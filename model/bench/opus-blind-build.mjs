// 기억 문항을 조건 이름 없이 무작위 순서로 뽑아 Opus(조정 세션) 블라인드 판정 목록을 만든다. 키는 판정이 끝난 뒤에만 연다.
// r1 은 scratchpad 의 make_blind.mjs 로 만들었고(out/opus-dm2/), 같은 방식을 회차·접두어를 받게 옮겼다.
// 사용: node bench/opus-blind-build.mjs --rep 2 --prefix N --seed 20261027 --dir out/opus-dm2-r2 [--conds a,b,...] [--run-prefix dm2]
//   120턴: --run-prefix lt1 --rep 1 --prefix L --dir out/opus-lt1-r1
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const ROOT = import.meta.dirname;
const OUT = path.join(ROOT, 'out');
const REP = opt('rep', '2');
const PREFIX = opt('prefix', 'N');
const DIR = path.resolve(ROOT, opt('dir', `out/opus-dm2-r${REP}`));
const RUNP = opt('run-prefix', 'dm2'); // 런 이름의 실험 접두어(dm2, lt1 …). 정규식 조각 가능: '(?:lt1|lt2)' + --conds 로 기준선을 같은 판정 회차에 섞는다
const CONDS = opt('conds') ? new Set(opt('conds').split(',')) : null;
let seed = Number(opt('seed', 20261027));
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const items = [];
for (const d of fs.readdirSync(OUT).filter((d) => new RegExp(`-${RUNP}-.*-r${REP}$`).test(d) && !/-situ-/.test(d) && fs.existsSync(path.join(OUT, d, 'run.json')))) {
  const run = JSON.parse(fs.readFileSync(path.join(OUT, d, 'run.json'), 'utf8'));
  // --cond-by-prefix 1: 조건 이름 대신 실험 접두어를 조건으로 쓴다(같은 조건 이름을 전·후로 비교할 때 — mb0/mb1, docs/50 2026-11-01)
  const cond = opt('cond-by-prefix') ? d.match(new RegExp(`-(${RUNP})-`))[1] : d.replace(new RegExp(`^.*-${RUNP}-`), '').replace(new RegExp(`-r${REP}$`), '');
  if (CONDS && !CONDS.has(cond)) continue;
  const sc = JSON.parse(fs.readFileSync(path.join(ROOT, 'scenarios', `${run.scenario}.json`), 'utf8'));
  for (const p of sc.turns.filter((t) => t.kind === 'probe')) {
    const reply = run.turns.find((t) => t.turn === p.turn)?.reply ?? '';
    const ctxTurns = [...new Set([...(p.source_turns ?? []), ...sc.turns.filter((t) => t.turn < p.turn && ['update', 'retract', 'distractor'].includes(t.kind)).map((t) => t.turn)])].sort((a, b) => a - b);
    items.push({ cond, rep: Number(REP), scenario: run.scenario, turn: p.turn, type: p.type, scope: p.scope ?? null,
      question: run.turns.find((t) => t.turn === p.turn)?.user ?? p.user, reply,
      expect: p.expect ?? [], expect_all: !!p.expect_all, stale: p.stale ?? [], forbidden: p.forbidden ?? [], forbidden_regex: p.forbidden_regex ?? null, hint: p.judge_hint ?? null,
      user_context: ctxTurns.map((n) => { const si = sc.sessions ? sc.sessions.findIndex((x) => n >= x.turns[0] && n <= x.turns[1]) : -1; const sx = si >= 0 ? sc.sessions[si] : null;
        return `${n}${sx ? `(${si + 1}세션${sx.character_id ? `, 상대 캐릭터 ${sx.character_id}` : ''})` : ''}: ${run.turns.find((t) => t.turn === n)?.user ?? ''}`; }),
      answering_character: run.turns.find((t) => t.turn === p.turn)?.character_id ?? run.character_id,
      promise_turn: p.requires_promise_turn ? { turn: p.requires_promise_turn, reply: run.turns.find((t) => t.turn === p.requires_promise_turn)?.reply ?? '' } : null });
  }
}
for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
const key = items.map((it, i) => ({ id: `${PREFIX}${String(i + 1).padStart(4, '0')}`, cond: it.cond, rep: it.rep, scenario: it.scenario, turn: it.turn }));
const blind = items.map((it, i) => { const { cond, rep, ...rest } = it; return { id: key[i].id, ...rest }; });
fs.mkdirSync(DIR, { recursive: true });
fs.writeFileSync(path.join(DIR, 'blind-memory.json'), JSON.stringify(blind, null, 1));
fs.writeFileSync(path.join(DIR, 'blind-memory-KEY.json'), JSON.stringify(key, null, 1));
console.log('문항', blind.length, '→', path.relative(process.cwd(), DIR));
