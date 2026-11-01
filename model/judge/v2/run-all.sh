#!/bin/zsh
# 판단 모델 v2 A단계 전체 실행: 모델마다 별도 프로세스(제공사별 병렬), 모델 안에서는 회차 1→2→3 순서, 4개 언어.
# 로그: judge/v2/out/log-<모델>.txt
cd ${0:A:h}/../..
MODELS=(claude-haiku-5-5 gpt-5-nano gpt-6-luna gpt-4.1-nano gemini-3.1-flash-lite gemini-3.5-flash-lite deepseek-flash
  google/gemma-4-26B-A4B-it google/gemma-4-31B-it Qwen/Qwen3-32B meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo)
for m in $MODELS; do
  n=${m//[^A-Za-z0-9.]/_}
  ( for r in 1 2 3; do node judge/v2/run.mjs --model $m --rep $r --conc 4 ko zh-TW ja en; done ) > judge/v2/out/log-$n.txt 2>&1 &
done
wait
echo ALL_DONE
