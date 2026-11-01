// 120턴 장기 대본 빌드: 캐릭터별 대사(src/<char>-120.mjs) + 공통 뼈대(skeleton-120.mjs) → scenarios/<char>-120.json
// 사용: node bench/scenarios/src/build-120.mjs [baekho naruto backend sejong]  → 이어서 node bench/check-scenario.mjs 로 점검
import fs from 'node:fs';
import path from 'node:path';
import { SKELETON } from './skeleton-120.mjs';

const KIND = { F: 'filler', P: 'plant', U: 'update', R: 'retract', D: 'distractor', Q: 'probe' };
const TYPE = { A1: 'implicit', 'A3+A11': 'combine', A5: 'implicit', A2: 'multi_update', A15: 'fact', A18: 'implicit', A12: 'half_said', A14: 'pref', A19: 'fact',
  A4: 'distractor', A9: 'relative_time', A10: 'update', A13: 'partial_update', A8: 'retract', A6: 'user_promise', A7: 'char_promise', A16: 'event',
  B7: 'implicit', B9: 'implicit', B1: 'fact', B3: 'update', B4: 'char_promise', B2: 'event', B6: 'user_promise', B8: 'event',
  C1: 'pref', C3: 'event', C6: 'update', C8: 'fact', abs1: 'abstain', abs2: 'abstain' };
const sourcesOf = (slot) => slot.startsWith('abs') ? [] : slot.split('+').flatMap((s) => Object.entries(SKELETON).filter(([, v]) => v !== `Q:${s}` && v.split(':')[1] === s).map(([t]) => Number(t)));

for (const ch of process.argv.slice(2).length ? process.argv.slice(2) : ['baekho', 'naruto', 'backend', 'sejong']) {
  const { meta, lines, probes } = await import(`./${ch}-120.mjs`);
  if (lines.length !== 120) throw new Error(`${ch}: 대사 ${lines.length}개 (120 필요)`);
  const turns = lines.map((user, i) => {
    const turn = i + 1, [k, slot] = SKELETON[turn].split(':');
    const t = { turn, kind: KIND[k], user };
    if (slot && k !== 'Q') t.slot = slot;
    if (k === 'Q') {
      const p = probes[slot];
      if (!p) throw new Error(`${ch} ${turn}: 확인 슬롯 ${slot} 정의 없음`);
      const src = sourcesOf(slot);
      Object.assign(t, { slot, type: p.type ?? TYPE[slot], difficulty: 'hard', expect: p.expect ?? [], stale: p.stale ?? [], forbidden: p.forbidden ?? [] }, p, { source_turns: src });
      if (t.type === 'char_promise') t.requires_promise_turn = src[0];
    }
    return t;
  });
  for (const s of Object.keys(probes)) if (!Object.values(SKELETON).includes(`Q:${s}`)) throw new Error(`${ch}: 뼈대에 없는 확인 슬롯 ${s}`);
  const sc = { id: `${ch}-120`, character_id: ch, ...meta, segments: { early: [1, 40], mid: [41, 80], late: [81, 120] }, scenes: (await import('./skeleton-120.mjs')).SCENES, turns };
  const out = path.join(import.meta.dirname, '..', `${ch}-120.json`);
  fs.writeFileSync(out, JSON.stringify(sc, null, 2));
  console.log(`${ch}-120: ${turns.length}턴 → ${path.relative(process.cwd(), out)}`);
}
