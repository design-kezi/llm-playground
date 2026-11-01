// 판단 모델 v2 채점·표 (docs/50-decision-log.md 사전 등록 규칙 그대로).
//  - 무응답(null)은 오답: 이진 과제에서 정답 1 이면 FN, 정답 0 이면 FP 로 센다.
//  - 저장·꺼내기 = F1, 수정 대상 = 균형 정확도 (바뀜 정답률 + 'none' 정답률) / 2.
//  - 순위 점수 = 4개 언어 × 3과제 평균, 3회 평균. 자격: 무응답·파싱 실패 ≤ 5%. 동점(0.5%p 이내)은 비용 낮은 쪽.
// 사용: node judge/v2/score.mjs  → out/summary.json, out/report.md
import fs from 'node:fs';
import path from 'node:path';

const HERE = import.meta.dirname;
const OUT = path.join(HERE, 'out');
const LANGS = ['ko', 'zh-TW', 'ja', 'en'];
const PRICING = JSON.parse(fs.readFileSync(path.join(HERE, '..', '..', 'pricing.json'), 'utf8'));
const FX = PRICING.fx_krw_per_usd;

const runs = fs.readdirSync(OUT).filter((f) => /^preds-.*-r\d+\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')));
const models = [...new Set(runs.map((r) => r.model_id))].sort();

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : NaN; };
function f1(ps) {
  let tp = 0, fp = 0, fn = 0;
  for (const p of ps) {
    const y = p.pred == null ? 1 - p.label : p.pred; // 무응답은 정답의 반대로
    if (y === 1 && p.label === 1) tp++; else if (y === 1) fp++; else if (p.label === 1) fn++;
  }
  const prec = tp / Math.max(1, tp + fp), rec = tp / Math.max(1, tp + fn);
  return (2 * prec * rec) / Math.max(1e-9, prec + rec);
}
const tOk = (p) => (p.label === 'none' ? p.pred === 'none' : Array.isArray(p.label) && p.label.includes(p.pred));
function targetScores(ps) {
  const ch = ps.filter((p) => p.label !== 'none'), no = ps.filter((p) => p.label === 'none');
  const a = mean(ch.map((p) => (tOk(p) ? 1 : 0))), b = mean(no.map((p) => (tOk(p) ? 1 : 0)));
  return { bal: (a + b) / 2, change: a, none: b, n_change: ch.length, n_none: no.length };
}
const binAcc = (ps) => mean(ps.map((p) => (p.pred === p.label ? 1 : 0)));
// DeepSeek 정가(피크) 환산: 토큰 × 정가
function peakCost(run) {
  const m = PRICING.models[run.model_id];
  if (!m?.offpeak) return null;
  let usd = 0;
  for (const c of run.calls) for (const a of c.attempts) {
    usd += ((a.input_tokens ?? 0) * m.input + (a.cache_read_tokens ?? 0) * m.cached + (a.output_tokens ?? 0) * m.output) / 1e6;
  }
  return usd * FX;
}

const summary = {};
for (const id of models) {
  const rs = runs.filter((r) => r.model_id === id);
  const reps = [...new Set(rs.map((r) => r.rep))].sort();
  const per = {}; // per[lang][rep] = metrics
  for (const lang of LANGS) {
    per[lang] = {};
    for (const rep of reps) {
      const r = rs.find((x) => x.lang === lang && x.rep === rep);
      if (!r) continue;
      const P = (task) => r.preds.filter((p) => p.task === task);
      const t = targetScores(P('target'));
      const groups = {};
      for (const g of ['v1', 'nc', 'hand2']) {
        const tg = P('target').filter((p) => p.src.startsWith(g + ':'));
        groups[g] = {
          save_f1: P('save').some((p) => p.src.startsWith(g + ':')) ? f1(P('save').filter((p) => p.src.startsWith(g + ':'))) : null,
          recall_f1: P('recall').some((p) => p.src.startsWith(g + ':')) ? f1(P('recall').filter((p) => p.src.startsWith(g + ':'))) : null,
          target_bal: tg.length ? targetScores(tg).bal : null,
        };
      }
      const hard = (task) => P(task).filter((p) => p.src.startsWith('v1:hard'));
      const lat = r.calls.flatMap((c) => c.attempts.filter((a) => a.ok).map((a) => a.latency_ms)).filter((x) => x != null);
      per[lang][rep] = {
        save_f1: f1(P('save')), recall_f1: f1(P('recall')), target_bal: t.bal, target_change: t.change, target_none: t.none,
        n: { save: P('save').length, recall: P('recall').length, target_change: t.n_change, target_none: t.n_none },
        hard: { save_acc: binAcc(hard('save')), recall_acc: binAcc(hard('recall')), target_acc: mean(hard('target').map((p) => (tOk(p) ? 1 : 0))) },
        groups,
        unanswered: r.preds.filter((p) => p.pred == null).length, decisions: r.preds.length,
        failed_calls: r.calls.filter((c) => c.error).length, calls: r.calls.length,
        retries: r.calls.reduce((s, c) => s + Math.max(0, c.attempts.length - 1), 0),
        cost_krw: r.cost_krw, cost_peak_krw: peakCost(r),
        price_windows: [...new Set(r.calls.flatMap((c) => c.attempts.map((a) => a.price_window)).filter(Boolean))],
        cache_read_tokens: r.calls.flatMap((c) => c.attempts).reduce((s, a) => s + (a.cache_read_tokens ?? 0), 0),
        latency_median_ms: median(lat),
      };
    }
  }
  const cells = LANGS.flatMap((l) => Object.values(per[l]));
  const scoreOf = (m) => mean([m.save_f1, m.recall_f1, m.target_bal]);
  const repScores = reps.map((rep) => mean(LANGS.map((l) => per[l][rep]).filter(Boolean).map(scoreOf)));
  const decisions = cells.reduce((s, m) => s + m.decisions, 0);
  const unans = cells.reduce((s, m) => s + m.unanswered, 0);
  const r1 = LANGS.map((l) => per[l][reps[0]]).filter(Boolean);
  summary[id] = {
    reps, complete: LANGS.every((l) => reps.every((rep) => per[l][rep])),
    score: mean(repScores), score_min: Math.min(...repScores), score_max: Math.max(...repScores),
    unanswered_rate: unans / Math.max(1, decisions), eligible: unans / Math.max(1, decisions) <= 0.05,
    // 비용: 1회차(r1) 4개 언어 합계를 판단 1,000건당으로. 반복 회차는 제공사 자동 캐시가 끼어 따로 표기
    cost_per_1k_r1: (r1.reduce((s, m) => s + m.cost_krw, 0) / Math.max(1, r1.reduce((s, m) => s + m.decisions, 0))) * 1000,
    cost_per_1k_r1_peak: r1.every((m) => m.cost_peak_krw != null) ? (r1.reduce((s, m) => s + m.cost_peak_krw, 0) / r1.reduce((s, m) => s + m.decisions, 0)) * 1000 : null,
    cost_total_all_reps: cells.reduce((s, m) => s + m.cost_krw, 0),
    per,
  };
}

const ranked = models.filter((m) => summary[m].eligible && summary[m].complete).sort((a, b) => {
  const d = summary[b].score - summary[a].score;
  return Math.abs(d) > 0.005 ? d : summary[a].cost_per_1k_r1 - summary[b].cost_per_1k_r1;
});
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ generated: new Date().toISOString(), ranked, summary }, null, 1));

const pct = (v) => (v == null || Number.isNaN(v) ? '–' : (v * 100).toFixed(1));
const avgRep = (id, lang, key) => mean(Object.values(summary[id].per[lang]).map((m) => key.split('.').reduce((o, k) => o?.[k], m)).filter((v) => v != null));
const rng = (id, lang, key) => {
  const v = Object.values(summary[id].per[lang]).map((m) => m[key]);
  return v.length > 1 ? `${pct(Math.min(...v))}~${pct(Math.max(...v))}` : pct(v[0]);
};
const L = [];
L.push('# 판단 모델 v2 결과', '', `생성: ${new Date().toISOString()} · 원자료: model/judge/v2/out/preds-*.json · 규칙: docs/50-decision-log.md 사전 등록`, '');
L.push('## 종합 (순위 = 사전 등록 규칙)', '', '| 순위 | 모델 | 점수(3회 평균, 범위) | 저장 F1 | 꺼내기 F1 | 수정 대상 균형 | 무응답률 | 판단 1,000건당 원 (r1) | 자격 |', '|---|---|---|---|---|---|---|---|---|');
const order = [...ranked, ...models.filter((m) => !ranked.includes(m))];
for (const id of order) {
  const s = summary[id];
  const avg = (key) => mean(LANGS.map((l) => avgRep(id, l, key)));
  const cost = `${s.cost_per_1k_r1.toFixed(2)}${s.cost_per_1k_r1_peak != null ? ` (정가 ${s.cost_per_1k_r1_peak.toFixed(2)})` : ''}`;
  L.push(`| ${ranked.includes(id) ? ranked.indexOf(id) + 1 : '–'} | ${id} | ${pct(s.score)} (${pct(s.score_min)}~${pct(s.score_max)}) | ${pct(avg('save_f1'))} | ${pct(avg('recall_f1'))} | ${pct(avg('target_bal'))} | ${pct(s.unanswered_rate)}% | ${cost} | ${s.eligible ? (s.complete ? '○' : '미완') : '× 무응답>5%'} |`);
}
for (const [key, title] of [['save_f1', '저장 판단 F1 (언어별, 3회 범위)'], ['recall_f1', '꺼내기 판단 F1 (언어별, 3회 범위)'], ['target_bal', '수정 대상 균형 정확도 (언어별, 3회 범위)'], ['target_change', '수정 대상: 바뀌는 항목을 맞힌 비율'], ['target_none', "수정 대상: '없음'을 맞힌 비율"]]) {
  L.push('', `## ${title}`, '', `| 모델 | ${LANGS.join(' | ')} |`, `|---|${LANGS.map(() => '---').join('|')}|`);
  for (const id of order) L.push(`| ${id} | ${LANGS.map((l) => rng(id, l, key)).join(' | ')} |`);
}
L.push('', '## 출처별 (4개 언어 · 3회 평균)', '', '| 모델 | 저장 v1 / 새 대본 | 꺼내기 v1 / 새 대본 | 수정 대상 v1 / 새 대본 / 손으로 쓴 문항 | 어려운 문항(v1 hard) 저장 / 꺼내기 / 수정 |', '|---|---|---|---|---|');
for (const id of order) {
  const g = (grp, k) => pct(mean(LANGS.map((l) => avgRep(id, l, `groups.${grp}.${k}`))));
  const h = (k) => pct(mean(LANGS.map((l) => avgRep(id, l, `hard.${k}`))));
  L.push(`| ${id} | ${g('v1', 'save_f1')} / ${g('nc', 'save_f1')} | ${g('v1', 'recall_f1')} / ${g('nc', 'recall_f1')} | ${g('v1', 'target_bal')} / ${g('nc', 'target_bal')} / ${g('hand2', 'target_bal')} | ${h('save_acc')} / ${h('recall_acc')} / ${h('target_acc')} |`);
}
L.push('', '## 비용·안정성 (언어 합계)', '', '| 모델 | r1 원 | r2 원 | r3 원 | 판단 수/회 | 실패 호출 | 재시도 | 캐시 읽기 토큰(합) | 중간 지연 | DeepSeek 단가 구간 |', '|---|---|---|---|---|---|---|---|---|---|');
for (const id of order) {
  const s = summary[id];
  const byRep = (rep) => LANGS.map((l) => s.per[l][rep]).filter(Boolean);
  const sum = (rep, k) => byRep(rep).reduce((a, m) => a + (m[k] ?? 0), 0);
  const all = LANGS.flatMap((l) => Object.values(s.per[l]));
  L.push(`| ${id} | ${[1, 2, 3].map((r) => (byRep(r).length ? sum(r, 'cost_krw').toFixed(2) : '–')).join(' | ')} | ${sum(1, 'decisions')} | ${all.reduce((a, m) => a + m.failed_calls, 0)} | ${all.reduce((a, m) => a + m.retries, 0)} | ${all.reduce((a, m) => a + m.cache_read_tokens, 0)} | ${Math.round(median(all.map((m) => m.latency_median_ms)))}ms | ${[...new Set(all.flatMap((m) => m.price_windows))].join(', ') || '–'} |`);
}
fs.writeFileSync(path.join(OUT, 'report.md'), L.join('\n'));
console.log(L.join('\n'));
console.log('\nranked:', ranked.join(', '));
