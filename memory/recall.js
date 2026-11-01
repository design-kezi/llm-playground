// 질문 기준 기억 보충(recall). 블록(캐시 접두사)에 못 들어간 항목 중 지금 사용자 말과 겹치는 것을 몇 줄 골라 그 턴에만 붙인다.
// AI 호출 없음. 한국어는 조사·어미가 붙어 단어 단위 일치가 약해서, 단어 안 글자 2개 묶음(bigram)을 항목 집합 기준 희소도(IDF)로 가중한다.
// 근거: model/bench/recall-sim.mjs (lt1 기록 재생, docs/50 2026-11-01)
const STOP = new Set(['사용', '용자', '캐릭', '릭터', '하는', '했다', '한다', '있다', '하기', '로로', '에서', '으로']);

export function bigrams(text = '') {
  const out = new Set();
  for (const w of String(text).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)) {
    if (w.length < 2) continue;
    for (let i = 0; i < w.length - 1; i++) { const g = w.slice(i, i + 2); if (!STOP.has(g)) out.add(g); }
  }
  return out;
}

// pool: 희소도를 셀 항목 전체(활성 항목), cands: 고를 후보. 반환 [{item, score}] 점수 순
export function rankRecall(query, cands, pool = cands) {
  const q = bigrams(query);
  if (!q.size || !cands.length) return [];
  const df = new Map();
  const grams = new Map(pool.map((i) => [i, bigrams(`${i.text} ${i.when_text ?? i.when ?? ''}`)]));
  for (const g of grams.values()) for (const x of g) df.set(x, (df.get(x) ?? 0) + 1);
  const n = pool.length;
  return cands.map((i) => {
    const g = grams.get(i) ?? bigrams(`${i.text} ${i.when_text ?? i.when ?? ''}`);
    let s = 0;
    for (const x of g) if (q.has(x)) s += Math.log((n + 1) / ((df.get(x) ?? 0) + 0.5));
    return { item: i, score: s };
  }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || b.item.id - a.item.id);
}
