// SQLite 접근. db 는 채팅앱이 열어 넘긴 node:sqlite DatabaseSync (연결 1개 공유).
import { SCHEMA_SQL, migrate } from './schema.js';
import { encode, decode } from './vector.js';

export const now = () => new Date().toISOString();

export class Store {
  constructor(db) {
    this.db = db; db.exec(SCHEMA_SQL); migrate(db);
    // 채팅앱 messages.active(2026-10-23, 응답 버전 넘기기): 0 은 접어 둔 행(버린 답·수정 전 가지). 기억은 활성 행만 읽는다. 컬럼이 없는 DB(테스트·스크립트)면 조건을 생략한다.
    let hasActive = false;
    try { hasActive = db.prepare('PRAGMA table_info(messages)').all().some((c) => c.name === 'active'); } catch { /* messages 없음 */ }
    this.activeCond = (alias = '') => (hasActive ? ` AND COALESCE(${alias}active,1)=1` : '');
  }
  q(sql) { return this.db.prepare(sql); }

  // ---- profile
  getProfile(user_id) {
    const o = {};
    for (const r of this.q('SELECT slot, value FROM memory_profile WHERE user_id=? ORDER BY slot').all(user_id)) o[r.slot] = r.value;
    return o;
  }
  setProfile(user_id, slot, value, conv, turn) {
    const prev = this.q('SELECT value FROM memory_profile WHERE user_id=? AND slot=?').get(user_id, slot)?.value;
    if (prev === value) return false;
    this.q(`INSERT INTO memory_profile (user_id, slot, value, source_conversation_id, source_turn, updated_at) VALUES (?,?,?,?,?,?)
            ON CONFLICT(user_id, slot) DO UPDATE SET value=excluded.value, source_conversation_id=excluded.source_conversation_id,
            source_turn=excluded.source_turn, updated_at=excluded.updated_at`).run(user_id, slot, value, conv, turn, now());
    this.log(user_id, conv, turn, prev == null ? 'PROFILE_SET' : 'PROFILE_UPDATE', null, JSON.stringify({ slot, from: prev ?? null, to: value }));
    return true;
  }

  // ---- items
  // 기억 범위(v2): character_id 를 주면 "공유(NULL) 또는 그 캐릭터" 행만. 없으면 사용자 전체(이전 동작).
  scopeCond(character_id) { return character_id ? ` AND (character_id IS NULL OR character_id=?)` : ''; }
  scopeArgs(character_id) { return character_id ? [character_id] : []; }
  activeItems(user_id, character_id = null) {
    return this.q(`SELECT * FROM memory_items WHERE user_id=? AND status='active'${this.scopeCond(character_id)} ORDER BY id`).all(user_id, ...this.scopeArgs(character_id));
  }
  archivedItems(user_id, character_id = null) {
    return this.q(`SELECT * FROM memory_items WHERE user_id=? AND status='archived'${this.scopeCond(character_id)} ORDER BY id`).all(user_id, ...this.scopeArgs(character_id));
  }
  // 보충·추출 입력 후보 = 활성 + 보관(v2: 보관 항목도 검색 대상으로 남긴다)
  searchableItems(user_id, character_id = null) {
    return this.q(`SELECT * FROM memory_items WHERE user_id=? AND status IN ('active','archived')${this.scopeCond(character_id)} ORDER BY id`).all(user_id, ...this.scopeArgs(character_id));
  }
  unarchive(ids, user_id) {
    const st = this.q(`UPDATE memory_items SET status='active', invalidated_at=NULL WHERE id=? AND user_id=? AND status='archived'`);
    let n = 0; for (const id of ids) n += st.run(id, user_id).changes;
    return n;
  }
  touchSeen(ids, turn) {
    if (!ids.length || turn == null) return;
    const st = this.q('UPDATE memory_items SET last_seen_turn=? WHERE id=?');
    for (const id of ids) st.run(turn, id);
  }
  // 임베딩이 없거나 다른 모델로 만든 항목(뒤늦게 채우기)
  itemsNeedingEmbedding(user_id, embedModel, limit) {
    // superseded 도 포함: 대체 사슬 검색(옛 값으로 묻는 질문 → 최신 항목)의 입력이 된다
    return this.q(`SELECT id, text FROM memory_items WHERE user_id=? AND status IN ('active','archived','superseded') AND (embedding IS NULL OR embed_model IS NOT ?) ORDER BY id DESC LIMIT ?`).all(user_id, embedModel, limit);
  }
  setEmbedding(id, vec, embedModel = null) { this.q('UPDATE memory_items SET embedding=?, embed_model=? WHERE id=?').run(encode(vec), embedModel, id); }
  // 이 대화에서 ADD/UPDATE 된 활성 항목(종료 정리의 중복·모순 후보 기준)
  itemsTouchedIn(user_id, conv) {
    return this.q(`SELECT i.* FROM memory_items i WHERE i.user_id=? AND i.status='active' AND i.id IN (SELECT item_id FROM memory_ops_log WHERE user_id=? AND conversation_id=? AND op IN ('ADD','UPDATE') AND item_id IS NOT NULL) ORDER BY i.id`).all(user_id, user_id, conv);
  }
  allItems(user_id, includeSuperseded, character_id = null) {
    const sql = includeSuperseded ? `SELECT * FROM memory_items WHERE user_id=?${this.scopeCond(character_id)} ORDER BY id`
      : `SELECT * FROM memory_items WHERE user_id=? AND status IN ('active','archived')${this.scopeCond(character_id)} ORDER BY id`;
    return this.q(sql).all(user_id, ...this.scopeArgs(character_id));
  }
  getItem(id) { return this.q('SELECT * FROM memory_items WHERE id=?').get(id); }
  addItem(user_id, { type, text, when_text, importance, slot = null, entity = null, depends_on = null, value = null, character_id = null, embedding = null, embed_model = null, last_seen_turn = null }, conv, turn, op = 'ADD') {
    const dep = Array.isArray(depends_on) && depends_on.length ? JSON.stringify(depends_on.map(Number).filter(Number.isFinite)) : null;
    const r = this.q(`INSERT INTO memory_items (user_id, type, text, when_text, source_conversation_id, source_turn, importance, created_at, slot, entity, depends_on, value, character_id, embedding, embed_model, last_seen_turn)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(user_id, type, text, when_text ?? null, conv, turn, clampImp(importance), now(), slot, entity, dep, value, character_id ?? null, embedding ? encode(embedding) : null, embedding ? embed_model : null, last_seen_turn ?? turn ?? null);
    const id = Number(r.lastInsertRowid);
    this.log(user_id, conv, turn, op, id, text);
    return id;
  }
  // 구조 조회(언어 무관): 같은 entity 의 활성 항목 / 같은 slot+entity 의 활성 항목 / 어떤 항목에 딸린(depends_on) 활성 항목
  activeByEntity(user_id, entity) {
    if (!entity) return [];
    return this.q(`SELECT * FROM memory_items WHERE user_id=? AND status='active' AND entity=? ORDER BY id`).all(user_id, entity);
  }
  // character_id 를 주면 그 캐릭터 범위(공유 NULL 포함) 안에서만 찾는다(mb1 누출 원인: 다른 캐릭터의 약속을 같은 slot·entity 로 대체했다)
  activeBySlot(user_id, slot, entity, character_id = null) {
    if (!slot) return [];
    const sc = this.scopeCond(character_id), sa = this.scopeArgs(character_id);
    return entity == null
      ? this.q(`SELECT * FROM memory_items WHERE user_id=? AND status='active' AND slot=?${sc} ORDER BY id`).all(user_id, slot, ...sa)
      : this.q(`SELECT * FROM memory_items WHERE user_id=? AND status='active' AND slot=? AND entity=?${sc} ORDER BY id`).all(user_id, slot, entity, ...sa);
  }
  // 대체된(superseded) 항목 중 임베딩이 있는 것: 옛 값으로 묻는 질문("2주 어디 가 있을 거라고 했지")을 최신 후속 항목으로 이어 주는 검색용
  supersededItems(user_id, character_id = null) {
    return this.q(`SELECT * FROM memory_items WHERE user_id=? AND status='superseded' AND embedding IS NOT NULL${this.scopeCond(character_id)} ORDER BY id`).all(user_id, ...this.scopeArgs(character_id));
  }
  // 대체 사슬의 끝(최신 항목). superseded 가 아니면 자기 자신
  chainHead(item) { let cur = item, n = 0; while (cur && cur.status === 'superseded' && cur.superseded_by && n++ < 20) cur = this.getItem(cur.superseded_by); return cur; }
  dependents(user_id, itemId) {
    return this.q(`SELECT * FROM memory_items WHERE user_id=? AND status='active' AND depends_on IS NOT NULL`).all(user_id)
      .filter((i) => { try { return JSON.parse(i.depends_on).includes(Number(itemId)); } catch { return false; } });
  }
  // 이름 슬롯(*.name)의 변경 이력: superseded 항목의 value → 대체 항목의 value. 옛 이름 금지어·에피소드 치환에 쓴다(단어 추측 없음)
  nameHistory(user_id) {
    const rows = this.q(`SELECT id, value, superseded_by FROM memory_items WHERE user_id=? AND status='superseded' AND value IS NOT NULL AND slot LIKE '%.name'`).all(user_id);
    const active = new Set(this.q(`SELECT value FROM memory_items WHERE user_id=? AND status='active' AND value IS NOT NULL`).all(user_id).map((r) => r.value));
    const pairs = [];
    for (const r of rows) {
      let cur = r.superseded_by, guard = 0, to = null;
      while (cur && guard++ < 6) { const n = this.getItem(cur); if (!n) break; if (n.status === 'active') { to = n.value ?? null; break; } cur = n.superseded_by; }
      if (r.value && to && r.value !== to && !active.has(r.value)) pairs.push([r.value, to]);
    }
    return pairs;
  }
  supersede(oldId, newId, user_id, conv, turn) {
    this.q(`UPDATE memory_items SET status='superseded', superseded_by=?, invalidated_at=? WHERE id=? AND user_id=?`).run(newId, now(), oldId, user_id);
    this.log(user_id, conv, turn, 'SUPERSEDE', oldId, `-> ${newId}`);
  }
  // 정정으로 생긴(옛 항목을 대체한) 활성 항목 id. 블록 선별에서 우선한다 — 바뀐 현재 값이 빠지면 캐릭터가 남은 옛 맥락(딸린 약속 등)으로 옛 값을 추론한다.
  correctedIds(user_id) {
    return new Set(this.q(`SELECT superseded_by AS id FROM memory_items WHERE user_id=? AND status='superseded' AND superseded_by IS NOT NULL`).all(user_id).map((r) => r.id));
  }
  archive(ids, user_id) {
    const st = this.q(`UPDATE memory_items SET status='archived', invalidated_at=? WHERE id=? AND user_id=? AND status='active'`);
    for (const id of ids) st.run(now(), id, user_id);
  }
  markUsed(ids) {
    if (!ids.length) return;
    const st = this.q('UPDATE memory_items SET use_count=use_count+1, last_used_at=? WHERE id=?');
    const t = now();
    for (const id of ids) st.run(t, id);
  }
  itemVec(row) { return decode(row.embedding); }

  // ---- episodes
  addEpisode(user_id, conv, summary, from, to, { character_id = null, embedding = null, embed_model = null } = {}) {
    const r = this.q('INSERT INTO memory_episodes (user_id, conversation_id, summary, turn_from, turn_to, created_at, character_id, embedding, embed_model) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(user_id, conv, summary, from, to, now(), character_id, embedding ? encode(embedding) : null, embedding ? embed_model : null);
    this.log(user_id, conv, 0, 'EPISODE', null, summary);
    return Number(r.lastInsertRowid);
  }
  episodes(user_id, limit, character_id = null) {
    return this.q(`SELECT * FROM memory_episodes WHERE user_id=?${this.scopeCond(character_id)} ORDER BY id DESC LIMIT ?`).all(user_id, ...this.scopeArgs(character_id), limit);
  }
  episodesNeedingEmbedding(user_id, embedModel, limit) {
    return this.q(`SELECT id, summary FROM memory_episodes WHERE user_id=? AND (embedding IS NULL OR embed_model IS NOT ?) ORDER BY id DESC LIMIT ?`).all(user_id, embedModel, limit);
  }
  setEpisodeEmbedding(id, vec, embedModel) { this.q('UPDATE memory_episodes SET embedding=?, embed_model=? WHERE id=?').run(encode(vec), embedModel, id); }
  hasEpisode(conv) { return !!this.q('SELECT 1 FROM memory_episodes WHERE conversation_id=?').get(conv); }

  // ---- state / log
  state(user_id, conv) {
    return this.q('SELECT * FROM memory_state WHERE user_id=? AND conversation_id=?').get(user_id, conv)
      ?? { user_id, conversation_id: conv, last_extract_turn: 0, memory_version: 0, last_block_text: null, last_block_version: null, last_deep_text: null };
  }
  saveState(s) {
    this.q(`INSERT INTO memory_state (user_id, conversation_id, last_extract_turn, memory_version, last_block_text, last_block_version, last_deep_text)
      VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id, conversation_id) DO UPDATE SET last_extract_turn=excluded.last_extract_turn,
      memory_version=excluded.memory_version, last_block_text=excluded.last_block_text, last_block_version=excluded.last_block_version,
      last_deep_text=excluded.last_deep_text`)
      .run(s.user_id, s.conversation_id, s.last_extract_turn ?? 0, s.memory_version ?? 0, s.last_block_text ?? null, s.last_block_version ?? null, s.last_deep_text ?? null);
  }
  // 사용자 단위 기억 버전 = 이 사용자의 ops_log 마지막 id (어느 대화에서 바뀌어도 감지)
  userVersion(user_id) {
    return this.q(`SELECT COALESCE(MAX(id),0) v FROM memory_ops_log WHERE user_id=? AND op IN ('ADD','UPDATE','SUPERSEDE','PROFILE_SET','PROFILE_UPDATE','EPISODE','ARCHIVE','MERGE','PROPAGATE','CLOSE_DEPENDENT','UNARCHIVE')`).get(user_id).v;
  }
  log(user_id, conv, turn, op, item_id, detail) {
    this.q('INSERT INTO memory_ops_log (user_id, conversation_id, turn_no, op, item_id, detail, created_at) VALUES (?,?,?,?,?,?,?)')
      .run(user_id, conv ?? null, turn ?? null, op, item_id ?? null, detail ?? null, now());
  }
  opsLog(user_id, limit = 200) {
    return this.q('SELECT * FROM memory_ops_log WHERE user_id=? ORDER BY id DESC LIMIT ?').all(user_id, limit);
  }

  // ---- 채팅앱 테이블 읽기 전용
  conversationMessages(conv) {
    return this.q(`SELECT id, turn_no, role, text, created_at FROM messages WHERE conversation_id=?${this.activeCond()} ORDER BY id`).all(conv);
  }
  // 해당 턴의 사용자 메시지 날짜(없으면 대화 시작일). 추출 프롬프트의 "오늘" 과 블록의 지난 일정 판정에 쓴다.
  // 해당 턴의 사용자 발화 원문(항목의 출처 발화). UPDATE 안전 규칙의 정정 근거 판정에 쓴다.
  userMessageText(conv, turn) {
    if (conv == null || turn == null) return "";
    return this.q(`SELECT text FROM messages WHERE conversation_id=? AND turn_no=? AND role='user'${this.activeCond()} ORDER BY id LIMIT 1`).get(conv, turn)?.text ?? '';
  }
  messageDate(conv, turn) {
    const r = turn != null ? this.q(`SELECT created_at FROM messages WHERE conversation_id=? AND turn_no=?${this.activeCond()} ORDER BY id LIMIT 1`).get(conv, turn) : null;
    return (r?.created_at ?? this.conversationStartedAt(conv) ?? null);
  }
  latestMessageDate(conv) {
    return this.q(`SELECT created_at FROM messages WHERE conversation_id=?${this.activeCond()} ORDER BY id DESC LIMIT 1`).get(conv)?.created_at ?? this.conversationStartedAt(conv) ?? null;
  }
  conversationStartedAt(conv) {
    return this.q('SELECT started_at FROM conversations WHERE id=?').get(conv)?.started_at ?? null;
  }
  // 깊은 검색 후보: 이 사용자의 user 메시지 중, 현재 대화의 최근 창(현재 턴 포함)을 제외
  // 무효화된(superseded) 항목의 출처 턴 = 이미 바뀐 정보가 담긴 원문. 깊은 검색이 꺼내면 옛 값을 되살리므로 제외한다.
  // v2: 보관(archived) 항목의 출처 턴은 다시 검색할 수 있게 둔다(활성은 블록·보충에 있고, 대체됨은 옛 값이라 제외)
  itemSourceKeys(user_id) {
    return new Set(this.q(`SELECT source_conversation_id c, source_turn t FROM memory_items WHERE user_id=? AND source_turn IS NOT NULL AND status IN ('active','superseded')`).all(user_id).map((r) => `${r.c}:${r.t}`));
  }
  // v2 원문 후보: 이 사용자의 모든 사용자 발화(현재 대화의 최근 창 제외) + 저장된 임베딩. 상한 없음(수천 개도 ms 단위 비교).
  // character_id 를 주면 그 캐릭터와의 대화 원문만(발췌용 — mb2 누출 2건이 다른 캐릭터 대화의 사용자 발화 발췌였다). 재색인은 null 로 전체.
  userMessagesWithEmbedding(user_id, conv, excludeFromTurn, character_id = null) {
    return this.q(`SELECT m.id, m.conversation_id, m.turn_no, m.text, m.created_at, e.embedding, e.embed_model FROM messages m
      JOIN conversations c ON c.id = m.conversation_id LEFT JOIN memory_message_embeddings e ON e.message_id = m.id
      WHERE c.user_id=? AND m.role='user'${this.activeCond('m.')} AND NOT (m.conversation_id=? AND m.turn_no>=?)${character_id ? ' AND c.character_id=?' : ''} ORDER BY m.id DESC`).all(user_id, conv, excludeFromTurn, ...(character_id ? [character_id] : []));
  }
  lastUserMessage(conv) {
    return this.q(`SELECT id, turn_no, text FROM messages WHERE conversation_id=? AND role='user'${this.activeCond()} ORDER BY id DESC LIMIT 1`).get(conv) ?? null;
  }
  deepCandidates(user_id, conv, excludeFromTurn, limit) {
    return this.q(`SELECT m.id, m.conversation_id, m.turn_no, m.text, m.created_at FROM messages m
      JOIN conversations c ON c.id = m.conversation_id
      WHERE c.user_id=? AND m.role='user'${this.activeCond('m.')} AND NOT (m.conversation_id=? AND m.turn_no>=?)
      ORDER BY m.id DESC LIMIT ?`).all(user_id, conv, excludeFromTurn, limit);
  }
  messageEmbeddings(ids) {
    if (!ids.length) return new Map();
    const rows = this.q(`SELECT message_id, embedding FROM memory_message_embeddings WHERE message_id IN (${ids.map(() => '?').join(',')})`).all(...ids);
    return new Map(rows.map((r) => [r.message_id, decode(r.embedding)]));
  }
  setMessageEmbedding(message_id, user_id, vec, embedModel = null) {
    this.q('INSERT OR REPLACE INTO memory_message_embeddings (message_id, user_id, embedding, embed_model) VALUES (?,?,?,?)').run(message_id, user_id, encode(vec), embedModel);
  }
}

function clampImp(n) { n = Number(n); return Number.isFinite(n) ? Math.min(5, Math.max(1, Math.round(n))) : 3; }
