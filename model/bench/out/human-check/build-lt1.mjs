// 120턴(lt1) 판정 갈린 장면(Opus ↔ 패널이 반대로 판정) 사람 확인용 블라인드 비교. 조건 정답은 KEY-lt1.json 에만.
// 고른 기준: 반대로 갈린 20장면 중 패널 만장일치이거나 Opus 점수 차가 2점인 것, 캐릭터가 겹치지 않게 4개.
import fs from 'node:fs';
import path from 'node:path';
const B = path.resolve(import.meta.dirname, '..', '..'), OUT = path.join(B, 'out');
const PICK = [['haiku-on', 'naruto', 's03', 1], ['haiku-on', 'sejong', 's08', 1], ['deepseek-on', 'baekho', 's02', 2], ['deepseek-on', 'backend', 's05', 2]];
let s = 20261031; const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const runFor = (cond, sc, rep) => JSON.parse(fs.readFileSync(path.join(OUT, fs.readdirSync(OUT).find((x) => x.endsWith(`-${sc}-lt1-${cond}-r${rep}`)), 'run.json'), 'utf8'));
const L = ['# 120턴 판정 갈린 장면 — 사람 확인용 (블라인드)', '', '각 장면에서 A·B 중 어느 캐릭터와 계속 대화하고 싶은지(또는 비슷함) 골라 주세요. 길이는 기준이 아닙니다. 어느 쪽이 어떤 모델인지는 KEY-lt1.json 에만 있습니다.', ''];
const key = [];
PICK.forEach(([cand, ch, seg, rep], i) => {
  const scId = `${ch}-120`, sc = JSON.parse(fs.readFileSync(path.join(B, 'scenarios', `${scId}.json`), 'utf8'));
  const [from, to, name] = sc.scenes[Number(seg.slice(1)) - 1];
  const flip = rand() < 0.5, A = flip ? cand : 'haiku-off', Bc = flip ? 'haiku-off' : cand;
  const ra = runFor(A, scId, rep), rb = runFor(Bc, scId, rep);
  key.push({ scene: i + 1, scenario: scId, segment: seg, rep, A, B: Bc });
  L.push('---', '', `## 장면 ${i + 1} · ${ch} · ${name} (${from}~${to}턴)`, '');
  for (let t = from; t <= to; t++) {
    const ta = ra.turns.find((x) => x.turn === t), tb = rb.turns.find((x) => x.turn === t);
    L.push(`**사용자:** ${ta.user}`, '', `> **A:** ${(ta.reply ?? '').replace(/\n+/g, ' ')}`, '>', `> **B:** ${(tb.reply ?? '').replace(/\n+/g, ' ')}`, '');
  }
  L.push('판정: A / B / 비슷함 → ', '');
});
fs.writeFileSync(path.join(import.meta.dirname, 'scenes-lt1.md'), L.join('\n'));
fs.writeFileSync(path.join(import.meta.dirname, 'KEY-lt1.json'), JSON.stringify(key, null, 1));
console.log(L.join('\n'));
