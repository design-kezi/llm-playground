// 추론 끔/켬 비교 채점(docs/50-decision-log.md 사전 등록). 무응답(null)은 오답. 순위 없음.
// 사용: node judge/reason/score.mjs → out/summary.json, out/report.md
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(import.meta.dirname, 'out');
const runs = fs.readdirSync(OUT).filter((f) => /-r\d+\.json$/.test(f)).map((f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8')));
const keys = [...new Set(runs.map((r) => `${r.model_id}|${r.mode}`))].sort();
const IDS = ['S1', 'S2', 'S3', 'R1', 'R2', 'R3', 'T1', 'T2', 'T3', 'T4'];
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);

const rows = keys.map((k) => {
  const [model_id, mode] = k.split('|');
  const rs = runs.filter((r) => r.model_id === model_id && r.mode === mode).sort((a, b) => a.rep - b.rep);
  const scores = rs.map((r) => r.preds.filter((p) => p.correct).length);
  const att = rs.flatMap((r) => r.calls.flatMap((c) => c.attempts));
  const okAtt = att.filter((a) => a.ok);
  const calls = rs.flatMap((r) => r.calls);
  return {
    model_id, mode, reps: rs.length, scores, mean: mean(scores), min: Math.min(...scores), max: Math.max(...scores),
    per_q: Object.fromEntries(IDS.map((id) => [id, rs.filter((r) => r.preds.find((p) => p.id === id)?.correct).length])),
    unanswered: rs.reduce((s, r) => s + r.preds.filter((p) => p.pred == null).length, 0),
    failed_calls: calls.filter((c) => c.error).length, failed_attempts: att.filter((a) => !a.ok).length,
    errors: [...new Set(att.filter((a) => !a.ok).map((a) => String(a.error).slice(0, 60)))],
    cost_per_run: mean(rs.map((r) => r.cost_krw)), cost_per_call: mean(calls.map((c) => c.attempts.reduce((s, a) => s + (a.cost_krw ?? 0), 0))),
    out_tokens_per_call: mean(calls.map((c) => c.attempts.filter((a) => a.ok).reduce((s, a) => s + (a.output_tokens ?? 0), 0))),
    reasoning_tokens_per_call: mean(calls.map((c) => c.attempts.filter((a) => a.ok).reduce((s, a) => s + (a.reasoning_tokens ?? 0), 0))),
    latency_ms: mean(okAtt.map((a) => a.latency_ms)), max_latency_ms: Math.max(...okAtt.map((a) => a.latency_ms ?? 0)),
    truncated: att.filter((a) => ['length', 'max_tokens', 'MAX_TOKENS'].includes(a.finish_reason)).length,
    price_windows: [...new Set(att.map((a) => a.price_window).filter(Boolean))],
  };
});
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify({ generated: new Date().toISOString(), rows }, null, 1));

const L = ['# 판단 모델 추론 끔/켬 비교', '', `생성: ${new Date().toISOString()} · 원자료: model/judge/reason/out/*-r*.json · 문항: questions.json · 규칙: docs/50-decision-log.md`, ''];
L.push('| 모델 | 조건 | 정답/10 (5회 평균) | 최소~최대 | 회차별 | 무응답 | 실패 호출 | 호출당 비용 | 10문항당 비용 | 출력 토큰/호출 | 추론 토큰/호출 | 평균 지연 | 최대 지연 |', '|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows) L.push(`| ${r.model_id} | ${r.mode} | ${r.mean.toFixed(1)} | ${r.min}~${r.max} | ${r.scores.join(' ')} | ${r.unanswered} | ${r.failed_calls} | ${r.cost_per_call.toFixed(3)}원 | ${r.cost_per_run.toFixed(3)}원 | ${Math.round(r.out_tokens_per_call)} | ${Math.round(r.reasoning_tokens_per_call)} | ${(r.latency_ms / 1000).toFixed(1)}s | ${(r.max_latency_ms / 1000).toFixed(1)}s |`);
L.push('', '## 문항별 정답 횟수 (5회 중)', '', `| 모델 | 조건 | ${IDS.join(' | ')} |`, `|---|---|${IDS.map(() => '---').join('|')}|`);
for (const r of rows) L.push(`| ${r.model_id} | ${r.mode} | ${IDS.map((id) => r.per_q[id]).join(' | ')} |`);
L.push('', '## 오류', '');
for (const r of rows.filter((x) => x.errors.length)) L.push(`- ${r.model_id} ${r.mode}: 실패 시도 ${r.failed_attempts}, ${r.errors.join(' / ')}`);
fs.writeFileSync(path.join(OUT, 'report.md'), L.join('\n'));
console.log(L.join('\n'));
