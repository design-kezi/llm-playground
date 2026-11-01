// 판단 모델 평가 지표. out/preds-*.json 과 규칙 판단(memory/gate.js, 한국어 정규식)을 같이 표로 낸다.
// 사용: node judge/report.mjs
import fs from 'node:fs';
import path from 'node:path';
import { updateGate, missSignal } from '../../memory/gate.js';
import { DEFAULT_POLICY } from '../../memory/policy.js';

const HERE = import.meta.dirname;
const LANGS = ['ko', 'zh-TW', 'ja', 'en'];

// 규칙 판단을 같은 형식의 예측으로 만든다(한국어 정규식이라 다른 언어는 거의 다 '아니요'가 나올 것)
for (const lang of LANGS) {
  const data = JSON.parse(fs.readFileSync(path.join(HERE, 'data', `${lang}.json`), 'utf8'));
  const preds = [];
  for (const x of data.save) {
    const g = updateGate([{ role: 'user', text: x.user }], DEFAULT_POLICY);
    preds.push({ task: 'save', id: x.id, label: x.label, pred: g.pass ? 1 : 0, src: x.src });
  }
  for (const x of data.recall) preds.push({ task: 'recall', id: x.id, label: x.label, pred: missSignal(x.user) ? 1 : 0, src: x.src });
  fs.mkdirSync(path.join(HERE, 'out'), { recursive: true });
  fs.writeFileSync(path.join(HERE, 'out', `preds-rule-${lang}.json`), JSON.stringify({ model: 'rule', lang, latency_ms_median: 0, preds }));
}

const files = fs.readdirSync(path.join(HERE, 'out')).filter((f) => f.startsWith('preds-'));
const runs = files.map((f) => JSON.parse(fs.readFileSync(path.join(HERE, 'out', f), 'utf8')));
const models = [...new Set(runs.map((r) => r.model))];

function binary(preds, thr = 0.5) {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const p of preds) {
    const y = p.pred != null && p.pred >= thr ? 1 : 0;
    if (y && p.label) tp++; else if (y) fp++; else if (p.label) fn++; else tn++;
  }
  const prec = tp / Math.max(1, tp + fp), rec = tp / Math.max(1, tp + fn);
  return { f1: (2 * prec * rec) / Math.max(1e-9, prec + rec), prec, rec, skip: tn / Math.max(1, tn + fp) };
}
// 놓침을 5% 이하로 묶었을 때(양성 95% 이상 잡는 가장 높은 문턱) 음성을 얼마나 걸러내나 = 아낄 수 있는 호출 비율
function skipAtRecall(preds, minRec = 0.95) {
  const thrs = [...new Set(preds.map((p) => p.pred ?? 0))].sort((a, b) => b - a);
  let best = { skip: 0, thr: 0 };
  for (const t of thrs) {
    const m = binary(preds, t);
    if (m.rec >= minRec && m.skip > best.skip) best = { skip: m.skip, thr: t };
  }
  return best;
}
function targetAcc(preds) {
  const ok = preds.filter((p) => (p.label === 'none' ? p.pred === 'none' : Array.isArray(p.label) && p.label.includes(p.pred))).length;
  return ok / Math.max(1, preds.length);
}
const pct = (v) => `${Math.round(v * 100)}`;

const lines = ['# 판단 모델 오프라인 평가', '', `생성: ${new Date().toISOString()}`, ''];
for (const [task, title] of [['save', '저장 판단 (새 정보가 있나)'], ['recall', '꺼내기 판단 (예전 기억이 필요한가)']]) {
  lines.push(`## ${title}`, '', 'F1 / 잡은 비율(재현율) / 걸러낸 비율 — 문턱 0.5 (%). 괄호: 놓침 5% 이하로 문턱을 내렸을 때 걸러내는 비율(확률을 주는 모델만)', '');
  lines.push(`| 모델 | ${LANGS.join(' | ')} | 중간 지연 |`, `|---|${LANGS.map(() => '---').join('|')}|---|`);
  for (const m of models) {
    const cells = LANGS.map((lang) => {
      const r = runs.find((x) => x.model === m && x.lang === lang);
      if (!r) return '–';
      const ps = r.preds.filter((p) => p.task === task);
      if (!ps.length) return '–';
      const b = binary(ps);
      const probs = ps.some((p) => p.pred != null && p.pred > 0 && p.pred < 1);
      return `${pct(b.f1)} / ${pct(b.rec)} / ${pct(b.skip)}${probs ? ` (${pct(skipAtRecall(ps).skip)})` : ''}`;
    });
    const lat = runs.find((x) => x.model === m)?.latency_ms_median;
    lines.push(`| ${m} | ${cells.join(' | ')} | ${lat != null ? Math.round(lat) + 'ms' : '–'} |`);
  }
  // 어려운 경우만 따로 (한국어)
  lines.push('', '어려운 경우만 (한국어, 정답률 %):', '');
  for (const m of models) {
    const r = runs.find((x) => x.model === m && x.lang === 'ko');
    const ps = r?.preds.filter((p) => p.task === task && p.src.startsWith('hard')) ?? [];
    if (!ps.length) continue;
    const acc = ps.filter((p) => ((p.pred ?? 0) >= 0.5 ? 1 : 0) === p.label).length / ps.length;
    lines.push(`- ${m}: ${pct(acc)}% (${ps.length}문항)`);
  }
  lines.push('');
}
lines.push('## 수정 대상 찾기 (정답률 %)', '', `| 모델 | ${LANGS.join(' | ')} |`, `|---|${LANGS.map(() => '---').join('|')}|`);
for (const m of models) {
  const cells = LANGS.map((lang) => {
    const ps = runs.find((x) => x.model === m && x.lang === lang)?.preds.filter((p) => p.task === 'target') ?? [];
    return ps.length ? pct(targetAcc(ps)) : '–';
  });
  if (cells.some((c) => c !== '–')) lines.push(`| ${m} | ${cells.join(' | ')} |`);
}
const md = lines.join('\n');
fs.writeFileSync(path.join(HERE, 'out', 'report.md'), md);
console.log(md);
