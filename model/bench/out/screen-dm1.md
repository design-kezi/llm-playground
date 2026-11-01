# 1차 선별 (dm1)

생성 2026-10-25T12:34:27.653Z · 원자료 bench/out/*-dm1-*/run.json · 기준 docs/50

대조군(최근 6턴 + 기억 끔) 기억 점수: 9 / 32 · 참고: ctl-memoff(기억 끔, 창이 안 줄어 대화 전체 전송과 같음) 26 / 30

| 조건 | 결과 | 지연 중앙값/95% (초) | 규칙 위반 턴 | 기억 점수(키워드) | 판정 필요 | 턴당 비용 | 답 글자 수 | 유효 |
|---|---|---|---|---|---|---|---|---|
| deepseek-off | 통과 | 1.4 / 1.8 | 1 (2%) {"user_action":0,"meta_or_empty":1,"lang_mix":0,"speech_mismatch":0} | 22 / 30 | 2 | 0.313원 | 83 | O |
| deepseek-on | 통과 | 2.0 / 2.8 | 0 (0%) {"user_action":0,"meta_or_empty":0,"lang_mix":0,"speech_mismatch":0} | 26 / 30 | 2 | 0.380원 | 95 | O |
| gem31-off | 탈락: 비용 | 1.6 / 2.4 | 0 (0%) {"user_action":0,"meta_or_empty":0,"lang_mix":0,"speech_mismatch":0} | 25 / 30 | 2 | 1.201원 | 151 | O |
| gem35-off | 탈락: 비용 | 1.1 / 1.4 | 0 (0%) {"user_action":0,"meta_or_empty":0,"lang_mix":0,"speech_mismatch":0} | 24 / 30 | 3 | 1.188원 | 72 | O |
| gem35-on | 탈락: 비용 | 1.4 / 3.1 | 3 (5%) {"user_action":0,"meta_or_empty":3,"lang_mix":0,"speech_mismatch":0} | 20 / 28 | 4 | 1.717원 | 77 | O |
| gemma26-off | 통과 | 1.1 / 2.2 | 0 (0%) {"user_action":0,"meta_or_empty":0,"lang_mix":0,"speech_mismatch":0} | 26 / 32 | 3 | 0.419원 | 83 | O |
| gemma26-on | 탈락: 지연 | 12.4 / 18.0 | 3 (5%) {"user_action":0,"meta_or_empty":1,"lang_mix":2,"speech_mismatch":0} | 26 / 30 | 2 | 0.955원 | 200 | O |
| gpt5nano-off | 통과 (기억 경계) | 1.3 / 1.8 | 2 (3%) {"user_action":0,"meta_or_empty":1,"lang_mix":1,"speech_mismatch":0} | 12 / 32 | 8 | 0.309원 | 117 | O |
| gpt5nano-on | 통과 | 3.6 / 5.3 | 5 (8%) {"user_action":0,"meta_or_empty":2,"lang_mix":3,"speech_mismatch":0} | 22 / 32 | 5 | 0.492원 | 112 | O |
| haiku-off | 통과 | 1.7 / 3.7 | 2 (3%) {"user_action":0,"meta_or_empty":2,"lang_mix":0,"speech_mismatch":0} | 28 / 32 | 2 | 0.416원 | 124 | O |
| haiku-on | 통과 | 1.9 / 4.2 | 2 (3%) {"user_action":0,"meta_or_empty":2,"lang_mix":0,"speech_mismatch":0} | 28 / 32 | 2 | 0.439원 | 138 | O |
| luna-off | 통과 | 1.7 / 3.0 | 3 (5%) {"user_action":0,"meta_or_empty":3,"lang_mix":0,"speech_mismatch":2} | 28 / 32 | 2 | 0.301원 | 73 | O |
| luna-on | 통과 | 2.0 / 3.6 | 5 (8%) {"user_action":0,"meta_or_empty":2,"lang_mix":2,"speech_mismatch":2} | 28 / 32 | 2 | 0.330원 | 73 | O |
| qwen-off | 통과 | 1.9 / 3.0 | 0 (0%) {"user_action":0,"meta_or_empty":0,"lang_mix":0,"speech_mismatch":0} | 22 / 32 | 3 | 0.482원 | 73 | O |
| qwen-on | 탈락: 지연 | 12.6 / 21.4 | 5 (8%) {"user_action":0,"meta_or_empty":4,"lang_mix":0,"speech_mismatch":1} | 26 / 28 | 1 | 0.686원 | 120 | O |