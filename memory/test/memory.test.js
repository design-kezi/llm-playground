import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setup, J } from './helpers.js';
import { updateGate, missSignal, keywords } from '../gate.js';
import { parseJson } from '../prompts.js';
import { DEFAULT_POLICY } from '../policy.js';

test('init 은 idempotent 하고 memory_ 테이블을 만든다', () => {
  const app = setup();
  app.memory.init({ db: app.db, model: app.model });
  const names = app.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'memory_%' ORDER BY name").all().map((r) => r.name);
  assert.deepEqual(names, ['memory_episodes', 'memory_items', 'memory_message_embeddings', 'memory_ops_log', 'memory_profile', 'memory_state']);
});

test('게이트: 짧은 말·잡담은 막고, 1인칭 정보·수정·약속은 통과', () => {
  const g = (t) => updateGate([{ role: 'user', text: t }], DEFAULT_POLICY);
  assert.equal(g('응 ㅋㅋ').pass, false);
  assert.equal(g('오늘 날씨 진짜 좋다 그치').pass, false);
  assert.equal(g('나는 매운 음식을 진짜 싫어해').pass, true);
  assert.ok(g('아니 사실은 나 이제 학생 아니고 회사 다녀').reasons.includes('correction'));
  assert.ok(g('결과 나오면 너한테 제일 먼저 알려줄게 약속').reasons.includes('promise'));
});

test('miss 신호와 키워드 추출', () => {
  assert.equal(missSignal('내가 전에 말했잖아 어디 산다고'), true);
  assert.equal(missSignal('기억 안 나?'), true);
  assert.equal(missSignal('오늘 뭐 먹을까'), false);
  assert.ok(keywords('나는 부산에서 살아').includes('부산'));
});

test('parseJson: 코드펜스·설명·후행 콤마 허용', () => {
  assert.deepEqual(parseJson('```json\n{"a":1,}\n```'), { a: 1 });
  assert.deepEqual(parseJson('결과입니다: {"ops":[]} 끝'), { ops: [] });
  assert.equal(parseJson('JSON 아님'), null);
});

test('ADD → retrieve 블록에 등장, 출처 턴 기록, 비용 attempts 반환', async () => {
  const app = setup({ responses: [J({ profile: { 이름: '민수', 직업: '대학생' }, ops: [{ op: 'ADD', type: 'preference', text: '사용자는 매운 음식을 싫어한다', importance: 3 }] })] });
  const conv = app.startConv('kezi');
  const t1 = await app.turn('kezi', conv, 1, '나는 민수고 대학생이야. 매운 음식은 진짜 싫어해');
  assert.equal(t1.retrieve.text, '');                       // 아직 기억 없음 → 블록 생략
  assert.equal(t1.update.ops.length, 3);                    // 프로필 2 + ADD 1
  assert.ok(t1.update.attempts.length >= 1 && t1.update.attempts[0].tag === 'extract');
  assert.ok(!t1.update.attempts.some((a) => a.tag === 'embed')); // 항목 임베딩은 기본 끔(indexItemEmbeddings:false — 읽는 곳이 없어 비용 0)

  const r = await app.memory.retrieve({ user_id: 'kezi', conversation_id: conv, query: '뭐 먹을까', budget_tokens: 400 });
  assert.match(r.text, /이름 민수, 직업 대학생/);
  assert.match(r.text, /선호: 사용자는 매운 음식을 싫어한다/);
  assert.equal(r.attempts.length, 0);                        // 평상시 retrieve 는 AI 호출 0
  const l = await app.memory.list({ user_id: 'kezi' });
  assert.equal(l.items[0].source.turn_no, 1);
});

test('게이트 미통과 + 주기 미도달이면 추출 호출 없음, 3턴 지나면 주기로 추출', async () => {
  const app = setup({ responses: [J({ profile: {}, ops: [] }), J({ profile: {}, ops: [] })] });
  const conv = app.startConv('a');
  const t1 = await app.turn('a', conv, 1, '안녕 반가워 오늘 날씨 좋네');   // 첫 턴: turn 1 - 0 < 3 → skip
  assert.equal(t1.update.skipped, 'gate');
  const t2 = await app.turn('a', conv, 2, '그냥 심심해서 들어왔어');
  assert.equal(t2.update.skipped, 'gate');
  const t3 = await app.turn('a', conv, 3, '별 일 없지 너는 뭐해');
  assert.equal(t3.update.skipped, undefined);
  assert.ok(t3.update.gate_reasons.includes('interval'));
  assert.equal(app.model.calls.filter((c) => c.kind === 'complete').length, 1);
});

test('UPDATE: 수정된 정보가 옛 정보를 대체하고, 옛 것은 superseded 로 남는다 (M3)', async () => {
  const app = setup({ responses: [
    J({ profile: { 직업: '대학생' }, ops: [{ op: 'ADD', type: 'fact', text: '사용자는 대학생이다', importance: 4 }] }),
    (req) => { // 두 번째 추출: 프롬프트에 기존 아이템 id 가 보여야 한다
      const m = /\[id (\d+)\] \(fact\) 사용자는 대학생이다/.exec(req.messages[0].content);
      return J({ profile: { 직업: '회사원' }, ops: [{ op: 'UPDATE', item_id: Number(m[1]), type: 'fact', text: '사용자는 지난달부터 회사에 다닌다', importance: 4 }] });
    },
  ] });
  const conv = app.startConv('u');
  await app.turn('u', conv, 1, '나는 대학생이야');
  await app.turn('u', conv, 2, '아 참 나 이제 학생 아니고 지난달부터 회사 다녀');
  const r = await app.memory.retrieve({ user_id: 'u', conversation_id: conv, query: '요즘 어때', budget_tokens: 400 });
  assert.match(r.text, /직업 회사원/);
  assert.match(r.text, /회사에 다닌다/);
  assert.doesNotMatch(r.text, /대학생이다/);
  const all = await app.memory.list({ user_id: 'u', include_superseded: true });
  const old = all.items.find((i) => i.text === '사용자는 대학생이다');
  assert.equal(old.status, 'superseded');
  assert.equal(old.superseded_by, all.items.find((i) => i.text.includes('회사에 다닌다')).id);
  const active = await app.memory.list({ user_id: 'u' });
  assert.equal(active.items.length, 1);
});

test('JSON 파싱 실패 시 1회 재시도, 둘 다 실패면 ops 없음 + 실패 시도도 attempts 에 남음', async () => {
  const app = setup({ responses: ['이건 JSON 이 아니야', '여전히 아님'] });
  const conv = app.startConv('x');
  const t = await app.turn('x', conv, 1, '나는 고양이를 두 마리 키워');
  assert.equal(t.update.parsed_ok, false);
  assert.equal(t.update.ops.length, 0);
  assert.equal(t.update.attempts.filter((a) => a.tag === 'extract').length, 2);
  assert.match(app.model.calls[1].messages[0].content, /올바른 JSON 이 아니었다/);
});

test('모델 호출 자체가 실패해도 기존 기억은 유지되고 실패 비용이 기록된다', async () => {
  const app = setup({ responses: [J({ profile: {}, ops: [{ op: 'ADD', type: 'fact', text: '사용자는 부산에 산다' }] }), new Error('timeout'), new Error('timeout')] });
  const conv = app.startConv('y');
  await app.turn('y', conv, 1, '나는 부산에 살아');
  const t2 = await app.turn('y', conv, 2, '아니 사실은 서울로 이사했어');
  assert.equal(t2.update.parsed_ok, false);
  assert.ok(t2.update.attempts.some((a) => a.ok === false));
  const l = await app.memory.list({ user_id: 'y' });
  assert.equal(l.items.length, 1);
});

test('예산: 아이템이 많으면 예산 안에서 잘리고, 예산 안이면 기억이 안 바뀐 동안 블록 바이트 동일; 넘칠 때 선별은 중요도·최근성(언어 무관)', async () => {
  const ops = Array.from({ length: 40 }, (_, i) => ({ op: 'ADD', type: 'fact', slot: 'user.other', entity: 'user', text: `사용자는 ${i}번째 사실을 말했다 그리고 그것은 꽤 긴 문장이다`, importance: (i % 5) + 1 }));
  const app = setup({ responses: [J({ profile: {}, ops })] });
  const conv = app.startConv('b');
  await app.turn('b', conv, 1, '나는 취미가 아주 많아 들어봐 나는 여러 사실을 말할거야');
  const r1 = await app.memory.retrieve({ user_id: 'b', conversation_id: conv, query: '안녕', budget_tokens: 300 });
  assert.ok(app.model.estimateTokens(r1.text) <= 300);
  assert.ok(r1.items.length < 40 && r1.items.length > 0);
  const r2 = await app.memory.retrieve({ user_id: 'b', conversation_id: conv, query: '안녕', budget_tokens: 300 });
  assert.equal(r1.text, r2.text);
  // 선별은 질의 단어와 무관(zh/ja 에서도 같은 동작): 중요도 5 항목이 중요도 1 항목보다 먼저 들어간다
  const imps = r1.items.map((i) => i.importance);
  assert.ok(imps.filter((x) => x === 5).length >= imps.filter((x) => x === 1).length);
  const r3 = await app.memory.retrieve({ user_id: 'b', conversation_id: conv, query: '7번째 사실 뭐였지', budget_tokens: 300 });
  assert.equal(r3.text, r1.text); // 질의가 달라도 블록은 같다(캐시 안정)
});

test('깊은 검색: 최근 창 밖·다른 대화의 원문을 임베딩+키워드로 찾아 그 턴에만 주입 (M1 보강)', async () => {
  const app = setup({ responses: [] }); // 추출은 전부 NONE
  const a = app.startConv('z');
  await app.turn('z', a, 1, '내 강아지 이름은 콩이야 세 살 됐어');
  for (let t = 2; t <= 9; t++) await app.turn('z', a, t, `다른 얘기 ${t}번`);
  const b = app.startConv('z', '2026-10-22T09:00:00.000Z');
  const r = await app.memory.retrieve({ user_id: 'z', conversation_id: b, query: '내 강아지 이름 기억나?', budget_tokens: 400 });
  assert.equal(r.deep_search.method, 'embedding+keyword');
  assert.ok(r.deep_search.hits.length >= 1);
  assert.match(r.text, /강아지 이름은 콩이야/);
  assert.ok(r.attempts.some((x) => x.tag === 'embed'));
  // 신호가 없는 다음 턴에는 발췌가 들어가지 않는다
  const r2 = await app.memory.retrieve({ user_id: 'z', conversation_id: b, query: '오늘 뭐 할까', budget_tokens: 400 });
  assert.doesNotMatch(r2.text, /콩이야/);
  assert.equal(r2.attempts.length, 0);
});

test('깊은 검색: embed 없는 모델이면 키워드로만, 현재 턴·최근 6턴은 제외', async () => {
  const app = setup({ withEmbed: false });
  const a = app.startConv('k');
  await app.turn('k', a, 1, '나 다음주에 제주도 여행 가');
  for (let t = 2; t <= 8; t++) await app.turn('k', a, t, `잡담 ${t}`);
  app.say(a, 9, 'user', '내가 여행 어디 간다고 했지?');
  const r = await app.memory.retrieve({ user_id: 'k', conversation_id: a, query: '내가 여행 어디 간다고 했지?', budget_tokens: 400 });
  assert.equal(r.deep_search.method, 'keyword');
  assert.ok(r.deep_search.hits.every((h) => h.turn_no < 3)); // 최근 6턴(3~8)과 현재(9) 제외
  assert.match(r.text, /제주도/);
});

test('깊은 검색 결과는 다음 update 추출 입력에 들어가 기억으로 승격될 수 있다', async () => {
  const app = setup({ responses: [] });
  const a = app.startConv('p');
  await app.turn('p', a, 1, '내 고향은 대구야');
  for (let t = 2; t <= 8; t++) await app.turn('p', a, t, `잡담 ${t}`);
  app.model.calls.length = 0;
  const responses = [J({ profile: {}, ops: [{ op: 'ADD', type: 'fact', text: '사용자의 고향은 대구다', importance: 4 }] })];
  const m = app.model; const orig = m.complete.bind(m);
  m.complete = async (req) => { const txt = responses.shift(); const r = await orig(req); return { ...r, text: txt ?? r.text }; };
  const t9 = await app.turn('p', a, 9, '내 고향 어디라고 했지?');
  assert.ok(t9.update.gate_reasons.includes('deep_search_followup'));
  assert.match(m.calls.find((c) => c.kind === 'complete').messages[0].content, /과거 대화 발췌/);
  assert.equal(t9.update.ops[0].text, '사용자의 고향은 대구다');
});

test('consolidate: 에피소드 요약 저장 + 중복 병합, 두 번 부르면 생략, 다음 대화 블록에 요약 등장', async () => {
  const app = setup({ responses: [
    J({ profile: {}, ops: [{ op: 'ADD', type: 'event', text: '사용자는 10/18 면접을 봤다' }, { op: 'ADD', type: 'fact', text: '사용자는 면접 결과를 기다리고 있다' }] }),
    (req) => { const ids = [...req.messages[0].content.matchAll(/\[id (\d+)\]/g)].map((m) => Number(m[1])); return J({ episode: '10/21 사용자가 면접 결과를 기다리며 불안해했고 캐릭터가 위로했다.', merge: [{ keep: ids[0], drop: [ids[1]] }] }); },
  ] });
  const a = app.startConv('c');
  await app.turn('c', a, 1, '나 지난 금요일에 면접 봤어 10/18에');
  await app.turn('c', a, 2, '결과 기다리는 중이라 불안해');
  const c1 = await app.memory.consolidate({ user_id: 'c', conversation_id: a });
  assert.equal(c1.ops.filter((o) => o.op === 'EPISODE').length, 1);
  assert.equal(c1.ops.filter((o) => o.op === 'MERGE').length, 1);
  assert.equal(c1.attempts[0].tag, 'consolidate');
  const c2 = await app.memory.consolidate({ user_id: 'c', conversation_id: a });
  assert.equal(c2.skipped, 'already_consolidated');
  const b = app.startConv('c', '2026-10-22T09:00:00.000Z');
  const r = await app.memory.retrieve({ user_id: 'c', conversation_id: b, query: '안녕', budget_tokens: 400 });
  assert.match(r.text, /지난 대화\(2026-10-21\): 10\/21 사용자가 면접 결과/);
  assert.equal((await app.memory.list({ user_id: 'c' })).items.length, 1);
});

test('짧은 대화(1턴)는 consolidate 호출 생략', async () => {
  const app = setup();
  const a = app.startConv('s');
  await app.turn('s', a, 1, '안녕');
  const c = await app.memory.consolidate({ user_id: 's', conversation_id: a });
  assert.equal(c.skipped, 'short_conversation');
  assert.equal(c.attempts.length, 0);
});

test('사용자 격리: 다른 이름의 기억은 보이지 않는다', async () => {
  const app = setup({ responses: [J({ profile: { 이름: '민수' }, ops: [{ op: 'ADD', type: 'fact', text: '사용자는 민수다' }] })] });
  const a = app.startConv('minsu');
  await app.turn('minsu', a, 1, '나는 민수야 반가워 잘 부탁해');
  const b = app.startConv('jina');
  const r = await app.memory.retrieve({ user_id: 'jina', conversation_id: b, query: '내 이름 알아?', budget_tokens: 400 });
  assert.equal(r.text, '');
  assert.equal(r.deep_search.hits.length, 0);
});

test('retrieveMode on_change: 기억이 안 바뀌면 블록 재사용, 바뀌면 재생성', async () => {
  const app = setup({ policy: { retrieveMode: 'on_change' }, responses: [J({ profile: {}, ops: [{ op: 'ADD', type: 'fact', text: '사용자는 커피를 안 마신다' }] })] });
  const a = app.startConv('o');
  const t1 = await app.turn('o', a, 1, '나는 커피를 안 마셔 카페인 때문에');
  const r2 = await app.memory.retrieve({ user_id: 'o', conversation_id: a, query: 'x', budget_tokens: 400 });
  assert.match(r2.text, /커피를 안 마신다/);
  const r3 = await app.memory.retrieve({ user_id: 'o', conversation_id: a, query: 'y', budget_tokens: 400 });
  assert.equal(r2.text, r3.text);
});

test('MEMORY_BUDGET_TOKENS 환경변수가 설정되면 호출 인자(400)보다 우선한다 (벤치용)', async () => {
  process.env.MEMORY_BUDGET_TOKENS = '200';
  try {
    const ops = Array.from({ length: 30 }, (_, i) => ({ op: 'ADD', type: 'fact', text: `사용자는 ${i}번째 취미가 있다고 했다`, importance: 3 }));
    const app = setup({ responses: [J({ profile: {}, ops })] });
    assert.equal(app.memory._internal.policy.budgetTokens, 200);
    const a = app.startConv('e');
    await app.turn('e', a, 1, '나는 취미가 정말 많아 하나씩 말해줄게');
    const r = await app.memory.retrieve({ user_id: 'e', conversation_id: a, query: '안녕', budget_tokens: 400 });
    assert.ok(app.memory._internal.estimateTokens(r.text) <= 200);
    assert.ok(r.items.length > 0 && r.items.length < 30);
  } finally { delete process.env.MEMORY_BUDGET_TOKENS; }
});

test('dropped_item_ids: 예산에서 밀린 아이템 id 를 반환하고 턴별 RETRIEVE 로그에 남긴다', async () => {
  const ops = Array.from({ length: 30 }, (_, i) => ({ op: 'ADD', type: 'fact', text: `사용자는 ${i}번째 취미가 있다고 했다`, importance: 3 }));
  const app = setup({ responses: [J({ profile: {}, ops })] });
  const a = app.startConv('d');
  await app.turn('d', a, 1, '나는 취미가 정말 많아 하나씩 말해줄게');
  app.say(a, 2, 'user', '안녕');
  const r = await app.memory.retrieve({ user_id: 'd', conversation_id: a, query: '안녕', budget_tokens: 150 });
  assert.ok(r.dropped_item_ids.length > 0);
  assert.equal(r.items.length + r.dropped_item_ids.length, 30);
  const l = await app.memory.list({ user_id: 'd', include_log: true });
  const row = l.ops_log.find((o) => o.op === 'RETRIEVE' && o.turn_no === 2);
  assert.ok(row);
  const d = JSON.parse(row.detail);
  assert.deepEqual(d.dropped, r.dropped_item_ids);
  assert.equal(d.budget, 150);
});

test('MEMORY_MAX_EPISODES=1 이면 에피소드 1개만 블록에 들어간다', async () => {
  process.env.MEMORY_MAX_EPISODES = '1';
  try {
    const app = setup({ responses: [J({ profile: {}, ops: [] }), J({ episode: '첫 대화 요약', merge: [] }), J({ profile: {}, ops: [] }), J({ episode: '둘째 대화 요약', merge: [] })] });
    for (const n of [1, 2]) {
      const c = app.startConv('m', `2026-10-2${n}T10:00:00.000Z`);
      await app.turn('m', c, 1, '나는 요즘 운동을 시작했어 헬스장 다녀');
      await app.turn('m', c, 2, '그래서 피곤해');
      await app.memory.consolidate({ user_id: 'm', conversation_id: c });
    }
    const c3 = app.startConv('m', '2026-10-23T10:00:00.000Z');
    const r = await app.memory.retrieve({ user_id: 'm', conversation_id: c3, query: '안녕', budget_tokens: 400 });
    assert.match(r.text, /둘째 대화 요약/);
    assert.doesNotMatch(r.text, /첫 대화 요약/);
  } finally { delete process.env.MEMORY_MAX_EPISODES; }
});

test('stair 묶음: force:true 면 게이트·주기와 무관하게 추출하고, 묶음 안의 모든 사용자 발화를 게이트가 본다', async () => {
  const app = setup({ responses: [J({ profile: {}, ops: [] }), J({ profile: {}, ops: [{ op: 'ADD', type: 'fact', text: '사용자는 부산에 산다' }] }), J({ profile: {}, ops: [] })] });
  const a = app.startConv('st');
  // 4턴 정리 (주기 충족) → 추출
  const u4 = await app.memory.update({ user_id: 'st', conversation_id: a, turn_no: 4, messages: [{ role: 'user', text: '안녕' }, { role: 'assistant', text: '응' }] });
  assert.equal(u4.skipped, undefined);
  // 6턴 정리: 주기 미충족(6-4=2), 마지막 발화는 잡담이지만 묶음 첫 발화에 정보 → scanAll 게이트로 통과
  const batch = [{ role: 'user', text: '나는 부산에 살아 바다 가까워' }, { role: 'assistant', text: '좋겠다' }, { role: 'user', text: '그치 ㅋㅋ 오늘 날씨도 좋고' }, { role: 'assistant', text: '산책 가자' }];
  const u6 = await app.memory.update({ user_id: 'st', conversation_id: a, turn_no: 6, messages: batch });
  assert.equal(u6.skipped, undefined);
  assert.ok(u6.gate_reasons.includes('first_person_info'));
  assert.equal(u6.ops[0].text, '사용자는 부산에 산다');
  // 7턴: 잡담만, 주기 미충족 → force 없으면 skip, force 있으면 추출
  const chat = [{ role: 'user', text: '그냥 심심하다' }, { role: 'assistant', text: '놀자' }];
  const u7a = await app.memory.update({ user_id: 'st', conversation_id: a, turn_no: 7, messages: chat });
  assert.equal(u7a.skipped, 'gate');
  const u7b = await app.memory.update({ user_id: 'st', conversation_id: a, turn_no: 7, messages: chat, force: true, reason: 'stair_evict' });
  assert.equal(u7b.skipped, undefined);
  assert.ok(u7b.gate_reasons.includes('force:stair_evict'));
});

test('추출 입력: turn_no 가 있으면 마지막 추출 이후 새 턴만 + 문맥 1턴, 캐릭터 발화는 잘림', async () => {
  const seen = [];
  const app = setup({ responses: [(req) => { seen.push(req.messages[0].content); return J({ ops: [] }); }, (req) => { seen.push(req.messages[0].content); return J({ ops: [] }); }] });
  const conv = app.startConv('nt');
  const long = '캐릭터의 아주 긴 답변 '.repeat(30);
  const msgs = (n) => Array.from({ length: n }, (_, i) => i + 1).flatMap((t) => [{ turn_no: t, role: 'user', text: `나는 ${t}번째 턴에 내 취미를 말했어` }, { turn_no: t, role: 'assistant', text: long }]);
  await app.memory.update({ user_id: 'nt', conversation_id: conv, turn_no: 2, messages: msgs(2) });
  await app.memory.update({ user_id: 'nt', conversation_id: conv, turn_no: 5, messages: msgs(5).slice(-8) });
  assert.equal(seen.length, 2);
  // 2번째 호출: 새 턴은 3~5, 문맥은 2턴. 1턴은 없어야 한다
  const body = seen[1].split('## 새 턴')[1];
  assert.match(body, /3번째 턴/); assert.match(body, /5번째 턴/); assert.doesNotMatch(body, /2번째 턴/);
  const ctx = seen[1].split('## 이전 턴')[1].split('## 새 턴')[0];
  assert.match(ctx, /2번째 턴/); assert.doesNotMatch(ctx, /1번째 턴/);
  assert.ok(!seen[1].includes(long)); // 캐릭터 발화 잘림
});

test('추출 입력: turn_no 없으면 끝에서 (현재턴-마지막추출턴) 턴만 새 턴으로 본다', async () => {
  const seen = [];
  const app = setup({ responses: [(req) => { seen.push(req.messages[0].content); return J({ ops: [] }); }] });
  const conv = app.startConv('nt2');
  const msgs = [1, 2, 3].flatMap((t) => [{ role: 'user', text: `나는 ${t}번째 턴에 내 취미를 말했어` }, { role: 'assistant', text: '응' }]);
  await app.memory.update({ user_id: 'nt2', conversation_id: conv, turn_no: 3, messages: msgs, force: true }); // 마지막 추출 0 → scanCount 3 → 전부 새 턴(한 조각)
  const body = seen[0].split('## 새 턴')[1];
  assert.match(body, /1번째 턴/); assert.match(body, /3번째 턴/);
});

test('추출 출력이 잘리면(max_tokens) 같은 입력 재시도 대신 "더 짧게" 접미사로 1회 재시도', async () => {
  const seen = [];
  const app = setup({ responses: [
    (req) => { seen.push(req.messages[0].content); return { text: '{"ops":[{"op":"ADD","type":"fact","text":"잘린', finish_reason: 'max_tokens' }; },
    (req) => { seen.push(req.messages[0].content); return J({ ops: [{ op: 'ADD', type: 'fact', text: '사용자는 짧게 말했다', importance: 3 }] }); },
  ] });
  const conv = app.startConv('tr');
  const u = await app.memory.update({ user_id: 'tr', conversation_id: conv, turn_no: 1, messages: [{ turn_no: 1, role: 'user', text: '나는 취미가 등산이야' }, { turn_no: 1, role: 'assistant', text: '좋네' }] });
  assert.equal(u.parsed_ok, true);
  assert.equal(seen.length, 2);
  assert.match(seen[1], /잘렸다/);
  assert.equal(u.ops.length, 1);
});

test('종료 요약: 긴 대화는 캐릭터 발화를 잘라 예산 안에 넣고, JSON 이 잘려도 episode 는 건진다', async () => {
  const seen = [];
  const app = setup({ responses: [
    (req) => { seen.push(req.messages[0].content); return { text: '{"episode":"길었던 대화 요약.","merge":[{"keep":1,"drop":[2', finish_reason: 'max_tokens' }; },
    (req) => { seen.push(req.messages[0].content); return { text: '{"episode":"길었던 대화 요약 2.","merge":[{"keep":1,"drop":[2', finish_reason: 'max_tokens' }; },
  ], policy: { consolidateInputTokens: 600 } });
  const conv = app.startConv('cs');
  for (let t = 1; t <= 30; t++) { app.say(conv, t, 'user', `사용자 발화 ${t}`); app.say(conv, t, 'assistant', '캐릭터의 긴 답변 '.repeat(20)); }
  const c = await app.memory.consolidate({ user_id: 'cs', conversation_id: conv });
  assert.ok(app.model.estimateTokens(seen[0]) < 600 + 400); // 대화 부분 ≤ 600 + 머리말/항목
  assert.ok(seen[0].includes('사용자 발화 30'));
  assert.equal(c.parsed_ok, true);
  assert.equal(c.ops[0].op, 'EPISODE');
  assert.match(c.ops[0].summary, /길었던 대화 요약/);
});

test('stair 묶음: 새 턴이 chunk 상한을 넘으면 3턴씩 나눠 순차 추출하고, 뒤 조각은 앞 조각 결과를 기존 항목으로 본다', async () => {
  const seen = [];
  const app = setup({ responses: [
    (req) => { seen.push(req.messages[0].content); return J({ ops: [{ op: 'ADD', type: 'fact', text: '사용자의 고양이 이름은 하늘이다', importance: 4 }] }); },
    (req) => { seen.push(req.messages[0].content); const id = /\[id (\d+)\] \(fact\) 사용자의 고양이 이름은 하늘이다/.exec(req.messages[0].content)?.[1]; return J({ ops: [{ op: 'UPDATE', item_id: Number(id), type: 'fact', text: '사용자의 고양이 이름은 구름이다', importance: 4 }] }); },
  ] });
  const conv = app.startConv('ch');
  const texts = ['나 고양이 키워 이름은 하늘이야', '오늘 날씨 좋다', '점심 뭐 먹지', '고양이 이름 구름이로 바꿨어', '졸리다', '퇴근하고 싶다'];
  const batch = texts.flatMap((t, i) => [{ turn_no: i + 1, role: 'user', text: t }, { turn_no: i + 1, role: 'assistant', text: '응' }]);
  const u = await app.memory.update({ user_id: 'ch', conversation_id: conv, turn_no: 6, messages: batch, force: true, reason: 'stair_evict' });
  assert.equal(u.chunks, 2);
  assert.equal(seen.length, 2);
  assert.match(seen[0].split('## 새 턴')[1], /하늘이야/); assert.doesNotMatch(seen[0].split('## 새 턴')[1], /구름이로/);
  assert.match(seen[1].split('## 이전 턴')[1].split('## 새 턴')[0], /점심 뭐 먹지/);
  assert.equal(u.ops.filter((o) => o.op === 'UPDATE').length, 1);
  const l = await app.memory.list({ user_id: 'ch' });
  assert.deepEqual(l.items.map((i) => i.text), ['사용자의 고양이 이름은 구름이다']);
  assert.equal(l.items[0].source.turn_no, 6); // op 에 turn 이 없으면 조각의 마지막 턴
});

test('잘림 재시도는 max_tokens 를 두 배로 올린다', async () => {
  const seen = [];
  const app = setup({ responses: [
    (req) => { seen.push(req.max_tokens); return { text: '{"ops":[{"op":"ADD"', finish_reason: 'max_tokens' }; },
    (req) => { seen.push(req.max_tokens); return J({ ops: [] }); },
  ] });
  const conv = app.startConv('mt');
  await app.memory.update({ user_id: 'mt', conversation_id: conv, turn_no: 1, messages: [{ turn_no: 1, role: 'user', text: '나는 취미가 등산이야' }], force: true });
  assert.deepEqual(seen, [600, 1200]); // policy.extractMaxTokens 600 → 재시도 1200
});

test('깊은 검색: 이미 항목으로 추출된 턴의 원문은 후보에서 빼서 옛 값을 되살리지 않는다', async () => {
  const app = setup({ responses: [
    J({ ops: [{ op: 'ADD', type: 'fact', text: '사용자의 고양이 이름은 하늘이다', importance: 4 }] }),
    (req) => { const id = /\[id (\d+)\]/.exec(req.messages[0].content)[1]; return J({ ops: [{ op: 'UPDATE', item_id: Number(id), type: 'fact', text: '사용자의 고양이 이름은 보리다', importance: 4 }] }); },
  ] });
  const a = app.startConv('ds');
  await app.turn('ds', a, 1, '나 고양이 키워 이름은 하늘이야');
  await app.turn('ds', a, 2, '고양이 이름 보리로 바꿨어 하늘이는 아니야');
  for (let t = 3; t <= 10; t++) app.say(a, t, 'user', `잡담 ${t}`), app.say(a, t, 'assistant', '응');
  const b = app.startConv('ds');
  app.say(b, 1, 'user', '우리 고양이 이름 기억나?');
  const r = await app.memory.retrieve({ user_id: 'ds', conversation_id: b, query: '우리 고양이 이름 기억나?', budget_tokens: 400 });
  assert.ok(r.deep_search);
  // 항목으로 이미 추출된 턴(1: 옛 값 하늘, 2: 현재 값 보리)은 발췌에서 제외. 현재 값은 항목으로 블록에 있다
  assert.ok(!r.deep_search.hits.some((h) => h.conversation_id === a && (h.turn_no === 1 || h.turn_no === 2)));
  assert.match(r.text, /보리/); assert.doesNotMatch(r.text, /하늘이야/);
});

test('op.turn 이 새 턴 범위 안이면 그 턴을 출처로 기록한다 (깊은 검색 제외·추적용)', async () => {
  const app = setup({ responses: [J({ ops: [{ op: 'ADD', type: 'fact', text: '사용자는 수영을 다닌다', importance: 3, turn: 2 }, { op: 'ADD', type: 'fact', text: '사용자는 편집자다', importance: 4, turn: 99 }] })] });
  const conv = app.startConv('ot');
  const batch = [1, 2, 3].flatMap((t) => [{ turn_no: t, role: 'user', text: `발화 ${t}` }, { turn_no: t, role: 'assistant', text: '응' }]);
  await app.memory.update({ user_id: 'ot', conversation_id: conv, turn_no: 3, messages: batch, force: true });
  const l = await app.memory.list({ user_id: 'ot' });
  assert.deepEqual(l.items.map((i) => i.source.turn_no), [2, 3]); // 99 는 범위 밖 → 조각 마지막 턴
});

test('stair 뒤처진 묶음: 현재 턴보다 오래된 턴들(18턴에 7~12턴)을 force 로 넘겨도 전부 새 턴으로 추출한다', async () => {
  const seen = [];
  const app = setup({ responses: Array.from({ length: 6 }, () => (req) => { seen.push(req.messages[0].content); return J({ ops: [] }); }) });
  const conv = app.startConv('lag');
  const batch = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i).flatMap((t) => [{ turn_no: t, role: 'user', text: `나는 ${t}번째 턴 정보` }, { turn_no: t, role: 'assistant', text: '응' }]);
  const u1 = await app.memory.update({ user_id: 'lag', conversation_id: conv, turn_no: 12, messages: batch(1, 6), force: true, reason: 'stair_evict' });
  const u2 = await app.memory.update({ user_id: 'lag', conversation_id: conv, turn_no: 18, messages: batch(7, 12), force: true, reason: 'stair_evict' });
  assert.equal(u1.chunks, 2); assert.equal(u2.chunks, 2);
  assert.equal(seen.length, 4);
  assert.match(seen[2].split('## 새 턴')[1], /7번째 턴/); assert.match(seen[3].split('## 새 턴')[1], /12번째 턴/);
  assert.doesNotMatch(seen[2], /1번째 턴/);
});

test('UPDATE: 텍스트는 같고 시점(when)만 바뀐 경우도 갱신하고, when 이 빠진 UPDATE 는 옛 시점을 물려받는다', async () => {
  const app = setup({ responses: [
    J({ ops: [{ op: 'ADD', type: 'event', text: '사용자는 친구와 전시회에 간다', when: '이번 주 토요일', importance: 3 }, { op: 'ADD', type: 'event', text: '사용자는 친구 생일파티를 가게에서 한다', when: '다음 주 화요일 저녁', importance: 3 }] }),
    J({ ops: [{ op: 'UPDATE', item_id: 1, type: 'event', text: '사용자는 친구와 전시회에 간다', when: '이번 주 일요일', importance: 3 }, { op: 'UPDATE', item_id: 2, type: 'event', text: '사용자의 친구 생일파티는 취소됐다', importance: 3 }] }),
  ] });
  const conv = app.startConv('wh');
  await app.turn('wh', conv, 1, '나는 토요일에 전시회 가고 화요일에 생일파티 해');
  await app.turn('wh', conv, 2, '전시회 일요일로 미뤘어 그리고 생일파티는 취소됐어');
  const l = await app.memory.list({ user_id: 'wh', include_superseded: true });
  const active = l.items.filter((i) => i.status === 'active');
  // when 은 코드 환산(대화 시작 2026-10-21 수 기준): 이번 주 일요일 → 10-25, 다음 주 화요일 → 10-27. 취소 UPDATE 는 옛 시점을 물려받고 type 은 fact 로 닫힌다
  assert.deepEqual(active.map((i) => [i.text, i.when, i.type]), [['사용자는 친구와 전시회에 간다', '2026-10-25 (이번 주 일요일)', 'event'], ['사용자의 친구 생일파티는 취소됐다', '2026-10-27 (다음 주 화요일 저녁)', 'fact']]);
  assert.equal(l.items.filter((i) => i.status === 'superseded').length, 2);
  const r = await app.memory.retrieve({ user_id: 'wh', conversation_id: conv, query: '전시회 언제야', budget_tokens: 400 });
  assert.match(r.text, /일요일/); assert.doesNotMatch(r.text, /토요일/);
});

test('블록 선별: 예산이 모자라면 열린 사건·약속과 정정 결과를 우선한다(질의 단어 겹침은 쓰지 않음)', async () => {
  const app = setup({ responses: [J({ profile: {}, ops: [
    ...Array.from({ length: 12 }, (_, i) => ({ op: 'ADD', type: 'fact', slot: 'user.hobby', entity: 'user', text: `사용자는 ${i}번째 취미로 악기를 배운다고 했다`, importance: 3 })),
    { op: 'ADD', type: 'event', slot: 'event.plan', entity: 'event#1', text: '사용자는 친구 생일파티를 카페에서 한다', when: '다음 주 화요일 저녁', importance: 3 },
    { op: 'ADD', type: 'promise', slot: 'promise.promise', entity: 'promise#1', text: '캐릭터는 사용자에게 고양이 라떼아트를 그려주기로 했다', importance: 3 },
  ] })] });
  const a = app.startConv('rk', '2026-10-23T10:00:00.000Z');
  await app.turn('rk', a, 1, '나 취미가 정말 많아 하나씩 말해줄게');
  const r1 = await app.memory.retrieve({ user_id: 'rk', conversation_id: a, query: '오늘 날씨 좋다', budget_tokens: 330 });
  assert.ok(r1.dropped_item_ids.length > 0, '예산이 모자라야 선별이 일어난다');
  assert.match(r1.text, /생일파티/); assert.match(r1.text, /라떼아트/);
});

test('추출 입력: 약속·제안 신호가 없는 캐릭터 발화는 짧게, 있는 발화는 길게 넣는다', async () => {
  const long = '그냥 잡담이야. '.repeat(20); // 신호 없음, 160자 초과
  const promise = '좋아, 다음에 오면 고양이 얼굴로 라떼아트 그려줄게! ' + '기대해. '.repeat(20);
  const app = setup({ responses: [J({ profile: {}, ops: [] })] });
  const a = app.startConv('pc');
  await app.memory.update({ user_id: 'pc', conversation_id: a, turn_no: 2, force: true, messages: [
    { turn_no: 1, role: 'user', text: '나 고양이 키워. 이름은 하늘이야' }, { turn_no: 1, role: 'assistant', text: long },
    { turn_no: 2, role: 'user', text: '다음에 내 라떼에 고양이 그려줄 수 있어?' }, { turn_no: 2, role: 'assistant', text: promise },
  ] });
  const req = app.model.calls.find((c) => c.kind === 'complete');
  const u = req.messages[0].content;
  const lines = u.split('\n').filter((l) => l.startsWith('캐릭터:'));
  assert.equal(lines.length, 2);
  assert.ok(lines[0].length <= 90 + 8, `잡담 발화는 90자 안팎: ${lines[0].length}`);
  assert.ok(lines[1].length > 100 && /라떼아트/.test(lines[1]), '약속 발화는 160자까지');
});


test('블록 선별: 정정으로 생긴 현재 값(취소·변경)은 중요도가 낮아도 예산에서 밀리지 않는다', async () => {
  const filler = Array.from({ length: 12 }, (_, i) => ({ op: 'ADD', type: 'fact', slot: 'user.hobby', entity: 'user', text: `사용자는 ${i}번째 취미로 악기를 배운다고 했다`, importance: 4 }));
  const app = setup({ responses: [
    J({ profile: {}, ops: [...filler, { op: 'ADD', type: 'event', slot: 'event.plan', entity: 'event#1', text: '사용자는 팀 사람들과 볼링을 친다', when: '다음 주 수요일 저녁', importance: 3 }] }),
    (req) => { const id = Number(req.messages[0].content.match(/\[id (\d+)\] \(event[^)]*\)/)[1]); return J({ profile: {}, ops: [{ op: 'UPDATE', item_id: id, type: 'event', slot: 'event.plan', entity: 'event#1', closed: true, text: '사용자의 팀 볼링 모임이 취소됐다', importance: 2 }] }); },
  ] });
  const a = app.startConv('cx');
  await app.turn('cx', a, 1, '나 취미가 정말 많아 하나씩 말해줄게');
  await app.memory.update({ user_id: 'cx', conversation_id: a, turn_no: 2, force: true, messages: [{ turn_no: 2, role: 'user', text: '수요일 볼링은 취소됐대요. 팀장님이 출장 가셔서요.' }] });
  const r = await app.memory.retrieve({ user_id: 'cx', conversation_id: a, query: '오늘 회의 진짜 길었어요', budget_tokens: 330 });
  assert.ok(r.dropped_item_ids.length > 0);
  assert.match(r.text, /취소/);
  assert.doesNotMatch(r.text, /볼링을 친다/);
});

test('stair 창 이월: 이전 대화의 턴이 묶음에 섞여 오면 출처는 그 대화로 기록하고, 현재 대화의 last_extract_turn 은 이전 대화 번호를 세지 않는다', async () => {
  const app = setup({ responses: [J({ ops: [
    { op: 'ADD', type: 'fact', text: '사용자는 고양이를 키운다', importance: 3, turn: 3 },
    { op: 'ADD', type: 'fact', text: '사용자는 부산에 산다', importance: 3, turn: 1 },
  ] })] });
  const prev = app.startConv('u');
  const cur = app.startConv('u');
  app.say(prev, 3, 'user', '나 고양이 키워'); app.say(prev, 3, 'assistant', '귀엽겠다');
  app.say(cur, 1, 'user', '나 부산 살아'); app.say(cur, 1, 'assistant', '바다 좋지');
  const { memory } = app;
  const u = await memory.update({ user_id: 'u', conversation_id: cur, turn_no: 1, force: true, reason: 'stair_evict', messages: [
    { conversation_id: prev, turn_no: 3, role: 'user', text: '나 고양이 키워' }, { conversation_id: prev, turn_no: 3, role: 'assistant', text: '귀엽겠다' },
    { conversation_id: cur, turn_no: 1, role: 'user', text: '나 부산 살아' }, { conversation_id: cur, turn_no: 1, role: 'assistant', text: '바다 좋지' },
  ] });
  assert.equal(u.ops.length, 2);
  const items = (await memory.list({ user_id: 'u' })).items;
  assert.deepEqual(items.find((i) => /고양이/.test(i.text)).source, { conversation_id: prev, turn_no: 3 });
  assert.deepEqual(items.find((i) => /부산/.test(i.text)).source, { conversation_id: cur, turn_no: 1 });
  assert.equal(memory._internal.store.state('u', cur).last_extract_turn, 1);
  // 추출 입력에서 이월 턴은 "이전 대화 턴" 으로 표시된다
  const prompt = app.model.calls.find((c) => c.kind === 'complete').messages[0].content;
  assert.match(prompt, /\[이전 대화 턴 3\] 사용자: 나 고양이 키워/);
  assert.match(prompt, /\[턴 1\] 사용자: 나 부산 살아/);
});

test('추출 입력에 "오늘" 날짜(해당 턴 메시지 날짜)가 들어가고, 지난 날짜의 사건은 "진행 중" 힌트에서 빠진다', async () => {
  const app = setup({ responses: [
    J({ ops: [{ op: 'ADD', type: 'event', text: '사용자는 부산 여행을 간다', when: '2026-10-18 (지난 토요일)', importance: 3 }] }),
    J({ ops: [{ op: 'ADD', type: 'promise', text: '캐릭터는 사용자에게 라떼아트를 그려주기로 했다', when: '다음에 올 때', importance: 3 }] }),
  ] });
  const c = app.startConv('d', '2026-10-21T10:00:00.000Z');
  await app.turn('d', c, 1, '나 지난 토요일에 부산 여행 갔다 왔어 진짜 좋았어');
  const prompt = app.model.calls.find((x) => x.kind === 'complete').messages[0].content;
  assert.match(prompt, /^## 오늘: 2026-10-21 \(수\)/);
  const r1 = await app.memory.retrieve({ user_id: 'd', conversation_id: c, query: '안녕', budget_tokens: 400 });
  assert.match(r1.text, /부산 여행/); assert.doesNotMatch(r1.text, /진행 중이면/); // 지난 사건만 → 힌트 없음
  await app.turn('d', c, 2, '다음에 올 때 라떼아트 그려줘 약속이야');
  const r2 = await app.memory.retrieve({ user_id: 'd', conversation_id: c, query: '안녕', budget_tokens: 400 });
  assert.match(r2.text, /진행 중이면/); // 날짜 없는 열린 약속 → 힌트
  assert.equal(app.memory._internal.isPast('2026-10-31 (다음 주 토요일)', '2026-10-21'), false);
  assert.equal(app.memory._internal.isPast('다음에 올 때', '2026-10-21'), false);
});

test('indexItemEmbeddings:true 면 새 항목을 임베딩한다(기본은 끔)', async () => {
  const app = setup({ policy: { indexItemEmbeddings: true }, responses: [J({ ops: [{ op: 'ADD', type: 'fact', text: '사용자는 매운 음식을 싫어한다' }] })] });
  const c = app.startConv('e');
  const t = await app.turn('e', c, 1, '나는 매운 음식 진짜 싫어해');
  assert.ok(t.update.attempts.some((a) => a.tag === 'embed'));
});

test('블록 첫 줄은 lang 별 라벨이고(앱은 라벨을 붙이지 않음), 항목 종류·프로필 라벨도 그 언어로 나온다', async () => {
  const app = setup({ responses: [J({ profile: { 이름: '지훈' }, ops: [{ op: 'ADD', type: 'fact', text: '사용자는 고양이를 키운다' }] })] });
  const c = app.startConv('lb');
  await app.turn('lb', c, 1, '나는 지훈이고 고양이 키워');
  const ko = await app.memory.retrieve({ user_id: 'lb', conversation_id: c, query: 'x', budget_tokens: 400 });
  assert.match(ko.text, /^기억:\n- 사용자: 이름 지훈\n- 사실: /);
  const en = await app.memory.retrieve({ user_id: 'lb', conversation_id: c, query: 'x', budget_tokens: 400, lang: 'en' });
  assert.match(en.text, /^Memory:\n- User: /); assert.match(en.text, /\n- fact: /);
  const none = await app.memory.retrieve({ user_id: 'nobody', conversation_id: c, query: 'x', budget_tokens: 400 });
  assert.equal(none.text, ''); // 기억 없음 → 라벨도 없음
});

test('코드 강제: 두 번째 문장 절단, 취소·이행된 사건·약속은 fact 로(closed 구조 신호 우선, ko 과거형은 보조), 사소한 캐릭터 제안 약속은 버림, 미래 사건의 과거 날짜 환산은 원문으로 되돌림', async () => {
  const { sanitizeOp, normStruct } = setup().memory._internal;
  const s1 = sanitizeOp({ type: 'fact', text: '사용자는 집에서 두부라는 강아지를 키운다. 이름은 조카가 지었다', when: null }, '2026-10-23');
  assert.deepEqual({ type: s1.type, text: s1.text, when: s1.when }, { type: 'fact', text: '사용자는 집에서 두부라는 강아지를 키운다', when: null });
  assert.equal(sanitizeOp({ type: 'event', text: '사용자의 팀 볼링 모임은 취소됐다', when: '2026-10-28 (다음 주 수요일)' }, '2026-10-23').type, 'fact');
  assert.equal(sanitizeOp({ type: 'event', text: 'The bowling night was called off', when: null, closed: true }, '2026-10-23').type, 'fact'); // 언어 무관: closed 신호
  assert.equal(sanitizeOp({ type: 'promise', text: '캐릭터는 사용자에게 볼링장 메뉴 확인을 해주기로 했으나 볼링이 취소되어 종료됐다', when: null }, '2026-10-23').type, 'fact');
  assert.equal(sanitizeOp({ type: 'promise', text: '캐릭터는 사용자에게 일반 우유 안 맞는 것을 기억해 두기로 했다', when: null }, '2026-10-23'), null);
  assert.equal(sanitizeOp({ type: 'promise', text: '캐릭터는 사용자에게 1층 카페 디카페인 메뉴를 권하기로 했다', when: null }, '2026-10-23'), null);
  assert.equal(sanitizeOp({ type: 'promise', text: '캐릭터는 사용자의 코드 리뷰를 봐주기로 했다', when: '다음에' }, '2026-10-23').type, 'promise');
  // 미래 표현이 과거 날짜로 잘못 환산 → 원문만 남김. 과거 표현("지난 토요일")의 과거 날짜는 유지
  assert.equal(sanitizeOp({ type: 'event', text: '사용자는 마을을 떠날 예정이다', when: '2026-10-20 (사흘 뒤)' }, '2026-10-23').when, '2026-10-26 (사흘 뒤)'); // 원문으로 다시 환산해 교정
  assert.equal(sanitizeOp({ type: 'event', text: '사용자는 마을을 떠날 예정이다', when: '2026-10-20' }, '2026-10-23').when, null);
  assert.equal(sanitizeOp({ type: 'event', text: '사용자는 부산 여행을 갔다', when: '지난 토요일' }, '2026-10-23').when, '2026-10-17 (지난 토요일)'); // 과거 표현의 과거 날짜는 유지
  // 구조 필드 정규화: 어휘 밖은 other, 대상 생략은 type 으로, entity 는 소문자 "<대상>#<n>"
  assert.deepEqual(normStruct({ slot: 'User.Allergy', entity: 'User' }, 'fact'), { slot: 'user.allergy', entity: 'user', depends_on: null, value: null });
  assert.deepEqual(normStruct({ slot: 'pet.name', entity: 'Pet #1', value: ' 보리 ' }, 'fact'), { slot: 'pet.name', entity: 'pet#1', depends_on: null, value: '보리' });
  assert.deepEqual(normStruct({ slot: 'cousin.favorite_food', entity: 'cousin' }, 'preference'), { slot: 'other.like', entity: 'cousin#1', depends_on: null, value: null });
  assert.deepEqual(normStruct({}, 'event'), { slot: 'event.plan', entity: null, depends_on: null, value: null });
  assert.deepEqual(normStruct({ slot: 'promise.promise', entity: 'promise#2', depends_on: ['31', 7] }, 'promise'), { slot: 'promise.promise', entity: 'promise#2', depends_on: [31, 7], value: null });
});

test('사건·약속: 같은 entity 로 다시 온 ADD 는 그 항목의 UPDATE 다(옛 날짜 항목 superseded). 값이 여러 개인 fact 는 전환하지 않음', async () => {
  const app = setup({ responses: [
    J({ ops: [{ op: 'ADD', type: 'event', slot: 'event.plan', entity: 'event#1', text: '사용자는 판교에서 열리는 개발 컨퍼런스에 간다', when: '이번 주 금요일' }] }),
    J({ ops: [{ op: 'ADD', type: 'event', slot: 'event.plan', entity: 'event#1', text: '사용자는 판교에서 열리는 개발 컨퍼런스 토요일 세션에 간다', when: '토요일' },
              { op: 'ADD', type: 'fact', slot: 'pet.status', entity: 'pet#1', text: '사용자는 고양이를 키운다' }, { op: 'ADD', type: 'fact', slot: 'pet.other', entity: 'pet#1', text: '사용자는 고양이 두 마리를 키운다' }] }),
  ] });
  const { memory } = app;
  const c = app.startConv('nd', '2026-10-23T10:00:00.000Z');
  app.say(c, 1, 'user', '이번 주 금요일에 판교 개발 컨퍼런스 가요'); app.say(c, 1, 'assistant', '좋네요');
  await memory.update({ user_id: 'nd', conversation_id: c, turn_no: 1, force: true, messages: [{ turn_no: 1, role: 'user', text: '이번 주 금요일에 판교 개발 컨퍼런스 가요' }] });
  app.say(c, 2, 'user', '컨퍼런스는 토요일 세션으로 바꿨어요'); app.say(c, 2, 'assistant', '알겠어요');
  const u = await memory.update({ user_id: 'nd', conversation_id: c, turn_no: 2, force: true, messages: [{ turn_no: 2, role: 'user', text: '컨퍼런스는 토요일 세션으로 바꿨어요. 그리고 고양이 두 마리 키워요' }] });
  const upd = u.ops.find((o) => o.op === 'UPDATE' && /토요일 세션/.test(o.text)); assert.ok(upd && upd.replaces, JSON.stringify(u.ops));
  const items = (await memory.list({ user_id: 'nd', include_superseded: true })).items;
  assert.equal(items.filter((i) => /컨퍼런스/.test(i.text) && i.status === 'active').length, 1);
  const cur = items.find((i) => /컨퍼런스/.test(i.text) && i.status === 'active');
  assert.equal(cur.when, '2026-10-24 (토요일)'); assert.equal(cur.entity, 'event#1'); assert.equal(cur.slot, 'event.plan'); // 코드 환산(오늘 2026-10-23 금)
  assert.equal(items.filter((i) => /고양이/.test(i.text) && i.status === 'active').length, 2); // 다른 slot 의 fact 는 그대로
});

test('dates: 한국어 시점 표현을 오늘 기준으로 결정적으로 환산한다(주는 월요일 시작)', async () => {
  const { resolveWhen, formatWhen } = await import('../dates.js');
  const T = '2026-10-23'; // 금요일
  const cases = { '오늘': '2026-10-23', '내일': '2026-10-24', '모레': '2026-10-25', '어제': '2026-10-22', '이번 주 금요일': '2026-10-23', '이번 주 토요일': '2026-10-24', '다음 주 수요일 저녁': '2026-10-28', '다음 주 토요일': '2026-10-31', '다다음 주 월요일': '2026-11-02', '지난 주 금요일': '2026-10-16', '토요일': '2026-10-24', '금요일': '2026-10-23', '지난 토요일': '2026-10-17', '28일': '2026-10-28', '3일': '2026-11-03', '이번 달 28일': '2026-10-28', '다음 달 3일': '2026-11-03', '11월 2일': '2026-11-02', '사흘 뒤': '2026-10-26', '3일 후': '2026-10-26', '일주일 뒤': '2026-10-30', '이번 주말': '2026-10-24' };
  for (const [k, v] of Object.entries(cases)) assert.equal(resolveWhen(k, T), v, k);
  for (const k of ['다음 주', '다음에 올 때', '보름달 뜨는 밤', '내년쯤']) assert.equal(resolveWhen(k, T), null, k);
  assert.equal(formatWhen('다음 주 수요일 저녁', T), '2026-10-28 (다음 주 수요일 저녁)');
  assert.equal(formatWhen('다음에 올 때', T), '다음에 올 때');
  assert.equal(formatWhen('2026-10-30 (이번 주 금요일)', T), '2026-10-23 (이번 주 금요일)'); // 모델 환산 오류 교정
  assert.equal(formatWhen('2026-10-28', T), '2026-10-28');
  assert.equal(formatWhen('2026-10-27~2026-10-31 (다음 주)', T), '2026-10-27 (다음 주)');
});

test('사건이 취소로 닫히면 depends_on 으로 딸린 활성 약속은 함께 닫히고, 무관한 약속은 남는다(날짜·단어 겹침 판정 없음)', async () => {
  const app = setup({ responses: [
    J({ ops: [{ op: 'ADD', type: 'event', slot: 'event.plan', entity: 'event#1', text: '사용자는 친구 생일파티를 카페에서 한다', when: '다음 주 화요일 저녁', importance: 3 }] }),
    (req) => { const id = Number(/\[id (\d+)\] \(event[^)]*\)/.exec(req.messages[0].content)[1]); return J({ ops: [
      { op: 'ADD', type: 'promise', who: 'character', slot: 'promise.promise', entity: 'promise#1', depends_on: [id], text: '큰 테이블을 잡아주기로 했다', when: '다음 주 화요일 저녁', importance: 3 },
      { op: 'ADD', type: 'promise', who: 'character', slot: 'promise.promise', entity: 'promise#2', text: '다음에 라떼아트를 그려주기로 했다', when: '다음 주 화요일 저녁', importance: 3 }] }); },
    (req) => { const id = /\[id (\d+)\] \(event[^)]*\)/.exec(req.messages[0].content)[1]; return J({ ops: [{ op: 'UPDATE', item_id: Number(id), type: 'event', slot: 'event.plan', entity: 'event#1', closed: true, text: '사용자의 친구 생일파티는 취소됐다', importance: 3 }] }); },
  ] });
  const { memory } = app;
  const c = app.startConv('dep', '2026-10-23T10:00:00.000Z');
  const say = (t, u, a = '응') => { app.say(c, t, 'user', u); app.say(c, t, 'assistant', a); return memory.update({ user_id: 'dep', conversation_id: c, turn_no: t, force: true, messages: [{ turn_no: t, role: 'user', text: u }, { turn_no: t, role: 'assistant', text: a }] }); };
  await say(1, '다음 주 화요일 저녁에 친구 생일파티 여기서 할게');
  await say(2, '테이블 큰 거 잡아줄 수 있어? 그리고 다음에 라떼아트도', '큰 테이블 잡아둘게. 라떼아트도 그려줄게');
  const u = await say(3, '생일파티 취소됐어 친구가 감기래');
  assert.ok(u.ops.some((o) => o.op === 'CLOSE_DEPENDENT'), JSON.stringify(u.ops));
  const act = (await memory.list({ user_id: 'dep' })).items;
  assert.deepEqual(act.map((i) => [i.type, i.text]), [['promise', '캐릭터는 사용자에게 다음에 라떼아트를 그려주기로 했다'], ['fact', '사용자의 친구 생일파티는 취소됐다']]);
  const r = await memory.retrieve({ user_id: 'dep', conversation_id: c, query: '화요일에 뭐 하기로 했지', budget_tokens: 400 });
  assert.doesNotMatch(r.text, /테이블/);
});

test('이름 정정은 value 기준으로 옛 이름을 품은 다른 항목에 전파된다(B19, 단어 추측 없음)', async () => {
  const app = setup({ responses: [
    J({ ops: [{ op: 'ADD', type: 'fact', slot: 'pet.name', entity: 'pet#1', value: '하늘이', text: '사용자의 고양이 이름은 하늘이다', importance: 4 },
              { op: 'ADD', type: 'promise', slot: 'promise.promise', entity: 'promise#1', text: '캐릭터는 사용자에게 다음에 하늘이 라떼아트를 그려주기로 했다', when: '다음에 올 때', importance: 3 },
              { op: 'ADD', type: 'fact', slot: 'user.job', entity: 'user', text: '사용자는 출판사 편집자다', importance: 4 }] }),
    // 모델이 item_id 를 빠뜨려도 같은 slot+entity(pet.name/pet#1)로 UPDATE 대상을 찾는다
    J({ ops: [{ op: 'UPDATE', type: 'fact', slot: 'pet.name', entity: 'pet#1', value: '보리', text: '사용자의 고양이 이름은 보리다', importance: 4 }] }),
  ] });
  const { memory } = app;
  const c = app.startConv('rn');
  app.say(c, 1, 'user', '고양이 하늘이 키워'); app.say(c, 1, 'assistant', '하늘이 라떼아트 그려줄게');
  await memory.update({ user_id: 'rn', conversation_id: c, turn_no: 1, force: true, messages: [{ turn_no: 1, role: 'user', text: '나 고양이 하늘이 키워 출판사 편집자야' }, { turn_no: 1, role: 'assistant', text: '하늘이 라떼아트 그려줄게' }] });
  app.say(c, 2, 'user', '이름 보리로 바꿨어'); app.say(c, 2, 'assistant', '응');
  const u = await memory.update({ user_id: 'rn', conversation_id: c, turn_no: 2, force: true, messages: [{ turn_no: 2, role: 'user', text: '고양이 이름 보리로 바꿨어' }] });
  const prop = u.ops.find((o) => o.op === 'PROPAGATE'); assert.ok(prop, JSON.stringify(u.ops)); assert.equal(prop.from, '하늘이'); assert.equal(prop.to, '보리');
  const act = (await memory.list({ user_id: 'rn' })).items;
  assert.ok(act.map((i) => i.text).includes('캐릭터는 사용자에게 다음에 보리 라떼아트를 그려주기로 했다'));
  assert.ok(!act.some((i) => /하늘이/.test(i.text)));
  assert.ok(act.map((i) => i.text).includes('사용자는 출판사 편집자다')); // 무관한 항목은 그대로
  assert.equal(act.find((i) => i.slot === 'pet.name').value, '보리');
  assert.deepEqual(memory._internal.renamePairs('rn'), [['하늘이', '보리']]);
});

test('importance 1 항목과 "듣기로/궁금해" 류 사소한 약속은 저장하지 않는다; "이 달 N일" 환산', async () => {
  const app = setup({ responses: [J({ ops: [
    { op: 'ADD', type: 'preference', text: '사용자의 동생은 진한 커피를 좋아하는지 궁금해함', importance: 1 },
    { op: 'ADD', type: 'promise', text: '캐릭터는 사용자에게 전시 후 어땠는지 듣기로 했다', importance: 3 },
    { op: 'ADD', type: 'event', text: '사용자는 마을을 떠날 예정이다', when: '이 달 28일', importance: 4 },
  ] })] });
  const c = app.startConv('imp', '2026-10-23T10:00:00.000Z');
  const t = await app.turn('imp', c, 1, '나는 이번 달 28일에 마을을 떠나기로 했어');
  assert.deepEqual(t.update.ops.map((o) => o.text), ['사용자는 마을을 떠날 예정이다']);
  assert.equal((await app.memory.list({ user_id: 'imp' })).items[0].when, '2026-10-28 (이 달 28일)');
  // 코드가 버린 두 op 는 ops_log 에 DROP 으로 남는다(원인 추적용; 반환 ops 에는 없음)
  const drops = (await app.memory.list({ user_id: 'imp', include_log: true })).ops_log.filter((o) => o.op === 'DROP');
  assert.equal(drops.length, 2, JSON.stringify(drops)); assert.ok(drops.some((o) => /importance 1/.test(o.detail))); assert.ok(drops.some((o) => /메타·사소/.test(o.detail)));
});

test('약속 주어는 who 로 코드가 정한다; 질문·요청만 한 턴의 선호는 저장하지 않는다', async () => {
  const { composePromise, isQuestionOnly } = setup().memory._internal;
  assert.equal(composePromise({ type: 'promise', who: 'character' }, '코드 리뷰를 봐주기로 했다'), '캐릭터는 사용자에게 코드 리뷰를 봐주기로 했다');
  assert.equal(composePromise({ type: 'promise', who: 'character' }, '사용자는 캐릭터에게 코드 리뷰를 부탁했다'), '캐릭터는 사용자에게 코드 리뷰를 해주기로 했다');
  assert.equal(composePromise({ type: 'promise', who: 'user' }, '캐릭터는 사용자에게 고향식 사과파이를 구워 주기로 했다'), '사용자는 캐릭터에게 고향식 사과파이를 구워 주기로 했다');
  assert.equal(composePromise({ type: 'promise' }, '캐릭터는 사용자의 코드 리뷰를 봐주기로 했다'), '캐릭터는 사용자의 코드 리뷰를 봐주기로 했다'); // who 없음 → 그대로
  assert.equal(isQuestionOnly('오후 네 시인데 너무 졸려요. 뭐 마실까요?'), true);
  assert.equal(isQuestionOnly('저녁 회식 메뉴를 제가 정해야 하는데, 선배님이 하나 골라 주세요.'), true);
  assert.equal(isQuestionOnly('저 커피는 디카페인만 마셔요. 카페인 들어가면 밤에 잠을 못 자서요.'), false);
  assert.equal(isQuestionOnly('나 매운 거 못 먹어, 기억해 줘.'), false);
  // 질문 턴에서 나온 preference 는 버려지고, 같은 턴의 캐릭터 약속(who)은 주어가 바로잡혀 저장된다
  const app = setup({ responses: [J({ ops: [
    { op: 'ADD', type: 'preference', text: '사용자는 오후에 졸리면 진한 커피를 마시고 싶어 한다', importance: 2 },
    { op: 'ADD', type: 'promise', who: 'character', text: '탕비실에 디카페인 커피를 준비해 두기로 했다', importance: 3 },
  ] })] });
  const c = app.startConv('q');
  app.say(c, 1, 'user', '오후 네 시인데 너무 졸려요. 뭐 마실까요?'); app.say(c, 1, 'assistant', '디카페인 준비해 둘게');
  const u = await app.memory.update({ user_id: 'q', conversation_id: c, turn_no: 1, force: true, messages: [{ turn_no: 1, role: 'user', text: '오후 네 시인데 너무 졸려요. 뭐 마실까요?' }, { turn_no: 1, role: 'assistant', text: '디카페인 준비해 둘게' }] });
  assert.deepEqual(u.ops.map((o) => o.text), ['캐릭터는 사용자에게 탕비실에 디카페인 커피를 준비해 두기로 했다']);
});

test('종료 요약의 옛 이름: 이름 슬롯 이력(value)에서 금지어를 넣고, 남으면 정정 쌍으로 코드 치환하며, 그래도 남을 때만 재요청한다', async () => {
  const app = setup({ responses: [
    J({ ops: [{ op: 'ADD', type: 'fact', slot: 'pet.name', entity: 'pet#1', value: '루나', text: '사용자의 말 이름은 루나다', importance: 3 }] }),
    (req) => { const id = /\[id (\d+)\]/.exec(req.messages[0].content)[1]; return J({ ops: [{ op: 'UPDATE', item_id: Number(id), type: 'fact', slot: 'pet.name', entity: 'pet#1', value: '코코', text: '사용자의 말 이름은 코코다', importance: 3 }] }); },
    (req) => { assert.match(req.messages[0].content, /옛 값이므로 episode 에 쓰지 말 것: 루나/); return J({ episode: '레오의 말 루나는 코코로 이름이 바뀌었다.', merge: [] }); },
  ] });
  const { memory } = app;
  const c = app.startConv('ep');
  await app.turn('ep', c, 1, '나는 말 루나랑 여행해');
  await app.turn('ep', c, 2, '아니 말 이름 코코야 루나 아니야');
  const r = await memory.consolidate({ user_id: 'ep', conversation_id: c });
  assert.equal(r.ops.find((o) => o.op === 'EPISODE').summary, '레오의 말 코코는 코코로 이름이 바뀌었다.'); // 코드 치환(루나→코코), 재요청 없음
  assert.equal(r.attempts.filter((a) => a.tag === 'consolidate').length, 1);
  const log = (await memory.list({ user_id: 'ep', include_log: true })).ops_log;
  assert.ok(log.some((o) => o.op === 'EPISODE_FIX')); assert.ok(!log.some((o) => o.op === 'EPISODE_RETRY'));
});

test('UPDATE 대상은 구조로 정한다: slot·entity 가 맞으면 UPDATE, id 가 다른 속성을 가리키면 단일값 속성(거주지)만 같은 slot 하나뿐일 때 재지정(RETARGET), 다중값 속성(루틴)은 덮지 않고 ADD(UPDATE_SKIPPED)', async () => {
  const app = setup({ responses: [
    J({ ops: [{ op: 'ADD', type: 'fact', slot: 'user.allergy', entity: 'user', text: '사용자는 해산물 알레르기가 있다', importance: 5 },
              { op: 'ADD', type: 'fact', slot: 'user.routine', entity: 'user', text: '사용자는 퇴근 후 한강에서 자전거를 탄다', importance: 3 },
              { op: 'ADD', type: 'fact', slot: 'user.location', entity: 'user', text: '사용자는 부산에 산다', importance: 4 }] }),
    // (nc10) 모델이 자전거 항목 id 에 "수영을 그만뒀다"(routine, closed 없음·다른 사실) → 다중값이므로 재지정하지 않고 ADD. 자전거는 그대로.
    (req) => { const bike = /\[id (\d+)\] \(fact[^)]*\) 사용자는 퇴근 후/.exec(req.messages[0].content)[1]; return J({ ops: [{ op: 'UPDATE', item_id: Number(bike), type: 'fact', slot: 'user.skill', entity: 'user', text: '사용자는 클라이밍을 시작했다', importance: 3 }] }); },
    // 단일값(거주지): 모델이 알레르기 id 를 잘못 가리켜도 user.location 활성 항목이 하나뿐 → 그쪽으로 재지정
    (req) => { const wrong = /\[id (\d+)\] \(fact[^)]*\) 사용자는 해산물/.exec(req.messages[0].content)[1]; return J({ ops: [{ op: 'UPDATE', item_id: Number(wrong), type: 'fact', slot: 'user.location', entity: 'user', text: '사용자는 서울에 산다', importance: 4 }] }); },
    // closed 와 같은 entity 면 속성 라벨이 달라도 그 id 를 닫는다(수영을 health 로 저장했다가 routine 으로 닫는 사례)
    (req) => { const bike = /\[id (\d+)\] \(fact[^)]*\) 사용자는 퇴근 후/.exec(req.messages[0].content)[1]; return J({ ops: [{ op: 'UPDATE', item_id: Number(bike), type: 'fact', slot: 'user.hobby', entity: 'user', closed: true, text: '사용자는 자전거를 그만뒀다', importance: 3 }] }); },
  ] });
  const { memory } = app;
  const c = app.startConv('safe');
  const say = (t, u) => { app.say(c, t, 'user', u); app.say(c, t, 'assistant', '응'); return memory.update({ user_id: 'safe', conversation_id: c, turn_no: t, force: true, messages: [{ turn_no: t, role: 'user', text: u }] }); };
  await say(1, '나 해산물 알레르기 있어. 퇴근하고 한강에서 자전거 타. 부산 살아');
  const u2 = await say(2, '클라이밍 시작했어');
  assert.ok(u2.ops.some((o) => o.op === 'UPDATE_SKIPPED'), JSON.stringify(u2.ops)); assert.ok(u2.ops.some((o) => o.op === 'ADD' && /클라이밍/.test(o.text)));
  const u3 = await say(3, '이사해서 이제 서울 살아');
  assert.ok(u3.ops.some((o) => o.op === 'UPDATE_RETARGET'), JSON.stringify(u3.ops)); assert.ok(u3.ops.some((o) => o.op === 'UPDATE' && /서울/.test(o.text)));
  let act = (await memory.list({ user_id: 'safe' })).items.map((i) => i.text);
  assert.ok(act.includes('사용자는 해산물 알레르기가 있다') && act.includes('사용자는 퇴근 후 한강에서 자전거를 탄다') && act.includes('사용자는 서울에 산다') && !act.includes('사용자는 부산에 산다'), act.join(' | '));
  const u4 = await say(4, '자전거는 그만뒀어');
  assert.ok(u4.ops.some((o) => o.op === 'UPDATE' && /자전거를 그만뒀다/.test(o.text)), JSON.stringify(u4.ops));
  act = (await memory.list({ user_id: 'safe' })).items.map((i) => i.text);
  assert.ok(!act.includes('사용자는 퇴근 후 한강에서 자전거를 탄다') && act.includes('사용자는 클라이밍을 시작했다'), act.join(' | '));
  const { composePromise, sanitizeOp } = memory._internal;
  assert.equal(composePromise({ type: 'promise', who: 'user' }, '직접 구운 쿠키를 캐릭터에게 갖다 주기로 했다'), '사용자는 캐릭터에게 직접 구운 쿠키를 갖다 주기로 했다');
  assert.equal(sanitizeOp({ type: 'promise', text: '캐릭터는 사용자에게 마을을 안내하기로 한 약속은 이미 기록되어 있다', when: null }, '2026-10-23'), null); // 메타 문장
});

test('캐릭터 응답의 지문(*…*)은 추출 입력·종료 요약 입력에서 제거되고 약속 신호도 대사에서만 본다', async () => {
  const { stripDirections, extractUser } = await import('../prompts.js');
  assert.equal(stripDirections('*컵을 내려놓으며 미소 짓는다* 다음에 올 때 라떼아트 그려줄게!'), '다음에 올 때 라떼아트 그려줄게!');
  assert.equal(stripDirections('*고개를 끄덕인다*'), '*고개를 끄덕인다*'); // 전부 지문이면 원문 유지
  const p = extractUser({ profile: {}, items: [], currentTurn: 3, newMessages: [
    { turn_no: 3, role: 'user', text: '다음에 올 때 쿠키 가져갈게' },
    { turn_no: 3, role: 'assistant', text: '*창가 자리를 정리하며 눈을 빛낸다. 오늘은 비가 와서 손님이 적다.* 응, 기대할게! 나도 라떼아트 그려줄게.' },
  ] });
  assert.match(p, /캐릭터: 응, 기대할게! 나도 라떼아트 그려줄게\./);
  assert.doesNotMatch(p, /창가 자리|손님이 적다/);
  const q = extractUser({ profile: {}, items: [], currentTurn: 4, plainAssistantChars: 20, assistantChars: 200, newMessages: [
    { turn_no: 4, role: 'assistant', text: '*내일 같이 가자고 말하려다 멈춘다* 오늘 날씨 좋네. 창밖에 햇살이 가득하고 사람들이 천천히 걸어 다닌다. 커피 향이 좋다.' },
  ] });
  assert.match(q, /캐릭터: 오늘 날씨 좋네\. 창밖에 햇살이 가득…/); // 지문의 약속 신호는 무시 → 20자 절단
});

test('이름 전파는 value 치환만 하고 딸린 약속 닫기는 depends_on 만 본다 → 이름 변경에 약속이 닫히지 않는다(fmt4 yuna 회귀)', async () => {
  const app = setup({ responses: [
    J({ ops: [{ op: 'ADD', type: 'fact', slot: 'pet.name', entity: 'pet#1', value: '하늘이', text: '사용자는 고양이 하늘이를 키우기 시작했다', importance: 3 },
              { op: 'ADD', type: 'promise', who: 'character', slot: 'promise.promise', entity: 'promise#1', text: '하늘이 사진을 보고 고양이 라떼아트를 그려주기로 했다', importance: 3 }] }),
    (req) => { const id = /\[id (\d+)\] \(fact[^)]*\)/.exec(req.messages[0].content)[1]; return J({ ops: [{ op: 'UPDATE', item_id: Number(id), type: 'fact', slot: 'pet.name', entity: 'pet#1', value: '구름이', text: '사용자는 고양이를 키우기 시작했고 이름은 구름이다', importance: 3 }] }); },
  ] });
  const { memory } = app;
  const c = app.startConv('pf');
  app.say(c, 1, 'user', '나 고양이 하늘이 키워'); app.say(c, 1, 'assistant', '하늘이 사진 보여주면 라떼아트 그려줄게');
  await memory.update({ user_id: 'pf', conversation_id: c, turn_no: 1, force: true, messages: [{ turn_no: 1, role: 'user', text: '나 고양이 하늘이 키워. 라떼에 고양이 그려줄 수 있어?' }, { turn_no: 1, role: 'assistant', text: '하늘이 사진 보여주면 라떼아트 그려줄게' }] });
  app.say(c, 2, 'user', '고양이 이름 구름이로 바꿨어'); app.say(c, 2, 'assistant', '응');
  const u = await memory.update({ user_id: 'pf', conversation_id: c, turn_no: 2, force: true, messages: [{ turn_no: 2, role: 'user', text: '고양이 이름 하늘이에서 구름이로 바꿨어' }] });
  assert.ok(u.ops.some((o) => o.op === 'PROPAGATE' && o.from === '하늘이' && o.to === '구름이'), JSON.stringify(u.ops));
  assert.ok(!u.ops.some((o) => o.op === 'CLOSE_DEPENDENT'), JSON.stringify(u.ops));
  const act = (await memory.list({ user_id: 'pf' })).items.map((i) => i.text);
  assert.ok(act.includes('캐릭터는 사용자에게 구름이 사진을 보고 고양이 라떼아트를 그려주기로 했다'), JSON.stringify(act));
});

test('정정은 slot·entity 로 잡힌다: "달린다"→"달리기를 그만뒀다"(같은 user.routine)는 UPDATE, 같은 id 를 겨눈 고양이 이름(pet.name)은 차단 후 ADD (nc1 naruto T17·T22)', async () => {
  const app = setup({ responses: [
    J({ ops: [{ op: 'ADD', type: 'fact', slot: 'user.routine', entity: 'user', text: '사용자는 아침마다 마을을 한 바퀴씩 달린다', importance: 3 }] }),
    (req) => { const id = /\[id (\d+)\] \(fact[^)]*\) 사용자는 아침마다/.exec(req.messages[0].content)[1]; return J({ ops: [{ op: 'UPDATE', item_id: Number(id), type: 'fact', slot: 'user.routine', entity: 'user', closed: true, text: '사용자는 달리기를 그만뒀다', importance: 3 }, { op: 'ADD', type: 'fact', slot: 'user.skill', entity: 'user', text: '사용자는 검술을 배우기 시작했다', importance: 3 }] }); },
    // 모델이 id 를 틀려 '달리기를 그만뒀다' 항목에 고양이 이름 UPDATE → slot 불일치(pet.name 활성 없음) → 차단
    (req) => { const wrong = /\[id (\d+)\] \(fact[^)]*\) 사용자는 달리기를 그만뒀다/.exec(req.messages[0].content)[1]; return J({ ops: [{ op: 'UPDATE', item_id: Number(wrong), type: 'fact', slot: 'pet.name', entity: 'pet#1', value: '유자', text: '사용자의 고양이 이름은 유자다', importance: 4 }] }); },
  ] });
  const { memory } = app;
  const c = app.startConv('src');
  const say = (t, u) => { app.say(c, t, 'user', u); app.say(c, t, 'assistant', '응'); return memory.update({ user_id: 'src', conversation_id: c, turn_no: t, force: true, messages: [{ turn_no: t, role: 'user', text: u }] }); };
  await say(12, '나 요즘 아침마다 달리기해. 마을 한 바퀴씩.');
  const u17 = await say(17, '달리기는 그만뒀어. 대신 검술 배우기 시작했는데 팔이 너무 아파 ㅋㅋ');
  assert.ok(u17.ops.some((o) => o.op === 'UPDATE' && /그만뒀다/.test(o.text)), JSON.stringify(u17.ops));
  assert.ok(!u17.ops.some((o) => o.op === 'UPDATE_SKIPPED'));
  const u22 = await say(22, '고양이 이름 또 바꿨어. 보리도 안 어울려서 결국 유자로 정착!');
  assert.ok(u22.ops.some((o) => o.op === 'UPDATE_SKIPPED'), JSON.stringify(u22.ops));
  const act = (await memory.list({ user_id: 'src' })).items;
  assert.ok(!act.some((i) => /달린다/.test(i.text)), act.map((i) => i.text).join(' | ')); // 옛 값이 공존하지 않는다
  assert.ok(act.map((i) => i.text).includes('사용자는 달리기를 그만뒀다')); assert.ok(act.map((i) => i.text).includes('사용자의 고양이 이름은 유자다'));
  assert.equal(act.find((i) => /유자/.test(i.text)).value, '유자');
});

test('messages.active(채팅앱 응답 버전 넘기기): 접힌 행(active=0)은 기억이 읽는 모든 messages 조회에서 제외되고, 컬럼 없는 DB 는 조건 없이 동작', async () => {
  const app = setup({ activeColumn: true });
  const { memory } = app; const store = memory._internal.store;
  const c = app.startConv('ver');
  app.say(c, 1, 'user', '나 부산 살아'); app.say(c, 1, 'assistant', '바다 좋지');
  // 2턴 다시 생성: 같은 turn_no 의 assistant 행 2개, 하나만 active
  app.say(c, 2, 'user', '오늘 뭐 먹지'); app.say(c, 2, 'assistant', '버린 답', { active: 0 }); app.say(c, 2, 'assistant', '국밥 어때');
  // 3턴 수정: 3턴 가지(사용자+답)는 접히고 새 턴 4 로 이어간다
  app.say(c, 3, 'user', '나 고양이 키워', { active: 0 }); app.say(c, 3, 'assistant', '귀엽겠다', { active: 0 });
  app.say(c, 4, 'user', '나 강아지 키워', { created_at: '2026-10-22T10:00:00.000Z' }); app.say(c, 4, 'assistant', '멍멍', { created_at: '2026-10-22T10:00:00.000Z' });
  const rows = store.conversationMessages(c);
  assert.equal(rows.length, 6); assert.ok(!rows.some((m) => /고양이|버린 답/.test(m.text))); // 9행 중 접힌 3행 제외
  assert.equal(store.userMessageText(c, 3), ''); assert.equal(store.userMessageText(c, 4), '나 강아지 키워');
  assert.equal(store.messageDate(c, 3), store.conversationStartedAt(c)); // 접힌 턴 → 대화 시작일로 대체
  assert.equal(store.latestMessageDate(c), '2026-10-22T10:00:00.000Z');
  const cands = store.deepCandidates('ver', 999, 0, 20);
  assert.ok(cands.length === 3 && !cands.some((m) => /고양이/.test(m.text)), JSON.stringify(cands.map((m) => m.text)));
  // MAX(turn_no) 는 접힌 행 포함(앱 규칙: 턴 번호는 전체 최대값+1 로 이어감) — update 가 현재 턴을 알아내는 경로가 그대로 동작
  assert.equal(store.q('SELECT MAX(turn_no) t FROM messages WHERE conversation_id=?').get(c).t, 4);
  // 컬럼 없는 DB: 조건 생략
  const plain = setup({}); const pc = plain.startConv('p'); plain.say(pc, 1, 'user', '안녕');
  assert.equal(plain.memory._internal.store.activeCond(), ''); assert.equal(plain.memory._internal.store.conversationMessages(pc).length, 1);
});

test('프로필 이름·호칭 저장 금지 규칙: 반려동물·제3자의 "이름은 X"는 사용자 이름으로 쓰지 않고(PROFILE_SKIPPED), 자기소개는 저장(nc2 채팅앱 발견: 고양이 보리 → 사용자 이름)', async () => {
  const { profileNameOk } = (await import('../index.js'))._internal;
  assert.equal(profileNameOk('보리', ['나루토 안녕! 나는 고양이 키워, 이름은 보리야']), false);
  assert.equal(profileNameOk('수아', ['내 동생 이름은 수아야. 나는 지민이야']), false);
  assert.equal(profileNameOk('지민', ['내 동생 이름은 수아야. 나는 지민이야']), true);
  assert.equal(profileNameOk('지민', ['나 지민이야']), true);
  assert.equal(profileNameOk('지민', ['저는 지민입니다']), true);
  assert.equal(profileNameOk('지민', ['지민이라고 불러']), true);
  assert.equal(profileNameOk('하린', ['하린이라고 해']), true);
  assert.equal(profileNameOk('민수', ['이름은 민수예요']), true); // 제3자 명사 없음 → 허용
  assert.equal(profileNameOk('도윤', ['나 요즘 아침마다 달리기해']), false); // 발화에 없는 이름은 지어낸 것
  assert.equal(profileNameOk('오빠', ['그냥 오빠라고 불러'], '호칭'), true); // 호칭
  assert.equal(profileNameOk('키워', ['나루토 안녕! 나는 고양이 키워, 이름은 보리야'], '호칭'), false); // 동사 조각이 호칭으로(실측 2/4)
  assert.equal(profileNameOk('키워', ['나루토 안녕! 나는 고양이 키워, 이름은 보리야']), false); // 이름으로도 거부
  assert.equal(profileNameOk('선배', ['선배라고 하면 돼요'], '호칭'), true);
  assert.equal(profileNameOk('보리', ['우리 고양이 키워. 이름은 보리야']), false); // 문장 경계 넘는 제3자 창
  assert.equal(profileNameOk('지민', ['지민입니다']), true);
  const app = setup({ responses: [
    J({ profile: { 이름: '보리' }, ops: [{ op: 'ADD', type: 'fact', text: '사용자는 고양이 보리를 키운다', importance: 4 }] }),
    J({ profile: { 이름: '하린' }, ops: [] }),
  ] });
  const { memory } = app; const c = app.startConv('pn');
  const say = (t, u) => { app.say(c, t, 'user', u); app.say(c, t, 'assistant', '응'); return memory.update({ user_id: 'pn', conversation_id: c, turn_no: t, force: true, messages: [{ turn_no: t, role: 'user', text: u }] }); };
  const u1 = await say(1, '나루토 안녕! 나는 고양이 키워, 이름은 보리야');
  assert.ok(u1.ops.some((o) => o.op === 'PROFILE_SKIPPED' && o.value === '보리'), JSON.stringify(u1.ops));
  assert.ok(u1.ops.some((o) => o.op === 'ADD' && /보리/.test(o.text))); // 고양이 사실은 저장
  assert.equal((await memory.list({ user_id: 'pn' })).profile.name, undefined);
  const u2 = await say(2, '아 맞다, 나는 하린이야');
  assert.ok(u2.ops.some((o) => o.op === 'PROFILE' && o.value === '하린'), JSON.stringify(u2.ops));
  assert.equal((await memory.list({ user_id: 'pn' })).profile.name, '하린'); // 옛 키 '이름' 은 name 으로 정규화된다
});

test('구조 재설계: 언어 무관 — 일본어 항목도 slot·entity·value·depends_on 으로 정정·전파·딸린 약속 닫기가 동작한다(단어 겹침 없음, B5)', async () => {
  const app = setup({ responses: [
    J({ ops: [{ op: 'ADD', type: 'fact', slot: 'pet.name', entity: 'pet#1', value: 'モモ', text: 'ユーザーの猫の名前はモモだ', importance: 4 },
              { op: 'ADD', type: 'event', slot: 'event.plan', entity: 'event#1', text: 'ユーザーは友達と花火を見に行く', when: '来週の土曜日', importance: 3 }] }),
    (req) => { const ev = Number(/\[id (\d+)\] \(event[^)]*\)/.exec(req.messages[0].content)[1]); return J({ ops: [
      { op: 'ADD', type: 'promise', slot: 'promise.promise', entity: 'promise#1', depends_on: [ev], text: 'キャラクターはモモの写真を見せてもらう約束をした', when: '来週の土曜日', importance: 3 },
      { op: 'ADD', type: 'promise', slot: 'promise.promise', entity: 'promise#2', text: 'キャラクターはモモにおやつを持ってくる約束をした', importance: 3 }] }); },
    // 이름 변경: item_id 없이 slot+entity 만으로 대상이 잡힌다. 일본어 토큰은 공백이 없어 keywords() 로는 문장 전체가 토큰 1개였다(B5)
    J({ ops: [{ op: 'UPDATE', type: 'fact', slot: 'pet.name', entity: 'pet#1', value: 'ココ', text: 'ユーザーの猫の名前はココだ', importance: 4 }] }),
    (req) => { const ev = Number(/\[id (\d+)\] \(event[^)]*\)/.exec(req.messages[0].content)[1]); return J({ ops: [{ op: 'UPDATE', item_id: ev, type: 'event', slot: 'event.plan', entity: 'event#1', closed: true, text: '花火は雨で中止になった', importance: 3 }] }); },
  ] });
  const { memory } = app;
  const c = app.startConv('ja', '2026-10-23T10:00:00.000Z');
  const say = (t, u) => { app.say(c, t, 'user', u); app.say(c, t, 'assistant', 'うん'); return memory.update({ user_id: 'ja', conversation_id: c, turn_no: t, force: true, lang: 'ja', messages: [{ turn_no: t, role: 'user', text: u }] }); };
  await say(1, '猫を飼ってる。名前はモモ。来週の土曜日に友達と花火を見に行くよ');
  await say(2, 'モモの写真見せるね。おやつも持ってきて');
  const u3 = await say(3, '猫の名前、ココに変えた');
  assert.ok(u3.ops.some((o) => o.op === 'UPDATE' && o.slot === 'pet.name'), JSON.stringify(u3.ops));
  assert.ok(u3.ops.some((o) => o.op === 'PROPAGATE' && o.from === 'モモ' && o.to === 'ココ'), JSON.stringify(u3.ops));
  let act = (await memory.list({ user_id: 'ja' })).items;
  assert.ok(act.some((i) => i.text === 'キャラクターはココの写真を見せてもらう約束をした')); assert.ok(!act.some((i) => /モモ/.test(i.text)));
  const u4 = await say(4, '花火、雨で中止になった');
  assert.ok(u4.ops.some((o) => o.op === 'CLOSE_DEPENDENT'), JSON.stringify(u4.ops));
  act = (await memory.list({ user_id: 'ja' })).items;
  assert.ok(!act.some((i) => /写真/.test(i.text)), '딸린 약속(사진)은 닫힌다'); assert.ok(act.some((i) => /おやつ/.test(i.text)), '무관한 약속은 남는다');
  assert.equal(act.find((i) => /中止/.test(i.text)).type, 'fact');
  const r = await memory.retrieve({ user_id: 'ja', conversation_id: c, query: 'ねえ', budget_tokens: 400, lang: 'ja' });
  assert.match(r.text, /^記憶:/); assert.match(r.text, /ココ/); assert.doesNotMatch(r.text, /モモ/);
  assert.deepEqual(memory._internal.renamePairs('ja'), [['モモ', 'ココ']]);
});

test('구조 재설계: 재설계 전 DB(구조 컬럼 없음·한국어 프로필 키)는 init 때 마이그레이션되고, 구조 없는 옛 항목은 id 를 믿는 UPDATE 로 동작한다', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const { APP_SCHEMA } = await import('./helpers.js');
  const db = new DatabaseSync(':memory:');
  db.exec(APP_SCHEMA);
  db.exec(`CREATE TABLE memory_profile (user_id TEXT NOT NULL, slot TEXT NOT NULL, value TEXT NOT NULL, source_conversation_id INTEGER, source_turn INTEGER, updated_at TEXT NOT NULL, PRIMARY KEY (user_id, slot));
    CREATE TABLE memory_items (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, type TEXT NOT NULL, text TEXT NOT NULL, when_text TEXT, source_conversation_id INTEGER NOT NULL, source_turn INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'active', superseded_by INTEGER, invalidated_at TEXT, importance INTEGER NOT NULL DEFAULT 3, use_count INTEGER NOT NULL DEFAULT 0, last_used_at TEXT, embedding BLOB, created_at TEXT NOT NULL);
    INSERT INTO memory_profile VALUES ('old','이름','민수',1,1,'2026-10-20T00:00:00Z');
    INSERT INTO memory_items (user_id,type,text,source_conversation_id,source_turn,created_at) VALUES ('old','fact','사용자는 부산에 산다',1,1,'2026-10-20T00:00:00Z');`);
  const memory = await import('../index.js');
  const { createFakeModel } = await import('../fake-model.js');
  memory.init({ db, model: createFakeModel({ responses: [J({ ops: [{ op: 'UPDATE', item_id: 1, type: 'fact', slot: 'user.location', entity: 'user', text: '사용자는 서울에 산다', importance: 3 }] })] }), policy: {} });
  const cols = db.prepare('PRAGMA table_info(memory_items)').all().map((c) => c.name);
  for (const c of ['slot', 'entity', 'depends_on', 'value']) assert.ok(cols.includes(c), c);
  const l = await memory.list({ user_id: 'old' });
  assert.equal(l.profile.name, '민수'); assert.equal(l.profile['이름'], undefined);
  assert.deepEqual(l.items.map((i) => [i.slot, i.entity, i.value]), [[null, null, null]]);
  const cid = Number(db.prepare("INSERT INTO conversations (user_id, character_id, started_at) VALUES ('old','x','2026-10-23T00:00:00Z')").run().lastInsertRowid);
  db.prepare("INSERT INTO messages (conversation_id, turn_no, role, text, created_at) VALUES (?,1,'user','이사해서 이제 서울 살아','2026-10-23T00:00:00Z')").run(cid);
  const u = await memory.update({ user_id: 'old', conversation_id: cid, turn_no: 1, force: true, messages: [{ turn_no: 1, role: 'user', text: '이사해서 이제 서울 살아' }] });
  assert.ok(u.ops.some((o) => o.op === 'UPDATE' && o.replaces === 1), JSON.stringify(u.ops));
  const after = (await memory.list({ user_id: 'old' })).items;
  assert.deepEqual(after.map((i) => [i.text, i.slot, i.entity]), [['사용자는 서울에 산다', 'user.location', 'user']]);
  const r = await memory.retrieve({ user_id: 'old', conversation_id: cid, query: '안녕', budget_tokens: 400 });
  assert.match(r.text, /이름 민수/); // 블록 프로필 라벨은 대화 언어(ko)
});

test('추출 입력: 기억을 묻는 짧은 질문 턴은 다른 새 턴이 있으면 묶음에서 빠진다(앱 대화 326: 질문 턴이 묶음 끝에 있으면 추출기가 묶음 전체를 건너뛰었다)', async () => {
  const app = setup({ responses: [J({ ops: [] }), J({ ops: [] })] });
  const c = app.startConv('q');
  const msgs = [
    { turn_no: 2, role: 'user', text: '저는 고양이를 키우는데 이름은 보리예요' }, { turn_no: 2, role: 'assistant', text: '반갑구려' },
    { turn_no: 3, role: 'user', text: '아 고양이 이름 보리가 아니라 나비였어요' }, { turn_no: 3, role: 'assistant', text: '나비라' },
    { turn_no: 4, role: 'user', text: '제 고양이 이름이 뭐라고 했죠?' }, { turn_no: 4, role: 'assistant', text: '나비라 하지 않았소?' },
  ];
  await app.memory.update({ user_id: 'q', conversation_id: c, turn_no: 4, force: true, reason: 'end_flush', messages: msgs });
  const u = app.model.calls.find((x) => x.kind === 'complete').messages[0].content;
  assert.match(u, /\[턴 2\]/); assert.match(u, /\[턴 3\]/); assert.doesNotMatch(u, /\[턴 4\]/); assert.doesNotMatch(u, /뭐라고 했죠/);
  // 질문 턴만 있는 묶음은 그대로 들어간다(뺄 것이 없음)
  await app.memory.update({ user_id: 'q', conversation_id: c, turn_no: 5, force: true, messages: [{ turn_no: 5, role: 'user', text: '내가 뭐라고 했지?' }, { turn_no: 5, role: 'assistant', text: '응' }] });
  const u2 = app.model.calls.filter((x) => x.kind === 'complete').at(-1).messages[0].content;
  assert.match(u2, /\[턴 5\]/);
});

test('(nc8 회귀) 다중값 속성(family.relation·user.routine …)에서 닫힘 신호 없는 UPDATE 는 옛 사실을 덮지 않고 ADD 로 둔다; 회상 질문 판정은 부탁·초대를 걸지 않는다', async () => {
  const app = setup({ responses: [
    J({ ops: [{ op: 'ADD', type: 'preference', slot: 'family.relation', entity: 'family#1', text: '사용자의 누나는 매운 음식을 좋아해서 불닭을 간식으로 먹는다', importance: 3 },
              { op: 'ADD', type: 'fact', slot: 'user.routine', entity: 'user', text: '사용자는 방송부에서 점심시간에 교내 방송을 진행한다', importance: 3 }] }),
    // 모델이 "같은 대상의 다른 사실"을 UPDATE 로 보냄(id·slot·entity 모두 일치) → 닫힘 신호 없음 → 덮지 않고 ADD
    (req) => { const id = /\[id (\d+)\] \(preference[^)]*\) 사용자의 누나/.exec(req.messages[0].content)[1]; const rid = /\[id (\d+)\] \(fact[^)]*\) 사용자는 방송부/.exec(req.messages[0].content)[1]; return J({ ops: [
      { op: 'UPDATE', item_id: Number(id), type: 'fact', slot: 'family.relation', entity: 'family#1', text: '사용자의 누나는 고등학교 때 사진부였다', importance: 3 },
      { op: 'UPDATE', item_id: Number(rid), type: 'fact', slot: 'user.routine', entity: 'user', text: '사용자는 등교 전에 매일 아침 줄넘기를 한다', importance: 3 }] }); },
    // 닫힘 신호가 있으면 덮는다(루틴을 그만둠)
    (req) => { const rid = /\[id (\d+)\] \(fact[^)]*\) 사용자는 등교 전에/.exec(req.messages[0].content)[1]; return J({ ops: [{ op: 'UPDATE', item_id: Number(rid), type: 'fact', slot: 'user.routine', entity: 'user', closed: true, text: '사용자는 줄넘기를 그만뒀다', importance: 3 }] }); },
  ] });
  const { memory } = app; const c = app.startConv('mv');
  const say = (t, u) => { app.say(c, t, 'user', u); app.say(c, t, 'assistant', '응'); return memory.update({ user_id: 'mv', conversation_id: c, turn_no: t, force: true, messages: [{ turn_no: t, role: 'user', text: u }] }); };
  await say(1, '우리 누나는 매운 거 좋아해서 불닭을 간식으로 먹어. 나는 방송부야');
  const u2 = await say(2, '누나는 고등학교 때 사진부였어. 나는 등교 전에 줄넘기해');
  assert.equal(u2.ops.filter((o) => o.op === 'UPDATE_AS_ADD').length, 2, JSON.stringify(u2.ops));
  let act = (await memory.list({ user_id: 'mv' })).items.map((i) => i.text);
  assert.ok(act.some((t) => /불닭/.test(t)) && act.some((t) => /사진부/.test(t)) && act.some((t) => /방송부/.test(t)) && act.some((t) => /줄넘기/.test(t)), act.join(' | '));
  const u3 = await say(3, '줄넘기는 그만뒀어');
  assert.ok(u3.ops.some((o) => o.op === 'UPDATE' && /그만뒀다/.test(o.text)), JSON.stringify(u3.ops));
  act = (await memory.list({ user_id: 'mv' })).items.map((i) => i.text);
  assert.ok(!act.some((t) => /매일 아침 줄넘기를 한다/.test(t)) && act.some((t) => /방송부/.test(t)));
  const { isRecallQuestion } = memory._internal;
  for (const t of ['너 Kafka 잘 알지? 다음에 우리 팀 컨슈머 코드 한 번만 봐줄 수 있어?', '다음 주 수요일 저녁에 동기들끼리 볼링 치기로 했는데, 너도 올 거지?', '다음 주 수요일 저녁에 친구들이랑 불꽃놀이 보러 가기로 했는데, 너도 올래?']) assert.equal(isRecallQuestion(t), false, t);
  for (const t of ['제 고양이 이름이 뭐라고 했죠?', '내가 친구 언제 어디서 만난다고 했는지 기억나?', '나 요즘 아침에 뭐 배운다고 했지?', '내가 지금 무슨 팀이라고 했었지?']) assert.equal(isRecallQuestion(t), true, t);
});

test('임베딩 429/quota 실패: 깊은 검색은 키워드로 대체되고 블록은 정상, 이후 쿨다운 동안 임베딩을 시도하지 않는다(nc9)', async () => {
  const app = setup({ responses: [J({ ops: [{ op: 'ADD', type: 'fact', slot: 'pet.name', entity: 'pet#1', value: '밤톨', text: '사용자의 강아지 이름은 밤톨이다', importance: 4 }] })] });
  const { memory } = app; memory._internal.resetEmbedCooldown();
  let embedCalls = 0;
  app.model.embed = async () => { embedCalls++; const e = new Error('gemini-embedding-001: 429 {"error":{"code":429,"message":"You exceeded your current quota"}}'); e.attempts = [{ model: 'gemini-embedding-001', ok: false, error: '429 quota', cost_krw: 0 }]; throw e; };
  const prev = app.startConv('emb'); for (let t = 1; t <= 3; t++) { app.say(prev, t, 'user', t === 2 ? '우리 강아지는 산책을 정말 좋아해' : `잡담 ${t}`); app.say(prev, t, 'assistant', '응'); }
  const cur = app.startConv('emb');
  for (let t = 1; t <= 8; t++) { app.say(cur, t, 'user', `잡담 ${t}`); app.say(cur, t, 'assistant', '응'); }
  await memory.update({ user_id: 'emb', conversation_id: cur, turn_no: 1, force: true, messages: [{ turn_no: 1, role: 'user', text: '우리 강아지 이름은 밤톨이야' }] });
  app.say(cur, 9, 'user', '우리 강아지 산책 얘기 전에 말했잖아 기억나?');
  const r1 = await memory.retrieve({ user_id: 'emb', conversation_id: cur, query: '우리 강아지 산책 얘기 전에 말했잖아 기억나?', budget_tokens: 500 });
  assert.equal(embedCalls, 1); assert.match(r1.text, /밤톨/); assert.equal(r1.deep_search.method, 'keyword(embed failed)'); assert.ok(r1.deep_search.hits.some((h) => /산책/.test(h.text)));
  assert.ok(r1.attempts.some((a) => a.tag === 'embed' && a.ok === false)); // 실패 비용도 기록
  assert.ok(memory._internal.embedCooldownUntil > Date.now());
  const r2 = await memory.retrieve({ user_id: 'emb', conversation_id: cur, query: '우리 강아지 산책 얘기 전에 말했잖아 기억나?', budget_tokens: 500 });
  assert.equal(embedCalls, 1, '쿨다운 중에는 임베딩을 다시 시도하지 않는다'); assert.equal(r2.deep_search.method, 'keyword(embed cooldown)'); assert.match(r2.text, /밤톨/);
  memory._internal.resetEmbedCooldown();
});

test('recall: 블록에 없는 항목 중 이번 발화와 겹치는 것만 골라 기록한다(AI 호출 없음)', async () => {
  const app = setup({ responses: [J({ ops: [
    { op: 'ADD', type: 'fact', text: '사용자는 우쿨렐레를 배우기 시작했다', importance: 3 },
    { op: 'ADD', type: 'preference', text: '사용자는 평양냉면을 제일 좋아한다', importance: 3 },
  ] })] });
  const conv = app.startConv('kezi');
  await app.turn('kezi', conv, 1, '나 요즘 우쿨렐레 배우기 시작했어. 그리고 평양냉면을 제일 좋아해');
  const before = app.model.calls.length;
  const r = await app.memory.recall({ user_id: 'kezi', conversation_id: conv, query: '우쿨렐레 연습하다 손가락 아파', block_text: '' });
  assert.equal(app.model.calls.length, before);
  assert.equal(r.items.length, 1);
  assert.match(r.text, /우쿨렐레/);
  assert.doesNotMatch(r.text, /평양냉면/);
  // 이미 블록에 있으면 고르지 않는다
  const r2 = await app.memory.recall({ user_id: 'kezi', conversation_id: conv, query: '우쿨렐레 연습', block_text: '- 사실: 사용자는 우쿨렐레를 배우기 시작했다' });
  assert.equal(r2.items.length, 0);
  // 겹침 없으면 빈 텍스트
  assert.equal((await app.memory.recall({ user_id: 'kezi', conversation_id: conv, query: '오늘 날씨 좋다' })).text, '');
  const log = (await app.memory.list({ user_id: 'kezi', include_log: true })).ops_log.filter((o) => o.op === 'RECALL');
  assert.equal(log.length, 1);
});
