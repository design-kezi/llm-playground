// 기억저장 레이어 공개 인터페이스. 채팅앱은 init 후 retrieve / update / consolidate / list 만 부른다.
// 의존성: node: 내장만. 모델 호출은 전부 model 레이어를 통해(비용 집계).
import { appendFileSync } from 'node:fs';
import { estimateTokens } from './tokens.js';
import { Store } from './store.js';
import { resolvePolicy } from './policy.js';
import { updateGate, missSignal, keywords } from './gate.js';
import { EXTRACT_SYSTEM, RETRY_SUFFIX, TRUNCATED_SUFFIX, CONSOLIDATE_SYSTEM, PROFILE_SLOTS, PROFILE_LABELS, SLOT_SUBJECTS, SLOT_ATTRS, SINGLE_VALUED, extractUser, consolidateUser, parseJson, stripDirections } from './prompts.js';
import { topK, cosine } from './vector.js';
import { formatWhen, dateRangeFromQuery } from './dates.js';
import { rankRecall } from './recall.js';
import { pickEmbedder } from './embed.js';

const ITEM_TYPES = new Set(['fact', 'preference', 'event', 'promise']);
// 블록 표시 문구(대화 언어별). 라벨·힌트가 대화 언어와 다르면 응답에 그 언어가 섞인다. 항목 text 자체는 추출기가 대화 언어로 쓴다.
const L10N = {
  ko: { title: '기억:', user: '사용자', past: (d) => `지난 대화(${d})`, type: { fact: '사실', preference: '선호', event: '사건', promise: '약속' }, hint: '(약속·사건이 아직 진행 중이면 먼저 어떻게 됐는지 물어볼 것)', excerpt: '과거 대화 발췌(당시 발언. 위 기억과 다르면 위 기억이 최신):', said: '사용자', recall: '관련 기억(지금 말과 관련 있을 수 있는 것. 맞을 때만 자연스럽게 쓸 것):' },
  en: { title: 'Memory:', user: 'User', past: (d) => `Earlier chat (${d})`, type: { fact: 'fact', preference: 'preference', event: 'event', promise: 'promise' }, hint: '(If a promise or event is still pending, ask how it went first)', excerpt: 'Excerpts from past chats (as said then; if they differ from the memory above, the memory is current):', said: 'User', recall: 'Related memory (may relate to what the user just said; use only if it fits, naturally):' },
  ja: { title: '記憶:', user: 'ユーザー', past: (d) => `前回の会話(${d})`, type: { fact: '事実', preference: '好み', event: '出来事', promise: '約束' }, hint: '(約束・出来事がまだ進行中なら、先にどうなったか聞くこと)', excerpt: '過去の会話の抜粋(当時の発言。上の記憶と異なる場合は上の記憶が最新):', said: 'ユーザー', recall: '関連する記憶(今の発言に関係するかもしれないもの。合うときだけ自然に使うこと):' },
  'zh-TW': { title: '記憶:', user: '使用者', past: (d) => `先前對話(${d})`, type: { fact: '事實', preference: '偏好', event: '事件', promise: '約定' }, hint: '(若約定或事件仍在進行中，先問問後來怎麼了)', excerpt: '過去對話摘錄(當時的發言。若與上方記憶不同，以上方記憶為準):', said: '使用者', recall: '相關記憶(可能和使用者剛說的話有關，只在合適時自然使用):' },
};
const l10n = (lang) => L10N[lang] ?? L10N.ko;
const RECENT_TURNS_IN_PROMPT = 6; // 채팅앱 RECENT_TURNS 와 맞춤 (깊은 검색에서 제외할 범위)

let store = null, model = null, policy = null;
let embedCooldownUntil = 0; // 임베딩 한도 초과(429/quota) 뒤 이 시각까지 임베딩 시도를 생략하고 키워드 검색으로 간다(nc9: 3회 재시도로 턴 지연 +2초)
// v2: 임베딩 제공자(embed.js). init 의 embedder 인자가 우선(테스트·주입), 없으면 policy.embedProvider 로 고른다(local 은 패키지 import 가 비동기라 첫 호출 때 기다린다).
let embedder = null, embedderInit = null;
const qvCache = new Map(); // 같은 턴에서 retrieve→recall 이 같은 발화를 두 번 임베딩하지 않도록(텍스트 → 벡터, 최근 32개)

export function init({ db, model: m, policy: p, embedder: e } = {}) {
  if (!db) throw new Error('memory.init: db 필요');
  store = new Store(db);
  model = m ?? null;
  policy = resolvePolicy(p);
  embedder = e ?? null; qvCache.clear();
  embedderInit = (!e && policy.memoryMode === 'v2') ? pickEmbedder(policy.embedProvider, { model, policy }).then((x) => { embedder = x; return x; }).catch((err) => { embedder = null; embedderErr = err; return null; }) : Promise.resolve(embedder);
  return { policy };
}
let embedderErr = null;
async function ensureEmbedder() { await embedderInit; return embedder; }
const isV2 = () => policy.memoryMode === 'v2';

function ensure() { if (!store) throw new Error('memory: init({db, model}) 먼저 호출'); }
const est = estimateTokens; // 한국어 보정 추정기(tokens.js). 모델 레이어 추정기(chars/1.5)는 한국어를 과소 추정한다

// ----------------------------------------------------------------------------------------------
// retrieve: AI 호출 없이 예산 안의 기억 블록. miss 신호 시에만 원문 로그 깊은 검색(임베딩 호출).
// ----------------------------------------------------------------------------------------------
export async function retrieve({ user_id, conversation_id, query = '', budget_tokens, lang = 'ko', character_id = null } = {}) {
  ensure();
  const budget = policy.budgetOverride ? policy.budgetTokens : (budget_tokens ?? policy.budgetTokens);
  if (isV2() && await ensureEmbedder()) return retrieveV2({ user_id, conversation_id, query, budget, lang, character_id });
  const attempts = [];
  const st = store.state(user_id, conversation_id);
  const version = store.userVersion(user_id);
  const wantDeep = policy.deepSearchEnabled && missSignal(query);

  const turnNo = store.q('SELECT COALESCE(MAX(turn_no),0) t FROM messages WHERE conversation_id=?').get(conversation_id).t;
  let block;
  if (policy.retrieveMode === 'on_change' && st.last_block_text != null && st.last_block_version === version) {
    block = { text: st.last_block_text, items: [], dropped: [], reused: true };
  } else {
    block = buildBlock(user_id, query, budget, dateOnly(store.latestMessageDate(conversation_id)), lang);
    st.last_block_text = block.text; st.last_block_version = version;
  }

  let deep = null;
  if (wantDeep) {
    deep = await deepSearch({ user_id, conversation_id, query, extraTokens: policy.deepSearchExtraTokens, lang });
    attempts.push(...deep.attempts);
    if (deep.lines.length) {
      block.text = (block.text ? block.text + '\n' : `${l10n(lang).title}\n`) + l10n(lang).excerpt + '\n' + deep.lines.join('\n');
      st.last_deep_text = deep.lines.join('\n'); // 다음 update 에서 추출 입력으로 사용
    }
  }
  store.saveState(st);
  store.markUsed(block.items.map((i) => i.id));
  // 벤치용: 턴별로 무엇이 들어가고 무엇이 예산에서 밀렸는지 기록 (list(include_log=1) 로 조회)
  if (block.items.length || block.dropped?.length) {
    store.log(user_id, conversation_id, turnNo, 'RETRIEVE', null,
      JSON.stringify({ budget, used: block.used_tokens ?? null, included: block.items.map((i) => i.id), dropped: block.dropped ?? [], reused: !!block.reused }));
  }
  return {
    text: block.text,
    items: block.items.map(pubItem),
    dropped_item_ids: block.dropped ?? [],
    attempts,
    ...(deep ? { deep_search: { hits: deep.hits, method: deep.method } } : {}),
  };
}

function buildBlock(user_id, query, budget, today = null, lang = 'ko') {
  const T = l10n(lang);
  const lines = [];
  let used = 0;
  const push = (line) => { const t = est(line) + 1; if (used + t > budget) return false; lines.push(line); used += t; return true; };

  // 블록 사용 지침("여기 없는 과거는 모른다고 할 것" 등)은 채팅앱 RULES(고정·캐시 접두사)로 옮겼다(2026-10-23). 블록 예산은 전부 기억 내용에 쓴다.
  const profile = store.getProfile(user_id);
  const PL = PROFILE_LABELS[lang] ?? PROFILE_LABELS.ko;
  const profEntries = PROFILE_SLOTS.filter((s) => profile[s]).map((s) => `${PL[s] ?? s} ${profile[s]}`);
  push(T.title); // 첫 줄 = 블록 라벨(채팅앱은 라벨을 따로 붙이지 않는다)
  if (profEntries.length) push(`- ${T.user}: ${profEntries.join(', ')}`);

  for (const ep of store.episodes(user_id, policy.maxEpisodes).reverse()) {
    const d = (store.conversationStartedAt(ep.conversation_id) ?? ep.created_at ?? '').slice(0, 10);
    if (!push(`- ${T.past(d)}: ${ep.summary}`)) break;
  }

  const active = store.activeItems(user_id);
  const fmt = (i) => `- ${T.type[i.type] ?? i.type}: ${i.text}${i.when_text ? ` (${i.when_text})` : ''}`;
  // 전부 들어가면 id 순(결정적 → 기억이 안 바뀐 동안 바이트 동일). 넘치면 중요도·최근성·정정 결과·열린 사건/약속으로 선별(언어 무관 — 질의 단어 겹침은 쓰지 않는다).
  // 2026-10-24 재설계: 예산 1000 에서 40턴 대본의 활성 항목(15~18개, 600~800토큰)은 전부 들어가므로 선별은 안전망이다.
  const total = active.reduce((s, i) => s + est(fmt(i)) + 1, 0);
  let ordered = active;
  if (used + total > budget) {
    const maxId = Math.max(1, ...active.map((i) => i.id));
    const corrected = store.correctedIds(user_id); // 정정 결과(취소·변경된 현재 값)는 우선 포함 — 빠지면 캐릭터가 남은 옛 맥락으로 옛 값을 추론한다
    const open = (i) => (i.type === 'promise' || i.type === 'event') && !isPast(i.when_text, today);
    const score = (i) => i.importance * 2 + (i.id / maxId) * 2 + (open(i) ? 3 : 0) + (corrected.has(i.id) ? 4 : 0) + (i.slot?.endsWith('.name') ? 2 : 0);
    ordered = [...active].sort((a, b) => score(b) - score(a) || a.id - b.id);
  }
  const chosen = [], dropped = [];
  for (const i of ordered) { if (push(fmt(i))) chosen.push(i); else dropped.push(i.id); }
  // 열린 약속·예정된 사건이 있으면 캐릭터가 먼저 꺼내도록 힌트 (M2: "나 왔어!" 같은 막연한 말에도 반응)
  // 지난 날짜(when 이 YYYY-MM-DD 로 저장되고 today 이전)의 사건·약속은 "진행 중" 힌트에서 뺀다. 취소·이행된 것은 추출기가 fact 로 닫는다.
  if (chosen.some((i) => (i.type === 'promise' || i.type === 'event') && !isPast(i.when_text, today))) push(T.hint);
  if (lines.length === 1) return { text: '', items: [], dropped: [] }; // 라벨만 남음 = 기억 없음 → 블록 생략
  return { text: lines.join('\n'), items: chosen, dropped, used_tokens: used };
}

// recall: 질문 기준 보충(AI 호출 없음). 지금 쓰는 블록(block_text)에 없는 활성 항목 중 이번 사용자 발화와 글자 묶음이 겹치는 것을 몇 줄 고른다.
// 채팅앱은 이 텍스트를 그 턴 사용자 메시지 뒤에만 붙인다(캐시 접두사·이력 불변). 설정 근거: model/bench/recall-sim.mjs (docs/50 2026-11-01)
export async function recall({ user_id, conversation_id, query = '', block_text = '', budget_tokens = 150, max_items = 3, min_score = 2, lang = 'ko', character_id = null } = {}) {
  ensure();
  if (isV2() && await ensureEmbedder()) return recallV2({ user_id, conversation_id, query, block_text, lang, character_id });
  const T = l10n(lang);
  const active = store.activeItems(user_id, character_id);
  const fmt = (i) => `- ${T.type[i.type] ?? i.type}: ${i.text}${i.when_text ? ` (${i.when_text})` : ''}`;
  const cands = active.filter((i) => !block_text.includes(i.text));
  const lines = [], picked = [];
  let used = est(T.recall) + 1;
  for (const { item, score } of rankRecall(query, cands, active)) {
    if (score < min_score || picked.length >= max_items) break;
    const t = est(fmt(item)) + 1;
    if (used + t > budget_tokens) break;
    lines.push(fmt(item)); picked.push(item); used += t;
  }
  if (!picked.length) return { text: '', items: [] };
  const turnNo = store.q('SELECT COALESCE(MAX(turn_no),0) t FROM messages WHERE conversation_id=?').get(conversation_id).t;
  store.log(user_id, conversation_id, turnNo, 'RECALL', null, JSON.stringify({ included: picked.map((i) => i.id), used }));
  return { text: `${T.recall}\n${lines.join('\n')}`, items: picked.map(pubItem) };
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
function dateOnly(iso) { return iso ? String(iso).slice(0, 10) : null; }
// 추출 프롬프트용 "오늘": 2026-10-21 (화). 시점 표현을 절대 날짜로 환산하는 기준.
function todayLabel(iso) {
  const d = dateOnly(iso) ?? dateOnly(new Date().toISOString());
  const dt = new Date(d + 'T00:00:00Z');
  return Number.isNaN(dt.getTime()) ? d : `${d} (${WEEKDAY[dt.getUTCDay()]})`;
}
function isPast(whenText, today) {
  if (!today || !whenText) return false;
  const m = /(\d{4}-\d{2}-\d{2})/.exec(whenText);
  return !!m && m[1] < today;
}

async function deepSearch({ user_id, conversation_id, query, extraTokens, lang = 'ko' }) {
  const attempts = [];
  const maxTurn = store.q('SELECT COALESCE(MAX(turn_no),0) t FROM messages WHERE conversation_id=?').get(conversation_id).t;
  const excludeFrom = Math.max(1, maxTurn - RECENT_TURNS_IN_PROMPT);
  const stale = store.itemSourceKeys(user_id); // 이미 항목으로 추출된 턴(현재·무효화 모두)은 발췌하지 않는다: 현재 값은 블록에 있고, 옛 값은 되살리면 안 된다
  const cands = store.deepCandidates(user_id, conversation_id, excludeFrom, policy.deepSearchCandidateLimit)
    .filter((c) => !stale.has(`${c.conversation_id}:${c.turn_no}`));
  if (!cands.length) return { lines: [], hits: [], attempts, method: 'none' };

  const qk = new Set(keywords(query));
  const kwScore = (t) => keywords(t).filter((k) => qk.has(k)).length;
  let ranked, method;

  if (model?.embed && Date.now() < embedCooldownUntil) { method = 'keyword(embed cooldown)'; ranked = null; }
  else if (model?.embed) {
    method = 'embedding+keyword';
    // 임베딩 대상: 키워드 매치 우선 + 최근순, 최대 60개. 이미 임베딩된 메시지는 재사용.
    const pool = [...cands].sort((a, b) => kwScore(b.text) - kwScore(a.text) || b.id - a.id).slice(0, 60);
    const have = store.messageEmbeddings(pool.map((c) => c.id));
    // 임베딩 모델이 바뀌어 차원이 다른 캐시는 버리고 다시 임베딩한다
    if (model.embedDim) for (const [id, v] of have) if (v.length !== model.embedDim) have.delete(id);
    const need = pool.filter((c) => !have.has(c.id));
    try {
      const texts = [query, ...need.map((c) => c.text)];
      const r = await model.embed({ tag: 'embed', conversation_id, turn_no: maxTurn, texts, purpose: 'deep_search' });
      attempts.push(...(r.attempts ?? []).map((a) => ({ tag: 'embed', ...a })));
      const [qv, ...vs] = r.vectors.map((v) => Float32Array.from(v));
      need.forEach((c, i) => { have.set(c.id, vs[i]); store.setMessageEmbedding(c.id, user_id, vs[i]); });
      ranked = topK(qv, pool.filter((c) => have.has(c.id)), policy.deepSearchTopK * 2, (c) => have.get(c.id))
        .map(({ row, score }) => ({ row, score: score + 0.1 * kwScore(row.text) }))
        .filter((x) => x.score > 0.15).sort((a, b) => b.score - a.score);
    } catch (e) {
      attempts.push(...(e.attempts ?? []).map((a) => ({ tag: 'embed', ...a })));
      method = 'keyword(embed failed)';
      ranked = null;
      const msg = String(e?.message ?? '') + JSON.stringify(e?.attempts ?? []);
      if (/429|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg)) embedCooldownUntil = Date.now() + policy.embedCooldownMs;
    }
  }
  if (!ranked) {
    method = method ?? 'keyword';
    ranked = cands.map((row) => ({ row, score: kwScore(row.text) })).filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || b.row.id - a.row.id);
  }
  const hits = ranked.slice(0, policy.deepSearchTopK).map(({ row, score }) => ({
    message_id: row.id, conversation_id: row.conversation_id, turn_no: row.turn_no, date: (row.created_at ?? '').slice(0, 10),
    text: row.text, score: Number(score.toFixed(3)),
  }));
  const lines = [];
  let used = 0;
  for (const h of hits) {
    const line = `- (${h.date}) ${l10n(lang).said}: "${h.text.length > 90 ? h.text.slice(0, 90) + '…' : h.text}"`;
    const t = est(line) + 1;
    if (used + t > extraTokens) break;
    lines.push(line); used += t;
  }
  store.log(user_id, conversation_id, maxTurn, 'DEEP_SEARCH', null, JSON.stringify({ method, hits: hits.map((h) => h.message_id) }));
  return { lines, hits, attempts, method };
}

// ----------------------------------------------------------------------------------------------
// update: 게이트/주기 통과 시 추출 1회 → ADD/UPDATE/프로필 적용. 옛 아이템은 superseded(삭제 안 함).
// ----------------------------------------------------------------------------------------------
// force: true 면 게이트·주기와 무관하게 반드시 추출 (stair 모드의 "창에서 밀려나는 묶음" 등 — 이 메시지들은 다시 보이지 않음)
export async function update({ user_id, conversation_id, turn_no, messages = [], force = false, reason, lang = 'ko', character_id = null } = {}) { // lang: 추출기 출력 언어 지시
  ensure();
  const v2 = isV2() && !!(await ensureEmbedder());
  const st = store.state(user_id, conversation_id);
  // 메시지 묶음이 "최근 N턴 + 현재 턴"보다 크면 여러 턴을 한 번에 넘긴 것 → 모든 사용자 발화를 본다
  const userCount = messages.filter((m) => m.role === 'user').length;
  const scanAll = force || userCount > RECENT_TURNS_IN_PROMPT + 1;
  // 마지막 추출 이후 지나간 턴(건너뛴 턴 포함)만 게이트에 보여 준다
  const scanCount = Math.max(1, turn_no - (st.last_extract_turn ?? 0));
  const gate = policy.gateEnabled ? updateGate(messages, policy, { scanAll, scanCount }) : { pass: false, reasons: ['gate_disabled'] };
  const due = turn_no - (st.last_extract_turn ?? 0) >= policy.extractEveryTurns;
  const deepText = st.last_deep_text ?? null;
  if (!force && !gate.pass && !due && !deepText) {
    return { ops: [], skipped: 'gate', gate_reasons: gate.reasons, attempts: [] };
  }
  const reasons = [...(force ? [`force${reason ? ':' + reason : ''}`] : []), ...gate.reasons.filter((r) => r !== 'short'),
    ...(due ? ['interval'] : []), ...(deepText ? ['deep_search_followup'] : [])];

  // force(stair 정리 묶음 등)는 호출자가 "이 턴들은 아직 추출 안 됐고 다시 안 보인다"고 보장한 것 → 마지막 추출 턴과 무관하게 전부 새 턴.
  // (앱 stair 는 현재 턴보다 뒤처진 묶음(18턴에 7~12턴)을 넘기므로 last_extract_turn 필터를 적용하면 전부 걸러진다.)
  const { newMessages, contextMessages } = force
    ? { newMessages: messages, contextMessages: [] }
    : splitNewTurns(messages, st.last_extract_turn ?? 0, turn_no, scanCount);
  // 새 턴이 많으면(stair 정리 묶음) extractChunkTurns 턴씩 나눠 순차 추출. 한 번에 넣으면 출력이 max_tokens 에 잘려 묶음 전체를 잃는다.
  // 종료 정리(end_flush)는 남은 창 전체(최대 11턴)라 3턴 조각이면 4조각 = 항목 목록·메시지 재전송 4회(r1: 조각당 0.25원, 새 항목 0). 더 큰 조각으로.
  const chunks = chunkTurns(newMessages, contextMessages, reason === 'end_flush' ? policy.extractFlushChunkTurns : policy.extractChunkTurns);
  const attempts = [];
  const applied = [];
  let parsedOk = true;
  for (let c = 0; c < chunks.length; c++) {
    let { newMessages: nm, contextMessages: cm } = chunks[c];
    // 기억을 묻는 짧은 질문 턴("내 고양이 이름이 뭐라고 했죠?")이 묶음에 섞이면 추출기가 규칙 4 를 묶음 전체에 적용해 ops 를 비웠다(앱 대화 326: 옛·새 프롬프트 모두 5/5 빈 출력).
    // 그 턴에는 사용자 정보가 없으므로 다른 새 턴이 있을 때 추출 입력에서 뺀다(ko 신호 정규식. 묶음이 질문 턴만이면 그대로 둔다).
    // (nc8 회귀) missSignal 은 "기로 했는데 올 거지?"·"잘 알지?" 같은 초대·부탁도 잡으므로 쓰지 않고, 회상 질문만 좁게 본다(isRecallQuestion).
    const uTurns = nm.filter((m) => m.role === 'user' && m.turn_no != null);
    if (uTurns.length >= 2) {
      const skip = new Set(uTurns.filter((m) => isRecallQuestion(m.text)).map((m) => m.turn_no));
      if (skip.size && skip.size < uTurns.length) nm = nm.filter((m) => m.turn_no == null || !skip.has(m.turn_no));
    }
    const profile = store.getProfile(user_id);
    const items = v2 ? await candidateItems(user_id, character_id, nm, conversation_id, turn_no, attempts) : relevantItems(store.activeItems(user_id));
    const lastTurn = nm.at(-1)?.turn_no ?? turn_no;
    const mark = (ms) => ms.map((m) => (m.conversation_id != null && m.conversation_id !== conversation_id ? { ...m, prev_conversation: true } : m));
    const lastMsg = nm.at(-1);
    const today = todayLabel(store.messageDate(lastMsg?.conversation_id ?? conversation_id, lastMsg?.turn_no ?? turn_no));
    let userText = extractUser({ profile, items, newMessages: mark(nm), contextMessages: mark(cm), currentTurn: lastTurn, today, lang, assistantChars: policy.extractAssistantChars, plainAssistantChars: policy.extractAssistantPlainChars, contextAssistantChars: policy.extractContextAssistantChars });
    if (deepText && c === chunks.length - 1) userText += `\n\n## 과거 대화 발췌 (당시 발언. 현재 기억에 없는 새 정보만 ADD. 현재 기억과 다르면 현재 기억이 최신이므로 UPDATE 금지)\n${deepText}`;
    const parsed = await callJson({
      tag: 'extract', purpose: 'extract', conversation_id, turn_no,
      system: EXTRACT_SYSTEM, user: userText, max_tokens: policy.extractMaxTokens, attempts,
    });
    if (!parsed) { parsedOk = false; continue; }
    // 출처(M4): 메시지에 conversation_id 가 있으면 그 대화로 기록한다(앱 stair 창 이월: 이전 대화의 정리 안 된 턴이 묶음에 섞여 온다).
    // 턴 번호가 두 대화에서 겹치면 현재 대화 쪽을 우선한다.
    const srcOf = (m) => ({ conv: m?.conversation_id ?? conversation_id, turn: m?.turn_no ?? lastTurn });
    const last = srcOf(nm.at(-1));
    const byTurn = new Map();
    for (const m of nm) if (m.turn_no != null && (!byTurn.has(m.turn_no) || m.conversation_id == null || m.conversation_id === conversation_id)) byTurn.set(m.turn_no, srcOf(m));
    const opSrc = (op) => byTurn.get(Number(op?.turn)) ?? last;
    const newUserTexts = nm.filter((m) => m.role === 'user').map((m) => m.text);
    const legacy = { '이름': 'name', '호칭': 'nickname', '직업': 'job', '거주지': 'location', '나이대': 'age', '관계': 'relation' };
    for (let [slot, value] of Object.entries(parsed.profile ?? {})) {
      slot = legacy[slot] ?? slot;
      if (!PROFILE_SLOTS.includes(slot) || typeof value !== 'string' || !value.trim()) continue;
      // (nc2 채팅앱 발견) "나는 고양이 키워, 이름은 보리야" → profile.이름=보리. 이름·호칭은 발화에 있어야 하고(모든 언어), ko 에서는 자기소개 문맥이어야 쓴다(M4: 지어내기·오귀속 금지).
      const v = value.trim();
      const ok = (slot !== 'name' && slot !== 'nickname') || (lang === 'ko' ? profileNameOk(v, newUserTexts, slot) : newUserTexts.some((t) => t.includes(v)));
      if (!ok) {
        store.log(user_id, last.conv, last.turn, 'PROFILE_SKIPPED', null, `${slot}=${v}: 자기소개 근거 없음`);
        applied.push({ op: 'PROFILE_SKIPPED', slot, value: v });
        continue;
      }
      if (store.setProfile(user_id, slot, v, last.conv, last.turn)) applied.push({ op: 'PROFILE', slot, value: v });
    }
    const todayYmd = today.slice(0, 10);
    const questionTurns = new Set(nm.filter((m) => m.role === 'user' && m.turn_no != null && isQuestionOnly(m.text)).map((m) => m.turn_no));
    for (const op of Array.isArray(parsed.ops) ? parsed.ops : []) { const s = opSrc(op); applyOp(op, { user_id, conversation_id: s.conv, turn_no: s.turn, applied, today: todayYmd, questionTurns, lang, character_id }); }
  }
  if (applied.length) {
    if (v2) await embedNewItemsV2(applied, conversation_id, turn_no, attempts); else await embedNewItems(applied, conversation_id, turn_no, attempts);
    enforceCap(user_id);
  }

  // 마지막 추출 턴 = 실제로 본 마지막 턴. 뒤처진 묶음(force)이면 turn_no 가 아니라 묶음의 마지막 turn_no 로, 단 되돌리지는 않는다.
  // 이전 대화에서 이월된 메시지(conversation_id 가 다른 것)의 턴 번호는 이 대화의 진행과 무관하므로 세지 않는다.
  const seenMax = Math.max(...newMessages.filter((m) => m.conversation_id == null || m.conversation_id === conversation_id).map((m) => m.turn_no ?? -Infinity));
  st.last_extract_turn = force && Number.isFinite(seenMax) ? Math.max(st.last_extract_turn ?? 0, seenMax) : turn_no;
  st.last_deep_text = null;
  store.saveState(st);
  return { ops: applied, gate_reasons: reasons, parsed_ok: parsedOk, chunks: chunks.length, attempts };
}

// 새 턴을 chunkTurns 턴씩 자른다. 각 조각의 문맥은 바로 앞 턴(이전 조각의 마지막 턴). turn_no 없으면 user 발화 경계로 센다.
// 사용자 발화가 짧은 질문만인가("오후 네 시인데 너무 졸려요. 뭐 마실까요?"). 선호 추출 금지 판정용.
// 프로필 이름·호칭 값의 근거 판정(M4: 지어내기·오귀속 금지). 값은 이번 사용자 발화에 있어야 한다.
// 이름: 자기소개 문맥("나는 X", "내 이름은 X", "X입니다", "X라고 불러")이면 OK. 없으면 반려동물·가족·지인 명사 뒤 30자 안의 "이름은 X"(문장 경계 포함)는 거부(고양이 보리 → 사용자 이름 사례),
//       그 밖에는 "이름은 X"처럼 값이 '이름' 바로 뒤에 올 때만 OK("이름은 민수예요"). 동사 조각("키워")이 이름으로 오는 것을 막는다.
// 호칭: "불러/부르/호칭/X라고 해" 문맥이 있을 때만 OK("그냥 오빠라고 불러"). nc3 전 실측에서 호칭="키워"가 2/4 저장됐다.
const THIRD_PARTY_NOUN = '(고양이|강아지|개|냥이|멍멍이|반려|햄스터|토끼|앵무새|새|동생|누나|형|오빠|언니|엄마|아빠|어머니|아버지|친구|아들|딸|남편|아내|와이프|여친|남친|애인|동료|선배|후배|팀장|사장|조카|삼촌|이모|고모|할머니|할아버지)';
const escapeRe = (t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function profileNameOk(value, texts, slot = 'name') {
  const v = escapeRe(value);
  const present = texts.filter((t) => t.includes(value));
  if (!present.length) return false;
  if (slot === 'nickname' || slot === '호칭') return present.some((t) => new RegExp(`불러|부르|호칭|${v}(이)?라고\\s*(해|하|합)`).test(t));
  const self = new RegExp(`(^|[\\s,.!?~])(나는|난|나|내 이름은|제 이름은|저는|전|저)\\s*${v}|(^|[\\s,.!?~])${v}(입니다|이에요|예요|이라고|라고)|${v}(이|라고|이라고)?\\s*(라고\\s*)?(해|불러|부르|합니다|해요|하면 돼)`);
  if (present.some((t) => self.test(t))) return true;
  const other = new RegExp(`${THIRD_PARTY_NOUN}[^\\n]{0,30}?이름[은이는도]?\\s*${v}`);
  if (present.some((t) => other.test(t))) return false;
  return present.some((t) => new RegExp(`이름[은이는도]?\\s*${v}`).test(t)); // "이름은 민수예요" — 값이 '이름' 바로 뒤에 올 때만
}
// 사용자가 자기 과거 발화를 되묻는 짧은 질문("내 고양이 이름이 뭐라고 했죠?", "누가 물 좋아한다고 했지?", "기억나?")만. 부탁·초대("봐줄 수 있어?", "너도 올 거지?")는 아니다.
const RECALL_Q = /(뭐라고|무엇이라고|누구라고|어디라고|언제라고|뭐였|기억\s*(나|해|하|안|못)|까먹|잊었|(뭐|무엇|무슨|누가|누구|어디|언제|며칠|몇)[^?？]*(다고|라고|기로)\s*(했|말했|얘기했))/;
function isRecallQuestion(text = '') { return RECALL_Q.test(text) && isQuestionOnly(text); }
function isQuestionOnly(text = '') {
  const t = text.trim();
  // 물음표 뒤에 짧은 꼬리("…했지? 아침에.")가 붙어도 되묻기다(mb1: 꼬리 때문에 추출기에 들어가 캐릭터의 틀린 답을 사실로 저장했다)
  const qi = Math.max(t.lastIndexOf('?'), t.lastIndexOf('？'));
  const tail = qi >= 0 ? t.slice(qi + 1).trim() : null;
  const askOrRequest = /[?？]\s*$/.test(t) || (tail != null && tail.length <= 10) || /(주세요|줘|줄래|주실래요|주실\s*수\s*있어요|해\s*주시겠어요)[.!~ㅋㅎ\s]*$/.test(t);
  return t.length <= 45 && askOrRequest && !/(좋아|싫어|즐겨|마셔|먹어|못\s*먹|안\s*먹|해요\.|할게|예요\.|이에요\.|이야\.|어요\.|습니다|기억해)/.test(t);
}

function chunkTurns(newMessages, contextMessages, chunkTurns) {
  const starts = newMessages.map((m, i) => (m.role === 'user' ? i : -1)).filter((i) => i >= 0);
  if (starts.length <= chunkTurns) return [{ newMessages, contextMessages }];
  const out = [];
  for (let k = 0; k < starts.length; k += chunkTurns) {
    const from = starts[k], to = starts[k + chunkTurns] ?? newMessages.length;
    const ctxFrom = k === 0 ? null : starts[k - 1];
    out.push({ newMessages: newMessages.slice(from, to), contextMessages: ctxFrom == null ? contextMessages : newMessages.slice(ctxFrom, from) });
  }
  return out;
}

function applyOp(op, ctx) {
  const { user_id, conversation_id, turn_no, applied } = ctx;
  const lang = ctx.lang ?? 'ko';
  const kind = String(op?.op ?? '').toUpperCase();
  if (kind === 'NONE' || !kind) return;
  const text = String(op.text ?? '').trim();
  if (!text) return;
  // 코드가 버린 op 는 ops_log 에 DROP 으로 남긴다(nc2 backend 7턴 "한강 자전거" 선호 미저장의 원인이 모델 누락인지 코드 폐기인지 가릴 수 없었음)
  const drop = (why) => { store.log(user_id, conversation_id, turn_no, 'DROP', null, `${why}: ${text.slice(0, 60)}`); }; // 반환 ops 에는 넣지 않는다(앱 인터페이스 불변)
  if (Number(op.importance) === 1) return drop('importance 1'); // importance 1 = 추출기가 스스로 사소하다고 본 것(캐릭터의 질문 등). 저장 가치 없음(r2 606)
  // (B30) 사용자가 질문만 한 턴("뭐 마실까요?")에서 나온 선호는 캐릭터의 권유를 사용자 선호로 옮긴 것 → 저장하지 않는다
  if (op.type === 'preference' && ctx.questionTurns?.has(turn_no)) return drop('질문 턴 선호');
  const norm = (s) => (s ?? '').replace(/\s+/g, '').toLowerCase();
  // 코드 강제(프롬프트 규칙은 비결정적으로 깨진다 — r1 벤치 B20):
  // (B28) 약속의 주어는 모델이 쓴 문장이 아니라 who 로 코드가 결정한다(주어 혼동이 양방향·비결정적이었음). 한국어 문장 합성이므로 ko 에서만.
  // 닫힘 판정: 구조 필드 closed 가 우선. ko 과거형 정규식은 구조 없는 옛 형식 출력에만 보조로 쓴다(실측: "만나기로 했으나 일요일로 미뤘다"의 "했으나"가 날짜 변경을 닫힘으로 오판).
  const sanitized = sanitizeOp({ type: ITEM_TYPES.has(op.type) ? op.type : 'fact', text: lang === 'ko' ? composePromise(op, text) : text, when: op.when ?? null, closed: op.closed === true, regexClose: !op.slot }, ctx.today);
  if (!sanitized) return drop('메타·사소 문장'); // 사소한 캐릭터 제안("기억해 두기로") 등 저장 가치 없음
  const { type } = sanitized;
  const struct = normStruct(op, type);
  struct.closedSignal = op.closed === true; // 닫힘 판정은 모델의 closed 플래그만(언어 무관). ko 과거형 정규식은 구조 없는 옛 출력의 type 보정에만 쓴다(실측 5/5 준수)
  const { closedSignal, ...fields } = struct;
  // 기억 범위(v2): 캐릭터 약속·사건만 캐릭터별, 사용자 사실·선호는 공유(NULL)
  const scopeOf = (ty) => (isV2() && (ty === 'promise' || ty === 'event') ? ctx.character_id ?? null : null);
  const item = { type, text: sanitized.text, when_text: sanitized.when, importance: op.importance ?? 3, ...fields, character_id: scopeOf(type) };

  // ---- 정정 대상 찾기(구조 기반, 언어 무관). 단어 겹침 판정은 쓰지 않는다(B5·B33·B41·B42 의 공통 원인이었음).
  // 1) 모델이 준 item_id 가 활성이고 slot·entity 가 같으면 그것. 2) slot·entity 가 다르면 id 오류로 보고(r4 sera, r5 kang, nc 고양이 이름→달리기 항목)
  //    같은 slot+entity 의 활성 항목이 정확히 하나일 때만 그것으로 바꾼다(UPDATE_RETARGET). 3) 없으면 ADD. 구조 필드가 없는 옛 항목(재설계 전 데이터)은 id 를 그대로 믿는다.
  let old = null, viaId = false; // viaId: 모델이 id 로 지정했고 구조도 맞는 대상(모델의 명시 → v2 에선 다중값 속성이어도 대체)
  // (mb1 누출) 다른 캐릭터의 약속·사건은 정정 대상이 아니다. 사용자 사실(NULL)과 이 캐릭터 것만.
  const inScope = (i) => !isV2() || i.character_id == null || i.character_id === (ctx.character_id ?? null);
  if (kind === 'UPDATE' || item.slot) {
    const attr = item.slot?.split('.')[1] ?? null;
    const single = attr && SINGLE_VALUED.has(attr);
    const byId = op.item_id != null ? store.getItem(Number(op.item_id)) : null;
    if (byId && byId.user_id === user_id && inScope(byId) && (byId.status === 'active' || (byId.status === 'archived' && isV2()))) {
      if (!byId.slot || !item.slot || sameStruct(byId, item)) { old = byId; viaId = true; }
      // 모델이 "이 항목을 닫는다"(closed, 같은 entity)고 명시하면 속성 라벨이 달라도 그 항목이다(nc10: 수영을 health 로 저장하고 그만둠은 routine 으로 보냄). 추측이 아니라 모델의 명시.
      else if (struct.closedSignal && byId.entity && byId.entity === item.entity) old = byId;
      // (nc10 교훈) 같은 slot 의 활성 항목이 하나뿐이라고 그쪽으로 바꾸는 재지정은 다중값 속성에서 무관한 사실(한강 자전거)을 덮었다 → 값이 하나뿐인 속성에서만.
      else if (single) {
        const cands = store.activeBySlot(user_id, item.slot, item.entity, isV2() ? ctx.character_id ?? null : null);
        if (cands.length === 1) { old = cands[0]; store.log(user_id, conversation_id, turn_no, 'UPDATE_RETARGET', old.id, `id ${byId.id}(${byId.slot}/${byId.entity}) -> ${old.id}`); applied.push({ op: 'UPDATE_RETARGET', item_id: old.id, from: byId.id }); }
      }
      if (!old) { store.log(user_id, conversation_id, turn_no, 'UPDATE_SKIPPED', byId.id, `구조 불일치 ${byId.slot}/${byId.entity} ≠ ${item.slot}/${item.entity}: ${item.text}`); applied.push({ op: 'UPDATE_SKIPPED', item_id: byId.id, text: item.text }); }
    } else if (kind === 'UPDATE' && item.slot && item.entity && (single || type === 'event' || type === 'promise')) {
      const cands = store.activeBySlot(user_id, item.slot, item.entity, isV2() ? ctx.character_id ?? null : null);
      if (cands.length === 1) old = cands[0];
    }
    // ADD 인데 값이 하나뿐인 속성(이름·나이·거주지·식단)이거나 사건·약속의 같은 entity 가 이미 있으면 그것의 UPDATE 다(근사 중복 B21 의 구조 판정).
    // (nc10) job 은 제외: 모델이 "팀 신입은 QA 출신"을 user.job 으로 보내 사용자의 팀 사실을 덮었다. 모델의 slot 오류는 구조로 못 잡으므로 변환 범위를 좁게 둔다.
    if (!old && kind === 'ADD' && item.slot && item.entity) {
      const cands = store.activeBySlot(user_id, item.slot, item.entity, isV2() ? ctx.character_id ?? null : null);
      if (cands.length === 1 && (single || type === 'event' || type === 'promise')) old = cands[0];
    }
  }

  // (nc8 회귀) 값이 여럿일 수 있는 속성(like·hobby·routine·relation·other …)에서 모델이 "같은 대상의 다른 사실"(누나의 선호 → 누나의 동아리, 방송부 → 줄넘기)을 UPDATE 로 보내 옛 사실이 지워졌다.
  // 구조만으로는 "같은 사실"인지 알 수 없으므로, 닫힘(closed) 신호가 없는 다중값 속성 UPDATE 는 덮지 않고 ADD 로 둔다(옛 값 공존 < 사실 삭제). 이름·나이·거주지·직업·식단과 사건·약속(entity 단위)만 덮는다.
  if (old && !struct.closedSignal) {
    const oattr = (old.slot ?? item.slot ?? '').split('.')[1];
    const perEntity = old.type === 'event' || old.type === 'promise' || type === 'event' || type === 'promise';
    // (mb1 정정 미달) v2 자유 라벨에선 단일값 목록(name·age·location·diet)이 뜻을 잃어 용돈·요일 같은 정정이 모두 UPDATE_AS_ADD 로 바뀌어 옛 값이 남았다(8런 35회, 옛 값 답 3건) → id 지정 + 구조 일치면 모델 판단대로 대체. 옛 값은 대체 사슬 검색으로 "이전: …" 에 남는다.
    if (oattr && !SINGLE_VALUED.has(oattr) && !perEntity && !(isV2() && viaId)) {
      store.log(user_id, conversation_id, turn_no, 'UPDATE_AS_ADD', old.id, `다중값 속성 ${old.slot}: ${item.text}`);
      applied.push({ op: 'UPDATE_AS_ADD', item_id: old.id, text: item.text });
      old = null;
    }
  }
  if (old) {
    // 보관된 항목이 정정 대상이면 먼저 되살린다(v2: 보관은 "검색 후보로만 남는 상태"이고 정정은 활성 사슬에서 이어진다)
    if (old.status === 'archived') { store.unarchive([old.id], user_id); store.log(user_id, conversation_id, turn_no, 'UNARCHIVE', old.id, 'update target'); applied.push({ op: 'UNARCHIVE', item_id: old.id }); }
    // when 이 빠진 UPDATE 는 옛 시점을 물려받는다(생일파티 취소 → "다음 주 화요일"은 그대로). 바뀐 날짜는 추출기가 when 에 새 값을 쓴다.
    const whenText = op.when != null && String(op.when).trim() ? item.when_text : old.when_text ?? null;
    const merged = { ...item, when_text: whenText, type: ITEM_TYPES.has(op.type) ? type : old.type,
      slot: item.slot ?? old.slot ?? null, entity: item.entity ?? old.entity ?? null,
      depends_on: item.depends_on ?? parseDeps(old.depends_on), value: item.value ?? (item.slot === old.slot ? null : old.value),
      character_id: item.character_id ?? old.character_id ?? null }; // 현재 대화의 범위가 우선(옛 항목의 캐릭터를 상속해 다른 캐릭터에게 새는 것을 막는다)
    if (norm(old.text) === norm(merged.text) && norm(old.when_text) === norm(whenText)) return; // 텍스트·시점 모두 같으면 변화 없음
    const id = store.addItem(user_id, merged, conversation_id, turn_no, 'UPDATE');
    store.supersede(old.id, id, user_id, conversation_id, turn_no);
    applied.push({ op: 'UPDATE', item_id: id, replaces: old.id, type: merged.type, text: merged.text, source_turn: turn_no, slot: merged.slot, entity: merged.entity });
    if (merged.type === 'fact' && old.type !== 'fact') closeDependents(old, id, ctx); // 사건·약속이 닫히면 딸린 항목도 닫는다
    if (old.value && merged.value && old.value !== merged.value) propagateName(old.value, merged.value, id, ctx); // 이름 전파(값 기준 정확 치환)
    return;
  }
  if (kind === 'ADD' || kind === 'UPDATE') {
    const active = store.activeItems(user_id);
    if (active.some((i) => norm(i.text) === norm(item.text))) return; // 글자 단위 중복
    const id = store.addItem(user_id, item, conversation_id, turn_no, 'ADD');
    applied.push({ op: 'ADD', item_id: id, type, text: item.text, source_turn: turn_no, slot: item.slot, entity: item.entity });
  }
}

// 구조 필드 정규화. slot 은 "<대상>.<속성>" 어휘 밖이면 other 로, entity 는 소문자 "<대상>#<n>" 또는 user/character. 없으면 null(옛 형식 호환).
function normStruct(op, type) {
  const low = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');
  let slot = null;
  const s = low(op.slot);
  if (s) {
    let [subj, attr] = s.split('.');
    if (!attr) { attr = subj; subj = type === 'event' ? 'event' : type === 'promise' ? 'promise' : 'user'; }
    if (isV2()) { // v2: 고정 어휘 없음(사용자 지적 "고정화된 모델로 어떻게 다 기억을 해"). 모델 라벨을 영어 소문자·숫자·_ 로만 다듬어 그대로 둔다. 정정 판단의 보조 정보일 뿐이다.
      subj = subj.replace(/[^a-z0-9_]/g, '') || 'other'; attr = attr.replace(/[^a-z0-9_]/g, '') || 'other';
    } else {
      if (!SLOT_SUBJECTS.includes(subj)) subj = 'other';
      if (!SLOT_ATTRS.includes(attr)) attr = type === 'event' ? 'plan' : type === 'promise' ? 'promise' : type === 'preference' ? 'like' : 'other';
    }
    slot = `${subj}.${attr}`;
  } else if (type === 'event' || type === 'promise') slot = type === 'event' ? 'event.plan' : 'promise.promise';
  let entity = low(op.entity).replace(/\s+/g, '') || null;
  if (entity && entity !== 'user' && entity !== 'character' && !/^[a-z]+#\d+$/.test(entity)) entity = /^[a-z]+$/.test(entity) ? `${entity}#1` : null;
  if (!entity && slot) { const subj = slot.split('.')[0]; if (subj === 'user' || subj === 'character') entity = subj; }
  const depends_on = Array.isArray(op.depends_on) ? op.depends_on.map(Number).filter(Number.isFinite) : null;
  const value = slot?.endsWith('.name') && typeof op.value === 'string' && op.value.trim() ? op.value.trim() : null;
  return { slot, entity, depends_on: depends_on?.length ? depends_on : null, value };
}
const sameStruct = (a, b) => (a.slot ?? null) === (b.slot ?? null) && (a.entity ?? null) === (b.entity ?? null);
function parseDeps(s) { try { const v = JSON.parse(s ?? 'null'); return Array.isArray(v) && v.length ? v : null; } catch { return null; } }

// 딸린 항목 닫기(구조 기반): 사건·약속이 fact 로 닫히면 depends_on 으로 그 항목(또는 그 항목으로 대체된 옛 id)을 가리키는 활성 항목을 함께 닫는다.
// r1 kang 34턴·r2 yuna 34턴: "생일파티 취소"는 저장됐지만 "큰 테이블 잡아주기로" 약속이 살아 캐릭터가 옛 계획을 말했다.
function lineageIds(item) {
  const ids = new Set([item.id]);
  const stack = [item.id];
  while (stack.length) { const cur = stack.pop(); for (const r of store.q('SELECT id FROM memory_items WHERE superseded_by=?').all(cur)) if (!ids.has(r.id)) { ids.add(r.id); stack.push(r.id); } }
  return [...ids];
}
function closeDependents(oldItem, newId, ctx) {
  const seen = new Set();
  for (const id of lineageIds(oldItem)) for (const p of store.dependents(ctx.user_id, id)) {
    if (p.id === newId || seen.has(p.id)) continue; seen.add(p.id);
    store.supersede(p.id, newId, ctx.user_id, ctx.conversation_id, ctx.turn_no);
    store.log(ctx.user_id, ctx.conversation_id, ctx.turn_no, 'CLOSE_DEPENDENT', p.id, `-> ${newId}`);
    ctx.applied.push({ op: 'CLOSE_DEPENDENT', item_id: p.id, by: newId });
  }
}

// 이름 전파(B19, 구조 기반): *.name 항목의 value 가 바뀌면 옛 이름 문자열을 품은 다른 활성 항목을 새 이름으로 바꾼다. 어떤 토큰이 이름인지 추측하지 않고
// 추출기가 준 value(옛/새)만 정확히 치환한다. r1 yuna "하늘이 라떼아트", r2 sera "루나는 … 친구다" 가 이름 변경 뒤에도 남아 옛 이름이 블록에 공존했다.
function propagateName(from, to, newId, ctx) {
  if (!from || !to || from.length < 2) return 0;
  let n = 0;
  for (const it of store.activeItems(ctx.user_id)) {
    if (it.id === newId || !it.text.includes(from) || it.text.includes(to)) continue;
    const text = it.text.split(from).join(to);
    const id = store.addItem(ctx.user_id, { type: it.type, text, when_text: it.when_text, importance: it.importance, slot: it.slot, entity: it.entity, depends_on: parseDeps(it.depends_on), value: it.value === from ? to : it.value }, ctx.conversation_id, ctx.turn_no, 'PROPAGATE');
    store.supersede(it.id, id, ctx.user_id, ctx.conversation_id, ctx.turn_no);
    ctx.applied.push({ op: 'PROPAGATE', item_id: id, replaces: it.id, text, from, to });
    n++;
  }
  return n;
}

// 옛 이름(바뀌기 전 값) 쌍: 이름 슬롯 이력에서 정확히 꺼낸다(단어 추측 없음). 에피소드 금지어·치환에 쓴다.
function renamePairs(user_id) { return store.nameHistory(user_id); }
function staleNamesIn(text, user_id) { return renamePairs(user_id).map(([from]) => from).filter((n) => text.includes(n)); }

// promise 의 who(character|user) 로 주어·상대를 붙인다. text 에 주어가 이미 있으면 떼고 붙인다. who 가 없으면 그대로. (한국어 문장 합성 — ko 에서만 호출)
function composePromise(op, text) {
  if (op?.type !== 'promise') return text;
  const who = String(op.who ?? '').toLowerCase();
  if (who !== 'character' && who !== 'user') return text;
  let body = text.replace(/^(사용자|캐릭터)(는|가|은|이)\s*/, '').replace(/^(사용자|캐릭터)(에게|한테|께|의|와|과|랑)\s*/, '').trim();
  body = body.replace(/\s*(사용자|캐릭터)(에게|한테|께)\s*/g, ' ').replace(/\s+/g, ' ').trim(); // 본문 안의 상대 표현도 제거(r5 "캐릭터에게 … 캐릭터에게" 중복)
  if (who === 'character') body = body.replace(/(을|를)\s*부탁(했다|함|받았다|드렸다)$/, '$1 해주기로 했다'); // "코드 리뷰를 부탁했다"(사용자 시점 문장)를 캐릭터 약속으로
  const [subj, obj] = who === 'character' ? ['캐릭터는 사용자에게', '사용자'] : ['사용자는 캐릭터에게', '캐릭터'];
  if (body.startsWith(`${obj}의 `) || body.startsWith(`${obj}와 `) || body.startsWith(`${obj}랑 `)) return `${subj.split(' ')[0]} ${body}`; // "사용자의 코드 리뷰를 …" 형태는 상대 중복 방지
  return `${subj} ${body}`;
}

// 항목 정규화. 반환 null = 버림.
const CLOSED = /(취소|종료|무산|이행|끝났|지났|마쳤|해\s?줬|봐\s?줬|사\s?줬|받았|했으나|않게 됐|못 하게|않기로|그만뒀|그만두|그만둠|끊었|끊고)/; // ko 보조: 모델이 closed 를 빼먹었을 때
const META_TEXT = /(기록되어|이미 저장|이미 있다|현재 기억|항목으로)/; // 추출기의 메타 문장("…약속은 이미 기록되어 있다")은 항목이 아니다
const TRIVIAL_PROMISE = /(기억해\s?두|기억하기로|권했|추천했|권하기로|추천하기로|위치를 알려주기로|같이 보기로 했다$|확인해 보기로 했다$|듣기로 했다$|물어보기로 했다$|기다리기로 했다$|궁금해|제안했|제안하기로)/;

function sanitizeOp({ type, text, when, closed = false, regexClose = true }, today) {
  let t = text.replace(/\s+/g, ' ').trim();
  // 두 번째 문장 절단(규칙 7): 첫 문장이 8자 이상이면 그것만 남긴다
  const m = /^(.{8,}?[.。!?])\s+\S/.exec(t);
  if (m) t = m[1].replace(/[.。!?]$/, '');
  if (META_TEXT.test(t)) return null;
  if (type === 'promise' && TRIVIAL_PROMISE.test(t)) return null;
  // 취소·종료·이행된 사건·약속은 fact 로 닫는다(규칙 6). 구조 신호 closed 가 우선, ko 과거형 정규식은 보조. '진행 중' 힌트와 약속 가중에서 빠진다
  if ((type === 'event' || type === 'promise') && (closed || (regexClose && CLOSED.test(t)))) type = 'fact';
  // 시점은 코드로 환산한다(dates.js): "다음 주 수요일 저녁" → "2026-10-28 (다음 주 수요일 저녁)". 모델이 환산해 보낸 날짜는 원문으로 다시 계산해 교정.
  let w = today ? formatWhen(when, today) : (when != null && String(when).trim() ? String(when).trim() : null);
  // 앞으로의 사건·약속이 오늘보다 과거 날짜로 환산됐으면(r1 sera: "떠날 예정" → 지난 날짜) 환산을 버리고 원문만 남긴다
  if (w && today && (type === 'event' || type === 'promise')) {
    const d = /^(\d{4}-\d{2}-\d{2})\s*(?:\((.*)\))?$/.exec(w);
    const orig = d?.[2]?.trim() ?? '';
    const futureWord = /(다음|이번|내일|모레|뒤|후|예정|오는|next|tomorrow|this|coming)/i.test(orig || t);
    const pastWord = /(지난|어제|그제|저번|전에|last|yesterday|ago)/i.test(orig);
    if (d && d[1] < today && futureWord && !pastWord) w = orig || null;
  }
  return { type, text: t, when: w };
}

async function embedNewItems(applied, conversation_id, turn_no, attempts) {
  if (!model?.embed || !policy.indexItemEmbeddings) return;
  const targets = applied.filter((a) => a.item_id);
  if (!targets.length) return;
  try {
    const r = await model.embed({ tag: 'embed', conversation_id, turn_no, texts: targets.map((t) => t.text), purpose: 'index_item' });
    attempts.push(...(r.attempts ?? []).map((a) => ({ tag: 'embed', ...a })));
    targets.forEach((t, i) => { if (r.vectors?.[i]) store.setEmbedding(t.item_id, r.vectors[i]); });
  } catch (e) {
    attempts.push(...(e.attempts ?? []).map((a) => ({ tag: 'embed', ...a })));
  }
}

function enforceCap(user_id) {
  const active = store.activeItems(user_id);
  if (active.length <= policy.maxActiveItems) return;
  const over = active.length - policy.maxActiveItems;
  const victims = isV2()
    ? [...active].sort((a, b) => a.importance - b.importance || (a.last_seen_turn ?? a.source_turn ?? 0) - (b.last_seen_turn ?? b.source_turn ?? 0) || a.use_count - b.use_count || a.id - b.id).slice(0, over)
    : [...active].sort((a, b) => a.importance - b.importance || a.use_count - b.use_count || a.id - b.id).slice(0, over);
  store.archive(victims.map((v) => v.id), user_id);
  for (const v of victims) store.log(user_id, null, null, 'ARCHIVE', v.id, 'cap');
}

// ----------------------------------------------------------------------------------------------
// consolidate: 대화 종료 시 1회. 에피소드 요약 + 중복 아이템 병합.
// ----------------------------------------------------------------------------------------------
export async function consolidate({ user_id, conversation_id, lang = 'ko', character_id = null } = {}) {
  ensure();
  if (store.hasEpisode(conversation_id)) return { ops: [], skipped: 'already_consolidated', attempts: [] };
  const msgs = store.conversationMessages(conversation_id);
  const turns = msgs.filter((m) => m.role === 'assistant').length;
  if (turns < policy.consolidateMinTurns) return { ops: [], skipped: 'short_conversation', attempts: [] };
  const v2 = isV2() && !!(await ensureEmbedder());

  // v2: 중복·모순 후보 = 이 대화에서 ADD/UPDATE 된 항목 + 각각과 가까운(dupThreshold) 기존 항목. 활성 "최근 40개" 보다 정확하고 대화가 길어도 입력이 안 불어난다.
  const items = v2 ? mergeCandidates(user_id, conversation_id, character_id) : store.activeItems(user_id).slice(-40);
  const date = (store.conversationStartedAt(conversation_id) ?? new Date().toISOString()).slice(0, 10);
  const attempts = [];
  // 옛 값(superseded 에만 있는 이름꼴 토큰)은 처음부터 금지어로 넣는다 — 재요청(+0.6원)은 최후 수단(r4 sera 종료 비용 1.77원 중 1.23원이 요약 2회)
  const staleAll = [...new Set(renamePairs(user_id).map(([from]) => from))]; // 이름 정정 쌍의 옛 이름만(r5 sera: "검술"을 옛 값으로 오판해 재요청 낭비)
  const staleNote = staleAll.length ? `\n\n(주의: 다음은 바뀌기 전의 옛 값이므로 episode 에 쓰지 말 것: ${staleAll.join(', ')}. 현재 값만 쓴다.)` : '';
  const parsed = await callJson({
    tag: 'consolidate', purpose: 'summary', conversation_id, turn_no: 0,
    system: CONSOLIDATE_SYSTEM, user: consolidateUser({ date, messages: trimForConsolidate(msgs, policy.consolidateInputTokens), items, lang }) + staleNote,
    max_tokens: policy.consolidateMaxTokens, attempts,
    // 잘려서 JSON 이 안 닫혔어도 episode 문자열만은 건진다(merge 는 포기)
    salvage: (t) => { const m = /"episode"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(t); return m ? { episode: m[1].replace(/\\"/g, '"'), merge: [] } : null; },
  });
  // (B32) 에피소드가 superseded 항목에만 있는 이름(옛 값)을 나열하면 금지어를 붙여 1회 재요청 ("말은 루나에서 토토를 거쳐 코코로…")
  let parsedFinal = parsed;
  if (parsed?.episode) {
    let bad = staleAll.filter((n) => String(parsed.episode).includes(n));
    if (bad.length) { // 1차: 정정 쌍(옛 이름→새 이름)을 알면 코드로 치환
      let ep = String(parsed.episode);
      for (const [from, to] of renamePairs(user_id)) if (bad.includes(from)) ep = ep.split(from).join(to);
      const still = staleAll.filter((n) => ep.includes(n));
      if (still.length < bad.length) { store.log(user_id, conversation_id, 0, 'EPISODE_FIX', null, JSON.stringify({ replaced: bad.filter((b) => !still.includes(b)) })); parsedFinal = { ...parsed, episode: ep }; }
      bad = still;
    }
    if (bad.length) {
      const retry = await callJson({
        tag: 'consolidate', purpose: 'summary', conversation_id, turn_no: 0, system: CONSOLIDATE_SYSTEM,
        user: consolidateUser({ date, messages: trimForConsolidate(msgs, policy.consolidateInputTokens), items, lang }) + `\n\n(주의: 다음은 바뀌기 전의 옛 값이므로 episode 에 쓰지 말 것: ${bad.join(', ')}. 현재 값만 쓴다.)`,
        max_tokens: policy.consolidateMaxTokens, attempts,
        salvage: (t) => { const m = /"episode"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(t); return m ? { episode: m[1].replace(/\\"/g, '"'), merge: parsed.merge ?? [] } : null; },
      });
      store.log(user_id, conversation_id, 0, 'EPISODE_RETRY', null, JSON.stringify({ stale_names: bad, fixed: !!retry && !staleAll.some((n) => String(retry.episode ?? '').includes(n)) }));
      if (retry?.episode) parsedFinal = { ...parsedFinal, ...retry };
    }
  }
  const applied = [];
  if (parsedFinal) {
    const parsed = parsedFinal;
    const ep = String(parsed.episode ?? '').trim();
    if (ep) {
      let embedding = null;
      if (v2) { try { const r = await embedder.embed([ep], { purpose: 'episode', conversation_id, turn_no: 0 }); attempts.push(...r.attempts); embedding = r.vectors[0]; } catch (e) { attempts.push({ tag: 'embed', ok: false, error: String(e?.message ?? e) }); } }
      const id = store.addEpisode(user_id, conversation_id, ep, msgs[0]?.turn_no ?? null, msgs.at(-1)?.turn_no ?? null, { character_id: v2 ? character_id ?? null : null, embedding, embed_model: embedder?.id ?? null });
      applied.push({ op: 'EPISODE', episode_id: id, summary: ep });
    }
    for (const m of Array.isArray(parsed.merge) ? parsed.merge : []) {
      const keep = store.getItem(Number(m.keep));
      if (!keep || keep.user_id !== user_id || keep.status !== 'active') continue;
      for (const d of Array.isArray(m.drop) ? m.drop : []) {
        const drop = store.getItem(Number(d));
        if (!drop || drop.id === keep.id || drop.user_id !== user_id || drop.status !== 'active') continue;
        store.supersede(drop.id, keep.id, user_id, conversation_id, 0);
        store.log(user_id, conversation_id, 0, 'MERGE', drop.id, `-> ${keep.id}`);
        applied.push({ op: 'MERGE', keep: keep.id, drop: drop.id });
      }
    }
  }
  return { ops: applied, parsed_ok: !!parsed, attempts };
}

// ----------------------------------------------------------------------------------------------
// list: 검증용. GET /api/memory?user=... 가 그대로 반환.
// ----------------------------------------------------------------------------------------------
export async function list({ user_id, include_superseded = false, include_log = false, character_id = null } = {}) {
  ensure();
  if (!user_id) return { error: 'user_id 필요' };
  return {
    user_id,
    ...(character_id ? { character_id } : {}),
    profile: store.getProfile(user_id),
    items: store.allItems(user_id, include_superseded, character_id).map(pubItem),
    episodes: store.episodes(user_id, 20, character_id).reverse().map((e) => ({ id: e.id, conversation_id: e.conversation_id, summary: e.summary, created_at: e.created_at, character_id: e.character_id ?? null })),
    ...(embedder ? { embed_model: embedder.id } : {}),
    ...(include_log ? { ops_log: store.opsLog(user_id) } : {}),
  };
}

// ----------------------------------------------------------------------------------------------
// 추출 입력 = 마지막 추출 이후의 새 턴 + 그 앞 문맥 1턴. 이미 추출한 턴을 다시 보여주면 같은 정보를 다시 ADD 하고
// 입력·출력이 턴마다 불어난다(40턴 벤치에서 추출이 비용의 57%). messages 에 turn_no 가 있으면 정확히, 없으면 끝에서 scanCount 턴.
function splitNewTurns(messages, lastExtractTurn, turnNo, scanCount) {
  const ctxTurns = policy.extractContextTurns;
  if (messages.every((m) => m.turn_no != null)) {
    const isNew = (m) => m.turn_no > lastExtractTurn;
    let newMessages = messages.filter(isNew);
    if (!newMessages.length) newMessages = messages.filter((m) => m.turn_no === turnNo); // 같은 턴 재호출 등
    if (!newMessages.length) newMessages = messages; // 전부 과거 턴이면 호출자가 그 묶음의 추출을 원한 것
    const firstNew = Math.min(...newMessages.map((m) => m.turn_no));
    const contextMessages = messages.filter((m) => m.turn_no < firstNew && m.turn_no >= firstNew - ctxTurns);
    return { newMessages, contextMessages };
  }
  // turn_no 없음: user 발화 기준으로 끝에서 scanCount 턴을 새 턴으로 본다
  const userIdx = messages.map((m, i) => (m.role === 'user' ? i : -1)).filter((i) => i >= 0);
  const n = Math.min(userIdx.length, Math.max(1, scanCount));
  const start = userIdx[userIdx.length - n] ?? 0;
  const ctxStart = userIdx[Math.max(0, userIdx.length - n - ctxTurns)] ?? 0;
  return { newMessages: messages.slice(start), contextMessages: n < userIdx.length ? messages.slice(ctxStart, start) : [] };
}

// 추출기에 보여줄 기존 항목(상한 extractItemsMax): 이름 슬롯·열린 사건/약속은 항상(entity 라벨 재사용·UPDATE 대상), 나머지는 최근순. 질의 단어 겹침은 쓰지 않는다(언어 무관).
function relevantItems(active) {
  const max = policy.extractItemsMax;
  if (active.length <= max) return active;
  const pin = (i) => i.slot?.endsWith('.name') || i.type === 'event' || i.type === 'promise';
  const pinned = active.filter(pin), rest = active.filter((i) => !pin(i)).sort((a, b) => b.id - a.id);
  return [...pinned, ...rest.slice(0, Math.max(0, max - pinned.length))].sort((a, b) => a.id - b.id);
}

// 종료 요약 입력 줄이기: 캐릭터 발화는 잘라 넣고, 예산을 넘으면 오래된 턴의 캐릭터 발화부터 뺀다. 사용자 발화는 남긴다.
function trimForConsolidate(msgs, budget) {
  const cut = (t, n) => (t.length > n ? t.slice(0, n) + '…' : t);
  let out = msgs.map((m) => ({ ...m, text: m.role === 'assistant' ? cut(stripDirections(m.text), 80) : cut(m.text, 200) })); // 캐릭터 지문 제외
  const size = (arr) => arr.reduce((s, m) => s + est(m.text) + 4, 0);
  if (size(out) <= budget) return out;
  const half = Math.floor(out.length / 2);
  out = out.filter((m, idx) => m.role === 'user' || idx >= half);
  if (size(out) <= budget) return out;
  out = out.filter((m) => m.role === 'user');
  while (size(out) > budget && out.length > 4) out.splice(1, 1); // 첫 발화는 남기고 앞쪽부터 제거
  return out;
}

// MEMORY_DEBUG=<파일경로|1> 이면 추출·통합 호출의 프롬프트와 원문 출력을 JSONL 로 남긴다(프롬프트 튜닝용)
function debugDump(rec) {
  try {
    const f = process.env.MEMORY_DEBUG === '1' ? 'memory-debug.jsonl' : process.env.MEMORY_DEBUG;
    appendFileSync(f, JSON.stringify({ at: new Date().toISOString(), ...rec }) + '\n');
  } catch { /* 디버그는 실패해도 무시 */ }
}

async function callJson({ tag, purpose, conversation_id, turn_no, system, user, max_tokens, attempts, salvage }) {
  if (!model?.complete) return null;
  let userText = user;
  let lastText = '';
  let budget = max_tokens;
  for (let i = 0; i <= policy.extractRetries; i++) {
    let res;
    try {
      res = await model.complete({
        tag, purpose, conversation_id, turn_no,
        system: [{ text: system, cache: true }],
        messages: [{ role: 'user', content: userText }],
        max_tokens: budget, temperature: 0, response_format: 'json',
      });
    } catch (e) {
      attempts.push(...(e?.attempts ?? [{ model: null, ok: false, error: String(e?.message ?? e), tag }]).map((a) => ({ tag, ...a })));
      continue; // 호출 실패도 재시도 1회
    }
    attempts.push(...(res.attempts ?? []).map((a) => ({ tag, ...a })));
    lastText = res.text ?? '';
    if (process.env.MEMORY_DEBUG) debugDump({ tag, conversation_id, turn_no, try: i, system, user: userText, output: lastText, finish_reason: res.attempts?.at(-1)?.finish_reason });
    const parsed = parseJson(lastText);
    if (parsed && typeof parsed === 'object') return parsed;
    // 잘린 출력(max_tokens)은 같은 입력을 되풀이해도 또 잘린다 → 더 짧게 요구
    const fin = res.attempts?.at(-1)?.finish_reason;
    const truncated = fin === 'max_tokens' || fin === 'length' || est(lastText) >= budget * 0.9;
    if (truncated) budget *= 2; // 출력 토큰은 싸다. 잘려서 정보를 통째로 잃는 것보다 두 배 예산이 낫다
    userText = user + (truncated ? TRUNCATED_SUFFIX : RETRY_SUFFIX);
  }
  return salvage ? salvage(lastText) : null;
}

function pubItem(i) {
  return {
    id: i.id, type: i.type, text: i.text, when: i.when_text ?? null, importance: i.importance, status: i.status,
    slot: i.slot ?? null, entity: i.entity ?? null, depends_on: parseDeps(i.depends_on), value: i.value ?? null,
    character_id: i.character_id ?? null, last_seen_turn: i.last_seen_turn ?? null, has_embedding: !!i.embedding,
    source: { conversation_id: i.source_conversation_id, turn_no: i.source_turn },
    superseded_by: i.superseded_by ?? null, invalidated_at: i.invalidated_at ?? null, created_at: i.created_at,
  };
}


// ==============================================================================================
// v2 (2026-11-01 장기 기억 재설계, docs/21 §3): 임베딩 기반 저장·조회·업데이트
//  - 블록 고정부(캐시 접두사): 프로필·에피소드·고정 핵심 항목만, id 순, 바이트 결정적
//  - 질문 보충(recall): 활성+보관 항목·에피소드를 발화 임베딩으로 상위 K, 날짜 범위 우선, 보관 되살리기, 필요하면 원문 발췌(전체 이력)
//  - 추출 입력: 고정 항목 + 새 턴과 가까운 항목(활성·보관) + 같은 entity + 최근순
//  - 임베딩은 저장 시 함께, 빠진 것은 호출마다 조금씩 채운다(reindex)
// ==============================================================================================
// 안전 속성만 핀(사용자 결정 2026-11-01: 제약을 매번 프롬프트에 고정하는 설계는 원치 않음 — "질문 때 필요한 기억을 찾아 넣는 게 맞다". 라벨·문장 기반 제약 핀 확장은 넣지 않는다)
const SAFETY_ATTR = /\.(allergy|health|diet|medical|condition)$/;
const isConstraint = (i) => SAFETY_ATTR.test(i.slot ?? '');
const dayOf = (iso) => (iso ? String(iso).slice(0, 10) : null);

async function embedTexts(texts, meta, attempts) {
  const e = await ensureEmbedder();
  if (!e || !texts.length) return null;
  const need = texts.filter((t) => !qvCache.has(t));
  if (need.length) {
    const r = await e.embed(need, meta);
    if (attempts) attempts.push(...(r.attempts ?? []));
    need.forEach((t, i) => { qvCache.set(t, r.vectors[i]); if (qvCache.size > 32) qvCache.delete(qvCache.keys().next().value); });
  }
  return texts.map((t) => qvCache.get(t));
}
const vecOf = (row) => (row?.embedding && row.embed_model === embedder?.id ? store.itemVec(row) : null);

// 빠진 임베딩 채우기(마이그레이션·모델 교체 뒤 점진). 항목·에피소드·원문을 호출당 reindexPerCall 개까지.
async function reindex(user_id, conversation_id, attempts, limit = policy.reindexPerCall) {
  const e = await ensureEmbedder(); if (!e) return 0;
  let n = 0;
  const items = store.itemsNeedingEmbedding(user_id, e.id, limit);
  if (items.length) { const r = await e.embed(items.map((i) => i.text), { purpose: 'reindex_item' }); attempts?.push(...r.attempts); items.forEach((i, k) => store.setEmbedding(i.id, r.vectors[k], e.id)); n += items.length; }
  const eps = store.episodesNeedingEmbedding(user_id, e.id, Math.max(0, limit - n));
  if (eps.length) { const r = await e.embed(eps.map((x) => x.summary), { purpose: 'reindex_episode' }); attempts?.push(...r.attempts); eps.forEach((x, k) => store.setEpisodeEmbedding(x.id, r.vectors[k], e.id)); n += eps.length; }
  const left = Math.max(0, limit - n);
  if (left && conversation_id != null) {
    const msgs = store.userMessagesWithEmbedding(user_id, conversation_id, Number.MAX_SAFE_INTEGER).filter((m) => !m.embedding || m.embed_model !== e.id).slice(0, left);
    if (msgs.length) { const r = await e.embed(msgs.map((m) => m.text), { purpose: 'reindex_message' }); attempts?.push(...r.attempts); msgs.forEach((m, k) => store.setMessageEmbedding(m.id, user_id, r.vectors[k], e.id)); n += msgs.length; }
  }
  return n;
}

async function embedNewItemsV2(applied, conversation_id, turn_no, attempts) {
  const e = await ensureEmbedder(); if (!e) return;
  const targets = applied.filter((a) => a.item_id && a.text && ['ADD', 'UPDATE', 'PROPAGATE'].includes(a.op));
  if (!targets.length) return;
  try {
    const r = await e.embed(targets.map((t) => t.text), { purpose: 'index_item', conversation_id, turn_no });
    attempts.push(...r.attempts);
    targets.forEach((t, i) => store.setEmbedding(t.item_id, r.vectors[i], e.id));
  } catch (err) { attempts.push({ tag: 'embed', ok: false, error: String(err?.message ?? err) }); }
}

// 고정부(캐시 접두사). 질문과 무관하게 "항상 있어야 하는 것"만: 프로필, 에피소드(최근 2 전문 + 그 이전 3 한 줄), 이름 슬롯, 열린 약속·사건, 안전 사실, 중요도 4+, 정정 결과, 최근 N턴에 저장된 것.
function buildFixedBlock(user_id, character_id, conversation_id, budget, today, lang, turnNo) {
  const T = l10n(lang);
  const lines = []; let used = 0;
  const push = (line) => { const t = est(line) + 1; if (used + t > budget) return false; lines.push(line); used += t; return true; };
  const profile = store.getProfile(user_id);
  const PL = PROFILE_LABELS[lang] ?? PROFILE_LABELS.ko;
  const profEntries = PROFILE_SLOTS.filter((s) => profile[s]).map((s) => `${PL[s] ?? s} ${profile[s]}`);
  push(T.title);
  if (profEntries.length) push(`- ${T.user}: ${profEntries.join(', ')}`);
  const eps = store.episodes(user_id, policy.maxEpisodes + 3, character_id);
  for (const [k, ep] of eps.reverse().entries()) {
    const d = (store.conversationStartedAt(ep.conversation_id) ?? ep.created_at ?? '').slice(0, 10);
    const full = k >= eps.length - policy.maxEpisodes;
    if (!push(`- ${T.past(d)}: ${full ? ep.summary : (ep.summary.length > 40 ? ep.summary.slice(0, 40) + '…' : ep.summary)}`)) break;
  }
  const active = store.activeItems(user_id, character_id);
  const corrected = store.correctedIds(user_id);
  const open = (i) => (i.type === 'promise' || i.type === 'event') && !isPast(i.when_text, today);
  const recent = (i) => conversation_id != null && i.source_conversation_id === conversation_id && turnNo != null && i.source_turn >= turnNo - policy.recentPinTurns;
  const pin = (i) => i.slot?.endsWith('.name') || open(i) || isConstraint(i) || i.importance >= 4 || corrected.has(i.id) || recent(i);
  const fmt = (i) => `- ${T.type[i.type] ?? i.type}: ${i.text}${i.when_text ? ` (${i.when_text})` : ''}`;
  // 우선순위(넘칠 때만 의미): 이름·열린 약속 > 안전 > 정정 > 중요도 > 최근. 같은 급은 id 순 → 결정적.
  const rank = (i) => (i.slot?.endsWith('.name') || open(i)) ? 0 : isConstraint(i) ? 1 : corrected.has(i.id) ? 2 : i.importance >= 4 ? 3 : 4;
  const pinned = active.filter(pin).sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  const chosen = [], dropped = [];
  for (const i of pinned) { if (push(fmt(i))) chosen.push(i); else dropped.push(i.id); }
  // 핀이 아닌 항목도 예산이 남으면 중요도·최근순으로 채운다(lt7: 핀 아니면 무조건 탈락시켜 선호 항목이 암묵 질문에 못 쓰였다). 넘치면 그때부터 보충 후보로만.
  const rest = active.filter((i) => !pin(i)).sort((a, b) => b.importance - a.importance || b.id - a.id);
  for (const i of rest) { if (push(fmt(i))) chosen.push(i); else dropped.push(i.id); }
  chosen.sort((a, b) => a.id - b.id);
  // 결정성: 출력은 id 순으로 다시 쓴다(push 는 예산 판정용)
  const head = lines.slice(0, lines.length - chosen.length);
  const body = chosen.map(fmt);
  const out = [...head, ...body];
  if (chosen.some(open)) out.push(T.hint);
  if (out.length === 1) return { text: '', items: [], dropped: [], used_tokens: 0 };
  return { text: out.join('\n'), items: chosen, dropped, used_tokens: used };
}

async function retrieveV2({ user_id, conversation_id, query, budget, lang, character_id }) {
  const attempts = [];
  const st = store.state(user_id, conversation_id);
  const version = store.userVersion(user_id);
  const turnNo = store.q('SELECT COALESCE(MAX(turn_no),0) t FROM messages WHERE conversation_id=?').get(conversation_id).t;
  const today = dateOnly(store.latestMessageDate(conversation_id));
  const fixedBudget = Math.min(budget, policy.fixedBudgetTokens);
  const block = buildFixedBlock(user_id, character_id, conversation_id, fixedBudget, today, lang, turnNo);
  st.last_block_text = block.text; st.last_block_version = version;
  store.saveState(st);
  store.markUsed(block.items.map((i) => i.id));
  // 이번 발화 임베딩: 저장(원문 색인)하고 recall 이 다시 쓸 수 있게 캐시
  try {
    if (query) {
      const [qv] = await embedTexts([query], { purpose: 'query', conversation_id, turn_no: turnNo }, attempts);
      const last = store.lastUserMessage(conversation_id);
      if (qv && last && last.text === query) store.setMessageEmbedding(last.id, user_id, qv, embedder.id);
    }
    await reindex(user_id, conversation_id, attempts);
  } catch (e) { attempts.push({ tag: 'embed', ok: false, error: String(e?.message ?? e) }); }
  if (block.items.length || block.dropped?.length) {
    store.log(user_id, conversation_id, turnNo, 'RETRIEVE', null, JSON.stringify({ budget: fixedBudget, used: block.used_tokens, included: block.items.map((i) => i.id), dropped: block.dropped, mode: 'v2' }));
  }
  return { text: block.text, items: block.items.map(pubItem), dropped_item_ids: block.dropped, attempts, mode: 'v2' };
}

// 질문 보충(v2). 반환 text 는 사용자 메시지 뒤에만 붙인다(캐시 접두사 불변).
async function recallV2({ user_id, conversation_id, query, block_text, lang, character_id }) {
  const T = l10n(lang);
  const attempts = [];
  const turnNo = store.q('SELECT COALESCE(MAX(turn_no),0) t FROM messages WHERE conversation_id=?').get(conversation_id).t;
  const today = dateOnly(store.latestMessageDate(conversation_id));
  const empty = { text: '', items: [], excerpts: [], attempts };
  if (!query?.trim()) return empty;
  let qv;
  try { [qv] = await embedTexts([query], { purpose: 'query', conversation_id, turn_no: turnNo }, attempts); } catch (e) { attempts.push({ tag: 'embed', ok: false, error: String(e?.message ?? e) }); }
  if (!qv) return empty;
  const range = dateRangeFromQuery(query, today);
  const inRange = (d) => range && d && d >= range[0] && d <= range[1];
  const fmt = (i) => `- ${T.type[i.type] ?? i.type}: ${i.text}${i.when_text ? ` (${i.when_text})` : ''}`;
  const fmtEp = (e) => `- ${T.past((store.conversationStartedAt(e.conversation_id) ?? e.created_at ?? '').slice(0, 10))}: ${e.summary}`;
  const cands = [];
  for (const i of store.searchableItems(user_id, character_id)) {
    if (block_text.includes(i.text)) continue;
    const v = vecOf(i); if (!v) continue;
    const hit = inRange(dayOf(i.created_at)) || (range && i.when_text && inRange(/\d{4}-\d{2}-\d{2}/.exec(i.when_text)?.[0]));
    cands.push({ kind: 'item', row: i, line: fmt(i), score: cosine(qv, v) + (hit ? 0.05 : 0), hit });
  }
  // 대체된 옛 항목으로 걸리면 최신 후속 항목을 보여 준다(mb1 retract 실패: "2주 어디 가 있을 거라고 했지"는 옛 항목과만 닮았고 옛 항목은 검색 밖이었다)
  const prevWord = lang === 'ko' ? '이전' : lang === 'ja' ? '以前' : 'previously';
  const byHead = new Map();
  for (const i of store.supersededItems(user_id, character_id)) {
    const v = vecOf(i); if (!v) continue;
    const head = store.chainHead(i); if (!head || !['active', 'archived'].includes(head.status) || block_text.includes(head.text)) continue;
    const score = cosine(qv, v);
    const prev = byHead.get(head.id); if (prev && prev.score >= score) continue;
    byHead.set(head.id, { kind: 'item', row: head, line: `${fmt(head)} (${prevWord}: ${i.text})`, score, hit: false, via: i.id });
  }
  for (const c of byHead.values()) {
    const direct = cands.find((x) => x.kind === 'item' && x.row.id === c.row.id);
    if (!direct) cands.push(c);
    else if (c.score > direct.score) { direct.score = c.score; direct.line = c.line; direct.via = c.via; }
  }
  for (const e of store.episodes(user_id, 50, character_id)) {
    if (!e.embedding || e.embed_model !== embedder.id || block_text.includes(e.summary)) continue;
    const hit = inRange(dayOf(store.conversationStartedAt(e.conversation_id) ?? e.created_at));
    cands.push({ kind: 'episode', row: e, line: fmtEp(e), score: cosine(qv, store.itemVec(e)) + (hit ? 0.05 : 0), hit });
  }
  let pool = cands.filter((c) => c.score >= policy.recallThreshold);
  if (range) { const r = pool.filter((c) => c.hit); if (r.length >= 1) pool = r; }
  pool.sort((a, b) => b.score - a.score || a.row.id - b.row.id);
  if (pool.length) pool = pool.filter((c) => c.score >= pool[0].score - (policy.recallMargin ?? 1)); // 최고점에서 margin 안쪽만(잡담 턴의 약한 매치 여럿을 막는다)
  const lines = [], picked = [];
  let used = est(T.recall) + 1;
  for (const c of pool) {
    if (picked.length >= policy.recallTopK) break;
    const t = est(c.line) + 1; if (used + t > policy.recallTokens) break;
    lines.push(c.line); picked.push(c); used += t;
  }
  const items = picked.filter((c) => c.kind === 'item').map((c) => c.row);
  const revived = items.filter((i) => i.status === 'archived').map((i) => i.id);
  if (revived.length) { store.unarchive(revived, user_id); for (const id of revived) store.log(user_id, conversation_id, turnNo, 'UNARCHIVE', id, 'recall'); }
  store.touchSeen(items.map((i) => i.id), turnNo);
  // 원문 발췌: 항목으로 충분히 가깝지 않거나 되묻기 표현이면 전체 이력에서 찾는다(상한 없음, 보관 출처 허용)
  const excerpts = [];
  const top = picked[0]?.score ?? 0;
  // 발췌는 되묻기 표현("기억나?", "전에 말했잖아")이나 시점 표현이 있을 때만: 보정에서 잡담 턴의 최고점 p50 이 0.554 라 "점수가 낮으면" 조건은 절반의 턴에서 무관한 원문을 끌어왔다
  if (missSignal(query) || range) {
    const excludeFrom = Math.max(1, turnNo - RECENT_TURNS_IN_PROMPT);
    const stale = store.itemSourceKeys(user_id);
    // 옛 되묻기 질문("…뭐라고 했지?")은 정보가 없고 틀린 미끼(mb1: "…했지? 아침에.")만 끌어오므로 발췌 출처에서 뺀다
    // 발췌 출처는 이 캐릭터와의 대화만(약속·사건은 캐릭터별 범위. 사용자 사실은 항목으로 공유된다)
    const rows = store.userMessagesWithEmbedding(user_id, conversation_id, excludeFrom, character_id).filter((m) => !stale.has(`${m.conversation_id}:${m.turn_no}`) && !isRecallQuestion(m.text));
    const scored = [];
    for (const m of rows) { const v = vecOf(m); if (!v) continue; const hit = inRange(dayOf(m.created_at)); const sc = cosine(qv, v) + (hit ? 0.05 : 0); if (sc >= policy.excerptThreshold) scored.push({ m, sc, hit }); }
    let ex = range && scored.some((x) => x.hit) ? scored.filter((x) => x.hit) : scored;
    ex.sort((a, b) => b.sc - a.sc || b.m.id - a.m.id);
    let eused = 0;
    for (const { m, sc } of ex.slice(0, policy.excerptTopK)) {
      const line = `- (${(m.created_at ?? '').slice(0, 10)}) ${T.said}: "${m.text.length > 90 ? m.text.slice(0, 90) + '…' : m.text}"`;
      const t = est(line) + 1; if (eused + t > policy.excerptTokens) break;
      excerpts.push({ message_id: m.id, conversation_id: m.conversation_id, turn_no: m.turn_no, text: m.text, score: Number(sc.toFixed(3)), line }); eused += t;
    }
    if (excerpts.length) store.log(user_id, conversation_id, turnNo, 'DEEP_SEARCH', null, JSON.stringify({ method: 'embedding(v2)', hits: excerpts.map((x) => x.message_id) }));
  }
  if (!picked.length && !excerpts.length) return { ...empty, attempts };
  const parts = [];
  if (picked.length) parts.push(`${T.recall}\n${lines.join('\n')}`);
  if (excerpts.length) parts.push(`${T.excerpt}\n${excerpts.map((x) => x.line).join('\n')}`);
  if (picked.length) store.log(user_id, conversation_id, turnNo, 'RECALL', null, JSON.stringify({ included: items.map((i) => i.id), episodes: picked.filter((c) => c.kind === 'episode').map((c) => c.row.id), used, range, revived, via_prev: picked.filter((c) => c.via).map((c) => c.via), mode: 'v2' }));
  return { text: parts.join('\n'), items: items.map(pubItem), excerpts, attempts, range };
}

// 추출 입력 항목(v2): 고정(이름 슬롯·열린 약속/사건) + 새 턴과 가까운 항목(활성·보관, 상위 K) + 그 항목들과 같은 entity + 최근순 채움. 상한 extractItemsMax.
async function candidateItems(user_id, character_id, newMessages, conversation_id, turn_no, attempts) {
  const max = Math.max(policy.extractItemsMax, 25);
  const active = store.activeItems(user_id, character_id);
  const searchable = store.searchableItems(user_id, character_id);
  const pin = (i) => i.slot?.endsWith('.name') || i.type === 'event' || i.type === 'promise';
  const chosen = new Map();
  for (const i of active.filter(pin)) chosen.set(i.id, i);
  const text = newMessages.filter((m) => m.role === 'user').map((m) => m.text).join('\n');
  if (text.trim()) {
    try {
      await reindex(user_id, conversation_id, attempts);
      const [qv] = await embedTexts([text], { purpose: 'extract_query', conversation_id, turn_no }, attempts);
      if (qv) {
        const scored = searchable.map((i) => ({ i, s: vecOf(i) ? cosine(qv, vecOf(i)) : -1 })).filter((x) => x.s >= policy.recallThreshold).sort((a, b) => b.s - a.s || a.i.id - b.i.id).slice(0, policy.extractSimilarK);
        const ents = new Set();
        for (const { i } of scored) { if (chosen.size >= max) break; chosen.set(i.id, i); if (i.entity && i.entity !== 'user' && i.entity !== 'character') ents.add(i.entity); }
        for (const i of searchable) if (ents.has(i.entity) && chosen.size < max) chosen.set(i.id, i);
        // 옛 값으로 말한 새 턴("용돈 다섯 냥이라 했는데 …")도 최신 후속 항목을 추출기에 보여 준다
        for (const i of store.supersededItems(user_id, character_id)) {
          if (chosen.size >= max) break;
          const v = vecOf(i); if (!v || cosine(qv, v) < policy.recallThreshold) continue;
          const h = store.chainHead(i); if (h && ['active', 'archived'].includes(h.status) && !chosen.has(h.id)) chosen.set(h.id, h);
        }
      }
    } catch (e) { attempts.push({ tag: 'embed', ok: false, error: String(e?.message ?? e) }); }
  }
  for (const i of [...active].sort((a, b) => b.id - a.id)) { if (chosen.size >= max) break; chosen.set(i.id, i); }
  return [...chosen.values()].sort((a, b) => a.id - b.id);
}

// 종료 정리의 중복·모순 후보(v2)
function mergeCandidates(user_id, conversation_id, character_id) {
  const touched = store.itemsTouchedIn(user_id, conversation_id);
  const chosen = new Map(touched.map((i) => [i.id, i]));
  const all = store.activeItems(user_id, character_id);
  for (const t of touched) {
    const tv = vecOf(t); if (!tv) continue;
    for (const o of all) { if (chosen.has(o.id)) continue; const ov = vecOf(o); if (ov && cosine(tv, ov) >= policy.dupThreshold) chosen.set(o.id, o); }
  }
  if (!chosen.size) return all.slice(-40);
  return [...chosen.values()].sort((a, b) => a.id - b.id).slice(-60);
}

export const _internal = { get store() { return store; }, get policy() { return policy; }, get embedder() { return embedder; }, get embedCooldownUntil() { return embedCooldownUntil; }, resetEmbedCooldown() { embedCooldownUntil = 0; }, buildBlock, buildFixedBlock, deepSearch, estimateTokens, isPast, todayLabel, sanitizeOp, composePromise, isQuestionOnly, isRecallQuestion, staleNamesIn, renamePairs, profileNameOk, normStruct, candidateItems, reindex, ensureEmbedder };
