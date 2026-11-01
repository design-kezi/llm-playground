import { db, now, recordCalls } from './db.js';
import { getCharacter } from './characters.js';
import { assemble, characterPrompt, languageBlock, needsNudge, needsDate, todayLine, replyLang, replyLangLine, questionStreak, LANGUAGES, SHEET_LANGS } from './context.js';
import { config, runSettings } from './config.js';
import * as model from './model.js';
import * as memory from './memory.js';

const memoryOn = config.memory === 'on';

// 기억 모듈에 DB 연결과 모델 모듈을 넘긴다(프로세스당 1회, 첫 요청 시점).
function ensureMemoryInit() {
  if (globalThis.__liteMemoryInit) return;
  memory.init({ db, model });
  globalThis.__liteMemoryInit = true;
}

export function startConversation({ user_name, character_id, language = 'ko', sheet_lang = 'ko' }) {
  ensureMemoryInit();
  const user_id = (user_name ?? '').trim();
  if (!user_id) throw httpError(400, 'user_name 필요');
  const character = getCharacter(character_id);
  if (!character) throw httpError(400, '없는 character_id');
  if (!LANGUAGES.includes(language)) throw httpError(400, `language 허용값: ${LANGUAGES.join('|')}`);
  if (!SHEET_LANGS.includes(sheet_lang)) throw httpError(400, `sheet_lang 허용값: ${SHEET_LANGS.join('|')}`);
  if (!characterPrompt(character, sheet_lang)) throw httpError(400, `${character_id} 에 ${config.character_variant}/${sheet_lang} 시트 없음`);
  if (languageBlock(character, language, sheet_lang) === null) throw httpError(400, `${character_id} 에 ${language} 언어 데이터 없음`);
  const r = db.prepare('INSERT INTO conversations (user_id, character_id, language, sheet_lang, started_at, settings) VALUES (?,?,?,?,?,?)')
    .run(user_id, character_id, language, sheet_lang, now(), JSON.stringify(runSettings()));
  return { conversation_id: Number(r.lastInsertRowid), user_id, character_id, language, sheet_lang };
}

export async function sendMessage(conversationId, text, opts = {}) {
  ensureMemoryInit();
  await settled(conversationId);
  const conv = getConversation(conversationId);
  if (conv.ended_at) throw httpError(409, '이미 종료된 대화');
  if (!text?.trim()) throw httpError(400, 'text 필요');

  const turnNo = nextTurn(conv.id);
  const recent = windowMessages(conv);
  const nudge = config.follow === 'on' ? false : needsNudge(recent); // follow: 끝맺기 규칙과 부딪히고 문구가 답에 새어 나와(fl1) 끔(docs/50 2026-11-01 사용자 결정)
  saveMessage(conv.id, turnNo, 'user', text, null, nudge);
  return runTurn(conv, turnNo, text, recent, { ...opts, nudge });
}

// 답 다시 생성(turnNo 없으면 마지막 턴). 이전 답과 그 뒤 턴은 지우지 않고 접어 둔다(버전 넘기기로 되돌릴 수 있게).
// ChatGPT 처럼 대화 어디서든 되지만, 이미 기억으로 넘어간 내용은 기억에 그대로 남는다. 이전 답의 호출 비용은 그 턴 비용에 남는다.
export async function regenerate(conversationId, opts = {}, turnNo = null) {
  ensureMemoryInit();
  await settled(conversationId);
  const conv = getConversation(conversationId);
  if (conv.ended_at) throw httpError(409, '이미 종료된 대화');
  turnNo = Number(turnNo) || db.prepare('SELECT MAX(turn_no) n FROM messages WHERE conversation_id=? AND active=1').get(conv.id).n;
  const user = turnNo && userMessage(conv.id, turnNo);
  if (!user) throw httpError(409, '다시 생성할 수 없는 턴');
  const answer = db.prepare("SELECT id FROM messages WHERE conversation_id=? AND turn_no=? AND role='assistant' AND active=1").get(conv.id, turnNo);
  if (answer) parkFrom(conv.id, answer.id, turnNo, true);
  return runTurn(conv, turnNo, user.text, windowMessages(conv), { ...opts, nudge: !!user.nudge });
}

// 버전 하나(byId)를 접으며 그 자리부터 뒤의 활성 행을 함께 접는다. 답 버전이면 같은 턴의 답과 다음 턴부터, 사용자 버전이면 그 턴부터.
function parkFrom(convId, byId, turnNo, answerOnly) {
  if (answerOnly) db.prepare("UPDATE messages SET active=0, parked_under=? WHERE conversation_id=? AND active=1 AND (turn_no>? OR (turn_no=? AND role='assistant'))").run(byId, convId, turnNo, turnNo);
  else db.prepare('UPDATE messages SET active=0, parked_under=? WHERE conversation_id=? AND active=1 AND turn_no>=?').run(byId, convId, turnNo);
}

// 사용자 메시지 수정: 그 턴부터 뒤를 접어 두고 새 턴으로 다시 보낸다(대화 어디서든). 접은 턴의 호출 비용은 대화 합계에 남는다.
export async function editMessage(conversationId, turnNo, text, opts = {}) {
  ensureMemoryInit();
  await settled(conversationId);
  const conv = getConversation(conversationId);
  if (conv.ended_at) throw httpError(409, '이미 종료된 대화');
  if (!text?.trim()) throw httpError(400, 'text 필요');
  const user = userMessage(conv.id, Number(turnNo));
  if (!user) throw httpError(409, '수정할 수 없는 턴');
  parkFrom(conv.id, user.id, Number(turnNo), false);
  const newTurn = nextTurn(conv.id);
  const recent = windowMessages(conv);
  const nudge = config.follow === 'on' ? false : needsNudge(recent); // follow: 끝맺기 규칙과 부딪히고 문구가 답에 새어 나와(fl1) 끔(docs/50 2026-11-01 사용자 결정)
  saveMessage(conv.id, newTurn, 'user', text, user.slot ?? user.id, nudge);
  return runTurn(conv, newTurn, text, recent, { ...opts, nudge });
}

// 대화별 백그라운드 작업(stair 정리) 한 줄 세우기. 실패는 서버 로그에만 남기고 다음 턴을 막지 않는다(그 묶음은 다음 정리 때 다시 넘어간다:
// 창 시작점은 추출이 끝난 뒤에만 옮기므로).
const pending = (globalThis.__litePending ??= new Map());
function background(convId, job) {
  const prev = pending.get(convId) ?? Promise.resolve();
  const p = prev.then(job).catch((e) => console.error(`[stair fold] conv ${convId}: ${e.message}`))
    .finally(() => { if (pending.get(convId) === p) pending.delete(convId); });
  pending.set(convId, p);
}
const settled = (convId) => pending.get(Number(convId)) ?? Promise.resolve();

// 제공사 응답에 섞여 오는 깨진 글자(U+FFFD)를 뺀다(haiku 응답의 '고개를 ?쭉' 사례)
const clean = (t) => t.replace(/\uFFFD/g, '');

// onDelta: 응답 조각 콜백(스트리밍), signal: 사용자가 중지하면 abort
async function runTurn(conv, turnNo, text, recent, { onDelta, signal, onSaved, nudge = false } = {}) {
  // 기억 블록: stair 는 정리 시점에만 바꾸고 그 사이엔 저장된 블록을 그대로 재사용(캐시 접두사 유지).
  // 그 외 모드는 매 턴 retrieve.
  let memoryText = '', recallText = '';
  if (memoryOn) {
    if (config.window_mode === 'stair' && conv.memory_text != null) memoryText = conv.memory_text;
    else memoryText = await retrieveMemory(conv, turnNo, text);
    // 블록(캐시 접두사)에 못 들어간 기억 중 이번 발화와 겹치는 것 — AI 호출 없음, 이번 턴 사용자 메시지 뒤에만
    if (config.recall === 'on') {
      const rc = await memory.recall({ user_id: conv.user_id, character_id: conv.character_id, conversation_id: conv.id, lang: conv.language, query: text, block_text: memoryText }); // v2 부터 async(sync 반환이어도 await 는 그대로 동작)
      recallText = rc.text;
      recordCalls(conv.id, turnNo, 'recall', rc.attempts); // v2: 질문 임베딩(local, 비용 0·지연 기록)
    }
  }

  const ctx = assemble({ character: getCharacter(conv.character_id), language: conv.language, sheetLang: conv.sheet_lang, memoryText, recallText, today: config.date === 'off' || (config.date === 'gate' && !needsDate(text)) ? '' : todayLine(now(), conv.sheet_lang, config.date),
    langLine: config.follow === 'on' ? replyLangLine(replyLang(conv.language, [...recent.filter((m) => m.role === 'user').map((m) => m.text), text]), conv.sheet_lang, questionStreak(recent)) : '', recent, userText: text, nudge });
  let streamed = '';
  const delta = onDelta && ((d) => { if (signal?.aborted) return; d = clean(d); streamed += d; onDelta(d); }); // 중지 뒤 조각은 버린다
  const call = async () => {
    try {
      const r = await model.complete({ ...ctx, tag: 'response', conversation_id: conv.id, turn_no: turnNo, purpose: 'response', max_tokens: config.max_tokens,
        cache_history: config.window_mode !== 'slide', // slide 는 창 앞이 매 턴 잘려 이력 캐시가 손해
        ...(onDelta && { onDelta: delta, signal }) });
      recordCalls(conv.id, turnNo, 'response', r.attempts);
      return r;
    } catch (e) {
      recordCalls(conv.id, turnNo, 'response', e.attempts); // 실패 호출 비용도 기록
      throw httpError(502, `모델 호출 실패: ${e.message}`);
    }
  };
  let res = await call();
  // 빈 답(호출은 성공·출력 토큰은 있는데 본문이 빔 — 추론 켬에서 fl1 1,120턴 중 1건)은 한 번 다시 부른다. 두 호출 비용 모두 기록된다.
  if (!signal?.aborted && !streamed && !clean(res.text ?? '').trim()) res = await call();
  if (onDelta && !streamed) delta(res.text); // 모델 레이어가 조각을 안 주면 한 번에
  const reply = signal?.aborted && streamed ? streamed : clean(res.text); // 중지했으면 사용자가 본 데까지만 저장
  saveMessage(conv.id, turnNo, 'assistant', reply);
  onSaved?.(); // 답은 확정 — 화면은 입력을 받기 시작하고, 아래 기억 갱신은 이어서 끝낸다

  // 후처리(기억 갱신). stair 정리는 async_fold=on 이면 요청 밖에서 돌고(답 확정 후 요청을 바로 닫음), 다음 턴·종료가 끝나기를 기다린다.
  // 그래서 이 턴의 turn_cost_krw 에는 정리 비용이 빠질 수 있다(calls 에는 이 턴 번호로 기록된다).
  if (memoryOn && config.window_mode === 'stair') {
    if (config.async_fold === 'on') background(conv.id, () => stairFold(conv, turnNo, text));
    else await stairFold(conv, turnNo, text);
  } else if (memoryOn) {
    const upd = await memory.update({ user_id: conv.user_id, character_id: conv.character_id, conversation_id: conv.id, lang: conv.language, turn_no: turnNo,
      messages: [...recent.slice(-config.recent_turns * 2), { turn_no: turnNo, role: 'user', text }, { turn_no: turnNo, role: 'assistant', text: reply }] });
    recordCalls(conv.id, turnNo, 'extract', upd.attempts);
  }

  return { turn_no: turnNo, reply, turn_cost_krw: turnCost(conv.id, turnNo) };
}

export async function endConversation(conversationId) {
  ensureMemoryInit();
  await settled(conversationId);
  const conv = getConversation(conversationId);
  if (!conv.ended_at) {
    if (memoryOn) {
      if (config.window_mode === 'stair') await stairFlush(conv);
      const c = await memory.consolidate({ user_id: conv.user_id, character_id: conv.character_id, conversation_id: conv.id, lang: conv.language });
      recordCalls(conv.id, 0, 'consolidate', c.attempts); // turn_no 0 = 대화 단위 호출
    }
    db.prepare('UPDATE conversations SET ended_at=? WHERE id=?').run(now(), conv.id);
  }
  return report(conv.id);
}

export function getMessages(conversationId) {
  ensureMemoryInit();
  const conv = getConversation(conversationId);
  const rows = db.prepare(`SELECT id, turn_no, role, text, created_at, slot,
      CASE role WHEN 'assistant' THEN (SELECT COALESCE(SUM(cost_krw),0) FROM calls c WHERE c.conversation_id=m.conversation_id AND c.turn_no=m.turn_no) END cost_krw
    FROM messages m WHERE conversation_id=? AND active=1 ORDER BY id`).all(conv.id);
  const userSibs = db.prepare("SELECT id FROM messages WHERE conversation_id=? AND role='user' AND COALESCE(slot,id)=? ORDER BY id");
  const aiSibs = db.prepare("SELECT id FROM messages WHERE conversation_id=? AND role='assistant' AND turn_no=? ORDER BY id");
  // editable: 수정·다시 생성·버전 넘기기 가능(종료 전 대화). versions: 같은 자리의 메시지 id(버전 순)
  return rows.map(({ slot, ...r }) => ({ ...r, editable: !conv.ended_at,
    versions: (r.role === 'user' ? userSibs.all(conv.id, slot ?? r.id) : aiSibs.all(conv.id, r.turn_no)).map((x) => x.id) }));
}

// 버전 넘기기: 지금 버전부터 뒤를 접고, 고른 버전이 접어 둔 행을 되살린다
export function switchVersion(conversationId, messageId) {
  const conv = getConversation(conversationId);
  if (conv.ended_at) throw httpError(409, '이미 종료된 대화');
  const target = db.prepare('SELECT * FROM messages WHERE id=? AND conversation_id=?').get(Number(messageId), conv.id);
  if (!target || target.active) throw httpError(400, '넘길 수 없는 버전');
  const current = target.role === 'user'
    ? db.prepare("SELECT * FROM messages WHERE conversation_id=? AND role='user' AND active=1 AND COALESCE(slot,id)=?").get(conv.id, target.slot ?? target.id)
    : db.prepare("SELECT * FROM messages WHERE conversation_id=? AND role='assistant' AND active=1 AND turn_no=?").get(conv.id, target.turn_no);
  if (!current) throw httpError(409, '바꿀 수 없는 버전');
  parkFrom(conv.id, current.id, current.turn_no, current.role === 'assistant');
  db.prepare('UPDATE messages SET active=1, parked_under=NULL WHERE conversation_id=? AND parked_under=?').run(conv.id, target.id);
  // stair 창 시작은 당기지 않는다: 되살린 행이 창 시작보다 앞이면 이미 기억으로 넘어갔을 수 있어 다시 추출하면 중복된다.
  // 그런 행은 프롬프트 이력에서 빠지고 기억으로만 이어진다.
  return { ok: true };
}

// 사이드바용: 사용자의 대화 목록(최신순), 제목은 첫 사용자 메시지
export function listConversations(user_name) {
  const user_id = (user_name ?? '').trim();
  if (!user_id) throw httpError(400, 'user 필요');
  return db.prepare(`SELECT id conversation_id, character_id, language, started_at, ended_at,
      COALESCE(title, (SELECT text FROM messages WHERE conversation_id=c.id AND role='user' AND active=1 ORDER BY id LIMIT 1)) title
    FROM conversations c WHERE user_id=? AND hidden=0 ORDER BY id DESC`).all(user_id);
}

// 사이드바 이름 바꾸기·삭제. 삭제는 목록에서만 숨긴다(비용 기록과 기억은 남는다).
export function updateConversation(conversationId, { title, hidden }) {
  const conv = getConversation(conversationId);
  if (title !== undefined) db.prepare('UPDATE conversations SET title=? WHERE id=?').run(String(title).trim() || null, conv.id);
  if (hidden) db.prepare('UPDATE conversations SET hidden=1 WHERE id=?').run(conv.id);
  return { ok: true };
}

export function report(conversationId) {
  ensureMemoryInit();
  const conv = getConversation(conversationId);
  const calls = db.prepare('SELECT * FROM calls WHERE conversation_id=?').all(conv.id);
  const turns = db.prepare("SELECT COUNT(*) n FROM messages WHERE conversation_id=? AND role='assistant' AND active=1").get(conv.id).n;
  const sum = (xs, k) => xs.reduce((s, x) => s + x[k], 0);
  const total = sum(calls, 'cost_krw');

  const byTag = {};
  for (const c of calls) byTag[c.tag] = (byTag[c.tag] ?? 0) + c.cost_krw;

  const perTurn = new Map();
  for (const c of calls) if (c.turn_no > 0) perTurn.set(c.turn_no, (perTurn.get(c.turn_no) ?? 0) + c.cost_krw);
  const turnNos = [...perTurn.keys()].sort((a, b) => a - b);

  let phases = null;
  if (turnNos.length >= 3) {
    const n = turnNos.length;
    phases = ['early', 'mid', 'late'].map((name, i) => {
      const part = turnNos.slice(Math.round((i * n) / 3), Math.round(((i + 1) * n) / 3));
      return { phase: name, turns: part.length ? `${part[0]}-${part.at(-1)}` : '-',
        avg_krw: part.length ? part.reduce((s, t) => s + perTurn.get(t), 0) / part.length : 0 };
    });
  }
  const maxTurnNo = turnNos.reduce((m, t) => (m == null || perTurn.get(t) > perTurn.get(m) ? t : m), null);

  return {
    conversation_id: conv.id, user_id: conv.user_id, character_id: conv.character_id, language: conv.language, sheet_lang: conv.sheet_lang, ended: !!conv.ended_at,
    turns, calls: calls.length, failed_calls: calls.filter((c) => !c.ok).length,
    // input = 캐시 안 된 입력만. 전체 입력 = input + cache_read + cache_write
    tokens: { input: sum(calls, 'input_tokens'), cache_read: sum(calls, 'cache_read_tokens'), cache_write: sum(calls, 'cache_write_tokens'), output: sum(calls, 'output_tokens') },
    total_krw: total,
    input_krw: sum(calls, 'input_krw'),
    output_krw: sum(calls, 'output_krw'),
    avg_krw_per_turn: turns ? total / turns : 0,
    by_tag_krw: byTag,
    phases,
    max_turn: maxTurnNo == null ? null : { turn_no: maxTurnNo, krw: perTurn.get(maxTurnNo) },
    pricing: model.pricing(),
    settings: conv.settings ? JSON.parse(conv.settings) : null, // 대화 시작 시점의 조건(재현용)
  };
}

function getConversation(id) {
  const conv = db.prepare('SELECT * FROM conversations WHERE id=?').get(Number(id));
  if (!conv) throw httpError(404, '없는 대화');
  return conv;
}

async function retrieveMemory(conv, turnNo, query) {
  const mem = await memory.retrieve({ user_id: conv.user_id, character_id: conv.character_id, conversation_id: conv.id, lang: conv.language, query, budget_tokens: config.memory_budget_tokens });
  recordCalls(conv.id, turnNo, 'retrieve', mem.attempts);
  if (config.window_mode === 'stair') {
    db.prepare('UPDATE conversations SET memory_text=? WHERE id=?').run(mem.text ?? '', conv.id);
  }
  return mem.text ?? '';
}

// 완료된(답변이 있는) 턴 번호. 실패한 턴의 사용자 메시지는 컨텍스트에서 뺀다.
function completedTurns(convId, fromTurn = 1) {
  return db.prepare(`SELECT turn_no FROM messages WHERE conversation_id=? AND role='assistant' AND active=1 AND turn_no>=?
    ORDER BY turn_no`).all(convId, fromTurn).map((r) => r.turn_no);
}

function messagesOfTurns(convId, turnNos) {
  if (!turnNos.length) return [];
  return db.prepare(`SELECT turn_no, role, text, nudge FROM messages WHERE conversation_id=? AND active=1 AND turn_no IN (${turnNos.map(() => '?').join(',')})
    ORDER BY id`).all(convId, ...turnNos);
}

// 프롬프트에 넣을 이전 대화.
// full: 전부 / slide: 최근 N턴 / stair: 마지막 정리 이후 전부(append-only, 최대 APP_STAIR_MAX)
function windowMessages(conv) {
  if (config.window_mode === 'stair') return stairWindow(conv).flatMap((t) => t.msgs);
  let turns = completedTurns(conv.id);
  if (config.window_mode === 'slide') turns = turns.slice(-config.recent_turns);
  return messagesOfTurns(conv.id, turns);
}

// stair 창은 대화가 아니라 (사용자, 캐릭터) 단위. 정리 전에 끝난(또는 그냥 닫힌) 대화의 턴은 다음 대화 창으로 이어진다.
// 창 시작 = stair_windows.start_msg_id 이후의 완료된 턴들(대화를 넘나들며 메시지 id 순).
function stairWindow(conv) {
  let row = db.prepare('SELECT start_msg_id FROM stair_windows WHERE user_id=? AND character_id=?').get(conv.user_id, conv.character_id);
  if (!row) { // 처음 보는 조합: 이전 이력은 이어 붙이지 않고 이 대화부터
    const first = db.prepare('SELECT MIN(id) n FROM messages WHERE conversation_id=?').get(conv.id).n
      ?? (db.prepare('SELECT MAX(id) n FROM messages').get().n ?? 0) + 1;
    db.prepare('INSERT INTO stair_windows (user_id, character_id, start_msg_id) VALUES (?,?,?)').run(conv.user_id, conv.character_id, first);
    row = { start_msg_id: first };
  }
  const rows = db.prepare(`SELECT m.id, m.conversation_id, m.turn_no, m.role, m.text, m.nudge FROM messages m
    JOIN conversations c ON c.id = m.conversation_id
    WHERE c.user_id=? AND c.character_id=? AND m.id>=? AND m.active=1 ORDER BY m.id`).all(conv.user_id, conv.character_id, row.start_msg_id);
  const turns = new Map();
  for (const r of rows) {
    const k = `${r.conversation_id}:${r.turn_no}`;
    if (!turns.has(k)) turns.set(k, { first_id: r.id, done: false, msgs: [] });
    const t = turns.get(k);
    if (r.role === 'assistant') t.done = true;
    t.msgs.push({ conversation_id: r.conversation_id, turn_no: r.turn_no, role: r.role, text: r.text, nudge: r.nudge });
  }
  return [...turns.values()].filter((t) => t.done); // 실패한 턴의 사용자 메시지는 뺀다
}

// stair: 창이 APP_STAIR_MAX 턴에 차면 오래된 턴을 기억으로 넘기고 최근 APP_RECENT_TURNS 턴만 남긴다.
// 넘긴 턴으로 update 1회 → 새 기억 블록 retrieve 1회. 비용은 이번 턴에 기록.
async function stairFold(conv, turnNo, userText) {
  const turns = stairWindow(conv);
  if (turns.length < config.stair_max) return;
  const folded = turns.slice(0, turns.length - config.recent_turns);
  const upd = await memory.update({ user_id: conv.user_id, character_id: conv.character_id, conversation_id: conv.id, lang: conv.language, turn_no: turnNo,
    messages: folded.flatMap((t) => t.msgs), force: true, reason: 'stair_evict' }); // 넘긴 턴은 다시 안 보이니 반드시 추출
  recordCalls(conv.id, turnNo, 'extract', upd.attempts);
  db.prepare('UPDATE stair_windows SET start_msg_id=? WHERE user_id=? AND character_id=?')
    .run(turns[folded.length].first_id, conv.user_id, conv.character_id);
  await retrieveMemory(conv, turnNo, userText);
}

// /end: 아직 정리 안 된 창을 바로 추출하고 창 시작점을 그 뒤로 옮긴다(그냥 닫은 대화는 다음 대화 창으로 이월).
async function stairFlush(conv) {
  const turns = stairWindow(conv);
  if (!turns.length) return;
  const last = db.prepare('SELECT MAX(turn_no) n FROM messages WHERE conversation_id=?').get(conv.id).n;
  const upd = await memory.update({ user_id: conv.user_id, character_id: conv.character_id, conversation_id: conv.id, lang: conv.language, turn_no: last,
    messages: turns.flatMap((t) => t.msgs), force: true, reason: 'end_flush' });
  recordCalls(conv.id, 0, 'extract', upd.attempts); // turn_no 0 = 대화 단위 호출
  const next = (db.prepare('SELECT MAX(id) n FROM messages').get().n ?? 0) + 1;
  db.prepare('UPDATE stair_windows SET start_msg_id=? WHERE user_id=? AND character_id=?').run(next, conv.user_id, conv.character_id);
}

// 수정으로 지운 턴의 호출 기록과 번호가 겹치지 않게 calls 까지 본다
function nextTurn(convId) {
  return Math.max(db.prepare('SELECT COALESCE(MAX(turn_no),0) n FROM messages WHERE conversation_id=?').get(convId).n,
    db.prepare('SELECT COALESCE(MAX(turn_no),0) n FROM calls WHERE conversation_id=?').get(convId).n) + 1;
}

function userMessage(convId, turnNo) {
  return db.prepare("SELECT id, text, slot, nudge FROM messages WHERE conversation_id=? AND turn_no=? AND role='user' AND active=1").get(convId, turnNo);
}

function saveMessage(convId, turnNo, role, text, slot = null, nudge = false) {
  db.prepare('INSERT INTO messages (conversation_id, turn_no, role, text, created_at, slot, nudge) VALUES (?,?,?,?,?,?,?)')
    .run(convId, turnNo, role, text, now(), slot, nudge ? 1 : 0);
}

function turnCost(convId, turnNo) {
  return db.prepare('SELECT COALESCE(SUM(cost_krw),0) s FROM calls WHERE conversation_id=? AND turn_no=?').get(convId, turnNo).s;
}

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

export function listMemory(opts) {
  ensureMemoryInit();
  return memory.list(opts);
}
