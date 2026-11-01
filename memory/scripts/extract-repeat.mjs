// 추출 재현율 측정: 고정 입력(벤치 run.json 의 턴 1~12 사용자 발화+캐릭터 응답)을 stair 와 같이 6턴 묶음 2회로 N번 추출해
// 사용자 사실 재현율, 캐릭터 약속 수, 항목 길이, 비용의 런 간 편차를 본다. 실제 모델 호출(회당 ≈0.5원).
// 사용: node scripts/extract-repeat.mjs <input.json> [N=5]   input: {turns:[{turn,user,reply}]} (scratchpad/kang-fold-input.json 참고)
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const memory = await import(`${ROOT}/memory/index.js`);
const model = await import(`${ROOT}/model/index.js`);
const { estimateTokens } = await import(`${ROOT}/memory/tokens.js`);
const [inputPath, nArg] = process.argv.slice(2);
const N = Number(nArg ?? 5);
const input = JSON.parse(readFileSync(resolve(ROOT, inputPath), 'utf8'));
// kang-40 턴 1~12 에 심은 사용자 정보(정답 키워드). 하나라도 활성 항목 text 에 있으면 재현.
const EXPECT = input.expect ?? [
  ['디카페인'], ['콩이'], ['해산물'], ['자바'], ['컨퍼런스'], ['국밥'], ['커피'], ['코드 리뷰', '코드리뷰', '리뷰'], ['볼링'], ['정보처리기사', '시험'], ['헬스', '거북목'],
];
// 13턴 가족 정보는 입력에 턴 13 이 있을 때만(kang-fold-input 은 1~12턴). 입력 json 에 expect 를 넣어 덮어쓸 수 있다.
const runs = [];
for (let n = 0; n < N; n++) {
  const db = new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE conversations (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, character_id TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT);
  CREATE TABLE messages (id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, turn_no INTEGER NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL);`);
  memory.init({ db, model, policy: {} });
  const user_id = `rep-${n}`;
  const cid = Number(db.prepare('INSERT INTO conversations (user_id, character_id, started_at) VALUES (?,?,?)').run(user_id, 'kang', new Date().toISOString()).lastInsertRowid);
  const say = (t, role, text) => db.prepare('INSERT INTO messages (conversation_id, turn_no, role, text, created_at) VALUES (?,?,?,?,?)').run(cid, t, role, text, new Date().toISOString());
  for (const t of input.turns) { say(t.turn, 'user', t.user); say(t.turn, 'assistant', t.reply); }
  const attempts = [];
  for (const [from, to] of input.folds ?? [[1, 6], [7, 12]]) {
    const msgs = input.turns.filter((t) => t.turn >= from && t.turn <= to).flatMap((t) => [{ turn_no: t.turn, role: 'user', text: t.user }, { turn_no: t.turn, role: 'assistant', text: t.reply }]);
    const u = await memory.update({ user_id, conversation_id: cid, turn_no: to + 6, messages: msgs, force: true, reason: 'stair_evict' });
    attempts.push(...u.attempts);
  }
  const items = (await memory.list({ user_id, include_superseded: true })).items;
  const act = items.filter((i) => i.status === 'active');
  const text = act.map((i) => i.text).join('\n');
  const hit = EXPECT.map((ks) => ks.some((k) => text.includes(k)));
  const ex = attempts.filter((a) => a.tag === 'extract');
  const r = {
    items: act.length, recall: hit.filter(Boolean).length, missed: EXPECT.filter((_, i) => !hit[i]).map((ks) => ks[0]),
    family: act.filter((i) => /동생|누나|형|언니|오빠|엄마|아빠|가족/.test(i.text)).length,
    char_promises: act.filter((i) => i.type === 'promise' && /^캐릭터/.test(i.text)).length,
    user_promises: act.filter((i) => i.type === 'promise' && /^사용자/.test(i.text)).length,
    two_sentence: act.filter((i) => /[.。]\s+\S/.test(i.text)).length,
    avg_chars: +(act.reduce((s, i) => s + i.text.length, 0) / Math.max(1, act.length)).toFixed(1),
    block_tokens: act.reduce((s, i) => s + estimateTokens(`- 사실: ${i.text}${i.when ? ` (${i.when})` : ''}`) + 1, 0),
    when_abs: act.filter((i) => /^\d{4}-\d{2}-\d{2}/.test(i.when ?? '')).length, when_rel: act.filter((i) => i.when && !/^\d{4}-\d{2}-\d{2}/.test(i.when)).length,
    extract_calls: ex.length, truncated: ex.filter((a) => a.finish_reason === 'max_tokens').length, out_tokens: ex.reduce((s, a) => s + (a.output_tokens ?? 0), 0),
    krw: +attempts.reduce((s, a) => s + (a.cost_krw ?? 0), 0).toFixed(3),
  };
  runs.push(r);
  console.log(`[rep ${n + 1}] items=${r.items} recall=${r.recall}/${EXPECT.length} missed=${r.missed.join(',') || '-'} family=${r.family} charP=${r.char_promises} userP=${r.user_promises} 2sent=${r.two_sentence} avg_chars=${r.avg_chars} block_tok=${r.block_tokens} when=${r.when_abs}abs/${r.when_rel}rel calls=${r.extract_calls} trunc=${r.truncated} out=${r.out_tokens} krw=${r.krw}`);
  for (const i of act) console.log(`     ${i.type[0]} ${i.importance} ${i.text}${i.when ? ` (${i.when})` : ''}`);
}
const avg = (k) => (runs.reduce((s, r) => s + r[k], 0) / runs.length).toFixed(2);
const missedAll = {}; for (const r of runs) for (const m of r.missed) missedAll[m] = (missedAll[m] ?? 0) + 1;
console.log(`\n=== ${N}회 평균: items ${avg('items')}, recall ${avg('recall')}/${EXPECT.length}, charP ${avg('char_promises')}, userP ${avg('user_promises')}, 2sent ${avg('two_sentence')}, block_tok ${avg('block_tokens')}, trunc ${avg('truncated')}, krw ${avg('krw')}`);
console.log(`=== 누락 빈도: ${JSON.stringify(missedAll)}`);
