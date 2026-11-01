// 상황 대본 대화 품질을 사람(또는 Opus 조정 세션)이 블라인드로 판정하기 위한 목록 만들기·보기·집계(docs/50 리뷰 지적 1).
// 짝(기준선 vs 후보)으로 보여 주면 기준선 답이 여러 짝에 똑같이 반복돼 어느 쪽이 기준선인지 드러난다(2026-10-26 발견).
// 그래서 같은 캐릭터·같은 구간(5턴)의 모든 조건 답을 한 묶음으로, 무작위 이름(V1..Vn)·무작위 순서로 보여 주고 축마다 1~5점을 매긴다.
// 축은 pair-run.mjs 와 같다. 기준선 대비 승/패는 같은 묶음 안의 점수 비교로 낸다(높으면 승, 같으면 무승부).
// 사용:
//   node bench/pair-blind.mjs build --rep 1 --seed 20261026 --dir out/opus-quality-r1   → groups.json(블라인드), groups-KEY.json
//   120턴(장면 단위): build --rep 1 --run-prefix lt1 --script 120 --units scenes --conds haiku-off,haiku-on,deepseek-on --dir out/opus-qlt1-r1
//   node bench/pair-blind.mjs show --dir out/opus-quality-r1 --from 0 --n 1
//   node bench/pair-blind.mjs score --dir out/opus-quality-r1 [--dir2 out/opus-quality-r2]  → labels.tsv(+KEY) 로 집계(summary.md)
//   labels.tsv: groupId<TAB>V#<TAB>character<TAB>context<TAB>engagement<TAB>user_agency<TAB>overall<TAB>근거   (1~5)
import fs from 'node:fs';
import path from 'node:path';

const [cmd, ...rest] = process.argv.slice(2);
const opt = (k, d) => { const i = rest.indexOf(`--${k}`); return i >= 0 ? rest[i + 1] : d; };
const OUT = path.join(import.meta.dirname, 'out');
const dirOf = (d) => path.resolve(import.meta.dirname, d);
const DIR = dirOf(opt('dir', 'out/opus-quality-r1'));
const AXES = ['character', 'context', 'engagement', 'user_agency', 'overall'];
const BASE = opt('baseline', 'haiku-off');
const CONDS = opt('conds', 'haiku-off,haiku-on,luna-off,luna-on,deepseek-off,deepseek-on,gemma26-off').split(',');
const RUNP = opt('run-prefix', 'dm2'); // 정규식 조각 가능(예: '(?:lt1|lt2)' — 기준선을 다른 실험에서 가져올 때)
const SCRIPT = opt('script', 'situ-20');
const SCENES = opt('units') === 'scenes';
// 판정 단위: 상황 대본은 4구간, 120턴 대본은 장면 10개(s01~s10, pair-run --units scenes 와 같은 이름)
const unitsOf = (sc) => (SCENES
  ? Object.fromEntries(sc.scenes.map(([from, to, name], i) => [`s${String(i + 1).padStart(2, '0')}`, { range: [from, to], situation: `${name} (${from}~${to}턴)` }]))
  : Object.fromEntries(Object.entries(sc.segments).map(([seg, range]) => [seg, { range, situation: sc.situations[seg] }])));

function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const shuffle = (a, rand) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const runFor = (cond, scenario, rep) => {
  const d = fs.readdirSync(OUT).find((x) => new RegExp(`-${scenario}-${RUNP}-${cond}-r${rep}$`).test(x) && fs.existsSync(path.join(OUT, x, 'run.json')));
  return d ? JSON.parse(fs.readFileSync(path.join(OUT, d, 'run.json'), 'utf8')) : null;
};

if (cmd === 'build') {
  const rep = Number(opt('rep', 1));
  const rand = rng(Number(opt('seed', 20261026)));
  const groups = [];
  for (const ch of ['baekho', 'naruto', 'backend', 'sejong']) {
    const scenario = `${ch}-${SCRIPT}`;
    const sc = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'scenarios', `${scenario}.json`), 'utf8'));
    const runs = Object.fromEntries(CONDS.map((c) => { const r = runFor(c, scenario, rep); if (!r) throw new Error(`런 없음 ${c} ${scenario} r${rep}`); return [c, r]; }));
    for (const [seg, { range: [from, to], situation }] of Object.entries(unitsOf(sc))) {
      const order = shuffle([...CONDS], rand);
      groups.push({ character_id: sc.character_id, scenario, segment: seg, situation,
        users: sc.turns.filter((t) => t.turn >= from && t.turn <= to).map((t) => t.user),
        versions: order.map((c, i) => ({ v: `V${i + 1}`, cond: c, run_id: runs[c].run_id, replies: runs[c].turns.filter((t) => t.turn >= from && t.turn <= to).map((t) => t.reply ?? '') })) });
    }
  }
  shuffle(groups, rand);
  groups.forEach((g, i) => { g.id = `G${rep}-${String(i + 1).padStart(2, '0')}`; });
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(path.join(DIR, 'groups.json'), JSON.stringify(groups.map((g) => ({ ...g, versions: g.versions.map(({ cond, run_id, ...v }) => v) })), null, 1));
  fs.writeFileSync(path.join(DIR, 'groups-KEY.json'), JSON.stringify(groups.map((g) => ({ id: g.id, scenario: g.scenario, segment: g.segment, rep, versions: g.versions.map(({ v, cond, run_id }) => ({ v, cond, run_id })) })), null, 1));
  console.log(`묶음 ${groups.length}개 × ${CONDS.length}버전 → ${path.relative(process.cwd(), DIR)}`);
} else if (cmd === 'show') {
  const groups = JSON.parse(fs.readFileSync(path.join(DIR, 'groups.json'), 'utf8'));
  const from = Number(opt('from', 0)), n = Number(opt('n', 1));
  for (const g of groups.slice(from, from + n)) {
    console.log(`## ${g.id} [${g.character_id} · ${g.segment}] ${g.situation}`);
    g.users.forEach((u, i) => { console.log(`  U${i + 1}: ${u}`); for (const v of g.versions) console.log(`    ${v.v}: ${v.replies[i].replace(/\s+/g, ' ')}`); });
  }
} else if (cmd === 'score') {
  const dirs = [DIR, ...(opt('dir2') ? [dirOf(opt('dir2'))] : [])];
  const rows = [];
  for (const d of dirs) {
    const key = new Map(JSON.parse(fs.readFileSync(path.join(d, 'groups-KEY.json'), 'utf8')).map((k) => [k.id, k]));
    const lab = fs.readFileSync(path.join(d, 'labels.tsv'), 'utf8').split('\n').filter((l) => /^G\d-\d{2}\tV\d/.test(l)).map((l) => l.split('\t'));
    const need = [...key.values()].reduce((s, k) => s + k.versions.length, 0);
    if (lab.length !== need) throw new Error(`${path.basename(d)}: 라벨 ${lab.length} / 필요 ${need}`);
    for (const [gid, v, ...x] of lab) {
      const k = key.get(gid), ver = k.versions.find((y) => y.v === v);
      const s = Object.fromEntries(AXES.map((ax, i) => { const n = Number(x[i]); if (!(n >= 1 && n <= 5)) throw new Error(`${gid} ${v} ${ax}=${x[i]}`); return [ax, n]; }));
      rows.push({ group: gid, rep: k.rep, scenario: k.scenario, segment: k.segment, v, cond: ver.cond, run_id: ver.run_id, scores: s, why: x[5] ?? '' });
    }
  }
  fs.writeFileSync(path.join(DIR, 'labels-unblinded.json'), JSON.stringify(rows, null, 1));
  const binom2 = (w, l) => { const n = w + l; if (!n) return 1; const k = Math.min(w, l); let p = 0; for (let i = 0; i <= k; i++) { let c = 1; for (let j = 0; j < i; j++) c = (c * (n - j)) / (j + 1); p += c / 2 ** n; } return Math.min(1, 2 * p); };
  const conds = CONDS.filter((c) => rows.some((r) => r.cond === c));
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const table = {};
  for (const c of conds) {
    const rs = rows.filter((r) => r.cond === c);
    table[c] = { n: rs.length, mean: Object.fromEntries(AXES.map((ax) => [ax, mean(rs.map((r) => r.scores[ax]))])), vs_base: null, min_overall: Math.min(...rs.map((r) => r.scores.overall)) };
    if (c !== BASE) table[c].vs_base = Object.fromEntries(AXES.map((ax) => {
      let w = 0, l = 0, t = 0;
      for (const r of rs) { const b = rows.find((x) => x.group === r.group && x.cond === BASE); if (r.scores[ax] > b.scores[ax]) w++; else if (r.scores[ax] < b.scores[ax]) l++; else t++; }
      return [ax, { win: w, loss: l, tie: t, p: binom2(w, l) }];
    }));
  }
  const L = [`# 상황 대본 대화 품질 — 블라인드 묶음 판정 (${dirs.map((d) => path.basename(d)).join(' + ')})`, '', `생성 ${new Date().toISOString()} · 묶음(캐릭터×구간) ${new Set(rows.map((r) => r.group)).size}개 · 조건 ${conds.length}개 · 1~5점`, '',
    '## 축별 평균 점수', '', `| 조건 | ${AXES.join(' | ')} | overall 최저 |`, `|---|${AXES.map(() => '---').join('|')}|---|`];
  for (const c of conds) L.push(`| ${c} | ${AXES.map((ax) => table[c].mean[ax].toFixed(2)).join(' | ')} | ${table[c].min_overall} |`);
  L.push('', `## ${BASE} 대비 같은 묶음 비교 (후보 높음:낮음:같음, 부호 검정 p)`, '', `| 조건 | ${AXES.join(' | ')} |`, `|---|${AXES.map(() => '---').join('|')}|`);
  for (const c of conds.filter((x) => x !== BASE)) L.push(`| ${c} | ${AXES.map((ax) => { const t = table[c].vs_base[ax]; return `${t.win}:${t.loss}:${t.tie} (${t.p.toFixed(2)})`; }).join(' | ')} |`);
  const SEGS = [...new Set(rows.map((r) => r.segment))].sort();
  L.push('', '## 구간별 overall 평균', '', `| 조건 | ${SEGS.join(' | ')} |`, `|---|${SEGS.map(() => '---').join('|')}|`);
  for (const c of conds) L.push(`| ${c} | ${SEGS.map((s) => { const xs = rows.filter((r) => r.cond === c && r.segment === s).map((r) => r.scores.overall); return xs.length ? mean(xs).toFixed(2) : '–'; }).join(' | ')} |`);
  fs.writeFileSync(path.join(DIR, 'summary.json'), JSON.stringify({ generated: new Date().toISOString(), table }, null, 1));
  fs.writeFileSync(path.join(DIR, 'summary.md'), L.join('\n'));
  console.log(L.join('\n'));
} else throw new Error('build | show | score');
