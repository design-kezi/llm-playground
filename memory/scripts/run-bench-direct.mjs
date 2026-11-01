// 모델 세션의 벤치 대본(model/bench/scenarios/*.json)을 채팅앱 없이 memory/ + model/ 로 돌려 추출 비용·잘림·기억 정확도를 본다.
// 사용: node scripts/run-bench-direct.mjs <대본.json> [slide|stair]   (stair: 앱과 같이 창 12턴이 차면 오래된 6턴 묶음을 force 추출, 매 턴 update 없음. 마지막 6턴은 종료 요약에만 들어감)
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const memory = await import(`${ROOT}/memory/index.js`);
const model = await import(`${ROOT}/model/index.js`);
const [scriptPath, mode = 'slide'] = process.argv.slice(2);
const script = JSON.parse(readFileSync(resolve(ROOT, scriptPath), 'utf8'));
const character = JSON.parse(readFileSync(`${ROOT}/app/characters/${script.character_id}.json`, 'utf8'));
const RULES = `규칙:\n- 위 캐릭터의 성격·말투를 끝까지 유지한다.\n- 사용자의 말과 지금 상황에 맞게 반응한다.\n- 맞장구로 끝내지 말고 질문·제안·행동으로 대화를 이어갈 고리를 남긴다.\n- 사용자의 행동이나 감정을 단정하지 않는다.\n- '기억'에 없는 과거 일은 아는 척하지 않는다.\n- 2~4문장으로 짧게 답한다.`;
const RECENT = 6, STAIR = 6;

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE conversations (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, character_id TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT);
CREATE TABLE messages (id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, turn_no INTEGER NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL);`);
memory.init({ db, model, policy: {} });
const user_id = 'bench-' + script.id;
const cid = Number(db.prepare('INSERT INTO conversations (user_id, character_id, started_at) VALUES (?,?,?)').run(user_id, script.character_id, new Date().toISOString()).lastInsertRowid);
const say = (t, role, text) => db.prepare('INSERT INTO messages (conversation_id, turn_no, role, text, created_at) VALUES (?,?,?,?,?)').run(cid, t, role, text, new Date().toISOString());

const all = [], history = [], probes = [];
const push = (arr, turn, stage) => all.push(...arr.map((a) => ({ ...a, turn, stage })));
for (const t of script.turns) {
  const turn = t.turn;
  say(turn, 'user', t.user);
  const r = await memory.retrieve({ user_id, conversation_id: cid, query: t.user, budget_tokens: 400 });
  push(r.attempts, turn, 'retrieve');
  const system = [{ text: `${character.prompt}\n\n${RULES}`, cache: true }, ...(r.text ? [{ text: `\n\n기억:\n${r.text}` }] : [])];
  const res = await model.complete({ system, messages: [...history.slice(-RECENT * 2), { role: 'user', content: t.user }], max_tokens: 200, purpose: 'response', tag: 'response', conversation_id: cid, turn_no: turn });
  push(res.attempts, turn, 'response');
  const reply = res.text;
  say(turn, 'assistant', reply);
  history.push({ role: 'user', content: t.user, turn_no: turn }, { role: 'assistant', content: reply, turn_no: turn });
  let u = null;
  if (mode === 'slide') {
    const msgs = history.slice(-(RECENT + 1) * 2).map((m) => ({ turn_no: m.turn_no, role: m.role, text: m.content }));
    u = await memory.update({ user_id, conversation_id: cid, turn_no: turn, messages: msgs });
  } else if (turn % STAIR === 0 && turn >= STAIR * 2) {
    // 앱과 같은 뒤처진 묶음: 창 12턴이 차면 오래된 6턴(turn-11..turn-6)을 넘기고 최근 6턴은 남긴다
    const msgs = history.filter((m) => m.turn_no > turn - STAIR * 2 && m.turn_no <= turn - STAIR).map((m) => ({ turn_no: m.turn_no, role: m.role, text: m.content }));
    u = await memory.update({ user_id, conversation_id: cid, turn_no: turn, messages: msgs, force: true, reason: 'stair_evict' });
  }
  if (u) push(u.attempts ?? [], turn, 'update');
  const ex = (u?.attempts ?? []).filter((a) => a.tag === 'extract');
  const exInfo = ex.length ? ` extract×${ex.length} in=${ex.map((a) => a.input_tokens).join('/')} out=${ex.map((a) => a.output_tokens + (a.finish_reason === 'max_tokens' ? '!' : '')).join('/')}` : '';
  console.log(`[T${turn} ${t.kind}] ${t.user}\n    → ${reply.replace(/\n/g, ' ')}${r.deep_search ? `\n    deep: ${r.deep_search.method} hits=${r.deep_search.hits.length}` : ''}${u ? `\n    update: ${u.skipped ? 'skip' : `ops=${u.ops.length}${u.chunks > 1 ? ` chunks=${u.chunks}` : ''} parsed=${u.parsed_ok}`}${exInfo}` : ''}`);
  if (t.kind === 'probe') {
    const has = (arr) => (arr ?? []).filter((e) => reply.includes(e));
    const exp = t.expect ?? [];
    const okExpect = !exp.length ? null : t.expect_all ? exp.every((e) => reply.includes(e)) : exp.some((e) => reply.includes(e));
    const stale = has(t.stale), forbidden = [...has(t.forbidden), ...(t.forbidden_regex && new RegExp(t.forbidden_regex).test(reply) ? ['regex'] : [])];
    // 모델 세션 채점기와 같은 규칙: expect 가 잡히면 정답(옛 값을 함께 말해도 됨). 옛 값만 있고 새 값이 없을 때만 옛정보 오답. forbidden 은 항상 실패.
    const auto = okExpect === null ? (forbidden.length ? false : null) : okExpect && !forbidden.length;
    if (okExpect && stale.length) console.log(`    (옛 값 함께 언급: ${stale.join(',')} — AI 판정 단계에서 재확인 대상)`);
    probes.push({ turn, type: t.type, auto, stale, forbidden, judge_hint: t.judge_hint, reply });
    console.log(`    probe: ${auto === null ? 'JUDGE' : auto ? 'PASS' : 'FAIL'}${stale.length ? ' stale=' + stale.join(',') : ''}${forbidden.length ? ' forbidden=' + forbidden.join(',') : ''}  (블록 아이템 ${r.items.length}, 예산에서 밀린 ${r.dropped_item_ids.length})`);
    if (!auto && auto !== null) console.log('    블록:\n' + r.text.split('\n').map((l) => '      | ' + l).join('\n'));
  }
}
const c = await memory.consolidate({ user_id, conversation_id: cid });
push(c.attempts ?? [], 0, 'consolidate');
console.log(`[end] consolidate: ${c.skipped ?? `ops=${c.ops.length} parsed=${c.parsed_ok}`}`);
const mem = await memory.list({ user_id, include_superseded: true });
console.log('\n=== 기억 프로필', JSON.stringify(mem.profile));
for (const i of mem.items) console.log(`  [${i.status[0]}] ${i.type} t${i.source.turn_no}: ${i.text}${i.when ? ` (${i.when})` : ''}`);
console.log('=== 에피소드:', mem.episodes.map((e) => e.summary).join(' || '));

const agg = {};
for (const a of all) { const k = a.tag ?? a.stage; const g = (agg[k] ??= { calls: 0, in: 0, cr: 0, out: 0, krw: 0, trunc: 0, fail: 0 }); g.calls++; g.in += a.input_tokens ?? 0; g.cr += a.cache_read_tokens ?? 0; g.out += a.output_tokens ?? 0; g.krw += a.cost_krw ?? 0; if (a.finish_reason === 'max_tokens') g.trunc++; if (!a.ok) g.fail++; }
const n = script.turns.length, total = all.reduce((s, a) => s + (a.cost_krw ?? 0), 0);
console.log(`\n=== ${script.id} ${mode} 비용 (${n}턴)`);
for (const [k, g] of Object.entries(agg)) console.log(`  ${k}: calls=${g.calls} in=${g.in} cache_read=${g.cr} out=${g.out} trunc=${g.trunc} fail=${g.fail} krw=${g.krw.toFixed(2)} (${(g.krw / n).toFixed(3)}/턴)`);
console.log(`  합계 ${total.toFixed(2)}원 = ${(total / n).toFixed(3)}원/턴`);
const auto = probes.filter((p) => p.auto !== null);
console.log(`=== probe 자동판정 ${auto.filter((p) => p.auto).length}/${auto.length} PASS, 판사 필요 ${probes.length - auto.length}개`);
for (const p of probes.filter((p) => p.auto === false)) console.log(`  FAIL T${p.turn} ${p.type}: ${p.reply.slice(0, 100)}`);
mkdirSync(`${ROOT}/memory/scripts/out`, { recursive: true });
writeFileSync(`${ROOT}/memory/scripts/out/bench-${script.id}-${mode}.json`, JSON.stringify({ mode, probes, memory: mem, attempts: all }, null, 2));
