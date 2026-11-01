import { DatabaseSync } from 'node:sqlite';
import * as memory from '../index.js';
import { createFakeModel } from '../fake-model.js';

export const APP_SCHEMA = `
CREATE TABLE IF NOT EXISTS conversations (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, character_id TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT);
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, turn_no INTEGER NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL);
`;

// activeColumn: 채팅앱의 응답 버전 넘기기 컬럼(active/parked_under/slot)이 있는 DB 를 흉내낸다
// 기존 테스트는 v1 동작(전부 주입·bigram 보충·miss 신호 깊은 검색) 기준이라 기본 memoryMode 를 'v1' 로 둔다. v2 테스트는 policy.memoryMode='v2' + embedder 주입.
export function setup({ responses = [], policy = {}, withEmbed = true, activeColumn = false, embedder = undefined } = {}) {
  const db = new DatabaseSync(':memory:');
  db.exec(APP_SCHEMA);
  if (activeColumn) db.exec('ALTER TABLE messages ADD COLUMN active INTEGER NOT NULL DEFAULT 1; ALTER TABLE messages ADD COLUMN parked_under INTEGER; ALTER TABLE messages ADD COLUMN slot INTEGER;');
  const model = createFakeModel({ responses, withEmbed });
  memory.init({ db, model, policy: { memoryMode: 'v1', ...policy }, embedder });
  const app = {
    db, model, memory,
    startConv(user_id, started_at = '2026-10-21T10:00:00.000Z') {
      return Number(db.prepare('INSERT INTO conversations (user_id, character_id, started_at) VALUES (?,?,?)').run(user_id, 'yuna', started_at).lastInsertRowid);
    },
    say(conv, turn, role, text, { active = 1, created_at = '2026-10-21T10:00:00.000Z' } = {}) {
      if (activeColumn) db.prepare('INSERT INTO messages (conversation_id, turn_no, role, text, created_at, active) VALUES (?,?,?,?,?,?)').run(conv, turn, role, text, created_at, active);
      else db.prepare('INSERT INTO messages (conversation_id, turn_no, role, text, created_at) VALUES (?,?,?,?,?)').run(conv, turn, role, text, created_at);
    },
    // 한 턴 전체: 사용자 메시지 저장 → retrieve → (가짜 답변 저장) → update
    async turn(user_id, conv, turn, userText, { reply = '(답변)', recent = [] } = {}) {
      app.say(conv, turn, 'user', userText);
      const r = await memory.retrieve({ user_id, conversation_id: conv, query: userText, budget_tokens: 400 });
      app.say(conv, turn, 'assistant', reply);
      const u = await memory.update({ user_id, conversation_id: conv, turn_no: turn, messages: [...recent, { role: 'user', text: userText }, { role: 'assistant', text: reply }] });
      return { retrieve: r, update: u };
    },
  };
  return app;
}

export const J = (o) => JSON.stringify(o);
