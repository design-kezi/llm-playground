// 제출 리포트(데모 웹 /report)용 데이터. 벤치 결과 파일에서 숫자·사례를 모아 한 파일로 쓴다(0원, 재현용).
// 입력: out/final-lt1·dm2 의 근거 파일들(opus-*/summary.json, cost-*.json, panel-vs-opus*.json, drop-lt1.json, run.json, 라벨)
// 사용: node bench/report-data.mjs → app/app/report/data.json
import fs from 'node:fs';
import path from 'node:path';

const B = import.meta.dirname, OUT = path.join(B, 'out');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
const PRICES = JSON.parse(fs.readFileSync(path.join(B, '..', 'pricing.json'), 'utf8'));
const r3 = (x) => (x == null ? null : Math.round(x * 1000) / 1000);
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

// ── 120턴(lt1) ──
// lt1(2026-10-31) 5조건 + lt2(2026-11-01 재측정) 개선판 2조건. 개선판의 기억·품질 점수는 lt2 판정 회차 것(기준 deepseek-on 을 같은 회차에서 다시 판정).
const LT_CONDS = ['deepseek-on', 'haiku-off', 'haiku-on', 'ctl-full-memoff', 'ctl-slide6-memoff'];
const has = (f) => fs.existsSync(path.join(OUT, f));
const LT2 = has('opus-lt2-r1/summary.json') ? ['v2-gemma', 'v2-dsx'] : [];
const tbl = (f) => Object.fromEntries(rd(f).table.map((r) => [r.cond, r]));
// 최종 구성(docs/50 2026-11-01 최종 측정): 대화 따르기 6차 + 기억 v2. FINAL_PREFIX 는 final-summary.json 이 정한 120턴 측정(lt7 또는 lt8).
// 기억은 그 측정의 Opus 블라인드(lt2 v2-dsx 와 같은 회차), 품질은 opus-qlt7(lt7 답, 대화 코드는 lt8 과 같음).
const FINAL = 'v2-dsx-follow';
const FINAL_PREFIX = has('final-summary.json') ? rd('final-summary.json').final_prefix : null;
const PTS = { correct: 2, partial: 1, unknown: 0, stale: -1, wrong: -1, fabricated: -2 };
const memFromLabels = (rows) => {
  const R = rows.filter((x) => x.label !== 'na'), pct = (xs) => ({ n: xs.length, pct: xs.length ? (100 * xs.reduce((a, x) => a + PTS[x.label], 0)) / (2 * xs.length) : 0 });
  const counts = {}; for (const x of R) counts[x.label] = (counts[x.label] ?? 0) + 1;
  const types = [...new Set(R.map((x) => x.type))];
  return { all: pct(R), by_rep: { 1: pct(R.filter((x) => x.rep === 1)), 2: pct(R.filter((x) => x.rep === 2)) }, counts, harmful: (counts.stale ?? 0) + (counts.wrong ?? 0) + (counts.fabricated ?? 0),
    by_type: Object.fromEntries(types.map((t) => [t, pct(R.filter((x) => x.type === t))])), vs_base: null };
};
const finalLabels = FINAL_PREFIX && has(`opus-${FINAL_PREFIX}-r1/labels-unblinded.json`) ? rd(`opus-${FINAL_PREFIX}-r1/labels-unblinded.json`) : [];
const ltMem = { ...tbl('opus-lt1-r1/summary.json'), ...(LT2.length ? Object.fromEntries(Object.entries(tbl('opus-lt2-r1/summary.json')).filter(([c]) => LT2.includes(c))) : {}) };
const mem2 = LT2.length ? tbl('opus-lt2-r1/summary.json') : {};
const ltCost = Object.fromEntries([...rd('cost-lt1.json').rows, ...(has('cost-lt2.json') ? rd('cost-lt2.json').rows : []), ...(FINAL_PREFIX ? rd(`cost-${FINAL_PREFIX}.json`).rows : [])].map((r) => [r.cond, r]));
const ltQual = { ...rd('opus-qlt1-r1/summary.json').table, ...(has('opus-qlt2-r1/summary.json') ? Object.fromEntries(Object.entries(rd('opus-qlt2-r1/summary.json').table).filter(([c]) => LT2.includes(c))) : {}) };
const qual2 = has('opus-qlt2-r1/summary.json') ? rd('opus-qlt2-r1/summary.json').table : {};
const ltPanel = { ...rd('panel-vs-opus-lt1.json').table, ...(has('panel-vs-opus-lt2.json') ? rd('panel-vs-opus-lt2.json').table : {}) };
const drop = [...rd('drop-lt1.json'), ...(has('drop-lt2.json') ? rd('drop-lt2.json') : [])];
const runs = {}, tags = {};
for (const d of fs.readdirSync(OUT).filter((x) => (/-120-lt[12]-/.test(x) || (FINAL_PREFIX && x.includes(`-120-${FINAL_PREFIX}-`))) && fs.existsSync(path.join(OUT, x, 'run.json')))) {
  const r = JSON.parse(fs.readFileSync(path.join(OUT, d, 'run.json'), 'utf8'));
  if (r.valid?.ok === false) continue;
  const c = r.label.replace(/^lt\d-|-r\d$/g, '');
  const a = (runs[c] ??= { n: 0, turns: 0, krw: 0, ph: [0, 0, 0], over1: 0, max: 0, lat: [], len: [], resp: [], exLat: [] });
  a.n++; a.turns += r.turns.length; a.krw += r.report.total_krw;
  r.report.phases.forEach((p, i) => { a.ph[i] += p.avg_krw; });
  a.max = Math.max(a.max, r.report.max_turn.krw);
  const per = {};
  for (const x of r.calls) per[x.turn_no] = (per[x.turn_no] ?? 0) + x.cost_krw;
  a.over1 += Object.entries(per).filter(([t, v]) => Number(t) > 0 && v > 1).length;
  // 지연: 요청 전체(같은 요청 안에서 기억 추출까지 기다림) / 대화 응답 호출만 / 추출이 있는 턴의 요청 전체
  const exT = new Set(r.calls.filter((x) => x.tag === 'extract').map((x) => x.turn_no));
  for (const x of r.calls) if (x.tag === 'response' && x.ok) a.resp.push(x.latency_ms);
  for (const t of r.turns) { if (exT.has(t.turn)) a.exLat.push(t.latency_ms); a.lat.push(t.latency_ms); a.len.push((t.reply ?? '').replace(/\*[^*]*\*/g, '').trim().length); }
  const tg = (tags[c] ??= {});
  // 공유 서버(--shared) 런은 모델 원장이 런 id 로 갈리지 않아 ledger 가 비어 있다 → 앱 calls 기록(같은 비용 근거)으로 태그별 합
  for (const x of Array.isArray(r.ledger) && r.ledger.length ? r.ledger : r.calls) tg[x.tag] = (tg[x.tag] ?? 0) + (x.cost_krw ?? 0);
}
// 결함 자동 집계(score.js, 0원): 120턴 런에서 결함이 걸린 턴 수. lt1 = 개선 전·대조군, lt2 = 개선판, lt5 = 현재 기본값(날짜 gate)
const DEFECTS = ['repetition', 'same_opening', 'user_action', 'lang_mix', 'meta_or_empty', 'speech_mismatch', 'early_past_ref'];
const defects = {};
for (const d of fs.readdirSync(OUT).filter((x) => /-120-lt[125]-/.test(x) && fs.existsSync(path.join(OUT, x, 'run.json')))) {
  const r = JSON.parse(fs.readFileSync(path.join(OUT, d, 'run.json'), 'utf8'));
  if (r.valid?.ok === false || r.aborted) continue;
  const key = r.label.replace(/-r\d$/, '');
  const a = (defects[key] ??= { runs: 0, turns: 0, any: 0, ...Object.fromEntries(DEFECTS.map((k) => [k, 0])) });
  const ft = r.score.quality.flag_turns ?? {};
  a.runs++; a.turns += r.turns.filter((t) => t.reply != null).length;
  for (const k of DEFECTS) a[k] += (ft[k] ?? []).length;
  a.any += new Set(DEFECTS.flatMap((k) => ft[k] ?? [])).size;
}
// 어려운 문항(docs/30 149행: 마지막 원문 턴에서 21턴 이상 떨어진 문항, 거리 기준만) 의 Opus 블라인드 라벨 집계. 0원.
// docs/30 247행 통과 기준 '제안'(정답률 70% 이상, 지어냄 5% 이하)은 120턴 사전 등록 기준이 아니다 — 사후로 대 보는 값.
// 정답은 'correct' 만 센다(docs/30 에 부분 정답 처리 정의 없음). na 는 분모에서 뺀다. 회차(판정 묶음)마다 따로: lt1 = 1차 판정, lt2 = 재판정(deepseek-on 포함).
const hard_probe = { definition: 'gap >= 21 turns (docs/30 l.149, distance only)', counting: 'correct only; na excluded', criterion_proposed: 'docs/30 l.247: correct >= 70%, fabricated <= 5% (proposal, not pre-registered)' };
for (const [round, file] of [['lt1', 'opus-lt1-r1/labels-unblinded.json'], ['lt2', 'opus-lt2-r1/labels-unblinded.json'], ...(FINAL_PREFIX ? [[FINAL_PREFIX, `opus-${FINAL_PREFIX}-r1/labels-unblinded.json`]] : [])]) {
  if (!has(file)) continue;
  const scs = {};
  for (const x of rd(file)) {
    const sc = (scs[x.scenario] ??= JSON.parse(fs.readFileSync(path.join(B, 'scenarios', `${x.scenario}.json`), 'utf8')));
    const t = sc.turns.find((y) => y.turn === x.turn);
    if (!t?.source_turns?.length || x.turn - Math.max(...t.source_turns) < 21 || x.label === 'na') continue;
    const a = ((hard_probe[round] ??= {})[x.cond] ??= { n: 0, correct: 0, fabricated: 0 });
    a.n++; if (x.label === 'correct') a.correct++; if (x.label === 'fabricated') a.fabricated++;
  }
  for (const a of Object.values(hard_probe[round] ?? {})) { a.correct_pct = Math.round((a.correct / a.n) * 1000) / 10; a.fabricated_pct = Math.round((a.fabricated / a.n) * 1000) / 10; }
}
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const blk = (c, b) => { const xs = drop.filter((x) => x.cond === c && x.block === b && x.label); return xs.length ? { correct: xs.filter((x) => x.label === 'correct').length, n: xs.length } : null; };
// 최종 구성 기억·품질(블라인드 라벨에서 바로 집계)
if (finalLabels.length) {
  ltMem[FINAL] = memFromLabels(finalLabels.filter((x) => x.cond === FINAL));
  const AXQ = ['character', 'context', 'engagement', 'user_agency', 'overall'], acc = Object.fromEntries(AXQ.map((a) => [a, []]));
  for (const r of [1, 2]) {
    if (!has(`opus-qlt7-r${r}/labels.tsv`)) continue;
    const key = Object.fromEntries(rd(`opus-qlt7-r${r}/groups-KEY.json`).map((g) => [g.id, g]));
    for (const l of fs.readFileSync(path.join(OUT, `opus-qlt7-r${r}`, 'labels.tsv'), 'utf8').trim().split('\n')) {
      const p = l.split('\t'); if (p.length < 7) continue;
      if (key[p[0]]?.versions.find((v) => v.v === p[1])?.cond !== FINAL) continue;
      AXQ.forEach((a, i) => acc[a].push(Number(p[2 + i])));
    }
  }
  if (acc.overall.length) ltQual[FINAL] = { mean: Object.fromEntries(AXQ.map((a) => [a, acc[a].reduce((x, y) => x + y, 0) / acc[a].length])), vs_base: null };
}
const lt = [...LT_CONDS, ...LT2, ...(finalLabels.length && runs[FINAL] ? [FINAL] : [])].map((c) => {
  const m = ltMem[c], co = ltCost[c], ru = runs[c], q = ltQual[c], p = ltPanel[c];
  return {
    cond: c, runs: ru.n, turns: ru.turns, total_krw: r1(ru.krw),
    mem_pct: r1(m.all.pct), mem_r1: r1(m.by_rep[1].pct), mem_r2: r1(m.by_rep[2].pct), counts: m.counts, harmful: m.harmful,
    vs_base: m.vs_base ? { better: m.vs_base.better, worse: m.vs_base.worse, p: r3(m.vs_base.p) } : null,
    by_type: Object.fromEntries(Object.entries(m.by_type).map(([k, v]) => [k, r1(v.pct)])),
    in_block: blk(c, 'in_block'), dropped: blk(c, 'dropped'),
    // lt2 판정 회차 기준(같은 회차 안 비교): deepseek-on 재판정 점수와 개선판 점수, 품질 평균
    ...(mem2[c] ? { mem2_pct: r1(mem2[c].all.pct), mem2_vs: mem2[c].vs_base ? { better: mem2[c].vs_base.better, worse: mem2[c].vs_base.worse, p: r3(mem2[c].vs_base.p) } : null, counts2: mem2[c].counts, harmful2: mem2[c].harmful,
      by_type2: Object.fromEntries(Object.entries(mem2[c].by_type).map(([k, v]) => [k, r1(v.pct)])) } : {}),
    ...(qual2[c] ? { quality2: { mean: Object.fromEntries(Object.entries(qual2[c].mean).map(([k, v]) => [k, Math.round(v * 100) / 100])),
      vs: qual2[c].vs_base ? Object.fromEntries(Object.entries(qual2[c].vs_base).map(([k, v]) => [k, { win: v.win, loss: v.loss, p: r3(v.p) }])) : null } } : {}),
    ...(c === FINAL ? { final_round_base: { cond: 'v2-dsx', mem_pct: r1(memFromLabels(finalLabels.filter((x) => x.cond === 'v2-dsx')).all.pct) }, final_prefix: FINAL_PREFIX } : {}),
    cost: { measured: r3(co.measured), peak: r3(co.peak), nocache: r3(co.nocache), worst: r3(co.worst) },
    phases: ru.ph.map((v) => r3(v / ru.n)), over1_per_run: Math.round(ru.over1 / ru.n), max_turn: r3(ru.max),
    by_tag: Object.fromEntries(Object.entries(tags[c]).map(([k, v]) => [k, r3(v / ru.turns)])),
    lat_p50: r1(pct(ru.lat, 0.5) / 1000), lat_p95: r1(pct(ru.lat, 0.95) / 1000), resp_p50: r1(pct(ru.resp, 0.5) / 1000), resp_p95: r1(pct(ru.resp, 0.95) / 1000), ex_p50: r1(pct(ru.exLat, 0.5) / 1000), ex_p95: r1(pct(ru.exLat, 0.95) / 1000), reply_len: Math.round(ru.len.reduce((a, b) => a + b, 0) / ru.len.length),
    quality: q ? { mean: Object.fromEntries(Object.entries(q.mean).map(([k, v]) => [k, Math.round(v * 100) / 100])),
      opus_vs_base: q.vs_base ? Object.fromEntries(Object.entries(q.vs_base).map(([k, v]) => [k, { win: v.win, loss: v.loss, p: r3(v.p) }])) : null,
      panel_vs_base: p ? Object.fromEntries(Object.entries(p).map(([k, v]) => [k, { win: v.panel.win, loss: v.panel.loss, p: r3(v.panel.p) }])) : null } : null,
  };
});

// ── 40턴(dm2) ──
const DM_CONDS = ['haiku-off', 'haiku-on', 'luna-off', 'luna-on', 'deepseek-off', 'deepseek-on', 'gemma26-off'];
const dmMem = Object.fromEntries(rd('opus-dm2/summary.json').table.map((r) => [r.cond, r]));
const dmQual = rd('opus-quality-r1/summary.json').table;
const dmPanel = rd('panel-vs-opus.json').table;
const dmCost = Object.fromEntries(rd('cost-dm2.json').rows.map((r) => [r.cond, r]));
const dmOps = Object.fromEntries(rd('summary-dm2.json').rows.map((r) => [r.cond, r]));
const dm = DM_CONDS.map((c) => ({
  cond: c, mem_pct: r1(dmMem[c].all.pct), harmful: dmMem[c].harmful,
  mem_vs_base: dmMem[c].vs_base ? { better: dmMem[c].vs_base.better, worse: dmMem[c].vs_base.worse, p: r3(dmMem[c].vs_base.p) } : null,
  q_opus: Math.round(dmQual[c].mean.overall * 100) / 100,
  q_opus_vs: dmQual[c].vs_base ? { win: dmQual[c].vs_base.overall.win, loss: dmQual[c].vs_base.overall.loss, p: r3(dmQual[c].vs_base.overall.p) } : null,
  q_panel_vs: dmPanel[c] ? { win: dmPanel[c].overall.panel.win, loss: dmPanel[c].overall.panel.loss, p: r3(dmPanel[c].overall.panel.p) } : null,
  cost: { measured: r3(dmCost[c].measured), peak: r3(dmCost[c].peak), worst: r3(dmCost[c].worst) },
  lat_p50: dmOps[c].lat_p50_s, lat_p95: dmOps[c].lat_p95_s, rule_bad: r1(dmOps[c].rule_bad_rate * 100),
}));

// ── 사례(채택 구성의 120턴 답, Opus 블라인드 라벨 원문 그대로) ──
const ADOPTED = finalLabels.length ? FINAL : 'v2-dsx'; // 최종 구성이 측정·판정되면 그것을 채택으로
const CASE_RUN = ADOPTED === FINAL ? `opus-${FINAL_PREFIX}` : ADOPTED.startsWith('v2-') ? 'opus-lt2' : 'opus-lt1';
const items = new Map();
for (const r of [1, 2]) {
  const key = new Map(rd(`${CASE_RUN}-r${r}/blind-memory-KEY.json`).map((k) => [k.id, k]));
  for (const it of rd(`${CASE_RUN}-r${r}/blind-memory.json`)) { const k = key.get(it.id); items.set(`${k.cond}|${it.scenario}|${it.turn}|${k.rep ?? r}`, it); }
}
const labels = rd(`${CASE_RUN}-r1/labels-unblinded.json`);
const dropOf = (l) => drop.find((x) => x.cond === l.cond && x.scenario === l.scenario && x.turn === l.turn && x.rep === l.rep);
const REQ = [
  { req: '① 사용자 정보·선호를 다른 주제 뒤에도 기억', types: ['fact', 'pref', 'implicit', 'combine'] },
  { req: '② 사건·약속을 이후 대화에 반영', types: ['event', 'user_promise', 'char_promise', 'relative_time'] },
  { req: '③ 수정된 정보를 옛 정보 대신 반영', types: ['update', 'partial_update', 'multi_update', 'retract', 'distractor'] },
  { req: '④ 없던 정보를 지어내지 않음', types: ['abstain', 'half_said'] },
];
const pick = (types, wanted, n) => labels.filter((l) => l.cond === ADOPTED && types.includes(l.type) && wanted.includes(l.label))
  .sort((a, b) => b.turn - a.turn || a.scenario.localeCompare(b.scenario) || a.rep - b.rep)
  .filter((l, i, arr) => arr.findIndex((x) => x.scenario === l.scenario) === i).slice(0, n)
  .map((l) => { const it = items.get(`${l.cond}|${l.scenario}|${l.turn}|${l.rep}`), d = dropOf(l);
    return { req_types: types, type: l.type, scenario: l.scenario, rep: l.rep, turn: l.turn, gap: d?.gap ?? null, block: d?.block ?? null,
      question: it.question, context: it.user_context, expect: it.expect, stale: it.stale, hint: it.hint, reply: it.reply, label: l.label, why: l.why }; });
const examples = REQ.map((g) => ({ req: g.req, success: pick(g.types, ['correct'], 2), failure: pick(g.types, ['unknown', 'stale', 'wrong', 'fabricated', 'partial'], 1) }));

// 유형별 문항 수(조건 하나 기준)
const typeCounts = Object.fromEntries(Object.entries(ltMem['deepseek-on'].by_type).map(([k, v]) => [k, v.n]));
const sc = JSON.parse(fs.readFileSync(path.join(B, 'scenarios', 'baekho-120.json'), 'utf8'));
const kinds = {}; for (const t of sc.turns) kinds[t.kind] = (kinds[t.kind] ?? 0) + 1;
const gaps = sc.turns.filter((t) => t.kind === 'probe' && t.source_turns?.length).map((t) => t.turn - Math.max(...t.source_turns));

// 앱 설정(기본값 = 데모 서버 구성). 구조도 탭이 창 크기·예산을 여기서 읽는다.
const { config: APP } = await import('../../app/lib/config.js');
// 대화 예제(0원): adopted 조건 120턴 런의 장면(12턴) 원문 + 그 장면의 Opus 블라인드 품질 점수(1~5, 축 5개).
// 고르는 규칙(미리 정함): 캐릭터마다 장면 s02(13~24턴)·1회차 1개씩 + adopted 의 모든 판정 장면 중 overall 최고·최저 1개씩
// (동점이면 축 5개 합, 그다음 대본·장면·회차 이름순으로 앞선 것). 품질 판정 폴더는 adopted 조건이 들어 있는 opus-qlt*-r* 를 모두 읽는다.
const AXES = ['character', 'context', 'engagement', 'user_agency', 'overall'];
const qScenes = [];
for (const d of fs.readdirSync(OUT).filter((x) => /^opus-qlt\d+-r\d+$/.test(x) && has(`${x}/groups-KEY.json`) && has(`${x}/labels.tsv`))) {
  const key = rd(`${d}/groups-KEY.json`), groups = rd(`${d}/groups.json`);
  const lab = fs.readFileSync(path.join(OUT, d, 'labels.tsv'), 'utf8').trim().split('\n').map((l) => l.split('\t'));
  key.forEach((k, gi) => {
    const v = k.versions.find((x) => x.cond === ADOPTED); if (!v) return;
    const row = lab.find((l) => l[0] === k.id && l[1] === v.v); if (!row) return;
    qScenes.push({ judge_dir: d, group: k.id, scenario: k.scenario, segment: k.segment, rep: k.rep, situation: groups[gi]?.situation ?? null, run_id: v.run_id,
      scores: Object.fromEntries(AXES.map((a, i) => [a, Number(row[2 + i])])), judge_note: row[7] ?? '' });
  });
}
const sceneText = (q) => {
  const run = JSON.parse(fs.readFileSync(path.join(OUT, q.run_id, 'run.json'), 'utf8'));
  const [a, b] = (q.situation?.match(/(\d+)~(\d+)턴/) ?? []).slice(1).map(Number);
  return run.turns.filter((t) => t.turn >= a && t.turn <= b).map((t) => ({ turn: t.turn, user: t.user, assistant: t.reply }));
};
const qKey = (q) => `${q.scenario}|${q.segment}|${q.rep}|${q.judge_dir}`;
const qSum = (q) => AXES.reduce((n, a) => n + q.scores[a], 0);
const byRank = [...qScenes].sort((x, y) => y.scores.overall - x.scores.overall || qSum(y) - qSum(x) || qKey(x).localeCompare(qKey(y)));
const pickRule = qScenes.filter((q) => q.segment === 's02' && q.rep === 1).sort((x, y) => qKey(x).localeCompare(qKey(y)));
const dialogue_examples = { cond: ADOPTED, rule: 'per character: scene s02 (turns 13-24), rep 1; plus highest and lowest overall among all judged scenes of this condition (ties: sum of 5 axes, then name order)',
  axes: AXES, scenes: [...pickRule.map((q) => ({ pick: 'rule', ...q })), ...(byRank.length ? [{ pick: 'best', ...byRank[0] }, { pick: 'worst', ...byRank.at(-1) }] : [])].map((q) => ({ ...q, turns: sceneText(q) })) };

// 실제로 보내는 고정 프롬프트(0원): 앱의 assemble() 로 기억·대화 없이 만든 system 텍스트 = 대화 내내 같은 앞부분(캐릭터 시트 + 공통 규칙 + 말투 예시).
// 기본 설정(데모 서버와 같은 값) 그대로. 기억 블록·최근 대화·이번 말은 매 턴 뒤에 붙는다.
const ctx = await import('../../app/lib/context.js');
const prompts = { note: 'fixed system prefix from app/lib/context.js assemble() with default config, language ko, no memory', characters: {} };
for (const c of ['baekho', 'naruto', 'backend', 'sejong']) {
  const a = ctx.assemble({ character: JSON.parse(fs.readFileSync(path.join(B, '..', '..', 'app', 'characters', `${c}.json`), 'utf8')), language: 'ko', sheetLang: 'ko', memoryText: '', recent: [], userText: '' });
  prompts.characters[c] = a.system.map((x) => x.text).join('');
}

const app_config = { stair_max: APP.stair_max, recent_turns: APP.recent_turns, memory_budget_tokens: APP.memory_budget_tokens, recall: APP.recall, reply_style: APP.reply_style, async_fold: APP.async_fold, date: APP.date, follow: APP.follow };
const { config: MODEL } = await import('../index.js');
// 기억 v2 는 서버 안 공개 임베딩 모델(memory/embed.js, MEMORY_EMBED 기본 local)로 저장·검색한다 — API 호출 0원, CPU 만 씀(docs/21 §2.5)
const model_config = { response: MODEL.response, extract: MODEL.extract, embed: 'local:Xenova/bge-m3@q8' };
const used = [...new Set([model_config.response, model_config.extract, model_config.embed])]; // 로컬 임베딩은 단가 없음(0원)
const data = {
  generated: new Date().toISOString(),
  pricing: { as_of: PRICES.as_of, fx: PRICES.fx_krw_per_usd, fx_source: PRICES.fx_source,
    models: used.map((m) => ({ model: m, ...PRICES.models[m] })) },
  app_config, model_config, adopted: ADOPTED, examples_cond: ADOPTED,
  hard_probe,
  // 최종 구성(대화 따르기 6차 + 기억 v2) 측정 모음: bench/final-summary.py → out/final-summary.json (docs/50 2026-11-01 최종 측정)
  final: has('final-summary.json') ? rd('final-summary.json') : null,
  dialogue_examples, prompts,
  defects, // 결함 자동 집계: 키 = 실험접두어-조건, 값 = 결함이 걸린 턴 수(any = 하나라도 걸린 턴)
  // 오늘 날짜 넣기 시험(docs/50 2026-11-01). 정답·틀린 날짜는 답 원문을 직접 읽어 센 값, 나머지는 out/date-compare.md·out/cost-lt{2..5}.md
  date_test: [
    { k: 'off', l: '넣지 않음', correct: 0, wrong: 9, cost: 0.320, mem: 92.0, unasked: 4.1 },
    { k: 'on', l: '매 턴 날짜', correct: 29, wrong: 0, cost: 0.345, mem: 93.7, unasked: 9.8 },
    { k: 'v2', l: '매 턴 + “물을 때만” 문구', correct: 32, wrong: 0, cost: 0.355, mem: 94.7, unasked: 6.5 },
    { k: 'gate', l: '시간 표현이 있는 턴만', correct: 31, wrong: 1, cost: 0.316, mem: 96.4, unasked: 5.9 },
  ],
  char_names: Object.fromEntries(['baekho', 'naruto', 'backend', 'sejong'].map((c) => [c, JSON.parse(fs.readFileSync(path.join(B, '..', '..', 'app', 'characters', `${c}.json`), 'utf8')).name])),
  lt, dm, examples, type_counts: typeCounts,
  script_120: { scenes: sc.scenes, kinds, gap_min: Math.min(...gaps), gap_max: Math.max(...gaps), gap_buckets: { '13-19': gaps.filter((g) => g < 20).length, '20-39': gaps.filter((g) => g >= 20 && g < 40).length, '40-89': gaps.filter((g) => g >= 40 && g < 90).length, '90+': gaps.filter((g) => g >= 90).length } },
  spend: { lt_conversation: r1(LT_CONDS.reduce((s, c) => s + runs[c].krw, 0)), lt_panel: Math.round(rd('panel-vs-opus-lt1.json').krw),
    ...(LT2.length ? { lt2_conversation: r1(LT2.reduce((s, c) => s + runs[c].krw, 0)) } : {}), ...(has('panel-vs-opus-lt2.json') ? { lt2_panel: Math.round(rd('panel-vs-opus-lt2.json').krw) } : {}) },
  lt2_length: has('opus-qlt2-r1/length.md') ? fs.readFileSync(path.join(OUT, 'opus-qlt2-r1/length.md'), 'utf8').match(/overall \| 길이 통제 \| ([^|]+) \| ([^|]+) \|/)?.slice(1).map((x) => x.trim()) : null,
};
const dest = path.join(B, '..', '..', 'app', 'app', 'report', 'data.json');
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(data, null, 1));
console.log('→', path.relative(process.cwd(), dest), (fs.statSync(dest).size / 1024).toFixed(0), 'KB');
console.log(examples.map((g) => `${g.req}: 성공 ${g.success.length}, 실패 ${g.failure.length}`).join('\n'));
