// 임베딩 BLOB(Float32 LE) 인코딩 + 브루트포스 코사인. 규모가 커지면 sqlite-vec 로 교체하는 지점.
export function encode(vec) {
  const f = vec instanceof Float32Array ? vec : Float32Array.from(vec);
  return Buffer.from(f.buffer, f.byteOffset, f.byteLength);
}
export function decode(blob) {
  if (!blob) return null;
  const b = Buffer.isBuffer(blob) ? blob : Buffer.from(blob);
  const copy = Buffer.from(b); // 정렬 보장
  return new Float32Array(copy.buffer, copy.byteOffset, copy.byteLength / 4);
}
export function cosine(a, b) {
  if (!a || !b || a.length !== b.length) return -1;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  if (!na || !nb) return -1;
  return dot / Math.sqrt(na * nb);
}
export function topK(query, rows, k, getVec = (r) => r.vec) {
  return rows.map((r) => ({ row: r, score: cosine(query, getVec(r)) }))
    .filter((x) => x.score > -1).sort((a, b) => b.score - a.score).slice(0, k);
}
