// v2 재색인: 임베딩이 없거나 다른 모델로 만든 항목·에피소드·사용자 원문을 현재 임베딩 모델로 채운다(마이그레이션·모델 교체 뒤 1회).
// 사용: node scripts/reindex.mjs <app.db 경로> [user_id]   (MEMORY_EMBED / MEMORY_MODEL_DIR 환경변수 그대로)
import { DatabaseSync } from 'node:sqlite';
import * as memory from '../index.js';
const [dbPath, onlyUser] = process.argv.slice(2);
if (!dbPath) { console.error('사용: node scripts/reindex.mjs <app.db> [user_id]'); process.exit(1); }
const db = new DatabaseSync(dbPath, { timeout: 5000 }); // 앱 서버가 같은 파일을 쓰는 중이어도 잠금 대기
memory.init({ db, model: null, policy: { memoryMode: 'v2' } });
const e = await memory._internal.ensureEmbedder();
if (!e) { console.error('임베더 없음(MEMORY_EMBED=off 또는 패키지 없음)'); process.exit(2); }
await e.ready?.();
console.log(`embedder ${e.id} load ${e.loadMs ?? '-'}ms`);
const users = onlyUser ? [onlyUser] : db.prepare('SELECT DISTINCT user_id FROM conversations').all().map((r) => r.user_id);
let total = 0; const t0 = Date.now();
for (const u of users) {
  let n = 0, round;
  const convs = db.prepare('SELECT id FROM conversations WHERE user_id=? ORDER BY id DESC').all(u).map((r) => r.id);
  do { round = await memory._internal.reindex(u, convs[0] ?? null, [], 256); n += round; } while (round > 0);
  total += n; if (n) console.log(`${u}: ${n}`);
}
console.log(`완료: ${users.length}명, ${total}건, ${((Date.now() - t0) / 1000).toFixed(1)}초`);
