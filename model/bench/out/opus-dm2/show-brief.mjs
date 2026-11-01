// 블라인드 문항 요약 보기(질문·정답·답만). 사용: node show-brief.mjs ids.txt <from> <n>
import fs from 'node:fs';
const [f, from = 0, n = 25] = process.argv.slice(2);
const ids = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).slice(Number(from), Number(from) + Number(n));
const P = new Map(JSON.parse(fs.readFileSync(new URL('./blind-memory.json', import.meta.url), 'utf8')).map((p) => [p.id, p]));
for (const id of ids) { const p = P.get(id); console.log(`${id} [${p.type}] Q${p.turn}: ${p.question} | 정답 ${(p.expect ?? []).join('/')} | 사용자: ${p.user_context.filter((u) => !/^1[68]:|^22:/.test(u)).join(' ‖ ').slice(0, 200)}\n   답: ${p.reply.replace(/\*[^*]*\*/g, '').replace(/\s+/g, ' ').trim()}`); }
