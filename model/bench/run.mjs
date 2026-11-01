// 벤치 실행기: 대본 하나를 채팅앱 HTTP API 로 한 턴씩 보내고 결과를 모은다. (docs/30-bench-design.md §3)
// 사용:
//   node bench/run.mjs --scenario bench/scenarios/yuna-40.json --env APP_WINDOW_MODE=stair [--env K=V ...] [--port 3101] [--label stair]
//   node bench/run.mjs --scenario ... --base http://localhost:3000     (이미 떠 있는 서버 사용, 조건 전환 없음)
//   추가: --language ko|zh-TW|ja|en  --sheet-lang ko|en  --gap <초> [--gap-at 12,18,24]  (턴 사이 대기: 캐시 만료 조건 측정용)
//         --allow-stale 1  (소스가 빌드보다 새로워도 진행 — 기본은 중단)
// --base 가 없으면 app/ 에서 next start 를 --port 로 띄우고 끝나면 내린다(조건별 환경변수 적용).
// --shared <dir> (dialogue-run-all --shared 가 붙임): 서버는 조율기가 하나만 띄운다. 세션마다 <dir>/ready-<세션>-<runId> 를 쓰고
//   <dir>/go-<세션> 이 생길 때까지 기다린다(조율기가 모든 런이 도착하면 그 세션 날짜로 서버를 다시 띄움). 런마다 서버를 띄우던 때는
//   서버마다 임베딩 모델(약 2.3GB)을 올려 동시 2런이 한계였다(docs/50 2026-11-01).
// 결과: bench/out/<run_id>/run.json  → 채점은 bench/score.mjs
import { spawn, execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { scoreRun } from './score.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const APP = path.join(ROOT, 'app');

const args = parseArgs(process.argv.slice(2));
const scenario = JSON.parse(fs.readFileSync(args.scenario, 'utf8'));
// 대본이 가정한 날짜(clock_date, 서울 기준)가 있으면 앱 시계를 그날로 맞춘다. 실행일에 따라 "이번 달 20일"이 과거가 되는 걸 막는다.
if (scenario.clock_date && args.env.APP_CLOCK_OFFSET_DAYS == null) {
  args.env.APP_CLOCK_OFFSET_DAYS = String(offsetDays(scenario.clock_date));
}
const runId = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${scenario.id}-${args.label ?? 'run'}`;
const userName = `bench-${runId}`;
const outDir = path.join(import.meta.dirname, 'out', runId);

// 실행 근거: 어떤 빌드·코드·설정으로 쟀는지. 소스가 빌드보다 새로우면 옛 코드로 재는 것이라 중단한다.
const provenance = collectProvenance();
if ((!args.base || args.shared) && provenance.stale_sources.length && !args['allow-stale']) {
  console.error('빌드가 소스보다 오래됨 — 채팅앱 빌드 후 다시 실행(또는 --allow-stale 1):', provenance.stale_sources.slice(0, 5));
  process.exit(1);
}
// 사전 호출: 같은 환경변수로 모델마다 1회. 키 만료·잔액 0 이면 시작하지 않는다.
if (!args.base || args.shared) {
  const pf = spawnSync(process.execPath, [path.join(import.meta.dirname, 'preflight.mjs')], { env: { ...process.env, ...args.env, BENCH_RUN_ID: runId }, encoding: 'utf8' });
  process.stdout.write(pf.stdout ?? '');
  if (pf.status !== 0) { console.error('사전 호출 실패 — 벤치 중단', pf.stderr?.slice(0, 300)); process.exit(1); }
  provenance.model = JSON.parse(pf.stdout.trim().split('\n').at(-1));
}

let server = null;
let base = args.base;
try {
  if (!base) {
    server = await startServer(args.port ?? 3101, args.env);
    base = `http://localhost:${args.port ?? 3101}`;
  }
  const result = await runScenario(base);
  const buildAfter = readBuildId();
  result.provenance = { ...provenance, build_id_after: buildAfter, build_changed_during_run: buildAfter !== provenance.build_id };
  if (result.provenance.build_changed_during_run) console.error('경고: 실행 중 빌드가 바뀜 — 이 결과는 쓰지 말 것');
  fs.mkdirSync(outDir, { recursive: true });
  result.score = scoreRun(scenario, result);
  // 공식 비교에 써도 되는 런인지: 실패 호출(임베딩 한도 초과 등)이나 빌드 변경이 있으면 결과가 다른 조건에서 나온 것이다
  const invalid = [
    ...(result.score.cost.failed_calls ? [`실패 호출 ${result.score.cost.failed_calls}건`] : []),
    ...(result.provenance.build_changed_during_run ? ['실행 중 빌드 변경'] : []),
    ...(result.aborted ? ['중단됨'] : []),
    // 임베딩이 막혀 키워드 검색으로 대신한 깊은 검색(기억저장: DEEP_SEARCH detail.method "keyword(embed failed)")
    ...((result.memory?.ops_log ?? []).some((o) => o.op === 'DEEP_SEARCH' && /embed failed/.test(o.detail ?? '')) ? ['임베딩 실패로 키워드 검색 대체'] : []),
  ];
  result.valid = { ok: invalid.length === 0, reasons: invalid };
  if (invalid.length) console.error('경고: 공식 비교 제외 —', invalid.join(', '));
  fs.writeFileSync(path.join(outDir, 'run.json'), JSON.stringify(result, null, 2));
  printSummary(result);
  if (result.ledger_check) console.log('원장 대조', JSON.stringify(result.ledger_check));
  console.log(`\n→ ${path.relative(ROOT, path.join(outDir, 'run.json'))}`);
} finally {
  if (server) await stopServer(server);
}

// 대본의 sessions(재방문 대본): 세션마다 새 대화를 열고 끝에 /end 로 닫는다. clock_date 가 바뀌면 그 날짜로 서버를 다시 띄운다.
// 세션에 character_id 가 있으면 그 세션만 다른 캐릭터와 대화한다(같은 사용자, 기억 범위 확인용 — docs/21 §6). 턴 기록에 character_id 를 남긴다.
// 앱의 turn_no·기억 기록의 turn_no 는 대화마다 1부터라 대본의 전역 턴 번호로 바꿔 저장한다(채점·판정이 전역 번호를 쓴다). 원래 값은 local_turn_no.
async function runScenario(base) {
  const sessions = scenario.sessions ?? [{ clock_date: scenario.clock_date, turns: [scenario.turns[0].turn, scenario.turns.at(-1).turn] }];
  if (sessions.length > 1 && args.base && !args.shared) throw new Error('재방문 대본은 날짜를 바꿔 서버를 다시 띄워야 해서 --base 와 같이 못 쓴다');
  const gapMs = Number(args.gap ?? 0) * 1000;
  const gapAt = args['gap-at'] ? new Set(args['gap-at'].split(',').map(Number)) : null;
  const turns = [], calls = [], reports = [], convs = [], ledger = [];
  const toGlobal = new Map(); // conversation_id → (앱 turn_no → 대본 턴)
  let aborted = false;
  for (const [si, s] of sessions.entries()) {
    if (args.shared) { // 조율기 장벽: 모든 런이 이 세션에 도착해야 그 날짜로 서버가 뜬다
      fs.writeFileSync(path.join(args.shared, `ready-${si}-${runId}`), '');
      while (!fs.existsSync(path.join(args.shared, `go-${si}`))) await new Promise((r) => setTimeout(r, 300));
    } else if (si > 0 && s.clock_date && s.clock_date !== sessions[si - 1].clock_date) {
      await stopServer(server);
      args.env.APP_CLOCK_OFFSET_DAYS = String(offsetDays(s.clock_date));
      server = await startServer(args.port ?? 3101, args.env);
    }
    const conv = await api(base, 'POST', '/api/conversations', { user_name: userName, character_id: s.character_id ?? scenario.character_id,
      ...(args.language ? { language: args.language } : {}), ...(args['sheet-lang'] ? { sheet_lang: args['sheet-lang'] } : {}) });
    const cid = conv.conversation_id;
    convs.push(cid);
    console.log(`[${runId}] session ${si + 1}/${sessions.length} conversation ${cid} user=${userName}${s.clock_date ? ` date=${s.clock_date}` : ''}`);
    const sTurns = scenario.turns.filter((t) => t.turn >= s.turns[0] && t.turn <= s.turns[1]);
    toGlobal.set(cid, new Map(sTurns.map((t, i) => [i + 1, t.turn])));
    for (const t of sTurns) {
      if (gapMs && t.turn > 1 && (!gapAt || gapAt.has(t.turn))) await new Promise((r) => setTimeout(r, gapMs));
      const t0 = Date.now();
      let reply = null, cost = null, error = null;
      try {
        const r = await api(base, 'POST', `/api/conversations/${cid}/messages`, { text: t.user });
        reply = r.reply;
        cost = r.turn_cost_krw;
      } catch (e) {
        error = e.message;
      }
      turns.push({ turn: t.turn, session: si + 1, character_id: s.character_id ?? scenario.character_id, kind: t.kind, user: t.user, reply, turn_cost_krw: cost, latency_ms: Date.now() - t0, error });
      // 런 도중 키가 죽는 경우(만료·잔액 소진): 연속 3턴 실패면 중단하고 결과를 '중단'으로 남긴다
      if (turns.slice(-3).length === 3 && turns.slice(-3).every((x) => x.error)) {
        console.error('연속 3턴 실패 — 벤치 중단');
        aborted = true;
        break;
      }
      const mark = t.kind === 'probe' ? '?' : ' ';
      console.log(`${mark}${String(t.turn).padStart(3)} ${(cost ?? 0).toFixed(3)}원 ${error ? 'ERR ' + error : oneLine(reply)}`);
    }
    reports.push(await api(base, 'POST', `/api/conversations/${cid}/end`));
    const map = toGlobal.get(cid);
    calls.push(...readCalls(cid).map((c) => ({ ...c, local_turn_no: c.turn_no, turn_no: c.turn_no === 0 ? 0 : (map.get(c.turn_no) ?? -c.turn_no), session: si + 1 })));
    const lc = ledgerCheck(cid);
    if (lc.ledger_check) ledger.push(lc);
    if (aborted) break;
  }
  const memory = await api(base, 'GET', `/api/memory?user=${encodeURIComponent(userName)}&include_superseded=1&include_log=1`);
  const glob = (cid, n) => (n == null || n === 0 ? n : toGlobal.get(cid)?.get(n) ?? n);
  for (const o of memory.ops_log ?? []) { o.local_turn_no = o.turn_no; o.turn_no = glob(o.conversation_id, o.turn_no); }
  for (const i of memory.items ?? []) if (i.source) { i.source.local_turn_no = i.source.turn_no; i.source.turn_no = glob(i.source.conversation_id, i.source.turn_no); }
  const ledgerOut = ledger.length ? {
    ledger: ledger.flatMap((l) => l.ledger),
    ledger_check: ledger.length === 1 ? ledger[0].ledger_check : { sessions: ledger.map((l) => l.ledger_check), match: ledger.every((l) => l.ledger_check.match) },
  } : {};
  return {
    run_id: runId, scenario: scenario.id, character_id: scenario.character_id, user_name: userName,
    conversation_id: convs[0], ...(convs.length > 1 ? { conversation_ids: convs, reports } : {}),
    label: args.label ?? null, env: redact(args.env), language: args.language ?? 'ko', sheet_lang: args['sheet-lang'] ?? 'ko',
    gap_s: Number(args.gap ?? 0), gap_at: args['gap-at'] ?? null, finished_at: new Date().toISOString(),
    aborted, turns, calls, report: reports.at(-1), memory, ...ledgerOut,
  };
}

function offsetDays(clockDate) {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  return Math.round((Date.parse(clockDate) - Date.parse(today)) / 86400000);
}

// 앱 DB 의 호출 기록과 모델 레이어 원장(제공사 원본 usage)을 맞춰 본다. 건수·합계가 다르면 어딘가에서 기록이 빠지거나 가공된 것.
function ledgerCheck(cid) {
  if (args.base) return {}; // 직접 띄운 서버가 아니면 BENCH_RUN_ID 가 안 붙어 원장을 고를 수 없다
  const dir = process.env.MODEL_LEDGER_DIR ?? path.join(import.meta.dirname, '..', 'ledger');
  const rows = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
    .flatMap((f) => fs.readFileSync(path.join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)))
    .filter((r) => r.run === runId && r.conversation_id === cid) : [];
  const calls = readCalls(cid);
  const db = calls.reduce((s, c) => s + c.cost_krw, 0);
  const led = rows.reduce((s, r) => s + r.cost_krw, 0);
  return { ledger: rows, ledger_check: { db_calls: calls.length, ledger_calls: rows.length, db_krw: db, ledger_krw: led, match: calls.length === rows.length && Math.abs(db - led) < 1e-9 } };
}

// 호출별 기록은 리포트에 턴 단위로 안 나오므로 앱 DB 에서 직접 읽는다(읽기 전용).
function readCalls(cid) {
  const db = new DatabaseSync(path.join(APP, 'data', 'app.db'), { readOnly: true, timeout: 15000 }); // 다른 레인이 쓰는 중이면 기다린다(2차 dm2 에서 잠금 오류 4건)
  try {
    return db.prepare('SELECT turn_no, tag, model, ok, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, input_krw, output_krw, cost_krw, latency_ms, error FROM calls WHERE conversation_id=? ORDER BY id').all(cid);
  } finally {
    db.close();
  }
}

async function api(base, method, p, body) {
  const res = await fetch(base + p, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(180_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${p} → ${res.status} ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

async function startServer(port, env) {
  if (await portBusy(port)) throw new Error(`포트 ${port} 사용 중 — 다른 --port 를 쓰거나 기존 서버를 내리세요`);
  const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], {
    cwd: APP, env: { ...process.env, ...env, BENCH_RUN_ID: runId }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => (log += d));
  child.stderr.on('data', (d) => (log += d));
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) throw new Error(`서버 종료됨:\n${log}`);
    try {
      const r = await fetch(`http://localhost:${port}/api/characters`);
      if (r.ok) return child;
      if (r.status >= 500) throw new Error(`서버 설정 오류(${r.status}): ${(await r.text()).slice(0, 300)}`);
    } catch (e) {
      if (String(e.message).startsWith('서버 설정')) throw e;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`서버 기동 시간 초과:\n${log}`);
}

// next start 는 next-server 자식을 남기므로 프로세스 그룹째 내리고 포트가 빌 때까지 기다린다(§3.2).
async function stopServer(child) {
  try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  const port = Number(args.port ?? 3101);
  for (let i = 0; i < 40 && (await portBusy(port)); i++) await new Promise((r) => setTimeout(r, 250));
  if (await portBusy(port)) try { process.kill(-child.pid, 'SIGKILL'); } catch {}
}

async function portBusy(port) {
  try {
    await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(1000) });
    return true;
  } catch {
    return false;
  }
}

function printSummary(r) {
  const s = r.score;
  console.log('\n== 비용');
  console.log(`턴당 평균 ${s.cost.avg_krw.toFixed(3)}원 (종료 정리 포함 ${s.cost.avg_with_end_krw.toFixed(3)}원) / 최대 ${s.cost.max.krw.toFixed(3)}원 @${s.cost.max.turn}턴`);
  for (const [k, v] of Object.entries(s.cost.segments)) console.log(`  ${k.padEnd(5)} ${v.toFixed(3)}원`);
  console.log(`  호출별 ${Object.entries(s.cost.by_tag).map(([k, v]) => `${k} ${v.toFixed(2)}`).join(' / ')}원, 실패 호출 ${s.cost.failed_calls}`);
  console.log(`  캐시 적중률 ${(s.cost.cache_hit_rate * 100).toFixed(0)}%`);
  console.log('== 기억');
  console.log(`  점수 ${s.memory.points}/${s.memory.max_points}  정답 ${s.memory.counts.correct ?? 0}, 부분 ${s.memory.counts.partial ?? 0}, 모름 ${s.memory.counts.unknown ?? 0}, 옛정보 ${s.memory.counts.stale ?? 0}, 지어냄 ${s.memory.counts.fabricated ?? 0}, 판정필요 ${s.memory.counts.needs_judge ?? 0}`);
  console.log('== 품질 규칙');
  console.log(`  ${Object.entries(s.quality.flags).map(([k, v]) => `${k} ${v}`).join(' / ')}`);
}

function oneLine(s) {
  return (s ?? '').replace(/\s+/g, ' ').slice(0, 70);
}

// 키 이름이 들어간 환경변수 값은 결과 파일에 남기지 않는다
function redact(env) {
  return Object.fromEntries(Object.entries(env ?? {}).map(([k, v]) => [k, /KEY|TOKEN|SECRET/i.test(k) ? '***' : v]));
}

function readBuildId() {
  try { return fs.readFileSync(path.join(APP, '.next', 'BUILD_ID'), 'utf8').trim(); } catch { return null; }
}

function collectProvenance() {
  const buildId = readBuildId();
  let buildMtime = 0;
  try { buildMtime = fs.statSync(path.join(APP, '.next', 'BUILD_ID')).mtimeMs; } catch {}
  // 앱 번들에 들어가는 소스(app/, memory/). model/ 은 번들하지 않고 런타임 import 라 빌드와 무관.
  const stale = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.next', 'data', 'test', 'out'].includes(e.name) || e.name.startsWith('.')) continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(m?js|jsx|tsx?|json|css)$/.test(e.name) && fs.statSync(p).mtimeMs > buildMtime) stale.push(path.relative(ROOT, p));
    }
  };
  walk(APP); walk(path.join(ROOT, 'memory'));
  const git = (...a) => { try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return null; } };
  return {
    build_id: buildId, build_time: buildMtime ? new Date(buildMtime).toISOString() : null, stale_sources: stale,
    git_head: git('rev-parse', '--short', 'HEAD'), git_dirty_files: (git('status', '--porcelain') ?? '').split('\n').filter(Boolean).length,
    git_status_sha: createHash('sha256').update(git('status', '--porcelain') ?? '').digest('hex').slice(0, 12),
    started_at: new Date().toISOString(),
  };
}

function parseArgs(argv) {
  const out = { env: {} };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i].replace(/^--/, '');
    const v = argv[++i];
    if (k === 'env') {
      const [ek, ...rest] = v.split('=');
      out.env[ek] = rest.join('=');
    } else out[k] = v;
  }
  if (!out.scenario) throw new Error('--scenario 필요');
  return out;
}
