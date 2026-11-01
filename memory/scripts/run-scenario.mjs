#!/usr/bin/env node
// 채팅앱 HTTP API 로 장기 기억 검증 시나리오를 실행하고 판정한다.
// 사용: node scripts/run-scenario.mjs [--base http://localhost:3000] [--only M1,M3] [--user-suffix 2]
// 결과: 콘솔 표 + scripts/out/<timestamp>.json (실측 응답·기억 목록 원본 보존 → 제출 자료)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]?.startsWith('--') || arr[i + 1] == null ? true : arr[i + 1]] : []).filter(Boolean));
const BASE = args.base ?? process.env.BASE_URL ?? 'http://localhost:3000';
const only = typeof args.only === 'string' ? args.only.split(',') : null;
const suffix = args['user-suffix'] ? `-${args['user-suffix']}` : `-${Date.now().toString(36).slice(-4)}`;
const spec = JSON.parse(fs.readFileSync(path.join(here, 'scenarios.json'), 'utf8'));

async function api(method, p, body) {
  const r = await fetch(BASE + p, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${method} ${p} → ${r.status} ${j.error ?? ''}`);
  return j;
}
const re = (s) => new RegExp(s);
const out = { base: BASE, started_at: new Date().toISOString(), scenarios: [] };

const chars = await api('GET', '/api/characters');
const character_id = args.character ?? chars[0]?.id;
if (!character_id) throw new Error('캐릭터 없음');

for (const sc of spec.scenarios) {
  if (only && !only.includes(sc.id)) continue;
  const user = sc.user + suffix;
  const rec = { id: sc.id, title: sc.title, user, conversations: [], checks: [] };
  console.log(`\n=== ${sc.id} ${sc.title}  (user=${user})`);
  for (const conv of sc.conversations) {
    const { conversation_id } = await api('POST', '/api/conversations', { user_name: user, character_id });
    const crec = { name: conv.name, conversation_id, turns: [] };
    let fi = 0;
    const turns = conv.turns.flatMap((t) => typeof t === 'string' && t.startsWith('@filler:') ? Array.from({ length: Number(t.split(':')[1]) }, () => spec.filler[fi++ % spec.filler.length]) : [t]);
    for (const t of turns) {
      const step = typeof t === 'string' ? { text: t } : t;
      const res = await api('POST', `/api/conversations/${conversation_id}/messages`, { text: step.text });
      const trec = { turn_no: res.turn_no, text: step.text, reply: res.reply, turn_cost_krw: res.turn_cost_krw };
      console.log(`  [${conv.name}#${res.turn_no}] 사용자: ${step.text}\n           캐릭터: ${res.reply}  (${(res.turn_cost_krw ?? 0).toFixed(3)}원)`);
      if (step.expect_reply) {
        const ok = re(step.expect_reply).test(res.reply ?? '');
        rec.checks.push({ kind: 'reply', conv: conv.name, turn: res.turn_no, expect: step.expect_reply, ok, note: step.note });
        trec.check = ok;
      }
      if (step.expect_not_reply) {
        const ok = !re(step.expect_not_reply).test(res.reply ?? '');
        rec.checks.push({ kind: 'reply_not', conv: conv.name, turn: res.turn_no, expect_not: step.expect_not_reply, ok, note: step.note });
      }
      crec.turns.push(trec);
    }
    if (conv.end) crec.report = await api('POST', `/api/conversations/${conversation_id}/end`);
    rec.conversations.push(crec);
  }
  const mem = await api('GET', `/api/memory?user=${encodeURIComponent(user)}&include_superseded=1`);
  rec.memory = mem;
  const items = mem.items ?? [];
  const active = items.filter((i) => i.status === 'active');
  const em = sc.expect_memory ?? {};
  for (const m of em.items_match ?? []) rec.checks.push({ kind: 'memory_has', expect: m, ok: active.some((i) => re(m).test(i.text)) });
  for (const m of em.superseded_match ?? []) rec.checks.push({ kind: 'memory_superseded', expect: m, ok: items.some((i) => i.status === 'superseded' && re(m).test(i.text)) });
  for (const m of em.active_not_match ?? []) rec.checks.push({ kind: 'memory_active_not', expect_not: m, ok: !active.some((i) => re(m).test(i.text)) });
  for (const t of em.types_include ?? []) rec.checks.push({ kind: 'memory_type', expect: t, ok: active.some((i) => i.type === t) });
  for (const [k, v] of Object.entries(em.profile ?? {})) rec.checks.push({ kind: 'profile', expect: `${k}=${v}`, ok: mem.profile?.[k] === v });

  console.log('  --- 기억 (활성):'); for (const i of active) console.log(`    [${i.id}] ${i.type} ${i.text}  (출처 대화 ${i.source.conversation_id} 턴 ${i.source.turn_no})`);
  const sup = items.filter((i) => i.status !== 'active'); if (sup.length) { console.log('  --- 무효화:'); for (const i of sup) console.log(`    [${i.id}] ${i.status}→${i.superseded_by} ${i.text}`); }
  console.log('  --- 판정:'); for (const c of rec.checks) console.log(`    ${c.ok ? 'PASS' : 'FAIL'} ${c.kind} ${c.expect ?? ''}${c.expect_not ? 'NOT ' + c.expect_not : ''}${c.note ? '  // ' + c.note : ''}`);
  out.scenarios.push(rec);
}
fs.mkdirSync(path.join(here, 'out'), { recursive: true });
const file = path.join(here, 'out', `${out.started_at.replace(/[:.]/g, '-')}.json`);
fs.writeFileSync(file, JSON.stringify(out, null, 2));
const all = out.scenarios.flatMap((s) => s.checks);
console.log(`\n총 ${all.length}개 판정 중 ${all.filter((c) => c.ok).length}개 PASS. 원본 저장: ${file}`);
