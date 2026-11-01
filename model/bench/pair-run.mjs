// 대화 품질 짝 비교(AI 판정). 근거: ACUTE-Eval(대화 둘을 나란히, 한 화자만 판정), MT-Bench(순서 바꿔 두 번, 엇갈리면 무승부, 대화 전체를 보여 줌),
// PingPong·PoLL(서로 다른 회사 판정관 여럿을 평균). 대상은 상황 대본(*-situ-20)의 구간(5턴) 단위다.
// 사용:
//   node bench/pair-run.mjs --manifest <runs.json> --judges m1,m2,m3 --baseline <조건> [--only <조건,...>] [--out <파일>] [--dry 1]
//   runs.json = [{ "cond": "haiku-off", "path": "bench/out/<run_id>/run.json" }, ...]  (같은 조건·같은 대본의 런이 여러 개면 회차 순서대로 짝짓는다)
//   --dry 1 : 호출 없이 첫 프롬프트만 출력(0원)
//   --max-tokens N : 판정 출력 한도(기본 400). 추론하는 판정관(GLM)이 긴 입력에서 한도에 걸려 JSON 이 잘리면 늘려서 다시 돌린다.
//   --redo <이전 결과 파일> : 그 파일에서 오류 난 (조건, 대본, 회차, 단위, 판정관)만 다시 판정하고, 성공한 결과로 바꿔 끼워 같은 파일에 쓴다.
//   --units scenes : 대본의 segments 대신 scenes(120턴 대본, 12턴 장면) 단위로 판정. SITUATION 에 장면 이름이 들어간다.
import fs from 'node:fs';
import path from 'node:path';
import * as model from '../index.js';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const args = Object.fromEntries(process.argv.slice(2).reduce((a, v, i, arr) => (v.startsWith('--') ? [...a, [v.slice(2), arr[i + 1]]] : a), []));
const AXES = ['character', 'context', 'engagement', 'user_agency', 'overall'];
const SYSTEM = `You compare two roleplay conversations. Both use the same character and the same user messages; only the character's replies differ.
Judge ONLY the character's replies. Answer for each axis which conversation is better: "A", "B", or "tie".
- character: stays in character (personality, speech style, world) as described in the character sheet. Breaking character or meta talk (saying it is an AI or a program) is worse.
- context: replies fit what the user just said and the situation, without contradictions.
- engagement: keeps the conversation going naturally and interestingly (not repetitive, reacts to short user messages, picks up new topics).
- user_agency: does NOT decide the user's actions, feelings, thoughts or the outcome of the user's actions; reacts only as the character.
- overall: which character you would rather keep talking to.
Length is NOT a criterion; do not prefer the longer replies. The conversations are in Korean.
Output one JSON object: {"character":"A|B|tie","context":"A|B|tie","engagement":"A|B|tie","user_agency":"A|B|tie","overall":"A|B|tie","reason":"<one short sentence>"}`;

const manifest = JSON.parse(fs.readFileSync(args.manifest, 'utf8')).map((m) => ({ ...m, run: JSON.parse(fs.readFileSync(path.resolve(ROOT, m.path), 'utf8')) }));
const judges = (args.judges ?? '').split(',').filter(Boolean);
if (!judges.length) throw new Error('--judges 필요');
const baseline = args.baseline;
const only = args.only ? new Set(args.only.split(',')) : null;
const scenarios = {};
const scen = (id) => (scenarios[id] ??= JSON.parse(fs.readFileSync(path.join(import.meta.dirname, 'scenarios', `${id}.json`), 'utf8')));
const sheet = (cid) => JSON.parse(fs.readFileSync(path.join(ROOT, 'app', 'characters', `${cid}.json`), 'utf8')).prompt;

// 짝: 기준선 조건 vs 나머지 조건, 같은 대본·같은 회차끼리
const byKey = {};
for (const m of manifest) (byKey[`${m.cond}|${m.run.scenario}`] ??= []).push(m);
const pairs = [];
for (const [key, list] of Object.entries(byKey)) {
  const [cond, sc] = key.split('|');
  if (cond === baseline || (only && !only.has(cond))) continue;
  const base = byKey[`${baseline}|${sc}`] ?? [];
  for (let i = 0; i < Math.min(list.length, base.length); i++) pairs.push({ cond, scenario: sc, rep: i + 1, a: base[i], b: list[i] });
}

function convText(run, [from, to]) {
  return run.turns.filter((t) => t.turn >= from && t.turn <= to).map((t) => `User: ${t.user}\nCharacter: ${t.reply ?? '(no reply)'}`).join('\n\n');
}
const unitsOf = (sc) => (args.units === 'scenes'
  ? Object.fromEntries(sc.scenes.map(([from, to, name], i) => [`s${String(i + 1).padStart(2, '0')}`, { range: [from, to], situation: `${name} (turns ${from}-${to} of a ${sc.turns.length}-turn conversation)` }]))
  : Object.fromEntries(Object.entries(sc.segments ?? {}).map(([seg, range]) => [seg, { range, situation: sc.situations?.[seg] ?? seg }])));
function prompt(sc, seg, first, second) {
  return `CHARACTER SHEET:\n${sheet(sc.character_id)}\n\nSITUATION: ${unitsOf(sc)[seg].situation}\n\n=== Conversation A ===\n${first}\n\n=== Conversation B ===\n${second}`;
}
// 형식 오류(축 값이 A/B/tie 가 아님, JSON 깨짐)는 한 번 다시 묻는다. 실패한 호출 비용도 합계(krw)에 넣는다.
async function ask(judge, content, tries = 2) {
  const res = await model.complete({ model: judge, purpose: 'judge_pair', max_tokens: Number(args['max-tokens'] ?? 400), response_format: 'json', system: [{ text: SYSTEM }], messages: [{ role: 'user', content }] });
  const cost = res.attempts.reduce((s, a) => s + a.cost_krw, 0);
  try {
    const j = JSON.parse(res.text.slice(res.text.indexOf('{'), res.text.lastIndexOf('}') + 1));
    for (const ax of AXES) if (!['A', 'B', 'tie'].includes(j[ax])) throw new Error(`${ax}=${j[ax]}`);
    return { ...j, krw: cost };
  } catch (e) {
    krw += cost;
    if (tries > 1) return ask(judge, content, tries - 1);
    throw e;
  }
}

const out = [];
let krw = 0;
// --redo: 이전 파일의 결과를 그대로 두고 오류 난 칸만 다시 판정한다
const prev = args.redo ? JSON.parse(fs.readFileSync(args.redo, 'utf8')) : null;
const redoKey = (r) => `${r.cond}|${r.scenario}|${r.rep}|${r.segment}|${r.judge}`;
const redoSet = prev ? new Set(prev.results.filter((r) => r.error).map(redoKey)) : null;
if (prev) { krw = prev.judge_cost_krw; out.push(...prev.results.filter((r) => !r.error)); }
for (const p of pairs) {
  const sc = scen(p.scenario);
  for (const [seg, { range }] of Object.entries(unitsOf(sc))) {
    const base = convText(p.a.run, range), cand = convText(p.b.run, range);
    if (args.dry) { console.log(prompt(sc, seg, base, cand)); process.exit(0); }
    for (const judge of judges) {
      if (redoSet && !redoSet.has(redoKey({ cond: p.cond, scenario: p.scenario, rep: p.rep, segment: seg, judge }))) continue;
      // 순서 1: A=기준선, 순서 2: A=후보. 두 번 다 같은 쪽이면 그 쪽 승, 아니면 무승부(MT-Bench 보수적 방식)
      const r = { cond: p.cond, scenario: p.scenario, rep: p.rep, segment: seg, judge, base_run: p.a.run.run_id, cand_run: p.b.run.run_id, ...(args['max-tokens'] ? { max_tokens: Number(args['max-tokens']) } : {}) };
      try {
        const o1 = await ask(judge, prompt(sc, seg, base, cand));
        const o2 = await ask(judge, prompt(sc, seg, cand, base));
        krw += o1.krw + o2.krw;
        r.raw = [o1, o2];
        r.result = Object.fromEntries(AXES.map((ax) => {
          const v1 = o1[ax] === 'B' ? 'cand' : o1[ax] === 'A' ? 'base' : 'tie';
          const v2 = o2[ax] === 'A' ? 'cand' : o2[ax] === 'B' ? 'base' : 'tie';
          return [ax, v1 === v2 ? v1 : 'tie'];
        }));
        r.consistent = Object.fromEntries(AXES.map((ax) => {
          const v1 = o1[ax] === 'B' ? 'cand' : o1[ax] === 'A' ? 'base' : 'tie';
          const v2 = o2[ax] === 'A' ? 'cand' : o2[ax] === 'B' ? 'base' : 'tie';
          return [ax, v1 === v2];
        }));
      } catch (e) {
        r.error = e.message.slice(0, 200);
      }
      out.push(r);
      console.log(`${p.cond} ${p.scenario} r${p.rep} ${seg} ${judge}: ${r.error ? 'ERR ' + r.error : r.result.overall}`);
    }
  }
}

// 집계: 조건별·축별 승/패/무(판정관별, 판정관 평균), 순서 일관성, 판정관끼리 일치, 이항 검정(무승부 제외, 양측)
function binom2(k, n) {
  if (!n) return null;
  const lg = (x) => { let s = 0; for (let i = 2; i <= x; i++) s += Math.log(i); return s; };
  const pmf = (i) => Math.exp(lg(n) - lg(i) - lg(n - i) - n * Math.LN2);
  const obs = pmf(k);
  let p = 0;
  for (let i = 0; i <= n; i++) if (pmf(i) <= obs + 1e-12) p += pmf(i);
  return Math.min(1, p);
}
const ok = out.filter((r) => r.result);
const summary = {};
for (const cond of [...new Set(ok.map((r) => r.cond))]) {
  const rs = ok.filter((r) => r.cond === cond);
  summary[cond] = Object.fromEntries(AXES.map((ax) => {
    const per = {};
    for (const j of judges) {
      const v = rs.filter((r) => r.judge === j).map((r) => r.result[ax]);
      per[j] = { win: v.filter((x) => x === 'cand').length, loss: v.filter((x) => x === 'base').length, tie: v.filter((x) => x === 'tie').length };
    }
    // 판정관 평균: 구간마다 판정관 표(+1 후보 승, -1 기준선 승, 0 무)의 평균 부호로 그 구간 결과를 정한다
    const units = {};
    for (const r of rs) (units[`${r.scenario}|${r.rep}|${r.segment}`] ??= []).push(r.result[ax] === 'cand' ? 1 : r.result[ax] === 'base' ? -1 : 0);
    const panel = Object.values(units).map((v) => Math.sign(v.reduce((a, b) => a + b, 0) / v.length));
    const win = panel.filter((x) => x > 0).length, loss = panel.filter((x) => x < 0).length;
    return [ax, { panel: { win, loss, tie: panel.length - win - loss, units: panel.length, p_binom: binom2(win, win + loss) }, per_judge: per,
      order_consistency: rs.length ? rs.filter((r) => r.consistent[ax]).length / rs.length : null }];
  }));
}
// 판정관끼리 일치: 같은 구간에서 두 판정관의 결과(cand/base/tie)가 같은 비율
const agree = {};
for (let i = 0; i < judges.length; i++) for (let k = i + 1; k < judges.length; k++) {
  const a = new Map(ok.filter((r) => r.judge === judges[i]).map((r) => [`${r.cond}|${r.scenario}|${r.rep}|${r.segment}`, r.result.overall]));
  const both = ok.filter((r) => r.judge === judges[k] && a.has(`${r.cond}|${r.scenario}|${r.rep}|${r.segment}`));
  agree[`${judges[i]} ~ ${judges[k]}`] = both.length ? both.filter((r) => a.get(`${r.cond}|${r.scenario}|${r.rep}|${r.segment}`) === r.result.overall).length / both.length : null;
}
const file = args.redo ?? args.out ?? path.join(import.meta.dirname, 'out', `pair-${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}.json`);
fs.writeFileSync(file, JSON.stringify({ generated: new Date().toISOString(), baseline, judges, pairs: pairs.length, errors: out.filter((r) => r.error).length, judge_cost_krw: krw, inter_judge_agreement_overall: agree, summary, results: out }, null, 1));
console.log(`→ ${path.relative(ROOT, file)}  판정비 ${krw.toFixed(1)}원, 오류 ${out.filter((r) => r.error).length}`);
