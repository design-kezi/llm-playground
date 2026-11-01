// 토큰 추정(Claude Haiku 5.5 기준). 계수는 모델 세션이 Anthropic count_tokens 로 보정(2026-10-23, model/index.js TOKEN_COEF 와 동일):
// 한글 1.47 · 한자 1.37 · 가나 0.96 · 그 밖 0.34 /자. 검증(보정에 안 쓴 문장) 추정/실제 = ko 1.03, zh-TW 1.00, ja 0.97, en 1.01.
// 이전의 chars/1.5 는 한국어를 35~45%, 중국어·일본어를 3배 과소 추정했다.
export const TOKEN_COEF = { hangul: 1.47, han: 1.37, kana: 0.96, other: 0.34 };
export function estimateTokens(text) {
  let hangul = 0, han = 0, kana = 0, other = 0;
  for (const ch of String(text ?? '')) {
    const c = ch.codePointAt(0);
    if (c >= 0xac00 && c <= 0xd7a3) hangul++;
    else if (c >= 0x4e00 && c <= 0x9fff) han++;
    else if (c >= 0x3040 && c <= 0x30ff) kana++;
    else other++;
  }
  return Math.ceil(hangul * TOKEN_COEF.hangul + han * TOKEN_COEF.han + kana * TOKEN_COEF.kana + other * TOKEN_COEF.other);
}
