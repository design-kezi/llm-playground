// 기억 레이어 소유 테이블. 접두사 memory_. 채팅앱 테이블(conversations, messages, calls)은 읽기만 한다.
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS memory_profile (
  user_id TEXT NOT NULL, slot TEXT NOT NULL, value TEXT NOT NULL,
  source_conversation_id INTEGER, source_turn INTEGER, updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, slot)
);
CREATE TABLE IF NOT EXISTS memory_items (
  id INTEGER PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,                      -- fact | preference | event | promise
  text TEXT NOT NULL,
  when_text TEXT,                          -- 날짜/시점 표현 (있을 때만)
  source_conversation_id INTEGER NOT NULL,
  source_turn INTEGER NOT NULL,            -- M4: 출처 필수
  status TEXT NOT NULL DEFAULT 'active',   -- active | superseded | archived
  superseded_by INTEGER,
  invalidated_at TEXT,
  importance INTEGER NOT NULL DEFAULT 3,   -- 1~5
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,
  embedding BLOB,                          -- Float32 LE. 없으면 키워드 검색만
  created_at TEXT NOT NULL,
  -- 구조 필드(2026-10-24 재설계): 정정·전파·딸린 약속·중복 판정을 단어 겹침이 아니라 이 필드로 한다(언어 무관)
  slot TEXT,                               -- "<대상>.<속성>" 영어 고정 키 (user.allergy, pet.name, event.plan …)
  entity TEXT,                             -- 같은 대상 묶음 라벨 (user, character, pet#1, family#1, event#2, promise#3)
  depends_on TEXT,                         -- JSON 배열: 이 항목이 딸린 항목 id (사건에 딸린 약속 → 사건 id)
  value TEXT,                              -- *.name 슬롯의 이름 값 자체("보리"). 이름 전파·옛 이름 금지어에 쓴다
  -- v2(2026-11-01 장기 기억 재설계, docs/21): 캐릭터별 범위·임베딩·최근 언급 턴
  character_id TEXT,                       -- promise·event 만 채움(캐릭터별). 사용자 사실·선호는 NULL = 모든 캐릭터 공유
  embed_model TEXT,                        -- embedding 을 만든 모델 식별자. 다르면 비교 불가 → 재임베딩 대상
  last_seen_turn INTEGER                   -- 사용자가 다시 언급해 조회·정정에 걸린 마지막 턴(보관 순서 근거)
);
CREATE INDEX IF NOT EXISTS memory_items_user_status ON memory_items (user_id, status);
CREATE TABLE IF NOT EXISTS memory_episodes (
  id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, conversation_id INTEGER NOT NULL,
  summary TEXT NOT NULL, turn_from INTEGER, turn_to INTEGER, created_at TEXT NOT NULL,
  character_id TEXT, embedding BLOB, embed_model TEXT
);
CREATE TABLE IF NOT EXISTS memory_ops_log (
  id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, conversation_id INTEGER, turn_no INTEGER,
  op TEXT NOT NULL, item_id INTEGER, detail TEXT, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_state (
  user_id TEXT NOT NULL, conversation_id INTEGER NOT NULL,
  last_extract_turn INTEGER NOT NULL DEFAULT 0,
  memory_version INTEGER NOT NULL DEFAULT 0,  -- 기억이 바뀔 때마다 +1 (retrieve 재사용 판단용)
  last_block_text TEXT, last_block_version INTEGER,
  last_deep_text TEXT,                        -- 직전 retrieve 의 깊은 검색 결과 (다음 update 입력)
  PRIMARY KEY (user_id, conversation_id)
);
CREATE TABLE IF NOT EXISTS memory_message_embeddings (
  message_id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, embedding BLOB NOT NULL, embed_model TEXT
);
`;

// 기존 DB(재설계 전) 마이그레이션: 없는 컬럼만 추가하고, 프로필 슬롯 키를 한국어 → 영어 고정 키로 바꾼다. 멱등.
export const ITEM_STRUCT_COLUMNS = { slot: 'TEXT', entity: 'TEXT', depends_on: 'TEXT', value: 'TEXT', character_id: 'TEXT', embed_model: 'TEXT', last_seen_turn: 'INTEGER' };
const EPISODE_COLUMNS = { character_id: 'TEXT', embedding: 'BLOB', embed_model: 'TEXT' };
const MSG_EMB_COLUMNS = { embed_model: 'TEXT' };
export const LEGACY_PROFILE_KEYS = { '이름': 'name', '호칭': 'nickname', '직업': 'job', '거주지': 'location', '나이대': 'age', '관계': 'relation' };
export function migrate(db) {
  const cols = new Set(db.prepare('PRAGMA table_info(memory_items)').all().map((c) => c.name));
  for (const [c, t] of Object.entries(ITEM_STRUCT_COLUMNS)) if (!cols.has(c)) db.exec(`ALTER TABLE memory_items ADD COLUMN ${c} ${t}`);
  const up = db.prepare('UPDATE OR IGNORE memory_profile SET slot=? WHERE slot=?');
  for (const [ko, en] of Object.entries(LEGACY_PROFILE_KEYS)) up.run(en, ko);
  // v2 컬럼
  const addCols = (table, spec) => {
    const have = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name));
    for (const [c, t] of Object.entries(spec)) if (!have.has(c)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${c} ${t}`);
  };
  addCols('memory_episodes', EPISODE_COLUMNS); addCols('memory_message_embeddings', MSG_EMB_COLUMNS);
  // 기억 범위(사용자 결정 2026-11-01): 캐릭터 약속·사건과 에피소드만 캐릭터별. 기존 행은 출처 대화의 캐릭터로 채운다(conversations 가 있을 때만, 멱등).
  let hasConv = false;
  try { hasConv = db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='conversations'").get() && db.prepare('PRAGMA table_info(conversations)').all().some((c) => c.name === 'character_id'); } catch { /* 없음 */ }
  if (hasConv) {
    db.exec(`UPDATE memory_items SET character_id=(SELECT c.character_id FROM conversations c WHERE c.id=memory_items.source_conversation_id)
             WHERE character_id IS NULL AND type IN ('promise','event') AND EXISTS (SELECT 1 FROM conversations c WHERE c.id=memory_items.source_conversation_id)`);
    db.exec(`UPDATE memory_episodes SET character_id=(SELECT c.character_id FROM conversations c WHERE c.id=memory_episodes.conversation_id)
             WHERE character_id IS NULL AND EXISTS (SELECT 1 FROM conversations c WHERE c.id=memory_episodes.conversation_id)`);
  }
}
