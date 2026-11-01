// 블라인드 문항을 id 목록으로 보여 준다(조건·기존 라벨은 숨김). 사용: node show-ids.mjs ids.txt <from> <n>
import fs from 'node:fs';
const [f, from = 0, n = 10] = process.argv.slice(2);
const ids = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).slice(Number(from), Number(from) + Number(n));
const probes = new Map(JSON.parse(fs.readFileSync(new URL('./blind-memory.json', import.meta.url), 'utf8')).map((p) => [p.id, p]));
for (const id of ids) {
  const p = probes.get(id);
  console.log(`## ${id} [${p.type}${p.scope ? '/' + p.scope : ''}] Q(${p.turn}): ${p.question}`);
  console.log(`  사용자: ${(p.user_context ?? []).join(' ‖ ')}`);
  if (p.promise_turn) console.log(`  약속턴${p.promise_turn.turn} 캐릭터: ${p.promise_turn.reply}`);
  console.log(`  기준: ${p.hint ?? ''} ${p.expect?.length ? '정답: ' + p.expect.join('/') : ''}${p.stale?.length ? ' | 옛: ' + p.stale.join('/') : ''}${p.forbidden?.length ? ' | 금지: ' + p.forbidden.join('/') : ''}`);
  console.log(`  답: ${p.reply.replace(/\s+/g, ' ')}`);
}
