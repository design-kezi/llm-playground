#!/bin/zsh
# B단계: A 상위 5개 + Haiku(현재 기준선, 참고) × 대본 4 × 3회. 모델마다 별도 프로세스.
cd ${0:A:h}/../..
MODELS=(google/gemma-4-31B-it gemini-3.5-flash-lite google/gemma-4-26B-A4B-it gpt-6-luna deepseek-flash claude-haiku-5-5)
for m in $MODELS; do
  n=${m//[^A-Za-z0-9.]/_}
  ( for r in 1 2 3; do MODEL_EXTRACT=$m MODEL_EMBED=off MODEL_REASONING=off node judge/v2/b-run.mjs --rep $r baekho naruto backend sejong; done ) > judge/v2/b-out/log-$n.txt 2>&1 &
done
wait
echo ALL_DONE
