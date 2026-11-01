// 오늘 날짜 넣기 시험(docs/50 2026-11-01 사전 등록) 집계.
// 사용: node bench/date-compare.mjs  → out/date-compare.md
//   시험 A: dt1 (v2-dsx vs v2-dsx-date, <캐릭터>-date-12) — 탐침별 키워드 판정 + 답 원문
//   시험 B: lt2 v2-dsx vs lt3 v2-dsx-date (120턴) — 비용·키워드 기억 점수·묻지 않은 날짜 언급
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(import.meta.dirname, 'out');
const runs = (re) => fs.readdirSync(OUT).filter((d) => re.test(d) && fs.existsSync(path.join(OUT, d, 'run.json')))
  .map((d) => ({ dir: d, ...JSON.parse(fs.readFileSync(path.join(OUT, d, 'run.json'), 'utf8')) })).filter((r) => r.valid !== false && !r.aborted);
const DATE_RE = /\d+\s?월\s?\d+\s?일|\d+일|[월화수목금토일]요일|며칠|오늘이|날짜/;
const SAID_RE = /\d+\s?월\s?\d+\s?일|[월화수목금토일]요일/;
const f = (x, d = 3) => (x == null ? '–' : x.toFixed(d));
const lines = ['# 오늘 날짜 넣기 시험 집계', '', `생성 ${new Date().toISOString()} · 사전 등록 docs/50 2026-11-01`, ''];

// ── 시험 A ──
lines.push('## 시험 A — 날짜 질문 (dt1, 12턴, 시계 2026-11-12 목)', '');
const A = Object.fromEntries(Object.entries({ 'v2-dsx': runs(/-date-12-dt1-v2-dsx-r\d$/), 'v2-dsx-date': runs(/-date-12-dt1-v2-dsx-date-r\d$/), 'v2-dsx-date2 (문구 v2)': runs(/-date-12-dt2-v2-dsx-date2-r\d$/), 'v2-dsx-dategate (시간 표현 턴만)': runs(/-date-12-dt3-v2-dsx-dategate-r\d$/) }).filter(([, rs]) => rs.length));
const slots = ['today_date', 'weekday', 'days_until', 'tomorrow', 'saturday_date'];
const SLOT = { today_date: '오늘 며칠(12일)', weekday: '무슨 요일(목)', days_until: '20일 시험까지(8일)', tomorrow: '내일 요일(금)', saturday_date: '이번 주 토요일(14일)' };
lines.push(`| 탐침 | ${Object.keys(A).map((c) => `${c} 정답/런`).join(' | ')} |`, `|---|${Object.keys(A).map(() => '---|').join('')}`);
const probe = (r, slot) => { const sc = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'scenarios', `${r.scenario}.json`), 'utf8')); const t = sc.turns.find((x) => x.slot === slot); return r.score.memory.results.find((x) => x.turn === t.turn); };
for (const s of slots) lines.push(`| ${SLOT[s]} | ${Object.values(A).map((rs) => `${rs.filter((r) => probe(r, s)?.result === 'correct').length}/${rs.length}`).join(' | ')} |`);
lines.push(`| 합계 | ${Object.values(A).map((rs) => `${rs.reduce((n, r) => n + slots.filter((s) => probe(r, s)?.result === 'correct').length, 0)}/${rs.length * slots.length}`).join(' | ')} |`, '');
lines.push('키워드 판정은 정답 키워드가 답에 있으면 정답. 지어낸 날짜 여부는 아래 원문을 읽고 따로 센다.', '');
for (const [c, rs] of Object.entries(A)) {
  lines.push(`### ${c} 답 원문`, '');
  for (const r of rs.sort((a, b) => a.dir.localeCompare(b.dir))) {
    lines.push(`**${r.scenario} ${r.label}**`, '');
    for (const s of slots) { const p = probe(r, s); lines.push(`- ${SLOT[s]} [${p?.result}] ${p?.reply?.replace(/\s+/g, ' ')}`); }
    lines.push('');
  }
}

// ── 시험 B ──
lines.push('## 시험 B — 120턴 회귀·비용 (lt2 v2-dsx vs lt3 v2-dsx-date)', '');
const B = Object.fromEntries(Object.entries({ 'lt2 v2-dsx': runs(/-120-lt2-v2-dsx-r\d$/), 'lt3 v2-dsx-date': runs(/-120-lt3-v2-dsx-date-r\d$/), 'lt4 v2-dsx-date2 (문구 v2)': runs(/-120-lt4-v2-dsx-date2-r\d$/), 'lt5 v2-dsx-dategate (시간 표현 턴만)': runs(/-120-lt5-v2-dsx-dategate-r\d$/) }).filter(([, rs]) => rs.length));
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const row = (rs) => {
  const turns = rs.flatMap((r) => r.turns.filter((t) => t.reply != null));
  const unasked = rs.map((r) => r.turns.filter((t) => t.reply && !DATE_RE.test(t.user ?? '') && SAID_RE.test(t.reply)).length);
  const pts = rs.reduce((n, r) => n + r.score.memory.points, 0), max = rs.reduce((n, r) => n + r.score.memory.max_points, 0);
  const cnt = {}; for (const r of rs) for (const [k, v] of Object.entries(r.score.memory.counts)) cnt[k] = (cnt[k] ?? 0) + v;
  const today = rs.map((r) => r.turns.filter((t) => t.reply && !/월요일|오늘/.test(t.user ?? '') && /월요일|11월 ?2일/.test(t.reply)).length);
  return { today: mean(today), today_all: today, n: rs.length, avg: mean(rs.map((r) => r.score.cost.avg_with_end_krw)), avg_turn: mean(rs.map((r) => r.score.cost.avg_krw)),
    max: Math.max(...rs.map((r) => r.score.cost.max.krw)),
    mem: (pts / max) * 100, cnt, unasked: mean(unasked), unasked_all: unasked, len: mean(turns.map((t) => t.reply.replace(/\*[^*]*\*/g, '').trim().length)) };
};
const R = Object.fromEntries(Object.entries(B).map(([k, rs]) => [k, rs.length ? row(rs) : null]));
lines.push('| 지표 | ' + Object.keys(R).join(' | ') + ' |', `|---|${Object.keys(R).map(() => '---|').join('')}`);
const L = (l, g) => lines.push(`| ${l} | ${Object.values(R).map((r) => (r ? g(r) : '–')).join(' | ')} |`);
L('런 수', (r) => r.n);
L('턴당 비용(종료 정리 포함)', (r) => `${f(r.avg)}원`);
L('턴당 비용(턴만)', (r) => `${f(r.avg_turn)}원`);
L('최대 턴', (r) => `${f(r.max, 2)}원`);
L('키워드 기억 점수', (r) => `${f(r.mem, 1)}%`);
L('키워드 판정 분포', (r) => Object.entries(r.cnt).map(([k, v]) => `${k} ${v}`).join(' · '));
L('묻지 않은 날짜·요일 언급/런', (r) => `${f(r.unasked, 1)} (${r.unasked_all.join(', ')})`);
L('그중 오늘 요일 덧붙임/런', (r) => `${f(r.today, 1)} (${r.today_all.join(', ')})`);
L('대사 평균 길이(지문 뺌)', (r) => `${Math.round(r.len)}자`);
lines.push('', '1원 넘은 턴·피크·최악 비용은 `node bench/cost-scenarios.mjs --prefix lt3` (out/cost-lt3.md) 를 본다(리포트와 같은 계산).', '묻지 않은 언급: 사용자 말에 날짜·요일·며칠이 없는 턴인데 답에 "N월 N일" 또는 "~요일"이 나온 수.', '');
for (const [k, rs] of Object.entries(B)) {
  const ex = rs.flatMap((r) => r.turns.filter((t) => t.reply && !DATE_RE.test(t.user ?? '') && SAID_RE.test(t.reply)).map((t) => `- ${r.scenario} ${r.label} ${t.turn}턴 · 사용자: ${t.user} → ${t.reply.replace(/\s+/g, ' ').slice(0, 200)}`));
  if (ex.length) lines.push(`### ${k} 묻지 않은 날짜 언급 원문`, '', ...ex, '');
}

fs.writeFileSync(path.join(OUT, 'date-compare.md'), lines.join('\n'));
console.log(lines.filter((l) => l.startsWith('|')).join('\n'));
