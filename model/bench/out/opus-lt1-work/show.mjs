import fs from 'node:fs';
const [,, file, from, n] = process.argv;
const items = JSON.parse(fs.readFileSync(file, 'utf8')).slice(Number(from), Number(from) + Number(n));
for (const it of items) {
  const ref = [it.expect.length ? `정답${it.expect_all ? '(전부)' : ''}: ${it.expect.join('/')}` : '', it.stale.length ? `옛: ${it.stale.join('/')}` : '', it.forbidden.length ? `금지: ${it.forbidden.slice(0, 6).join('/')}…` : '', it.forbidden_regex ? `금지식: ${it.forbidden_regex}` : '', it.hint ? `힌트: ${it.hint}` : ''].filter(Boolean).join(' | ');
  console.log(`## ${it.id} [${it.type}${it.scope ? '/' + it.scope : ''}] Q(${it.turn}): ${it.question}`);
  console.log(`  사용자: ${it.user_context.join(' ‖ ')}`);
  if (it.promise_turn) console.log(`  약속턴${it.promise_turn.turn} 캐릭터: ${it.promise_turn.reply.replace(/\s+/g, ' ')}`);
  console.log(`  기준: ${ref}`);
  console.log(`  답: ${it.reply.replace(/\s+/g, ' ')}`);
}
