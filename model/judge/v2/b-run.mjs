// 판단 모델 v2 B단계: 고정된 대화(nc8 mem-1 녹화본)를 앱 stair(12/6) 흐름 그대로 memory.update 에 재생한다.
// 추출 모델은 환경변수 MODEL_EXTRACT 로만 바꾼다(MODEL_EMBED=off, MODEL_REASONING=off 는 실행 스크립트가 지정).
// 사용: MODEL_EXTRACT=<id> MODEL_EMBED=off node judge/v2/b-run.mjs --rep <n> [baekho naruto backend sejong]
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, '..', '..', '..');
const model = await import(`${ROOT}/model/index.js`);
const memory = await import(`${ROOT}/memory/index.js`);
const argv = process.argv.slice(2);
const REP = Number(argv.includes('--rep') ? argv[argv.indexOf('--rep') + 1] : 1);
const SCS = argv.filter((a, i) => !a.startsWith('--') && argv[i - 1] !== '--rep');
const MODEL = process.env.MODEL_EXTRACT;
if (!MODEL || process.env.MODEL_EMBED !== 'off') throw new Error('MODEL_EXTRACT 와 MODEL_EMBED=off 필요');
const NAME = MODEL.replace(/[^a-z0-9.]+/gi, '_');
const OUT = path.join(HERE, 'b-out');
fs.mkdirSync(OUT, { recursive: true });

const STAIR_MAX = 12, RECENT = 6;
for (const sc of SCS.length ? SCS : ['baekho', 'naruto', 'backend', 'sejong']) {
  const runDir = fs.readdirSync(path.join(ROOT, 'model', 'bench', 'out')).filter((d) => d.endsWith(`${sc}-40-nc8-mem-1`)).sort().at(-1);
  const src = JSON.parse(fs.readFileSync(path.join(ROOT, 'model', 'bench', 'out', runDir, 'run.json'), 'utf8'));
  const turns = src.turns.map((t) => ({ turn: t.turn, user: t.user, reply: t.reply ?? '' }));

  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE conversations (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, character_id TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT);
  CREATE TABLE messages (id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, turn_no INTEGER NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL);`);
  memory.init({ db, model, policy: {} });
  const user_id = `b-${NAME}-${sc}-${REP}`;
  const cid = Number(db.prepare('INSERT INTO conversations (user_id, character_id, started_at) VALUES (?,?,?)').run(user_id, sc, new Date().toISOString()).lastInsertRowid);
  const say = (t, role, text) => db.prepare('INSERT INTO messages (conversation_id, turn_no, role, text, created_at) VALUES (?,?,?,?,?)').run(cid, t, role, text, new Date().toISOString());

  const steps = [];
  const t0 = Date.now();
  let windowStart = 1;
  const msgsOf = (from, to) => turns.filter((t) => t.turn >= from && t.turn <= to).flatMap((t) => [{ turn_no: t.turn, role: 'user', text: t.user }, { turn_no: t.turn, role: 'assistant', text: t.reply }]);
  const run = async (kind, args) => {
    let r, error = null;
    try { r = kind === 'consolidate' ? await memory.consolidate(args) : await memory.update(args); } catch (e) { error = String(e?.message ?? e); r = { attempts: e?.attempts ?? [] }; }
    steps.push({ kind, reason: args.reason ?? null, turn_no: args.turn_no ?? 0, range: args.range ?? null, parsed_ok: r.parsed_ok ?? null, chunks: r.chunks ?? null, ops: (r.ops ?? []).length, error,
      attempts: (r.attempts ?? []).map((a) => ({ tag: a.tag, model: a.model, ok: a.ok, input_tokens: a.input_tokens, output_tokens: a.output_tokens, cache_read_tokens: a.cache_read_tokens, cache_write_tokens: a.cache_write_tokens, cost_krw: a.cost_krw, latency_ms: a.latency_ms, finish_reason: a.finish_reason, error: a.error, price_window: a.price_window })) });
  };
  for (const t of turns) {
    say(t.turn, 'user', t.user); say(t.turn, 'assistant', t.reply);
    if (t.turn - windowStart + 1 >= STAIR_MAX) { // 앱 stairFold 와 같은 조건: 창이 12턴이면 앞 6턴을 넘긴다
      const to = t.turn - RECENT;
      const { range, ...a } = { range: [windowStart, to], user_id, conversation_id: cid, lang: 'ko', turn_no: t.turn, messages: msgsOf(windowStart, to), force: true, reason: 'stair_evict' };
      await run('update', { ...a, range });
      windowStart = to + 1;
    }
  }
  const last = turns.at(-1).turn;
  await run('update', { range: [windowStart, last], user_id, conversation_id: cid, lang: 'ko', turn_no: last, messages: msgsOf(windowStart, last), force: true, reason: 'end_flush' });
  await run('consolidate', { user_id, conversation_id: cid, lang: 'ko' });
  const mem = await memory.list({ user_id, include_superseded: true, include_log: true });
  const all = steps.flatMap((s) => s.attempts);
  const out = {
    model_id: MODEL, scenario: sc, rep: REP, source_run: runDir, started_at: new Date(t0).toISOString(), wall_ms: Date.now() - t0,
    env: Object.fromEntries(Object.entries(process.env).filter(([k]) => /^(MODEL|MEMORY)_/.test(k))),
    cost_krw: all.reduce((s, a) => s + (a.cost_krw ?? 0), 0),
    cost_by_tag: all.reduce((o, a) => ({ ...o, [a.tag]: (o[a.tag] ?? 0) + (a.cost_krw ?? 0) }), {}),
    steps, memory: mem,
  };
  fs.writeFileSync(path.join(OUT, `${NAME}-${sc}-r${REP}.json`), JSON.stringify(out, null, 1));
  console.log(`${MODEL} ${sc} r${REP}: ${out.cost_krw.toFixed(2)}원, 단계 ${steps.length}, 파싱 실패 ${steps.filter((s) => s.parsed_ok === false).length}, 오류 ${steps.filter((s) => s.error).length}, 활성 ${mem.items.filter((i) => i.status === 'active').length}`);
}
