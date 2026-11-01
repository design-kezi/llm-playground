// 대화 모델 비교 최종 표(docs/50 리뷰 지적 1~5 해결 뒤). 추천하지 않고 측정값만 나란히 놓는다. 선택은 사용자.
// 입력: out/opus-dm2/summary.json(기억, Opus) · out/opus-quality-r1/summary.json(품질, Opus 두 회차) · out/panel-vs-opus.json(품질, 패널)
//       out/cost-dm2.json(비용 시나리오) · out/summary-dm2.json(지연·규칙 위반, dm-summary.mjs)
// 사용: node bench/final-table.mjs → out/final-dm2.md
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(import.meta.dirname, 'out');
const rd = (f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
const mem = Object.fromEntries(rd('opus-dm2/summary.json').table.map((r) => [r.cond, r]));
const qual = rd('opus-quality-r1/summary.json').table;
const panel = rd('panel-vs-opus.json');
const cost = Object.fromEntries(rd('cost-dm2.json').rows.map((r) => [r.cond, r]));
const ops = Object.fromEntries(rd('summary-dm2.json').rows.map((r) => [r.cond, r]));
const CONDS = ['haiku-off', 'haiku-on', 'luna-off', 'luna-on', 'deepseek-off', 'deepseek-on', 'gemma26-off'];
const f1 = (x) => (x == null ? '–' : x.toFixed(1));
const wl = (t) => (t ? `${t.win}:${t.loss} (p ${t.p.toFixed(2)})` : '기준선');

const L = ['# 대화 모델 비교 dm2 — 최종 표 (r1+r2)', '', `생성 ${new Date().toISOString()} · 추천 없음, 측정값만. 각 칸의 근거 파일은 아래 '출처'.`, '',
  '| 조건 | 기억 점수 Opus (r1 / r2) | 해로운 답 | 기억: haiku-off 대비 나음:못함 | 품질 overall 평균 Opus(1~5) | 품질: haiku-off 대비 Opus | 품질: haiku-off 대비 패널(r1+r2) | 턴당 비용 기록값 / DeepSeek 피크 / 캐시 0 최악 | 지연 중앙값 / 95% | 규칙 위반 턴 |',
  '|---|---|---|---|---|---|---|---|---|---|'];
for (const c of CONDS) {
  const m = mem[c], q = qual[c], p = panel.table[c]?.overall?.panel, co = cost[c], o = ops[c];
  L.push(`| ${c} | ${f1(m.all.pct)}% (${f1(m.by_rep?.[1]?.pct)} / ${f1(m.by_rep?.[2]?.pct)}) | ${m.harmful} | ${m.vs_base ? `${m.vs_base.better}:${m.vs_base.worse} (p ${m.vs_base.p.toFixed(2)})` : '기준선'} | ${q.mean.overall.toFixed(2)} | ${q.vs_base ? wl(q.vs_base.overall) : '기준선'} | ${p ? `${p.win}:${p.loss} (p ${p.p.toFixed(2)})` : '기준선'} | ${co.measured.toFixed(3)} / ${co.peak.toFixed(3)} / ${co.worst.toFixed(3)}원 | ${o.lat_p50_s.toFixed(1)} / ${o.lat_p95_s.toFixed(1)}초 | ${(o.rule_bad_rate * 100).toFixed(1)}% |`);
}
L.push('', '## 읽을 때 주의 (측정으로 확인한 것)', '',
  '- 기억: 상위 조건 차이는 회차 사이 흔들림(같은 조건 r1↔r2 최대 약 10%p)과 비슷한 크기다. 2회차 라벨이 1회차보다 \'부분\'을 더 자주 줬다(덧붙임 규칙을 처음부터 엄격히 적용) — 회차 안 조건 비교에는 영향 없음.',
  '- 품질: Opus 는 haiku 두 조건을 뚜렷이 높게 봤다. 패널(GLM·Kimi·MiniMax)은 deepseek 두 조건을 haiku-off 와 비슷하게 봤다. Opus 는 haiku 와 같은 회사이고, 점수와 대사 길이 상관이 있다(out/opus-quality-r1/length.md). 두 판정이 다르면 사람 확인 없이는 어느 쪽이 맞는지 가릴 수 없다.',
  '- 둘 다 같은 방향: luna 두 조건은 캐릭터 깸(사실상 AI 인정)·이어 가기 약함, gemma26-off 는 이어 가기·맥락 약함.',
  '- 비용: DeepSeek 은 dm2 를 일요일 밤에 돌려 반값으로 기록됐다. 평일 피크 칸이 실사용 낮 시간 값이다. 캐시 0 은 최악 가정.',
  '- luna 는 제공사가 UTC 날짜를 넣는다(date-probe). 실사용에서 KST 자정~09시에 날짜가 하루 어긋날 수 있다.',
  '', '## 출처', '', '- 기억: model/bench/out/opus-dm2/summary.md (라벨: opus-dm2/opus-labels.tsv, opus-dm2-r2/opus-labels.tsv)',
  '- 품질 Opus: model/bench/out/opus-quality-r1/summary.md, length.md (라벨: opus-quality-r1/labels.tsv, opus-quality-r2/labels.tsv)',
  '- 품질 패널: model/bench/out/panel-vs-opus.md (pair-panel-r1-*.json, pair-panel-r2-*.json)',
  '- 비용: model/bench/out/cost-dm2.md · 지연·규칙: model/bench/out/summary-dm2.md · 판정관 선정: model/bench/out/judge-agree-cand.md · 날짜: model/bench/out/date-probe/');
fs.writeFileSync(path.join(OUT, 'final-dm2.md'), L.join('\n'));
console.log(L.join('\n'));
