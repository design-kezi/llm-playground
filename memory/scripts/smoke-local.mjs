// 실제 로컬 임베더(bge-m3 int8)로 v2 경로 스모크: 기동, 턴당 retrieve+recall 지연, 보충 선택, 원문 발췌. 모델 호출(추출)은 가짜.
import { DatabaseSync } from 'node:sqlite';
import * as memory from '../index.js';
import { APP_SCHEMA } from '../test/helpers.js';
import { createFakeModel } from '../fake-model.js';
const db = new DatabaseSync(':memory:'); db.exec(APP_SCHEMA);
const model = createFakeModel({ withEmbed: false, responses: ['{"ops":[{"op":"ADD","type":"fact","slot":"user.hobby","entity":"user","text":"사용자는 기타를 배우기 시작했다","importance":3},{"op":"ADD","type":"fact","slot":"user.allergy","entity":"user","text":"사용자는 복숭아 알레르기가 있다","importance":4},{"op":"ADD","type":"preference","slot":"user.like","entity":"user","text":"사용자는 돈가스를 제일 좋아한다","importance":3}]}'] });
memory.init({ db, model, policy: { memoryMode: 'v2', embedProvider: 'local' } });
let t = performance.now(); const e = await memory._internal.ensureEmbedder(); await e.ready(); console.log('embedder', e.id, 'load', Math.round(performance.now() - t), 'ms');
db.prepare("INSERT INTO conversations (user_id, character_id, started_at) VALUES ('s','baekho','2026-11-02T10:00:00Z')").run();
const say = (turn, role, text) => db.prepare("INSERT INTO messages (conversation_id, turn_no, role, text, created_at) VALUES (1,?,?,?,'2026-11-02T10:00:00Z')").run(turn, role, text);
say(1, 'user', '나 요즘 기타 배우기 시작했어. 복숭아 알레르기 있고 돈가스 제일 좋아해'); say(1, 'assistant', '(답)');
t = performance.now();
const u = await memory.update({ user_id: 's', conversation_id: 1, turn_no: 1, character_id: 'baekho', messages: [{ role: 'user', text: '나 요즘 기타 배우기 시작했어. 복숭아 알레르기 있고 돈가스 제일 좋아해' }, { role: 'assistant', text: '(답)' }] });
console.log('update ops', u.ops.map((o) => o.op).join(','), Math.round(performance.now() - t), 'ms; embed attempts', u.attempts.filter((a) => a.tag === 'embed').map((a) => `${a.purpose ?? ''}:${a.cpu_ms}ms`).join(' '));
for (let k = 2; k <= 15; k++) { say(k, 'user', `잡담 ${k}`); say(k, 'assistant', '(답)'); }
for (const q of ['손가락 굳은살 생긴 거 봐, 요즘 뭘 연습해서 그런 걸까?', '편의점에 과일 컵 있다. 하나만 골라줘.', '배고프다 저녁 뭐 먹을까', '오늘 날씨 좋다']) {
  say(16, 'user', q);
  t = performance.now();
  const r = await memory.retrieve({ user_id: 's', conversation_id: 1, query: q, budget_tokens: 2000, character_id: 'baekho' });
  const rc = await memory.recall({ user_id: 's', conversation_id: 1, query: q, block_text: r.text, character_id: 'baekho' });
  console.log(`\nQ: ${q}\n  retrieve+recall ${Math.round(performance.now() - t)}ms | 고정부 ${r.items.map((i) => i.text.slice(4, 14)).join('/')} | 보충 ${rc.items.map((i) => i.text).join(' / ') || '-'} | 발췌 ${rc.excerpts.length}`);
  db.prepare("DELETE FROM messages WHERE turn_no=16").run();
}
console.log('\nRSS', Math.round(process.memoryUsage().rss / 1e6), 'MB');
