// 사용자 말 따르기·언어 따르기(follow) 시험 집계(docs/50 2026-11-01 사전 등록).
// 사용: node bench/follow-compare.mjs build  → out/follow-blind/items.tsv(조건 가림) + key.json(판정 뒤에만 연다)
//       node bench/follow-compare.mjs         → out/follow-compare.md (labels.tsv 가 있으면 블라인드 판정도 합친다)
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.join(import.meta.dirname, 'out');
const SC = path.join(import.meta.dirname, 'scenarios');
const BL = path.join(OUT, 'follow-blind');
const CONDS = { cur: 'v2-dsx-dategate', follow: 'v2-dsx-follow' };
const runs = (re) => fs.readdirSync(OUT).filter((d) => re.test(d) && fs.existsSync(path.join(OUT, d, 'run.json')))
  .map((d) => ({ dir: d, ...JSON.parse(fs.readFileSync(path.join(OUT, d, 'run.json'), 'utf8')) })).filter((r) => r.valid?.ok !== false && r.valid !== false && !r.aborted); // 실패 호출이 있는 런은 뺀다(out/_failed 로 옮기고 다시 돌림)
const dialog = (t) => (t ?? '').replace(/\*[^*]*\*/g, '').trim();
const lang = (t) => {
  const s = dialog(t), ko = (s.match(/[가-힣]/g) ?? []).length, la = (s.match(/[A-Za-z]/g) ?? []).length, ja = (s.match(/[぀-ヿ]/g) ?? []).length, tot = ko + la + ja || 1;
  return { en: la / tot >= 0.8, ko: ko / tot >= 0.8, ja: ja > 0 && ko / tot < 0.2 };
};
const endsQ = (t) => /[?？][!！]?\s*$|[!！][?？]\s*$/.test(dialog(t));
const TICS = { baekho: ['냐하하', '천재'], naruto: ['라니깐'], backend: ['ㅋㅋ'], sejong: ['허허'] };
const RULES = ['user_action', 'meta_or_empty', 'speech_mismatch'];
const pct = (a, b) => (b ? `${((a / b) * 100).toFixed(1)}%` : '–');

const fl = Object.fromEntries(Object.entries(CONDS).map(([k, c]) => [k, runs(new RegExp(`-fl1-${c}-r\\d$`))]));
const lt = { cur: runs(/-120-lt5-v2-dsx-dategate-r\d$/), follow: runs(/-120-lt6-v2-dsx-follow-r\d$/) };

if (process.argv[2] === 'build') {
  // 블라인드 판정 목록: follow·situ 대본의 모든 턴. 직전 사용자 말·직전 답을 같이 보여 준다. 조건은 key.json 에만.
  let seed = 20261101; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const items = [];
  for (const [k, rs] of Object.entries(fl)) for (const r of rs) {
    const ts = r.turns.filter((t) => t.reply != null);
    ts.forEach((t, i) => items.push({ cond: k, run: r.dir, scenario: r.scenario, turn: t.turn, prev_user: ts[i - 1]?.user ?? '', prev_reply: ts[i - 1]?.reply ?? '', user: t.user, reply: t.reply }));
  }
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  items.forEach((x, i) => (x.id = `F${String(i + 1).padStart(4, '0')}`));
  fs.mkdirSync(BL, { recursive: true });
  const clean = (s) => s.replace(/[\t\n]+/g, ' ');
  const chars = Object.fromEntries(['baekho', 'naruto', 'backend', 'sejong'].map((c) => [c, JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', '..', 'app', 'characters', `${c}.json`), 'utf8')).name]));
  fs.writeFileSync(path.join(BL, 'items.tsv'), ['id\tcharacter\tprev_user\tprev_reply\tuser\treply', ...items.map((x) => [x.id, chars[x.scenario.split('-')[0]], clean(x.prev_user), clean(x.prev_reply), clean(x.user), clean(x.reply)].join('\t'))].join('\n'));
  fs.writeFileSync(path.join(BL, 'key.json'), JSON.stringify(items.map(({ id, cond, run, scenario, turn }) => ({ id, cond, run, scenario, turn })), null, 1));
  console.log(`items ${items.length} → ${BL}`);
  process.exit(0);
}

const L = ['# 사용자 말 따르기·언어 따르기(follow) 시험 집계', '', `생성 ${new Date().toISOString()} · 사전 등록 docs/50 2026-11-01 · cur = 현재 기본값(v2-dsx-dategate), follow = APP_FOLLOW on`, ''];
L.push(`런 수: follow·situ 대본 cur ${fl.cur.length} · follow ${fl.follow.length} / 120턴 cur(lt5) ${lt.cur.length} · follow(lt6) ${lt.follow.length}`, '');

// A1 언어
L.push('## A1 언어 (follow 대본, 지문 뺀 대사 글자 비율)', '', '| 기대 언어 | cur | follow |', '|---|---|---|');
const langRows = {};
for (const want of ['en', 'ko', 'ja', '합계']) {
  const cell = (rs) => { let n = 0, ok = 0; for (const r of rs.filter((r) => /-follow-12$/.test(r.scenario))) { const sc = JSON.parse(fs.readFileSync(path.join(SC, `${r.scenario}.json`), 'utf8')); for (const st of sc.turns) { if (want !== '합계' && st.lang !== want) continue; const t = r.turns.find((x) => x.turn === st.turn); if (!t?.reply) continue; n++; if (lang(t.reply)[st.lang]) ok++; } } return [ok, n]; };
  const c = cell(fl.cur), f = cell(fl.follow); langRows[want] = { c, f };
  L.push(`| ${want} | ${c[0]}/${c[1]} (${pct(...c)}) | ${f[0]}/${f[1]} (${pct(...f)}) |`);
}
L.push('');

// 끝맺음·입버릇
const style = (rs) => { const ts = rs.flatMap((r) => r.turns.filter((t) => t.reply).map((t) => ({ ...t, ch: r.character_id }))); const o = { n: ts.length, q: ts.filter((t) => endsQ(t.reply)).length, q2: ts.filter((t) => (dialog(t.reply).match(/[?？]/g) ?? []).length >= 2).length, len: ts.reduce((a, t) => a + dialog(t.reply).length, 0) / (ts.length || 1) };
  for (const [ch, ws] of Object.entries(TICS)) { const tc = ts.filter((t) => t.ch === ch); for (const w of ws) o[`${ch}:${w}`] = [tc.filter((t) => t.reply.includes(w)).length, tc.length]; } return o; };
L.push('## 끝맺음·입버릇', '', '| 지표 | follow·situ cur | follow·situ follow | 120턴 cur(lt5) | 120턴 follow(lt6) |', '|---|---|---|---|---|');
const S = [style(fl.cur), style(fl.follow), style(lt.cur), style(lt.follow)];
L.push(`| 물음표로 끝난 답 | ${S.map((s) => pct(s.q, s.n)).join(' | ')} |`);
L.push(`| 물음표 2개 이상인 답(지문 뺌) | ${S.map((s) => pct(s.q2, s.n)).join(' | ')} |`);
L.push(`| 대사 평균 길이(지문 뺌) | ${S.map((s) => `${Math.round(s.len)}자`).join(' | ')} |`);
for (const [ch, ws] of Object.entries(TICS)) for (const w of ws) L.push(`| ${ch} '${w}' 든 답 | ${S.map((s) => pct(...s[`${ch}:${w}`])).join(' | ')} |`);
L.push('');

// 규칙 위반(situ)
L.push('## 규칙 위반 턴 (situ 대본, score.js 자동: user_action·meta_or_empty·speech_mismatch)', '', '| | cur | follow |', '|---|---|---|');
const viol = (rs) => { const s = rs.filter((r) => /-situ-20$/.test(r.scenario)); let n = 0, v = 0; for (const r of s) { n += r.turns.filter((t) => t.reply).length; const turns = new Set(RULES.flatMap((k) => r.score.quality.flag_turns?.[k] ?? [])); v += turns.size; } return [v, n]; };
L.push(`| 위반 턴 | ${viol(fl.cur)[0]}/${viol(fl.cur)[1]} (${pct(...viol(fl.cur))}) | ${viol(fl.follow)[0]}/${viol(fl.follow)[1]} (${pct(...viol(fl.follow))}) |`, '');

// 블라인드 판정
const LBL = path.join(BL, 'labels.tsv');
if (fs.existsSync(LBL)) {
  const key = Object.fromEntries(JSON.parse(fs.readFileSync(path.join(BL, 'key.json'), 'utf8')).map((k) => [k.id, k]));
  const [head, ...rows] = fs.readFileSync(LBL, 'utf8').trim().split('\n'); const cols = head.split('\t'); // 3차부터 qpress(질문 부담) 열 추가 — 사후 참고 지표
  const lab = rows.map((l) => { const v = Object.fromEntries(l.split('\t').map((x, i) => [cols[i], x])); return { ...key[v.id], ...v }; }).filter((x) => x.cond);
  const g = (k, f) => lab.filter((x) => x.cond === k && f(x));
  L.push('## A2 블라인드 판정 (Opus, 조건 가림)', '', `판정 ${lab.length}개`, '', '| 지표 | cur | follow |', '|---|---|---|');
  const row = (l, f, base = () => true) => L.push(`| ${l} | ${['cur', 'follow'].map((k) => `${g(k, (x) => base(x) && f(x)).length}/${g(k, base).length} (${pct(g(k, (x) => base(x) && f(x)).length, g(k, base).length)})`).join(' | ')} |`);
  row('직접 응답 예', (x) => x.direct === '예');
  row('직접 응답 아니오', (x) => x.direct === '아니오');
  row('이어 말하기 쉬움 예', (x) => x.cont === '예');
  if (cols.includes('nq')) row('사용자에게 묻는 문장 2개 이상(블라인드, 6차부터)', (x) => Number(x.nq) >= 2);
  if (cols.includes('qpress')) row('질문이 부담스러움 예(사후 참고, 사전 등록 아님)', (x) => x.qpress === '예');
  row('캐릭터 이탈 (situ 6~8턴)', (x) => x.brk === '예', (x) => /-situ-20$/.test(x.scenario) && x.turn >= 6 && x.turn <= 8);
  row('캐릭터 이탈 (전체)', (x) => x.brk === '예');
  // close-8: 대본의 close 표시(판정자는 모름)와 '끝맺는 인사인가' 판정을 맞춰 본다
  const closeOf = (x) => { if (!x.scenario.endsWith('close-8')) return undefined; const sc = JSON.parse(fs.readFileSync(path.join(SC, `${x.scenario}.json`), 'utf8')); return sc.turns.find((t) => t.turn === x.turn)?.close; };
  for (const x of lab) x.close = closeOf(x);
  row('끝내려는 말 → 끝맺는 인사(close-8)', (x) => x.ending === '예', (x) => x.close === true);
  row('이어 가는 말 → 끊지 않음(close-8)', (x) => x.ending === '아니오', (x) => x.close === false);
  row('마무리처럼 보이는 이어 가는 말(3·5턴) → 끊지 않음', (x) => x.ending === '아니오', (x) => x.close === false && [3, 5].includes(x.turn));
  for (const sc of ['follow-12', 'situ-20', 'close-8']) row(`직접 응답 예 — ${sc} 대본`, (x) => x.direct === '예', (x) => x.scenario.endsWith(sc));
  L.push('', '### 캐릭터 이탈·직접 응답 아니오 원문', '');
  for (const x of lab.filter((x) => x.brk === '예' || x.direct === '아니오').sort((a, b) => a.cond.localeCompare(b.cond) || a.scenario.localeCompare(b.scenario) || a.turn - b.turn)) {
    const r = [...fl.cur, ...fl.follow].find((r) => r.dir === x.run); const t = r?.turns.find((t) => t.turn === x.turn);
    L.push(`- ${x.cond} · ${x.scenario}#${x.turn} [직접 ${x.direct} · 이탈 ${x.brk}] ${x.note ?? ''} — 사용자: ${t?.user} → ${t?.reply?.replace(/\s+/g, ' ').slice(0, 160)}`);
  }
  L.push('');
}

// B 120턴
if (lt.follow.length) {
  const mem = (rs) => { const p = rs.reduce((n, r) => n + r.score.memory.points, 0), m = rs.reduce((n, r) => n + r.score.memory.max_points, 0); const c = {}; for (const r of rs) for (const [k, v] of Object.entries(r.score.memory.counts)) c[k] = (c[k] ?? 0) + v; return [(p / m) * 100, c]; };
  const [mc, cc] = mem(lt.cur), [mf, cf] = mem(lt.follow);
  L.push('## B 120턴 (lt5 cur vs lt6 follow)', '', '| 지표 | cur(lt5) | follow(lt6) |', '|---|---|---|');
  L.push(`| 키워드 기억 점수 | ${mc.toFixed(1)}% | ${mf.toFixed(1)}% |`);
  L.push(`| 키워드 판정 분포 | ${Object.entries(cc).map(([k, v]) => `${k} ${v}`).join(' · ')} | ${Object.entries(cf).map(([k, v]) => `${k} ${v}`).join(' · ')} |`);
  L.push('', '비용은 `node bench/cost-scenarios.mjs --prefix lt6`(DeepSeek 모두 비피크 열)과 lt5 를 비교한다.', '');
}
fs.writeFileSync(path.join(OUT, 'follow-compare.md'), L.join('\n'));
console.log(L.join('\n'));
