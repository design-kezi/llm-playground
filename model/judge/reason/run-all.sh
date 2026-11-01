#!/bin/zsh
# 추론 끔/켬 비교 전체 실행. 모델마다 별도 프로세스, 모델 안에서는 끔 1~5회 → 켬 1~5회.
cd ${0:A:h}/../..
ON=(claude-haiku-5-5 gpt-5-nano gpt-6-luna gemini-3.1-flash-lite gemini-3.5-flash-lite deepseek-flash
  google/gemma-4-26B-A4B-it google/gemma-4-31B-it Qwen/Qwen3-32B)
OFF_ONLY=(meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo)
for m in $ON $OFF_ONLY; do
  n=${m//[^A-Za-z0-9.]/_}
  modes=(off on); (( ${OFF_ONLY[(Ie)$m]} )) && modes=(off)
  ( for mode in $modes; do for r in 1 2 3 4 5; do MODEL_REASONING=$mode node judge/reason/run.mjs --model $m --rep $r; done; done ) > judge/reason/out/log-$n.txt 2>&1 &
done
wait
echo ALL_DONE
