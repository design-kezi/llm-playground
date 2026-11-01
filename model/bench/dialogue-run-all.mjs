// 대화 모델 비교 본 실행(docs/50 사전 등록 2026-10-25). 조건 × 대본 × 회차를 큐로 만들어 레인 수만큼 동시에 돌린다(레인마다 포트가 다르다).
// 판단(추출) 모델은 모든 조건에서 gemma-4-31B 추론 끔으로 고정. 대화 모델만 바꾼다.
// 이미 끝난 런(out/<id>/run.json, label 일치)은 건너뛰므로 중간에 멈춰도 다시 실행하면 이어서 돈다.
// 사용: node bench/dialogue-run-all.mjs [--order scenario] [--lanes 3] [--reps 1] [--only cond1,cond2] [--scripts mem,revisit,situ] [--chars baekho,...] [--prefix dm] [--controls ctl-memoff] [--dry 1]
//   120턴: --scripts long --prefix lt1 --reps 2 --only haiku-off,haiku-on,deepseek-on,ctl-slide6-memoff,ctl-full-memoff
//   120턴 재측정: --scripts long --prefix lt2 --reps 2 --only v2-gemma,v2-dsx
//   오늘 날짜: --scripts date --prefix dt1 --reps 2 --only v2-dsx,v2-dsx-date · --scripts long --prefix lt3 --reps 2 --only v2-dsx-date
//   1차 선별: --chars baekho --scripts mem,situ --prefix dm1 --controls ctl-memoff
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const LANES = Number(opt('lanes', 3));
const REPS = Number(opt('reps', 1));
const only = opt('only') ? new Set(opt('only').split(',')) : null;
const kinds = new Set(opt('scripts', 'mem,revisit,situ').split(','));
const PREFIX = opt('prefix', 'dm');
const OUT = path.join(import.meta.dirname, 'out');

const MODELS = {
  haiku: 'claude-haiku-5-5', 'gpt5nano': 'gpt-5-nano', luna: 'gpt-6-luna', 'gem31': 'gemini-3.1-flash-lite', 'gem35': 'gemini-3.5-flash-lite',
  deepseek: 'deepseek-flash', gemma26: 'google/gemma-4-26B-A4B-it', qwen: 'Qwen/Qwen3-32B',
};
// 추론 켬은 출력 한도 2000(사전 점검: 300 에서 5개 모델이 잘리거나 빈 답, 1500 에서 최대 1,228토큰). 끔은 앱 기본 300.
// gem31-on 은 제외: 사전 점검에서 출력 토큰 비용만 턴당 약 2.2원(1원 상한 초과, 실측).
// 앱 기본값이 개선판(v2-dsx)으로 바뀌어(docs/50 2026-11-01) 이전 조건이 쓰던 값을 여기서 고정한다. V2 조건은 아래에서 덮어쓴다.
const FIXED = { MODEL_EXTRACT: 'google/gemma-4-31B-it', MODEL_REASONING_EXTRACT: 'off', MODEL_TIMEOUT_MS: '180000', APP_MEMORY_BUDGET: '1000', APP_RECALL: 'off', APP_REPLY_STYLE: 'v1', APP_DATE: 'off', APP_FOLLOW: 'off' };
const CONDS = {};
for (const [k, m] of Object.entries(MODELS)) {
  CONDS[`${k}-off`] = { MODEL_RESPONSE: m, MODEL_REASONING_RESPONSE: 'off', APP_MAX_TOKENS: '300' };
  if (k !== 'gem31') CONDS[`${k}-on`] = { MODEL_RESPONSE: m, MODEL_REASONING_RESPONSE: 'on', APP_MAX_TOKENS: '2000' };
}
// 대조군(기억 대본·재방문 대본만): 기억 끔 + stair / 기억 끔 + 대화 전체 전송. 대화 모델은 기준선 Haiku 끔.
const CONTROLS = {
  // ctl-memoff(기억 끔 + stair)는 잘못 정의한 대조군: 앱은 기억이 켜졌을 때만 stair 창을 정리해서, 기억을 끄면 창이 안 줄어 대화 전체 전송과 같아진다(1차 dm1 에서 발견, docs/50).
  'ctl-memoff': { MODEL_RESPONSE: 'claude-haiku-5-5', MODEL_REASONING_RESPONSE: 'off', APP_MAX_TOKENS: '300', APP_MEMORY: 'off' },
  // docs/30 §5.2 원래 대조군: 최근 6턴 + 기억 끔(하한선)
  'ctl-slide6-memoff': { MODEL_RESPONSE: 'claude-haiku-5-5', MODEL_REASONING_RESPONSE: 'off', APP_MAX_TOKENS: '300', APP_MEMORY: 'off', APP_WINDOW_MODE: 'slide', APP_RECENT_TURNS: '6' },
  'ctl-full-memoff': { MODEL_RESPONSE: 'claude-haiku-5-5', MODEL_REASONING_RESPONSE: 'off', APP_MAX_TOKENS: '300', APP_MEMORY: 'off', APP_WINDOW_MODE: 'full' },
};
// lt2(docs/50 2026-11-01 사전 등록): deepseek-on + 기억 예산 2000·질문 기준 보충·응답 규칙 v2·정리 비동기. 추출 모델만 다르다.
const V2 = { MODEL_RESPONSE: 'deepseek-flash', MODEL_REASONING_RESPONSE: 'on', APP_MAX_TOKENS: '2000', APP_MEMORY_BUDGET: '2000', APP_RECALL: 'on', APP_REPLY_STYLE: 'v2', APP_ASYNC_FOLD: 'on' };
CONDS['v2-gemma'] = V2;
CONDS['v2-dsx'] = { ...V2, MODEL_EXTRACT: 'deepseek-flash', MODEL_REASONING_EXTRACT: 'off' };
// 오늘 날짜 한 줄(docs/50 2026-11-01 사전 등록): v2-dsx + APP_DATE on
CONDS['v2-dsx-date'] = { ...CONDS['v2-dsx'], APP_DATE: 'on' };
// 문구 v2(docs/50 2026-11-01 두 번째 사전 등록): 날짜는 물을 때만 쓴다
CONDS['v2-dsx-date2'] = { ...CONDS['v2-dsx'], APP_DATE: 'v2' };
// 시간 표현이 있는 턴에만(docs/50 2026-11-01 세 번째 사전 등록)
CONDS['v2-dsx-dategate'] = { ...CONDS['v2-dsx'], APP_DATE: 'gate' };
// 사용자 말에 먼저 답하기 + 사용자 언어 따르기(docs/50 2026-11-01 사전 등록). 현재 기본값(dategate) + APP_FOLLOW on
CONDS['v2-dsx-follow'] = { ...CONDS['v2-dsx-dategate'], APP_FOLLOW: 'on' };
const CHARS = opt('chars', 'baekho,naruto,backend,sejong').split(',');
// long: 장면 기반 120턴 고정 대본(docs/50 2026-10-31 사전 등록). 기억 대본처럼 대조군도 돈다.
const SCRIPTS = { mem: (c) => `${c}-40`, revisit: (c) => `${c}-revisit-40`, situ: (c) => `${c}-situ-20`, long: (c) => `${c}-120`, date: (c) => `${c}-date-12`, follow: (c) => `${c}-follow-12`, close: (c) => `${c}-close-8`, long300: (c) => `${c}-long-300` }; // long300: 기억 재설계 비교 대본(docs/21 §6, 세션 5개·4번째는 다른 캐릭터)

const jobs = [];
for (let rep = 1; rep <= REPS; rep++) {
  const ctl = opt('controls') ? Object.fromEntries(Object.entries(CONTROLS).filter(([k]) => opt('controls').split(',').includes(k))) : CONTROLS;
  for (const [cond, env] of Object.entries({ ...CONDS, ...ctl })) {
    if (only && !only.has(cond)) continue;
    for (const [kind, f] of Object.entries(SCRIPTS)) {
      if (!kinds.has(kind) || (cond.startsWith('ctl-') && kind === 'situ')) continue;
      for (const c of CHARS) jobs.push({ cond, env: { ...FIXED, ...env }, scenario: f(c), label: `${PREFIX}-${cond}-r${rep}` });
    }
  }
}
const done = (j) => fs.readdirSync(OUT).some((d) => d.endsWith(`-${j.scenario}-${j.label}`) && fs.existsSync(path.join(OUT, d, 'run.json')));
const todo = jobs.filter((j) => !done(j));
// --order scenario: 대본 순으로 조건을 섞어 돌린다(조건마다 시간대·서버 부하가 고르게 퍼지도록, 2회차부터)
if (opt('order') === 'scenario') todo.sort((a, b) => a.scenario.localeCompare(b.scenario) || a.cond.localeCompare(b.cond));
console.log(`작업 ${jobs.length}개, 남은 것 ${todo.length}개, 레인 ${LANES}`);
if (opt('dry')) { for (const j of todo.slice(0, 5)) console.log(j.label, j.scenario, JSON.stringify(j.env)); process.exit(0); }

// --shared 1: 조건마다 서버 하나만 띄우고 그 조건의 런을 모두 동시에 돌린다(레인 수 무시, --max-jobs 로 상한).
// 대본에 세션(날짜)이 여럿이면 모든 런이 다음 세션에 도착할 때까지 기다렸다가 그 날짜로 서버를 다시 띄운다(run.mjs --shared 장벽).
// 런마다 서버를 띄우면 서버마다 임베딩 모델(약 2.3GB)을 올려 동시 2런이 한계였다 → 8런 약 58분(mb1). 사용자 지적 2026-11-01.
const log = fs.createWriteStream(path.join(OUT, `dialogue-run-all-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}.log`));
if (opt('shared')) {
  const { spawn: sp } = await import('node:child_process');
  const ROOTM = path.join(import.meta.dirname, '..'), APPD = path.join(ROOTM, '..', 'app');
  const port = Number(opt('port-base', 3201));
  const offsetDays = (d) => Math.round((Date.parse(d) - Date.parse(new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' }))) / 86400000);
  const busy = async () => { try { await fetch(`http://localhost:${port}/api/characters`); return true; } catch { return false; } };
  const startSrv = async (env) => {
    if (await busy()) throw new Error(`포트 ${port} 사용 중`);
    const c = sp(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-p', String(port)], { cwd: APPD, env: { ...process.env, ...env, BENCH_RUN_ID: `shared-${PREFIX}` }, detached: true, stdio: 'ignore' });
    for (let i = 0; i < 240; i++) { try { if ((await fetch(`http://localhost:${port}/api/characters`)).ok) return c; } catch {} await new Promise((r) => setTimeout(r, 250)); }
    throw new Error('서버 기동 시간 초과');
  };
  const stopSrv = async (c) => { if (!c) return; try { process.kill(-c.pid, 'SIGTERM'); } catch {} for (let i = 0; i < 80 && (await busy()); i++) await new Promise((r) => setTimeout(r, 250)); if (await busy()) try { process.kill(-c.pid, 'SIGKILL'); } catch {} };
  const groups = {};
  for (const j of todo) (groups[j.cond] ??= []).push(j);
  const MAXJ = Number(opt('max-jobs', 8));
  for (const [cond, all] of Object.entries(groups)) {
    for (let k = 0; k < all.length; k += MAXJ) {
      const batch = all.slice(k, k + MAXJ);
      const scs = batch.map((j) => JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'scenarios', `${j.scenario}.json`), 'utf8')));
      const dates = (sc) => (sc.sessions ?? [{ clock_date: sc.clock_date }]).map((x) => x.clock_date ?? sc.clock_date ?? null);
      const D = dates(scs[0]);
      if (scs.some((sc) => JSON.stringify(dates(sc)) !== JSON.stringify(D))) throw new Error(`${cond}: 대본마다 세션 날짜가 달라 한 서버로 못 돌림`);
      const dir = path.join(OUT, `shared-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${PREFIX}-${cond}`);
      fs.mkdirSync(dir, { recursive: true });
      const t0 = Date.now();
      const exited = new Set();
      const procs = batch.map((j, i) => new Promise((res) => {
        const a = ['bench/run.mjs', '--scenario', `bench/scenarios/${j.scenario}.json`, '--base', `http://localhost:${port}`, '--shared', dir, '--label', j.label, ...Object.entries(j.env).flatMap(([kk, v]) => ['--env', `${kk}=${v}`])];
        const p = sp(process.execPath, a, { cwd: ROOTM, stdio: ['ignore', 'pipe', 'pipe'] });
        let tail = '';
        p.stdout.on('data', (d) => { log.write(d); tail = (tail + d).slice(-400); });
        p.stderr.on('data', (d) => { log.write(d); tail = (tail + d).slice(-400); });
        p.on('close', (c) => { exited.add(i); console.log(`[shared] ${c ? 'FAIL' : 'ok  '} ${j.label} ${j.scenario} ${Math.round((Date.now() - t0) / 1000)}s${c ? ' ' + tail.split('\n').filter(Boolean).at(-1) : ''}`); res(c); });
      }));
      let srv = null;
      for (let si = 0; si < D.length; si++) {
        // 살아 있는 런이 모두 이 세션 앞에 도착할 때까지(끝난·실패한 런은 제외)
        while (true) {
          const ready = fs.readdirSync(dir).filter((f) => f.startsWith(`ready-${si}-`)).length;
          if (ready >= batch.length - exited.size && (ready > 0 || exited.size === batch.length)) break;
          await new Promise((r) => setTimeout(r, 300));
        }
        await stopSrv(srv);
        const env = { ...batch[0].env, ...(D[si] ? { APP_CLOCK_OFFSET_DAYS: String(offsetDays(D[si])) } : {}) };
        srv = await startSrv(env);
        fs.writeFileSync(path.join(dir, `go-${si}`), String(D[si]));
        console.log(`[shared] ${cond} 세션 ${si + 1}/${D.length} ${D[si] ?? ''} 시작 (${Math.round((Date.now() - t0) / 1000)}s)`);
      }
      await Promise.all(procs);
      await stopSrv(srv);
      console.log(`[shared] ${cond} 묶음 ${batch.length}런 ${Math.round((Date.now() - t0) / 1000)}s`);
    }
  }
  console.log('끝.');
  process.exit(0);
}
let next = 0;
async function lane(n) {
  const port = Number(opt('port-base', 3201)) + n; // 두 묶음을 동시에 돌리면 --port-base 를 다르게(포트 충돌 → 0초 실패)
  while (next < todo.length) {
    const j = todo[next++];
    const a = ['bench/run.mjs', '--scenario', `bench/scenarios/${j.scenario}.json`, '--port', String(port), '--label', j.label, ...Object.entries(j.env).flatMap(([k, v]) => ['--env', `${k}=${v}`])];
    const t0 = Date.now();
    const code = await new Promise((res) => {
      const p = spawn(process.execPath, a, { cwd: path.join(import.meta.dirname, '..'), stdio: ['ignore', 'pipe', 'pipe'] });
      let tail = '';
      p.stdout.on('data', (d) => { log.write(d); tail = (tail + d).slice(-400); });
      p.stderr.on('data', (d) => { log.write(d); tail = (tail + d).slice(-400); });
      p.on('close', (c) => { if (c) console.error(`  ✗ ${j.label} ${j.scenario}: ${tail.split('\n').filter(Boolean).at(-1)}`); res(c); });
    });
    console.log(`[lane ${n}] ${code ? 'FAIL' : 'ok  '} ${j.label} ${j.scenario} ${Math.round((Date.now() - t0) / 1000)}s (${next}/${todo.length})`);
  }
}
await Promise.all(Array.from({ length: LANES }, (_, n) => lane(n)));
console.log('끝. 남은 실패는 다시 실행하면 이어서 돈다.');
