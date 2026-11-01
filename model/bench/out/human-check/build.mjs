// 판정 갈린 장면(deepseek-on vs haiku-off, Opus ↔ 패널 불일치) 사람 확인용 블라인드 비교. 조건 정답은 KEY 파일에만.
import fs from 'node:fs';
import path from 'node:path';
const B = path.resolve(import.meta.dirname, '..', '..'), OUT = path.join(B, 'out');
const PICK = [['backend', 'lowinput', 1], ['sejong', 'agency', 1], ['sejong', 'break', 2], ['baekho', 'lowinput', 2], ['naruto', 'agency', 1], ['naruto', 'break', 2]];
let s = 20261031; const rand = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
const runFor = (cond, sc, rep) => JSON.parse(fs.readFileSync(path.join(OUT, fs.readdirSync(OUT).find((x) => x.endsWith(`-${sc}-dm2-${cond}-r${rep}`)), 'run.json'), 'utf8'));
const L = ['# 판정 갈린 장면 — 사람 확인용 (블라인드)', '', '각 장면에서 A·B 중 어느 캐릭터와 계속 대화하고 싶은지(또는 비슷함) 골라 주세요. 길이는 기준이 아닙니다. 어느 쪽이 어떤 모델인지는 KEY.json 에만 있습니다.', ''];
const key = [];
PICK.forEach(([ch, seg, rep], i) => {
  const scId = `${ch}-situ-20`, sc = JSON.parse(fs.readFileSync(path.join(B, 'scenarios', `${scId}.json`), 'utf8'));
  const [from, to] = sc.segments[seg];
  const flip = rand() < 0.5, A = flip ? 'deepseek-on' : 'haiku-off', Bc = flip ? 'haiku-off' : 'deepseek-on';
  const ra = runFor(A, scId, rep), rb = runFor(Bc, scId, rep);
  key.push({ scene: i + 1, scenario: scId, segment: seg, rep, A, B: Bc });
  L.push(`---`, '', `## 장면 ${i + 1} · ${ch} · ${seg}`, '', `상황: ${sc.situations[seg]}`, '');
  for (let t = from; t <= to; t++) {
    const ta = ra.turns.find((x) => x.turn === t), tb = rb.turns.find((x) => x.turn === t);
    L.push(`**사용자:** ${ta.user}`, '', `> **A:** ${(ta.reply ?? '').replace(/\n+/g, ' ')}`, '>', `> **B:** ${(tb.reply ?? '').replace(/\n+/g, ' ')}`, '');
  }
  L.push(`판정: A / B / 비슷함 → `, '');
});
fs.writeFileSync(path.join(import.meta.dirname, 'scenes.md'), L.join('\n'));
fs.writeFileSync(path.join(import.meta.dirname, 'KEY.json'), JSON.stringify(key, null, 1));
console.log(L.join('\n'));
