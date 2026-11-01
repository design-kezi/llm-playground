import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';

// 첫 사용 시점에 연다. 모듈 import 시점에 열면 next build 의 병렬 작업자끼리 DB 잠금이 걸린다.
const g = globalThis;
const real = () => g.__liteDb ?? (g.__liteDb = open());
export const db = new Proxy({}, {
  get(_, key) {
    const d = real();
    const v = d[key];
    return typeof v === 'function' ? v.bind(d) : v;
  },
});

function open() {
  const dir = path.join(process.cwd(), 'data');
  fs.mkdirSync(dir, { recursive: true });
  const d = new DatabaseSync(path.join(dir, 'app.db'), { timeout: 5000 });
  d.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, character_id TEXT NOT NULL,
      started_at TEXT NOT NULL, ended_at TEXT
    );
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, turn_no INTEGER NOT NULL,
      role TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, turn_no INTEGER NOT NULL,
      tag TEXT NOT NULL, model TEXT, ok INTEGER NOT NULL,
      input_tokens INTEGER, output_tokens INTEGER, cache_read_tokens INTEGER, cache_write_tokens INTEGER,
      input_krw REAL NOT NULL, output_krw REAL NOT NULL, cost_krw REAL NOT NULL,
      latency_ms INTEGER, error TEXT, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS stair_windows (
      user_id TEXT NOT NULL, character_id TEXT NOT NULL, start_msg_id INTEGER NOT NULL,
      PRIMARY KEY (user_id, character_id)
    );
  `);
  // 메시지 버전(GPT 의 ‹ 1/2 ›): active=0 은 다른 버전으로 넘어가 접어 둔 행, parked_under = 그 행들을 접게 한 버전의 메시지 id,
  // slot = 수정으로 생긴 사용자 메시지가 같은 자리의 첫 메시지 id 를 가리킨다
  const mcols = d.prepare('PRAGMA table_info(messages)').all().map((c) => c.name);
  for (const [name, type] of [['active', 'INTEGER NOT NULL DEFAULT 1'], ['parked_under', 'INTEGER'], ['slot', 'INTEGER'], ['nudge', 'INTEGER NOT NULL DEFAULT 0']]) {
    if (!mcols.includes(name)) d.exec(`ALTER TABLE messages ADD COLUMN ${name} ${type}`);
  }
  // 벤치 설정 추가 전 DB와의 호환: 없는 컬럼만 추가
  const cols = d.prepare('PRAGMA table_info(conversations)').all().map((c) => c.name);
  for (const [name, type] of [['settings', 'TEXT'], ['memory_text', 'TEXT'], ['language', "TEXT NOT NULL DEFAULT 'ko'"], ['sheet_lang', "TEXT NOT NULL DEFAULT 'ko'"], ['title', 'TEXT'], ['hidden', 'INTEGER NOT NULL DEFAULT 0']]) {
    if (!cols.includes(name)) d.exec(`ALTER TABLE conversations ADD COLUMN ${name} ${type}`);
  }
  return d;
}

export const now = () => new Date(Date.now() + config.clock_offset_days * 86400000).toISOString();

export function recordCalls(conversationId, turnNo, tag, attempts = []) {
  const st = db.prepare(`INSERT INTO calls (conversation_id, turn_no, tag, model, ok, input_tokens, output_tokens,
    cache_read_tokens, cache_write_tokens, input_krw, output_krw, cost_krw, latency_ms, error, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (const a of attempts) {
    st.run(conversationId, turnNo, a.tag ?? tag, a.model ?? null, a.ok ? 1 : 0, a.input_tokens ?? 0, a.output_tokens ?? 0,
      a.cache_read_tokens ?? 0, a.cache_write_tokens ?? 0, a.input_krw ?? 0, a.output_krw ?? 0,
      a.cost_krw ?? 0, a.latency_ms ?? null, a.error ?? null, now());
  }
}
