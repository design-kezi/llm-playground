// 채팅앱 없이 memory/ 레이어만 실제 모델 레이어(model/)에 붙여 M1~M4 와 비용을 실측한다. 인메모리 DB, 캐릭터는 2줄 고정.
// 사용: node scripts/run-direct.mjs [M1|M2|M3|M4]   (OUT_DIR 환경변수로 결과 JSON 위치 지정, 기본 scripts/out)
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const memory = await import(`${ROOT}/memory/index.js`);
const model = await import(`${ROOT}/model/index.js`);
const spec = JSON.parse(readFileSync(`${ROOT}/memory/scripts/scenarios.json`, 'utf8'));

const db = new DatabaseSync(':memory:');
db.exec(`CREATE TABLE conversations (id INTEGER PRIMARY KEY, user_id TEXT NOT NULL, character_id TEXT NOT NULL, started_at TEXT NOT NULL, ended_at TEXT);
CREATE TABLE messages (id INTEGER PRIMARY KEY, conversation_id INTEGER NOT NULL, turn_no INTEGER NOT NULL, role TEXT NOT NULL, text TEXT NOT NULL, created_at TEXT NOT NULL);`);
memory.init({ db, model, policy: {} });
console.log('pricing:', JSON.stringify(model.pricing().models), 'embedDim', model.embedDim);

const CHAR = `너는 "유나", 20대 여성 캐릭터다. 사용자의 친한 친구처럼 반말로 2~3문장 안에 답한다. 기억 블록에 있는 내용만 사실로 쓰고, 없는 내용은 모른다고 하거나 되묻는다.`;
const all = [];           // 모든 attempts
const re = (p) => new RegExp(p);
const now = () => new Date().toISOString();
const only = process.argv[2]; // 특정 시나리오만

for (const sc of spec.scenarios) {
  if (only && sc.id !== only) continue;
  console.log(`\n=== ${sc.id} ${sc.title}`);
  const rec = { id: sc.id, checks: [], turns: [] };
  let fi = 0;
  for (const conv of sc.conversations) {
    const cid = Number(db.prepare('INSERT INTO conversations (user_id, character_id, started_at) VALUES (?,?,?)').run(sc.user, 'yuna', now()).lastInsertRowid);
    const turns = conv.turns.flatMap((t) => typeof t === 'string' && t.startsWith('@filler:') ? Array.from({ length: Number(t.split(':')[1]) }, () => spec.filler[fi++ % spec.filler.length]) : [t]);
    const history = [];
    let turn_no = 0;
    for (const t of turns) {
      const step = typeof t === 'string' ? { text: t } : t;
      turn_no++;
      db.prepare('INSERT INTO messages (conversation_id, turn_no, role, text, created_at) VALUES (?,?,?,?,?)').run(cid, turn_no, 'user', step.text, now());
      const r = await memory.retrieve({ user_id: sc.user, conversation_id: cid, query: step.text, budget_tokens: 400 });
      all.push(...r.attempts.map((a) => ({ ...a, sc: sc.id, turn: turn_no, stage: 'retrieve' })));
      let reply = '(답변)';
      // 같은 대화 안에 reply 기대가 있으면 그 대화는 전부 실제 응답(가짜 답변 패턴을 모델이 따라가는 것을 막기 위해)
      const needReal = conv.turns.some((x) => typeof x === 'object' && (x.expect_reply || x.expect_not_reply));
      if (needReal) {
        const res = await model.complete({
          system: [{ text: CHAR, cache: true }, ...(r.text ? [{ text: r.text }] : [])],
          messages: [...history.slice(-6), { role: 'user', content: step.text }],
          max_tokens: 150, purpose: 'response', tag: 'response', conversation_id: cid, turn_no,
        });
        reply = res.text;
        all.push(...res.attempts.map((a) => ({ ...a, sc: sc.id, turn: turn_no, stage: 'response' })));
      }
      db.prepare('INSERT INTO messages (conversation_id, turn_no, role, text, created_at) VALUES (?,?,?,?,?)').run(cid, turn_no, 'assistant', reply, now());
      const recent = history.slice(-6).map((m) => ({ role: m.role, text: m.content }));
      const u = await memory.update({ user_id: sc.user, conversation_id: cid, turn_no, messages: [...recent, { role: 'user', text: step.text }, { role: 'assistant', text: reply }] });
      all.push(...(u.attempts ?? []).map((a) => ({ ...a, sc: sc.id, turn: turn_no, stage: 'update' })));
      history.push({ role: 'user', content: step.text }, { role: 'assistant', content: reply });
      const line = { conv: conv.name, turn: turn_no, user: step.text, reply: needReal ? reply : undefined, mem_block: r.text, deep: r.deep_search?.method, update: u.skipped ? `skip(${u.gate_reasons?.join(',')})` : `ops=${JSON.stringify(u.ops)} parsed_ok=${u.parsed_ok} gate=${u.gate_reasons?.join(',')}` };
      rec.turns.push(line);
      console.log(`  [${conv.name}#${turn_no}] ${step.text}`);
      if (needReal) console.log(`      → ${reply.replace(/\n/g, ' ')}`);
      if (r.deep_search) console.log(`      deep: ${r.deep_search.method} hits=${r.deep_search.hits.length}`);
      console.log(`      update: ${line.update}`);
      if (step.expect_reply) rec.checks.push({ kind: 'reply', turn: `${conv.name}#${turn_no}`, expect: step.expect_reply, ok: re(step.expect_reply).test(reply) });
      if (step.expect_not_reply) rec.checks.push({ kind: 'reply_not', turn: `${conv.name}#${turn_no}`, expect_not: step.expect_not_reply, ok: !re(step.expect_not_reply).test(reply) });
    }
    if (conv.end) {
      const c = await memory.consolidate({ user_id: sc.user, conversation_id: cid });
      all.push(...(c.attempts ?? []).map((a) => ({ ...a, sc: sc.id, turn: 0, stage: 'consolidate' })));
      console.log(`  [${conv.name} end] consolidate: ${c.skipped ?? `ops=${JSON.stringify(c.ops)} parsed_ok=${c.parsed_ok}`}`);
    }
  }
  const mem = await memory.list({ user_id: sc.user, include_superseded: true });
  const items = mem.items, active = items.filter((i) => i.status === 'active');
  const em = sc.expect_memory ?? {};
  for (const m of em.items_match ?? []) rec.checks.push({ kind: 'memory_has', expect: m, ok: active.some((i) => re(m).test(i.text)) });
  for (const m of em.superseded_match ?? []) rec.checks.push({ kind: 'memory_superseded', expect: m, ok: items.some((i) => i.status === 'superseded' && re(m).test(i.text)) });
  for (const m of em.active_not_match ?? []) rec.checks.push({ kind: 'memory_active_not', expect_not: m, ok: !active.some((i) => re(m).test(i.text)) });
  for (const t of em.types_include ?? []) rec.checks.push({ kind: 'memory_type', expect: t, ok: active.some((i) => i.type === t) });
  for (const [k, v] of Object.entries(em.profile ?? {})) rec.checks.push({ kind: 'profile', expect: `${k}=${v}`, ok: mem.profile?.[k] === v });
  console.log('  --- 기억:', JSON.stringify(mem.profile), items.map((i) => `[${i.status[0]}]${i.type}:${i.text}`).join(' | '));
  console.log('  --- 에피소드:', mem.episodes.map((e) => e.summary).join(' || '));
  console.log('  --- 판정:'); for (const c of rec.checks) console.log(`    ${c.ok ? 'PASS' : 'FAIL'} ${c.kind} ${c.expect ?? ''}${c.expect_not ? 'NOT ' + c.expect_not : ''}`);
  rec.memory = mem;
  writeFileSync(`${process.env.OUT_DIR ?? `${ROOT}/memory/scripts/out`}/real-${sc.id}.json`, JSON.stringify(rec, null, 2));
}

// 비용 집계
const agg = {};
for (const a of all) {
  const k = `${a.stage}/${a.tag ?? '-'}/${a.model}`;
  const g = (agg[k] ??= { calls: 0, ok: 0, in: 0, cache_read: 0, cache_write: 0, out: 0, krw: 0, ms: 0 });
  g.calls++; g.ok += a.ok ? 1 : 0; g.in += a.input_tokens ?? 0; g.cache_read += a.cache_read_tokens ?? 0; g.cache_write += a.cache_write_tokens ?? 0; g.out += a.output_tokens ?? 0; g.krw += a.cost_krw ?? 0; g.ms += a.latency_ms ?? 0;
}
console.log('\n=== 비용 집계 (stage/tag/model)');
for (const [k, g] of Object.entries(agg)) console.log(`  ${k}: calls=${g.calls} ok=${g.ok} in=${g.in} cr=${g.cache_read} cw=${g.cache_write} out=${g.out} krw=${g.krw.toFixed(3)} avg_ms=${Math.round(g.ms / g.calls)} krw/call=${(g.krw / g.calls).toFixed(3)}`);
console.log('  total krw=', all.reduce((s, a) => s + (a.cost_krw ?? 0), 0).toFixed(3));
const errs = all.filter((a) => !a.ok); if (errs.length) console.log('  errors:', errs.map((e) => `${e.sc}#${e.turn} ${e.tag} ${e.error}`).join('\n    '));
writeFileSync(`${process.env.OUT_DIR ?? `${ROOT}/memory/scripts/out`}/real-attempts.json`, JSON.stringify(all, null, 2));
