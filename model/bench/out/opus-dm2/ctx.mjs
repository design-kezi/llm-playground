// 키를 열지 않고(조건 이름 출력 없이) 해당 문항 런의 앞선 대화 원문만 보여 준다.
import fs from 'node:fs';
const [,, sp, id, ...turnArgs] = process.argv;
const key = JSON.parse(fs.readFileSync(`${sp}/blind-memory-KEY.json`, 'utf8')).find((k) => k.id === id);
const dir = fs.readdirSync('/Users/kezi/ws/llm-playground/model/bench/out').find((d) => d.endsWith(`-${key.scenario}-dm2-${key.cond}-r${key.rep ?? 1}`));
const run = JSON.parse(fs.readFileSync(`/Users/kezi/ws/llm-playground/model/bench/out/${dir}/run.json`, 'utf8'));
for (const n of turnArgs.map(Number)) { const t = run.turns.find((x) => x.turn === n); console.log(`[${n}] U: ${t.user}\n     C: ${(t.reply ?? '').replace(/\s+/g, ' ')}`); }
