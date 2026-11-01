// 120턴 기억 문항마다 "왜 맞혔나/틀렸나"를 기록에서 찾는다(0원, docs/50 2026-10-31 사전 등록).
// 1) 기억 블록: 문항 직전의 RETRIEVE(ops_log)에서, 원문 턴(source_turns 중 가장 늦은 턴)에서 나온 항목이 블록에 들어갔나(included)·예산 때문에 빠졌나(dropped)·저장이 안 됐나.
// 2) 원문 검색: 문항 턴에 DEEP_SEARCH 가 돌았나(missSignal 문구).
// 3) 캐릭터 재언급: 원문 턴 뒤~문항 앞 캐릭터 답에 정답 키워드가 나왔나. 최근 12턴 안이면 기억 없이 대화 창만으로 맞힐 수 있다.
// 한 세션 대본 전용(120턴): 항목의 원문 턴(source.local_turn_no)을 대본 턴과 같다고 본다. 재방문(여러 세션) 대본에는 쓰지 않는다.
// 사용: node bench/memory-drop.mjs [--run-prefix lt1] [--labels out/opus-lt1/labels-unblinded.json] → out/drop-<prefix>.md, .json
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const OUT = path.join(import.meta.dirname, 'out');
const RUNP = opt('run-prefix', 'lt1');
const WINDOW = 12;
const labels = opt('labels') && fs.existsSync(opt('labels')) ? JSON.parse(fs.readFileSync(opt('labels'), 'utf8')) : [];
const labelOf = (cond, scenario, turn, rep) => labels.find((l) => l.cond === cond && l.scenario === scenario && l.turn === turn && l.rep === rep)?.label ?? null;

const rows = [];
for (const d of fs.readdirSync(OUT)) {
  const m = d.match(new RegExp(`^\\d{14}-(.+)-${RUNP}-(.+)-r(\\d+)$`));
  if (!m || !fs.existsSync(path.join(OUT, d, 'run.json'))) continue;
  const run = JSON.parse(fs.readFileSync(path.join(OUT, d, 'run.json'), 'utf8'));
  const sc = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'scenarios', `${run.scenario}.json`), 'utf8'));
  const ops = run.memory?.ops_log ?? [];
  const items = run.memory?.items ?? [];
  const retrieves = ops.filter((o) => o.op === 'RETRIEVE').map((o) => ({ turn: o.local_turn_no ?? o.turn_no, ...JSON.parse(o.detail) }));
  for (const p of sc.turns.filter((t) => t.kind === 'probe')) {
    const src = Math.max(...(p.source_turns ?? []));
    const r = retrieves.filter((x) => x.turn <= p.turn).sort((a, b) => b.turn - a.turn)[0] ?? null;
    const fromSrc = items.filter((it) => (it.source?.local_turn_no ?? it.source?.turn_no) === src).map((it) => it.id);
    const block = !Number.isFinite(src) ? 'na'
      : run.report?.settings?.app?.memory === 'off' ? 'memory_off'
      : !fromSrc.length ? 'not_stored'
      : fromSrc.some((id) => r?.included.includes(id)) ? 'in_block'
      : fromSrc.some((id) => r?.dropped.includes(id)) ? 'dropped'
      : 'not_in_block';
    const deep = ops.some((o) => o.op === 'DEEP_SEARCH' && (o.local_turn_no ?? o.turn_no) === p.turn);
    // 질문 기준 보충(lt2~): 그 턴 RECALL 이 원문 항목을 붙였나
    const rc = ops.find((o) => o.op === 'RECALL' && (o.local_turn_no ?? o.turn_no) === p.turn);
    const recalled = !!rc && fromSrc.some((id) => JSON.parse(rc.detail).included.includes(id));
    const kws = (p.expect ?? []).filter((k) => k.length >= 2);
    const mentions = run.turns.filter((t) => t.turn > src && t.turn < p.turn && kws.some((k) => (t.reply ?? '').includes(k))).map((t) => t.turn);
    rows.push({ cond: m[2], rep: Number(m[3]), scenario: run.scenario, turn: p.turn, slot: p.slot ?? null, type: p.type, gap: Number.isFinite(src) ? p.turn - src : null,
      block, block_used: r?.used ?? null, block_dropped_n: r?.dropped.length ?? null, deep_search: deep, recalled,
      char_mentions: mentions, mention_in_window: mentions.some((t) => p.turn - t <= WINDOW), label: labelOf(m[2], run.scenario, p.turn, Number(m[3])) });
  }
}
const conds = [...new Set(rows.map((r) => r.cond))].sort();
const BLOCKS = ['in_block', 'dropped', 'not_in_block', 'not_stored', 'memory_off', 'na'];
const L = [`# 120턴 기억 문항 — 블록 포함·빠짐·원문 검색·캐릭터 재언급 (${RUNP})`, '', `생성 ${new Date().toISOString()} · 문항 ${rows.length}개 · 블록 = 문항 직전 RETRIEVE 기준, 원문 턴 = source_turns 중 가장 늦은 턴`, '',
  `| 조건 | 문항 | ${BLOCKS.join(' | ')} | 블록에서 빠진 항목 수 최대 | 블록 토큰 최대 | 원문 검색 | 보충으로 붙음 | 재언급(창 ${WINDOW}턴 안) |`, `|---|---|${BLOCKS.map(() => '---').join('|')}|---|---|---|---|---|`];
for (const c of conds) {
  const rs = rows.filter((r) => r.cond === c);
  L.push(`| ${c} | ${rs.length} | ${BLOCKS.map((b) => rs.filter((r) => r.block === b).length).join(' | ')} | ${Math.max(0, ...rs.map((r) => r.block_dropped_n ?? 0))} | ${Math.max(0, ...rs.map((r) => r.block_used ?? 0))} | ${rs.filter((r) => r.deep_search).length} | ${rs.filter((r) => r.recalled).length} | ${rs.filter((r) => r.mention_in_window).length} |`);
}
if (labels.length) {
  L.push('', '## 블록 상태별 Opus 라벨', '', '| 조건 | 블록 상태 | correct | partial | unknown | stale | wrong | fabricated |', '|---|---|---|---|---|---|---|---|');
  for (const c of conds) for (const b of BLOCKS) {
    const rs = rows.filter((r) => r.cond === c && r.block === b && r.label);
    if (rs.length) L.push(`| ${c} | ${b} | ${['correct', 'partial', 'unknown', 'stale', 'wrong', 'fabricated'].map((k) => rs.filter((r) => r.label === k).length).join(' | ')} |`);
  }
}
fs.writeFileSync(path.join(OUT, `drop-${RUNP}.json`), JSON.stringify(rows, null, 1));
fs.writeFileSync(path.join(OUT, `drop-${RUNP}.md`), L.join('\n'));
console.log(L.join('\n'));
