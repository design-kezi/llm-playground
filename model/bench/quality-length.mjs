// 대화 품질 블라인드 판정(pair-blind.mjs)의 길이 효과 점검(docs/50 리뷰 지적 3: 판정관 길이 편향, MT-Bench verbosity bias).
// 축마다 점수 ~ 묶음 고정효과 + 조건(기준선 haiku-off 대비) [+ 대사 평균 길이] 최소제곱. 길이를 넣어도 조건 차이가 남는지 본다.
// 사용: node bench/quality-length.mjs --dir out/opus-quality-r1 [--dir2 out/opus-quality-r2] → <dir>/length.md
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
const dirs = [opt('dir') ?? 'out/opus-quality-r1', ...(opt('dir2') ? [opt('dir2')] : [])].map((d) => path.resolve(import.meta.dirname, d));
const rows = [];
// score --dir2 를 쓰면 첫 디렉터리의 labels-unblinded.json 에 두 회차가 다 들어 있다. 묶음 원문은 회차별 groups.json 에서 찾는다.
const G = new Map(dirs.flatMap((d) => JSON.parse(fs.readFileSync(path.join(d, 'groups.json'), 'utf8')).map((g) => [g.id, g])));
for (const r of JSON.parse(fs.readFileSync(path.join(dirs[0], 'labels-unblinded.json'), 'utf8'))) {
  const v = G.get(r.group)?.versions.find((x) => x.v === r.v);
  if (v) rows.push({ ...r, len: v.replies.reduce((s, t) => s + t.replace(/\*[^*]*\*/g, '').trim().length, 0) / v.replies.length });
}
const AXES = ['overall', 'engagement', 'character', 'context', 'user_agency'];
const BASE = process.argv.includes('--baseline') ? process.argv[process.argv.indexOf('--baseline') + 1] : 'haiku-off';
const conds = [...new Set(rows.map((r) => r.cond))].filter((c) => c !== BASE).sort();
const groups = [...new Set(rows.map((r) => r.group))];
function ols(X, y) {
  const n = X.length, k = X[0].length;
  const A = Array.from({ length: k }, () => Array(2 * k).fill(0));
  const Xty = Array(k).fill(0);
  for (let i = 0; i < n; i++) for (let a = 0; a < k; a++) { Xty[a] += X[i][a] * y[i]; for (let b = 0; b < k; b++) A[a][b] += X[i][a] * X[i][b]; }
  for (let i = 0; i < k; i++) A[i][k + i] = 1;
  for (let i = 0; i < k; i++) { let p = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r; [A[i], A[p]] = [A[p], A[i]]; const d = A[i][i]; for (let j = 0; j < 2 * k; j++) A[i][j] /= d; for (let r = 0; r < k; r++) if (r !== i) { const f = A[r][i]; for (let j = 0; j < 2 * k; j++) A[r][j] -= f * A[i][j]; } }
  const inv = A.map((r) => r.slice(k));
  const beta = inv.map((r) => r.reduce((s, v, j) => s + v * Xty[j], 0));
  const res = y.map((yy, i) => yy - X[i].reduce((s, v, j) => s + v * beta[j], 0));
  const s2 = res.reduce((s, e) => s + e * e, 0) / (n - k);
  return { beta, ci: inv.map((r, i) => 1.96 * Math.sqrt(s2 * r[i])) };
}
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const L = [`# 대화 품질 점수와 대사 길이 (${dirs.map((d) => path.basename(d)).join(' + ')})`, '', `생성 ${new Date().toISOString()} · 판정 ${rows.length}개 · 묶음 고정효과 최소제곱, 값 = ${BASE} 대비 점수 차 ± 95% 구간`, '',
  `평균 대사 길이(행동 묘사 제외, 글자): ${[BASE, ...conds].map((c) => `${c} ${mean(rows.filter((r) => r.cond === c).map((r) => r.len)).toFixed(0)}`).join(' · ')}`, ''];
const mx = mean(rows.map((r) => r.len)), my = mean(rows.map((r) => r.scores.overall));
const corr = rows.reduce((s, r) => s + (r.len - mx) * (r.scores.overall - my), 0) / Math.sqrt(rows.reduce((s, r) => s + (r.len - mx) ** 2, 0) * rows.reduce((s, r) => s + (r.scores.overall - my) ** 2, 0));
let longer = 0, shorter = 0;
for (const g of groups) { const rs = rows.filter((r) => r.group === g); for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) { const dl = rs[i].len - rs[j].len, ds = rs[i].scores.overall - rs[j].scores.overall; if (dl && ds) dl * ds > 0 ? longer++ : shorter++; } }
L.push(`overall 과 길이 상관 r = ${corr.toFixed(2)} · 같은 묶음 안에서 점수가 갈린 쌍 중 긴 쪽이 높음 ${longer}, 짧은 쪽이 높음 ${shorter}`, '', `| 축 | 모형 | ${conds.join(' | ')} | 길이 10자당 |`, `|---|---|${conds.map(() => '---').join('|')}|---|`);
for (const ax of AXES) for (const withLen of [false, true]) {
  const X = rows.map((r) => [...groups.slice(1).map((g) => (r.group === g ? 1 : 0)), ...conds.map((c) => (r.cond === c ? 1 : 0)), ...(withLen ? [r.len / 10] : []), 1]);
  const { beta, ci } = ols(X, rows.map((r) => r.scores[ax]));
  const o = groups.length - 1;
  L.push(`| ${ax} | ${withLen ? '길이 통제' : '통제 없음'} | ${conds.map((c, i) => `${beta[o + i] >= 0 ? '+' : ''}${beta[o + i].toFixed(2)} ±${ci[o + i].toFixed(2)}${Math.abs(beta[o + i]) > ci[o + i] ? ' *' : ''}`).join(' | ')} | ${withLen ? beta[o + conds.length].toFixed(3) : ''} |`);
}
L.push('', '\\* = 95% 구간이 0을 포함하지 않음.');
fs.writeFileSync(path.join(dirs[0], 'length.md'), L.join('\n'));
console.log(L.join('\n'));
