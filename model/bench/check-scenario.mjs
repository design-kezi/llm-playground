// 대본 정적 점검(0원). 확인 질문이 "바로 앞 메시지만 읽어서는" 통과할 수 없는지 본다(과제 4, docs/30 §4.4).
// - 턴 번호 연속, 확인 질문의 근거 턴이 질문보다 앞인지
// - 간격: 마지막 근거 턴 → 질문이 13턴 이상(stair 창 최대 12턴을 넘겨야 최근 대화만으로 못 답한다)
// - 새는 정답: 정답 키워드가 질문 자신이나 직전 12턴 사용자 발화에 있으면(근거 턴 제외) 표시
// - 말투: 앱의 원문 검색 신호(memory/gate.js missSignal)에 걸리는지 — 걸리면 블록에서 빠진 정보도 원문 검색으로 되살아난다
// 사용: node bench/check-scenario.mjs scenarios/baekho-120.json [...]
import fs from 'node:fs';
import { missSignal } from '../../memory/gate.js';

const WINDOW = 12, MIN_GAP = 13;
let bad = 0;
for (const f of process.argv.slice(2)) {
  const sc = JSON.parse(fs.readFileSync(f, 'utf8'));
  const T = sc.turns, errs = [], rows = [];
  T.forEach((t, i) => { if (t.turn !== i + 1) errs.push(`턴 번호 불연속: ${i + 1} 자리에 ${t.turn}`); });
  for (const t of T.filter((x) => x.kind === 'probe')) {
    const src = t.source_turns ?? [];
    if (src.some((s) => s >= t.turn)) errs.push(`${t.turn}: 근거 턴이 질문보다 뒤`);
    const gap = src.length ? t.turn - Math.max(...src) : null, far = src.length ? t.turn - Math.min(...src) : null;
    if (gap != null && gap < MIN_GAP) errs.push(`${t.turn}: 간격 ${gap} < ${MIN_GAP}`);
    const recent = T.filter((x) => x.turn < t.turn && x.turn >= t.turn - WINDOW && !src.includes(x.turn));
    const leak = t.leak_ok ? [] : (t.expect ?? []).filter((k) => t.user.includes(k) || recent.some((x) => x.user.includes(k)));
    if (leak.length) errs.push(`${t.turn}: 정답 키워드가 질문·직전 ${WINDOW}턴에 있음 ${leak.join(',')}`);
    // 다시 말함: 첫 근거 턴 뒤 ~ 질문 전, 근거가 아닌 사용자 발화에 정답 키워드가 나오면 그 정보는 그때 다시 심긴 것(간격이 실제보다 짧아진다)
    const first = src.length ? Math.min(...src) : t.turn;
    const again = t.leak_ok ? [] : (t.expect ?? []).flatMap((k) => T.filter((x) => x.turn > first && x.turn < t.turn && !src.includes(x.turn) && x.user.includes(k)).map((x) => `${k}@${x.turn}`));
    if (again.length) errs.push(`${t.turn}: 근거 아닌 턴에서 정답을 다시 말함 ${again.join(',')}`);
    rows.push({ turn: t.turn, type: t.type, gap, far, phrasing: missSignal(t.user) ? '직접(원문검색)' : '자연', q: t.user });
  }
  // 같은 사실을 두 번 묻지 않기: 근거 턴 집합이 같은 질문이 둘이면 표시
  const seen = new Map();
  for (const t of T.filter((x) => x.kind === 'probe' && x.source_turns?.length)) {
    const k = [...t.source_turns].sort((a, b) => a - b).join(',');
    if (seen.has(k)) errs.push(`${t.turn}: ${seen.get(k)}턴과 같은 근거(${k})`); else seen.set(k, t.turn);
  }
  const probes = rows.length, by = (fn) => rows.reduce((m, r) => ((m[fn(r)] = (m[fn(r)] ?? 0) + 1), m), {});
  console.log(`\n# ${sc.id} — ${T.length}턴, 확인 질문 ${probes}개, 심기 ${T.filter((x) => x.kind === 'plant').length} · 수정 ${T.filter((x) => ['update', 'retract'].includes(x.kind)).length} · 방해 ${T.filter((x) => x.kind === 'distractor').length} · 잡담 ${T.filter((x) => x.kind === 'filler').length}`);
  console.log('유형:', JSON.stringify(by((r) => r.type)));
  console.log('말투:', JSON.stringify(by((r) => r.phrasing)));
  console.log('간격(마지막 근거→질문):', JSON.stringify(by((r) => r.gap == null ? '근거 없음' : r.gap >= 90 ? '90+' : r.gap >= 40 ? '40~89' : r.gap >= 20 ? '20~39' : '13~19')));
  console.log('| 턴 | 유형 | 간격 | 첫 근거부터 | 말투 | 질문 |\n|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.turn} | ${r.type} | ${r.gap ?? '–'} | ${r.far ?? '–'} | ${r.phrasing} | ${r.q} |`);
  console.log(errs.length ? `\n문제 ${errs.length}개:\n- ${errs.join('\n- ')}` : '\n문제 없음');
  bad += errs.length;
}
process.exit(bad ? 1 : 0);
