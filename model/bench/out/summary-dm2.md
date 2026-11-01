# 대화 모델 비교 dm2 — 키워드·규칙 채점

생성 2026-10-25T16:49:28.759Z · 원자료 bench/out/*-dm2-*/run.json · AI 판정 전(판정 필요 문항은 0점)

| 조건 | 런 | 기억 점수 전체 (%) | 기억 대본 | 재방문 대본 | 판정 필요 | 지연 중앙값/95% | 규칙 위반 턴 | 빈 답 | 턴당 비용 (대화+추출+정리+임베딩) | 답 글자 | 무효 런 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| deepseek-off | 24 | 387/456 (84.9) | 199/244 | 188/212 | 33 | 1.4 / 2.1초 | 11/800 (1.4%) {"user_action":0,"meta_or_empty":3,"lang_mix":4,"speech_mismatch":4} | 0 | 0.314원 (response 0.121 · extract 0.170 · embed 0.001 · consolidate 0.022) | 82 | 0 |
| deepseek-on | 24 | 389/464 (83.8) | 211/250 | 178/214 | 36 | 2.0 / 2.9초 | 20/800 (2.5%) {"user_action":0,"meta_or_empty":3,"lang_mix":3,"speech_mismatch":14} | 0 | 0.377원 (response 0.184 · extract 0.171 · embed 0.001 · consolidate 0.021) | 90 | 0 |
| gemma26-off | 24 | 384/460 (83.5) | 202/248 | 182/212 | 35 | 1.1 / 2.2초 | 11/800 (1.4%) {"user_action":0,"meta_or_empty":3,"lang_mix":1,"speech_mismatch":7} | 0 | 0.424원 (response 0.233 · extract 0.169 · embed 0.001 · consolidate 0.021) | 79 | 0 |
| haiku-off | 24 | 399/468 (85.3) | 205/250 | 194/218 | 31 | 1.8 / 2.6초 | 6/800 (0.8%) {"user_action":2,"meta_or_empty":3,"lang_mix":1,"speech_mismatch":0} | 0 | 0.418원 (response 0.219 · extract 0.176 · embed 0.001 · consolidate 0.022) | 131 | 0 |
| haiku-on | 24 | 409/476 (85.9) | 214/254 | 195/222 | 30 | 1.9 / 3.6초 | 10/800 (1.3%) {"user_action":0,"meta_or_empty":5,"lang_mix":6,"speech_mismatch":0} | 0 | 0.457원 (response 0.257 · extract 0.176 · embed 0.001 · consolidate 0.022) | 149 | 0 |
| luna-off | 24 | 402/478 (84.1) | 219/256 | 183/222 | 34 | 1.9 / 5.8초 | 11/800 (1.4%) {"user_action":0,"meta_or_empty":2,"lang_mix":2,"speech_mismatch":7} | 0 | 0.307원 (response 0.114 · extract 0.171 · embed 0.001 · consolidate 0.021) | 77 | 0 |
| luna-on | 24 | 402/478 (84.1) | 218/256 | 184/222 | 36 | 2.2 / 4.5초 | 16/800 (2.0%) {"user_action":0,"meta_or_empty":2,"lang_mix":6,"speech_mismatch":8} | 0 | 0.333원 (response 0.141 · extract 0.169 · embed 0.001 · consolidate 0.021) | 71 | 0 |
| qwen-off | 12 | 186/232 (80.2) | 98/126 | 88/106 | 22 | 2.2 / 4.3초 | 5/400 (1.3%) {"user_action":0,"meta_or_empty":2,"lang_mix":1,"speech_mismatch":2} | 0 | 0.493원 (response 0.303 · extract 0.169 · embed 0.001 · consolidate 0.020) | 75 | 0 |
| ctl-full-memoff | 8 | 165/232 (71.1) | 108/126 | 57/106 | 17 | 1.8 / 2.7초 | 0/320 (0.0%) {"user_action":0,"meta_or_empty":0,"lang_mix":0,"speech_mismatch":0} | 0 | 0.213원 (response 0.213) | 134 | 0 |
| ctl-slide6-memoff | 8 | 69/236 (29.2) | 31/126 | 38/110 | 30 | 1.8 / 2.6초 | 1/320 (0.3%) {"user_action":0,"meta_or_empty":0,"lang_mix":1,"speech_mismatch":0} | 0 | 0.285원 (response 0.285) | 130 | 0 |