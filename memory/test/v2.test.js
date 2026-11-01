// v2(임베딩 기반 장기 기억, docs/21 §3·§5) 단위 테스트. 가짜 임베더(키워드 해시 + near 별칭)로 결정적.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, J } from './helpers.js';
import { createFakeEmbedder } from '../embed.js';
import { EXTRACT_SYSTEM } from '../prompts.js';

const V2 = (extra = {}) => ({ memoryMode: 'v2', ...extra });
const add = (text, extra = {}) => ({ op: 'ADD', type: 'fact', text, importance: 3, slot: 'user.other', entity: 'user', ...extra });

test('v2 저장: 항목 ADD 때 임베딩·모델 식별자가 저장되고, retrieve 가 이번 발화를 원문 색인에 넣는다', async () => {
  const emb = createFakeEmbedder();
  const app = setup({ responses: [J({ ops: [add('사용자는 우쿨렐레를 배우기 시작했다', { slot: 'user.hobby' })] })], policy: V2(), embedder: emb });
  const conv = app.startConv('u1');
  await app.turn('u1', conv, 1, '나 요즘 우쿨렐레 배우기 시작했어');
  const row = app.db.prepare("SELECT embedding, embed_model FROM memory_items WHERE user_id='u1'").get();
  assert.ok(row.embedding && row.embedding.length > 0); assert.equal(row.embed_model, 'fake:hash');
  const me = app.db.prepare('SELECT embed_model FROM memory_message_embeddings').all();
  assert.ok(me.length >= 1); assert.equal(me[0].embed_model, 'fake:hash');
  const l = await app.memory.list({ user_id: 'u1' });
  assert.equal(l.embed_model, 'fake:hash'); assert.equal(l.items[0].has_embedding, true);
});

test('v2 고정부: 예산이 남으면 모두 들어가고, 넘칠 때 이름·열린 약속 > 제약 > 중요도 4+ > 나머지 순으로 남는다. 같은 기억이면 바이트가 같다', async () => {
  const emb = createFakeEmbedder();
  const app = setup({ policy: V2({ recentPinTurns: 0 }), embedder: emb });
  const conv = app.startConv('u2');
  const st = app.memory._internal.store;
  st.addItem('u2', { type: 'fact', text: '사용자의 고양이 이름은 모모다', slot: 'pet.name', entity: 'pet#1', value: '모모' }, conv, 1);
  st.addItem('u2', { type: 'promise', text: '캐릭터는 사용자에게 덩크를 보여주기로 했다', slot: 'promise.promise', entity: 'promise#1' }, conv, 2);
  st.addItem('u2', { type: 'fact', text: '사용자는 땅콩 알레르기가 있다', slot: 'user.allergy', entity: 'user', importance: 3 }, conv, 3);
  st.addItem('u2', { type: 'preference', text: '사용자는 토트넘 팬이다', slot: 'user.like', entity: 'user', importance: 3 }, conv, 4);
  st.addItem('u2', { type: 'fact', text: '사용자는 왼손잡이다', slot: 'user.other', entity: 'user', importance: 4 }, conv, 5);
  app.say(conv, 30, 'user', '안녕');
  const r1 = await app.memory.retrieve({ user_id: 'u2', conversation_id: conv, query: '안녕', budget_tokens: 2000 });
  assert.equal(r1.mode, 'v2');
  assert.match(r1.text, /모모/); assert.match(r1.text, /덩크/); assert.match(r1.text, /땅콩/); assert.match(r1.text, /왼손/);
  assert.match(r1.text, /토트넘/, '예산이 남으면 일반 선호도 들어간다(암묵 질문의 근거)');
  assert.equal(r1.dropped_item_ids.length, 0);
  const r2 = await app.memory.retrieve({ user_id: 'u2', conversation_id: conv, query: '다른 질문', budget_tokens: 2000 });
  assert.equal(r1.text, r2.text, '질문이 달라도 고정부는 같다(캐시 접두사)');
  const small = await app.memory.retrieve({ user_id: 'u2', conversation_id: conv, query: '안녕', budget_tokens: 80 });
  assert.match(small.text, /모모/); assert.match(small.text, /덩크/);
  assert.doesNotMatch(small.text, /토트넘/, '넘치면 일반 선호가 먼저 빠진다');
  assert.ok(small.dropped_item_ids.length >= 1);
  st.addItem('u2', { type: 'preference', text: '사용자는 높은 곳을 무서워한다', slot: 'user.fear_of_heights', entity: 'user', importance: 3 }, conv, 6);
  const small2 = await app.memory.retrieve({ user_id: 'u2', conversation_id: conv, query: '안녕', budget_tokens: 145 });
  assert.match(small2.text, /무서워한다/, '핀이 아닌 항목은 남은 예산을 중요도·최근순으로 채운다(제약 핀 확장은 사용자 결정으로 안 함)');
  assert.doesNotMatch(small2.text, /토트넘/, '같은 중요도면 최근 것이 먼저');
});

test('v2 보충: 글자가 안 겹쳐도 가까운 항목(의미 유사)을 고르고, 블록에 있는 것은 빼고, 무관한 것은 임계값에서 걸린다', async () => {
  const emb = createFakeEmbedder({ near: [['손가락 굳은살 생긴 거 봐', '사용자는 기타를 배우기 시작했다']] });
  const app = setup({ policy: V2(), embedder: emb });
  const conv = app.startConv('u3');
  const st = app.memory._internal.store;
  st.addItem('u3', { type: 'fact', text: '사용자는 기타를 배우기 시작했다', slot: 'user.hobby', entity: 'user' }, conv, 1);
  st.addItem('u3', { type: 'preference', text: '사용자는 평양냉면을 제일 좋아한다', slot: 'user.like', entity: 'user' }, conv, 2);
  app.say(conv, 20, 'user', '손가락 굳은살 생긴 거 봐');
  await app.memory.retrieve({ user_id: 'u3', conversation_id: conv, query: '손가락 굳은살 생긴 거 봐', budget_tokens: 800 });
  const r = await app.memory.recall({ user_id: 'u3', conversation_id: conv, query: '손가락 굳은살 생긴 거 봐', block_text: '' });
  assert.equal(r.items.length, 1); assert.match(r.text, /기타/); assert.doesNotMatch(r.text, /평양냉면/);
  const r2 = await app.memory.recall({ user_id: 'u3', conversation_id: conv, query: '손가락 굳은살 생긴 거 봐', block_text: '- 사실: 사용자는 기타를 배우기 시작했다' });
  assert.equal(r2.items.length, 0, '블록에 있으면 다시 고르지 않는다');
  const r3 = await app.memory.recall({ user_id: 'u3', conversation_id: conv, query: '오늘 날씨 어때', block_text: '' });
  assert.equal(r3.items.length, 0);
  const log = (await app.memory.list({ user_id: 'u3', include_log: true })).ops_log.filter((o) => o.op === 'RECALL');
  assert.equal(log.length, 1); assert.equal(JSON.parse(log[0].detail).mode, 'v2');
});

test('v2 보관 되살리기: 상한을 넘어 보관된 항목이 보충에 걸리면 활성으로 돌아오고 UNARCHIVE 가 남는다', async () => {
  const emb = createFakeEmbedder({ near: [['토트넘 경기 봤어?', '사용자는 토트넘 팬이다']] });
  const app = setup({ policy: V2({ maxActiveItems: 3 }), embedder: emb, responses: [J({ ops: [
    add('사용자는 토트넘 팬이다', { importance: 2, slot: 'user.like' }), add('사용자는 왼손잡이다', { importance: 3 }), add('사용자는 자전거로 등교한다', { importance: 3, slot: 'user.routine' }),
    add('사용자는 붕어빵을 좋아한다', { importance: 3, slot: 'user.like' }), add('사용자는 매운 것을 잘 먹는다', { importance: 3, slot: 'user.like' }),
  ] })] });
  const conv = app.startConv('u4');
  await app.turn('u4', conv, 1, '나 토트넘 팬이고 왼손잡이야. 자전거로 등교하고 붕어빵 좋아하고 매운 거 잘 먹어');
  const archived = app.db.prepare("SELECT text FROM memory_items WHERE user_id='u4' AND status='archived'").all().map((r) => r.text);
  assert.equal(archived.length, 2); assert.ok(archived.includes('사용자는 토트넘 팬이다'), '중요도 2 가 먼저 보관');
  app.say(conv, 40, 'user', '토트넘 경기 봤어?');
  const r = await app.memory.recall({ user_id: 'u4', conversation_id: conv, query: '토트넘 경기 봤어?', block_text: '' });
  assert.ok(r.items.some((i) => /토트넘/.test(i.text)));
  assert.equal(app.db.prepare("SELECT status FROM memory_items WHERE text='사용자는 토트넘 팬이다'").get().status, 'active');
  const log = (await app.memory.list({ user_id: 'u4', include_log: true })).ops_log.filter((o) => o.op === 'UNARCHIVE');
  assert.equal(log.length, 1);
});

test('v2 추출 입력: 최근순 상한 밖의 오래된 항목과 보관 항목도 새 턴과 가까우면 후보에 들고, 상한을 넘지 않는다', async () => {
  const emb = createFakeEmbedder({ near: [['고양이 이름 두부로 바꿨어', '사용자의 고양이 이름은 모모다']] });
  const app = setup({ policy: V2({ extractItemsMax: 25 }), embedder: emb });
  const conv = app.startConv('u5');
  const st = app.memory._internal.store;
  const oldId = st.addItem('u5', { type: 'fact', text: '사용자의 고양이 이름은 모모다', slot: 'pet.name_old', entity: 'pet#1' }, conv, 1); // 이름 슬롯 고정에서 빼려고 라벨을 다르게
  for (let k = 0; k < 40; k++) st.addItem('u5', { type: 'fact', text: `사용자는 사실 ${k} 를 말했다`, slot: 'user.other', entity: 'user' }, conv, 2 + k);
  const archId = st.addItem('u5', { type: 'fact', text: '사용자는 보관된 고양이 사료를 산다', slot: 'pet.food', entity: 'pet#1' }, conv, 50);
  st.archive([archId], 'u5');
  await app.memory._internal.reindex('u5', conv, [], 100);
  const items = await app.memory._internal.candidateItems('u5', null, [{ role: 'user', text: '고양이 이름 두부로 바꿨어' }], conv, 60, []);
  assert.ok(items.some((i) => i.id === oldId), '오래된 정정 대상이 들어온다');
  assert.ok(items.some((i) => i.id === archId), '같은 entity 의 보관 항목도 들어온다');
  assert.ok(items.length <= 25);
});

test('v2 정정: UPDATE 대상이 보관 항목이면 되살린 뒤 superseded 로 바뀐다', async () => {
  const emb = createFakeEmbedder();
  const app = setup({ policy: V2(), embedder: emb, responses: [] });
  const conv = app.startConv('u6');
  const st = app.memory._internal.store;
  const id = st.addItem('u6', { type: 'fact', text: '사용자의 고양이 이름은 모모다', slot: 'pet.name', entity: 'pet#1', value: '모모' }, conv, 1);
  st.archive([id], 'u6');
  app.model.calls.length = 0;
  app.db.prepare("DELETE FROM memory_items WHERE 0").run();
  const responses = [J({ ops: [{ op: 'UPDATE', item_id: id, type: 'fact', slot: 'pet.name', entity: 'pet#1', value: '두부', text: '사용자의 고양이 이름은 두부다', importance: 3 }] })];
  app.model.complete = async () => ({ text: responses.shift(), attempts: [{ model: 'fake', ok: true, input_tokens: 0, output_tokens: 0, cost_krw: 0 }] });
  await app.turn('u6', conv, 20, '고양이 이름 두부로 바꿨어');
  const old = st.getItem(id); assert.equal(old.status, 'superseded'); assert.ok(old.superseded_by);
  assert.equal(st.getItem(old.superseded_by).text, '사용자의 고양이 이름은 두부다');
  const log = (await app.memory.list({ user_id: 'u6', include_log: true })).ops_log.filter((o) => o.op === 'UNARCHIVE');
  assert.equal(log.length, 1);
});

test('v2 원문 발췌: 상한 없이 전체 이력에서 가까운 옛 발화를 찾고, 활성·대체 항목의 출처 턴은 빼며 보관 출처는 허용한다', async () => {
  const emb = createFakeEmbedder({ near: [['어릴 때 피아노 콩쿠르 얘기 기억나?', '나 어릴 때 피아노 콩쿠르 나갔어']] });
  const app = setup({ policy: V2(), embedder: emb });
  const old = app.startConv('u7');
  app.say(old, 1, 'user', '나 어릴 때 피아노 콩쿠르 나갔어');
  for (let t = 2; t <= 300; t++) app.say(old, t, 'user', `잡담 ${t}`);
  const cur = app.startConv('u7');
  app.say(cur, 1, 'user', '어릴 때 피아노 콩쿠르 얘기 기억나?');
  await app.memory._internal.reindex('u7', cur, [], 1000);
  const r = await app.memory.recall({ user_id: 'u7', conversation_id: cur, query: '어릴 때 피아노 콩쿠르 얘기 기억나?', block_text: '' });
  assert.ok(r.excerpts.some((x) => /피아노/.test(x.text)), '300턴 전 원문을 찾는다');
  // 그 발화가 활성 항목의 출처가 되면 발췌에서 빠진다(현재값은 항목에 있다)
  const st = app.memory._internal.store;
  const id = st.addItem('u7', { type: 'fact', text: '사용자는 어릴 때 피아노 콩쿠르에 나갔다', slot: 'user.other', entity: 'user' }, old, 1);
  const r2 = await app.memory.recall({ user_id: 'u7', conversation_id: cur, query: '어릴 때 피아노 콩쿠르 얘기 기억나?', block_text: '- 사실: 사용자는 어릴 때 피아노 콩쿠르에 나갔다' });
  assert.ok(!r2.excerpts.some((x) => /피아노/.test(x.text)));
  st.archive([id], 'u7');
  const r3 = await app.memory.recall({ user_id: 'u7', conversation_id: cur, query: '어릴 때 피아노 콩쿠르 얘기 기억나?', block_text: '' });
  assert.ok(r3.items.some((i) => /피아노/.test(i.text)) || r3.excerpts.some((x) => /피아노/.test(x.text)), '보관되면 항목 되살리기 또는 원문으로 돌아온다');
});

test('v2 날짜 범위: "지난달" 같은 시점 표현이 있으면 그 기간의 기록을 먼저 고른다', async () => {
  const emb = createFakeEmbedder({ near: [['지난달에 내가 나간 대회 결과 기억나?', '사용자는 영어 말하기 대회에서 3등 했다', '사용자는 합창 대회에서 2등 했다']] });
  const app = setup({ policy: V2(), embedder: emb });
  const conv = app.startConv('u8', '2026-12-29T10:00:00.000Z');
  const st = app.memory._internal.store;
  const a = st.addItem('u8', { type: 'fact', text: '사용자는 합창 대회에서 2등 했다', slot: 'user.other', entity: 'user' }, conv, 1);
  const b = st.addItem('u8', { type: 'fact', text: '사용자는 영어 말하기 대회에서 3등 했다', slot: 'user.other', entity: 'user' }, conv, 2);
  app.db.prepare('UPDATE memory_items SET created_at=? WHERE id=?').run('2026-10-20T10:00:00.000Z', a);
  app.db.prepare('UPDATE memory_items SET created_at=? WHERE id=?').run('2026-11-07T10:00:00.000Z', b);
  app.say(conv, 10, 'user', '지난달에 내가 나간 대회 결과 기억나?', { created_at: '2026-12-29T10:00:00.000Z' });
  await app.memory._internal.reindex('u8', conv, [], 100);
  const r = await app.memory.recall({ user_id: 'u8', conversation_id: conv, query: '지난달에 내가 나간 대회 결과 기억나?', block_text: '' });
  assert.deepEqual(r.range, ['2026-11-01', '2026-11-30']);
  assert.equal(r.items.length, 1); assert.match(r.items[0].text, /영어/);
});

test('v2 기억 범위: 캐릭터 약속·사건은 그 캐릭터에게만, 사용자 사실은 모든 캐릭터에게. 기존 행은 대화의 캐릭터로 채워진다', async () => {
  const emb = createFakeEmbedder();
  const app = setup({ policy: V2(), embedder: emb, responses: [J({ ops: [
    { op: 'ADD', type: 'promise', who: 'character', slot: 'promise.promise', entity: 'promise#1', text: '덩크를 보여주기로 했다', importance: 3 },
    add('사용자는 땅콩 알레르기가 있다', { slot: 'user.allergy', importance: 4 }),
  ] })] });
  const conv = app.startConv('u9');
  app.say(conv, 1, 'user', '덩크 보여줘! 그리고 나 땅콩 알레르기 있어');
  await app.memory.retrieve({ user_id: 'u9', conversation_id: conv, query: '덩크 보여줘! 그리고 나 땅콩 알레르기 있어', character_id: 'baekho' });
  app.say(conv, 1, 'assistant', '(답)');
  await app.memory.update({ user_id: 'u9', conversation_id: conv, turn_no: 1, character_id: 'baekho', messages: [{ role: 'user', text: '덩크 보여줘! 그리고 나 땅콩 알레르기 있어' }, { role: 'assistant', text: '(답)' }] });
  const rows = app.db.prepare("SELECT type, character_id FROM memory_items WHERE user_id='u9' ORDER BY id").all().map((r) => ({ type: r.type, character_id: r.character_id }));
  assert.deepEqual(rows, [{ type: 'promise', character_id: 'baekho' }, { type: 'fact', character_id: null }]);
  const conv2 = app.startConv('u9'); app.say(conv2, 1, 'user', '안녕');
  const forNaruto = await app.memory.retrieve({ user_id: 'u9', conversation_id: conv2, query: '안녕', character_id: 'naruto' });
  assert.match(forNaruto.text, /땅콩/); assert.doesNotMatch(forNaruto.text, /덩크/);
  const forBaekho = await app.memory.retrieve({ user_id: 'u9', conversation_id: conv2, query: '안녕', character_id: 'baekho' });
  assert.match(forBaekho.text, /덩크/);
  const all = await app.memory.list({ user_id: 'u9' }); assert.equal(all.items.length, 2);
  const only = await app.memory.list({ user_id: 'u9', character_id: 'naruto' }); assert.equal(only.items.length, 1);
  // 마이그레이션: character_id 없는 옛 약속 행은 conversations.character_id 로 채워진다(멱등)
  app.db.prepare("UPDATE memory_items SET character_id=NULL WHERE type='promise'").run();
  app.db.prepare("UPDATE conversations SET character_id='sejong' WHERE id=?").run(conv);
  const { migrate } = await import('../schema.js'); migrate(app.db); migrate(app.db);
  assert.equal(app.db.prepare("SELECT character_id FROM memory_items WHERE type='promise'").get().character_id, 'sejong');
});

test('v2 반쪽 발화 규칙과 자유 라벨: 프롬프트에 규칙 13 이 있고, 고정 어휘 밖 라벨(sister.job)이 그대로 저장된다', async () => {
  assert.match(EXTRACT_SYSTEM, /내용을 밝히지 않은 고민/);
  assert.doesNotMatch(EXTRACT_SYSTEM, /정해진 목록 없음.*대상 user\|pet/);
  const emb = createFakeEmbedder();
  const app = setup({ policy: V2(), embedder: emb, responses: [J({ ops: [{ op: 'ADD', type: 'fact', slot: 'Sister.Job', entity: 'sister#1', text: '사용자의 언니는 간호사다', importance: 3 }] })] });
  const conv = app.startConv('u10');
  await app.turn('u10', conv, 1, '우리 언니는 간호사야');
  assert.equal(app.db.prepare("SELECT slot FROM memory_items WHERE user_id='u10'").get().slot, 'sister.job');
});

test('v2 폴백: 임베더가 없으면(MEMORY_EMBED=off) v1 경로로 동작한다', async () => {
  const app = setup({ policy: V2({ embedProvider: 'off' }), responses: [J({ ops: [add('사용자는 우쿨렐레를 배운다', { slot: 'user.hobby' })] })] });
  const conv = app.startConv('u11');
  const r = await app.turn('u11', conv, 1, '나 요즘 우쿨렐레 배우기 시작했어');
  assert.equal(r.retrieve.mode, undefined);
  const r2 = await app.memory.retrieve({ user_id: 'u11', conversation_id: conv, query: '안녕', budget_tokens: 400 });
  assert.match(r2.text, /우쿨렐레/, 'v1 은 활성 항목을 전부 주입');
});

// ---- mb1 측정(2026-11-01) 뒤 결함 수정 4건
const okAttempt = () => ({ model: 'fake', ok: true, input_tokens: 0, output_tokens: 0, cost_krw: 0 });

test('v2 범위 차단: 다른 캐릭터의 약속은 같은 slot·entity 라도 UPDATE 대상이 아니고, 새 약속은 현재 캐릭터로 저장된다', async () => {
  const app = setup({ policy: V2(), embedder: createFakeEmbedder(), responses: [] });
  const st = app.memory._internal.store;
  const convA = app.startConv('u12'); // character yuna
  const a = st.addItem('u12', { type: 'promise', text: '캐릭터는 사용자에게 붕어빵을 사 주기로 했다', slot: 'character.promise', entity: 'character', character_id: 'yuna' }, convA, 1);
  const convB = Number(app.db.prepare("INSERT INTO conversations (user_id, character_id, started_at) VALUES ('u12','sejong','2026-11-01T10:00:00.000Z')").run().lastInsertRowid);
  const responses = [J({ ops: [{ op: 'ADD', type: 'promise', who: 'character', slot: 'character.promise', entity: 'character', text: '캐릭터는 사용자에게 붓글씨를 가르쳐 주기로 했다', importance: 3 }] })];
  app.model.complete = async () => ({ text: responses.shift(), attempts: [okAttempt()] });
  app.say(convB, 20, 'user', '다음에 저한테 붓글씨 가르쳐 주실 수 있어요?'); app.say(convB, 20, 'assistant', '그러지요.');
  const u = await app.memory.update({ user_id: 'u12', character_id: 'sejong', conversation_id: convB, turn_no: 20, messages: [{ role: 'user', text: '다음에 저한테 붓글씨 가르쳐 주실 수 있어요?' }, { role: 'assistant', text: '그러지요.' }] });
  assert.equal(st.getItem(a).status, 'active', '다른 캐릭터의 약속은 그대로');
  const nw = st.activeItems('u12', 'sejong').find((i) => /붓글씨/.test(i.text));
  assert.ok(nw, `새 약속이 저장된다 ${JSON.stringify(u.applied)}`); assert.equal(nw.character_id, 'sejong');
  assert.ok(!st.activeItems('u12', 'yuna').some((i) => /붓글씨/.test(i.text)), '원래 캐릭터에게는 보이지 않는다');
});

test('v2 정정: 단일값 목록 밖의 자유 라벨(user.allowance)이라도 id 를 지정한 UPDATE 는 옛 값을 대체한다', async () => {
  const app = setup({ policy: V2(), embedder: createFakeEmbedder(), responses: [] });
  const conv = app.startConv('u13'); const st = app.memory._internal.store;
  const id = st.addItem('u13', { type: 'fact', text: '사용자는 한 달에 용돈 다섯 냥을 받는다', slot: 'user.allowance', entity: 'user' }, conv, 1);
  const responses = [J({ ops: [{ op: 'UPDATE', item_id: id, type: 'fact', slot: 'user.allowance', entity: 'user', text: '사용자는 한 달에 용돈 일곱 냥을 받는다', importance: 3 }] })];
  app.model.complete = async () => ({ text: responses.shift(), attempts: [okAttempt()] });
  await app.turn('u13', conv, 20, '용돈 올랐어요! 다섯 냥에서 일곱 냥으로요.');
  assert.equal(st.getItem(id).status, 'superseded');
  const act = st.activeItems('u13').filter((i) => /용돈/.test(i.text));
  assert.equal(act.length, 1); assert.match(act[0].text, /일곱/);
  const log = (await app.memory.list({ user_id: 'u13', include_log: true })).ops_log;
  assert.ok(!log.some((o) => o.op === 'UPDATE_AS_ADD'));
  // id 없이 들어온 다중값 UPDATE 는 여전히 ADD 로 둔다(nc8)
  const h1 = st.addItem('u13', { type: 'preference', text: '사용자는 농구를 좋아한다', slot: 'user.hobby', entity: 'user' }, conv, 21);
  const r2 = [J({ ops: [{ op: 'UPDATE', type: 'preference', slot: 'user.hobby', entity: 'user', text: '사용자는 기타를 좋아한다', importance: 3 }] })];
  app.model.complete = async () => ({ text: r2.shift(), attempts: [okAttempt()] });
  await app.turn('u13', conv, 40, '요즘은 기타가 좋아');
  assert.equal(st.getItem(h1).status, 'active', 'id 없는 다중값 UPDATE 는 옛 값을 지우지 않는다');
});

test('v2 대체 사슬 검색: 옛 값으로 묻는 질문이 대체된 항목에 걸리면 최신 항목을 "(이전: …)" 와 함께 보충한다', async () => {
  const emb = createFakeEmbedder({ near: [['연말에 나 어디 가 있을 거라고 했지? 2주 동안', '사용자는 외할머니 댁에 2주 머문다']] });
  const app = setup({ policy: V2(), embedder: emb });
  const conv = app.startConv('u14'); const st = app.memory._internal.store;
  const vec = async (t) => (await emb.embed([t])).vectors[0];
  const old = st.addItem('u14', { type: 'event', text: '사용자는 외할머니 댁에 2주 머문다', slot: 'user.trip', entity: 'user', character_id: 'yuna', embedding: await vec('사용자는 외할머니 댁에 2주 머문다'), embed_model: emb.id }, conv, 1);
  const head = st.addItem('u14', { type: 'fact', text: '외할머니 댁 방문은 취소됐다', slot: 'user.trip', entity: 'user', character_id: 'yuna', embedding: await vec('외할머니 댁 방문은 취소됐다'), embed_model: emb.id }, conv, 2);
  st.supersede(old, head, 'u14', conv, 2);
  for (let t = 1; t <= 3; t++) app.say(conv, t, 'user', `잡담 ${t}`);
  const r = await app.memory.recall({ user_id: 'u14', character_id: 'yuna', conversation_id: conv, query: '연말에 나 어디 가 있을 거라고 했지? 2주 동안', block_text: '' });
  assert.ok(r.items.some((i) => i.id === head), `최신 항목이 보충에 든다: ${r.text}`);
  assert.match(r.text, /취소됐다 \(이전: 사용자는 외할머니 댁에 2주 머문다\)/);
  assert.ok(!r.items.some((i) => i.id === old), '대체된 항목 자체는 노출하지 않는다');
});

test('v2 되묻기 판별: 물음표 뒤 짧은 꼬리가 붙어도 되묻기로 보고, 새 정보가 이어지는 문장은 아니다', () => {
  const f = setup({ policy: V2(), embedder: createFakeEmbedder() }).memory._internal.isRecallQuestion;
  assert.equal(f('나 매주 뭐 배우러 다닌다고 했지? 아침에.'), true);
  assert.equal(f('내 고양이 이름 뭐라고 했지?'), true);
  assert.equal(f('나 매주 뭐 배우러 다닌다고 했지? 그리고 나 내일부터 피아노도 배워.'), false);
  assert.equal(f('나 수영 다녀. 토요일 아침에.'), false);
});

test('v2 발췌 출처: 옛 되묻기 질문은 발췌하지 않는다(정보 없음·미끼), 같은 뜻의 진술은 발췌한다', async () => {
  const emb = createFakeEmbedder({ near: [['수영 무슨 요일이라고 했지?', '나 매주 뭐 배우러 다닌다고 했지? 아침에.', '나 토요일 아침마다 수영 배우러 다녀']] });
  const app = setup({ policy: V2(), embedder: emb });
  const old = app.startConv('u15');
  app.say(old, 1, 'user', '나 매주 뭐 배우러 다닌다고 했지? 아침에.');
  app.say(old, 2, 'user', '나 토요일 아침마다 수영 배우러 다녀');
  for (let t = 3; t <= 40; t++) app.say(old, t, 'user', `잡담 ${t}`);
  const cur = app.startConv('u15'); app.say(cur, 1, 'user', '수영 무슨 요일이라고 했지?');
  await app.memory._internal.reindex('u15', cur, [], 1000);
  const r = await app.memory.recall({ user_id: 'u15', conversation_id: cur, query: '수영 무슨 요일이라고 했지?', block_text: '' });
  assert.ok(r.excerpts.some((x) => /토요일 아침마다/.test(x.text)), `진술은 발췌된다: ${r.text}`);
  assert.ok(!r.excerpts.some((x) => /다닌다고 했지/.test(x.text)), '되묻기 질문은 발췌되지 않는다');
});

test('v2 발췌 범위: 다른 캐릭터와의 대화에서 한 발화는 발췌하지 않고, 같은 캐릭터 대화의 발화는 발췌한다', async () => {
  const emb = createFakeEmbedder({ near: [['내가 나루토한테 뭐 가르쳐 달라고 했는지 알아?', '다음에 나한테 변신술 가르쳐 줄 수 있어? 우리 반 애들 놀려 주려고.', '나 요즘 저녁마다 자유투 연습해']] });
  const app = setup({ policy: V2(), embedder: emb });
  const mine = app.startConv('u16'); // yuna
  app.say(mine, 1, 'user', '나 요즘 저녁마다 자유투 연습해');
  for (let t = 2; t <= 30; t++) app.say(mine, t, 'user', `잡담 ${t}`);
  const other = Number(app.db.prepare("INSERT INTO conversations (user_id, character_id, started_at) VALUES ('u16','naruto','2026-12-01T10:00:00.000Z')").run().lastInsertRowid);
  app.say(other, 1, 'user', '다음에 나한테 변신술 가르쳐 줄 수 있어? 우리 반 애들 놀려 주려고.');
  for (let t = 2; t <= 30; t++) app.say(other, t, 'user', `수행 잡담 ${t}`);
  const cur = app.startConv('u16'); app.say(cur, 1, 'user', '내가 나루토한테 뭐 가르쳐 달라고 했는지 알아?');
  await app.memory._internal.reindex('u16', cur, [], 1000);
  const r = await app.memory.recall({ user_id: 'u16', character_id: 'yuna', conversation_id: cur, query: '내가 나루토한테 뭐 가르쳐 달라고 했는지 알아?', block_text: '' });
  assert.ok(!r.excerpts.some((x) => /변신술/.test(x.text)), `다른 캐릭터 대화의 발화는 발췌되지 않는다: ${r.text}`);
  assert.ok(r.excerpts.some((x) => /자유투/.test(x.text)), '같은 캐릭터 대화의 발화는 발췌된다');
  const r2 = await app.memory.recall({ user_id: 'u16', character_id: null, conversation_id: cur, query: '내가 나루토한테 뭐 가르쳐 달라고 했는지 알아?', block_text: '' });
  assert.ok(r2.excerpts.some((x) => /변신술/.test(x.text)), '캐릭터를 안 주면(v1 호환) 전체 이력');
});
