# 120턴 기억 문항 — 블록 포함·빠짐·원문 검색·캐릭터 재언급 (lt1)

생성 2026-10-31T13:06:56.120Z · 문항 1240개 · 블록 = 문항 직전 RETRIEVE 기준, 원문 턴 = source_turns 중 가장 늦은 턴

| 조건 | 문항 | in_block | dropped | not_in_block | not_stored | memory_off | na | 블록에서 빠진 항목 수 최대 | 블록 토큰 최대 | 원문 검색 | 재언급(창 12턴 안) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| ctl-full-memoff | 248 | 0 | 0 | 0 | 0 | 232 | 16 | 0 | 0 | 0 | 19 |
| ctl-slide6-memoff | 248 | 0 | 0 | 0 | 0 | 232 | 16 | 0 | 0 | 0 | 13 |
| deepseek-on | 248 | 138 | 83 | 1 | 10 | 0 | 16 | 36 | 1000 | 16 | 14 |
| haiku-off | 248 | 135 | 84 | 2 | 11 | 0 | 16 | 36 | 1000 | 16 | 20 |
| haiku-on | 248 | 142 | 76 | 2 | 12 | 0 | 16 | 39 | 1000 | 16 | 27 |

## 블록 상태별 Opus 라벨

| 조건 | 블록 상태 | correct | partial | unknown | stale | wrong | fabricated |
|---|---|---|---|---|---|---|---|
| ctl-full-memoff | memory_off | 211 | 17 | 3 | 0 | 1 | 0 |
| ctl-full-memoff | na | 16 | 0 | 0 | 0 | 0 | 0 |
| ctl-slide6-memoff | memory_off | 22 | 33 | 164 | 0 | 12 | 1 |
| ctl-slide6-memoff | na | 16 | 0 | 0 | 0 | 0 | 0 |
| deepseek-on | in_block | 127 | 8 | 2 | 1 | 0 | 0 |
| deepseek-on | dropped | 15 | 25 | 34 | 1 | 8 | 0 |
| deepseek-on | not_in_block | 0 | 0 | 1 | 0 | 0 | 0 |
| deepseek-on | not_stored | 10 | 0 | 0 | 0 | 0 | 0 |
| deepseek-on | na | 16 | 0 | 0 | 0 | 0 | 0 |
| haiku-off | in_block | 102 | 26 | 2 | 3 | 2 | 0 |
| haiku-off | dropped | 16 | 22 | 38 | 0 | 8 | 0 |
| haiku-off | not_in_block | 1 | 0 | 0 | 0 | 0 | 1 |
| haiku-off | not_stored | 9 | 0 | 0 | 2 | 0 | 0 |
| haiku-off | na | 16 | 0 | 0 | 0 | 0 | 0 |
| haiku-on | in_block | 117 | 16 | 5 | 3 | 1 | 0 |
| haiku-on | dropped | 9 | 20 | 33 | 2 | 12 | 0 |
| haiku-on | not_in_block | 0 | 0 | 2 | 0 | 0 | 0 |
| haiku-on | not_stored | 10 | 0 | 0 | 1 | 0 | 0 |
| haiku-on | na | 16 | 0 | 0 | 0 | 0 | 0 |