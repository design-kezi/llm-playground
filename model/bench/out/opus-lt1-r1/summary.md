# 2차(dm2) 기억 문항 — Opus 블라인드 판정

생성 2026-10-31T12:43:11.451Z · 문항 1240개 · 회차 1+2 (opus-lt1-r1, opus-lt1-r2) · 조건 공개 결과 opus-lt1-r1/labels-unblinded.json

배점: 정답 +2 · 부분 +1 · 모름 0 · 옛 값 −1 · 틀림 −1 · 지어냄 −2 · 해당 없음(na) 제외. "기준선 대비"는 같은 대본·같은 턴 문항을 haiku-off 와 짝지어 점수가 높으면 나음, 낮으면 못함(부호 검정, 양측).

| 조건 | 기억 점수(합) | r1 | r2 | 기억 대본 | 재방문 대본 | 정답/부분/모름/옛값/틀림/지어냄/na | 해로운 답(옛값+틀림+지어냄) | 기준선 대비 나음:못함 (p) | 키워드 채점 일치 |
|---|---|---|---|---|---|---|---|---|---|
| deepseek-on | 359/496 (72.4%) | 71.8% | 73.0% | 72.4% | –% | 168/33/37/2/8/0/0 | 10 | 42:19 (0.004) | 90% (175) |
| haiku-off | 319/496 (64.3%) | 62.1% | 66.5% | 64.3% | –% | 144/48/40/5/10/1/0 | 16 | 기준선 | 81% (190) |
| haiku-on | 321/494 (65.0%) | 65.0% | 64.9% | 65.0% | –% | 152/36/40/6/13/0/1 | 19 | 37:32 (0.630) | 85% (188) |
| ctl-full-memoff | 470/496 (94.8%) | 93.1% | 96.4% | 94.8% | –% | 227/17/3/0/1/0/0 | 1 | 96:10 (0.000) | 96% (197) |
| ctl-slide6-memoff | 95/496 (19.2%) | 19.0% | 19.4% | 19.2% | –% | 38/33/164/0/12/1/0 | 13 | 12:136 (0.000) | 86% (162) |

## 유형별 점수(%)

| 조건 | abstain | char_promise | combine | distractor | event | fact | half_said | implicit | multi_update | partial_update | pref | relative_time | retract | update | user_promise |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| deepseek-on | 100.0 | 96.9 | 25.0 | 75.0 | 95.3 | 56.3 | 100.0 | 73.8 | 100.0 | 93.8 | 9.4 | 100.0 | 100.0 | 22.9 | 96.9 |
| haiku-off | 100.0 | 100.0 | 25.0 | 62.5 | 84.4 | 45.3 | 100.0 | 61.3 | 93.8 | 31.3 | 28.1 | 100.0 | 87.5 | 12.5 | 87.5 |
| haiku-on | 100.0 | 100.0 | 37.5 | 62.5 | 89.1 | 59.4 | 100.0 | 58.8 | 100.0 | 81.3 | -9.4 | 93.8 | 56.3 | 14.6 | 87.5 |
| ctl-full-memoff | 100.0 | 90.6 | 100.0 | 87.5 | 98.4 | 89.1 | 100.0 | 88.8 | 100.0 | 93.8 | 93.8 | 100.0 | 100.0 | 97.9 | 100.0 |
| ctl-slide6-memoff | 100.0 | 3.1 | 0.0 | 0.0 | 9.4 | -1.6 | 100.0 | 45.0 | 0.0 | 0.0 | 15.6 | 0.0 | 0.0 | 0.0 | 0.0 |

유형별 문항 수(첫 조건 기준): abstain 16 · char_promise 16 · combine 8 · distractor 8 · event 32 · fact 32 · half_said 8 · implicit 40 · multi_update 8 · partial_update 8 · pref 16 · relative_time 8 · retract 8 · update 24 · user_promise 16

## 해로운 답 목록(옛 값·틀림·지어냄)

- ctl-full-memoff r1 · baekho-120#110 [implicit] **wrong** — 이온음료와 함께 우유도 사라고 권함
- ctl-slide6-memoff r2 · backend-120#110 [implicit] **wrong** — 카페인 끊었는데 아이스 아메리카노 권함
- ctl-slide6-memoff r2 · naruto-120#82 [implicit] **wrong** — 돼지고기 못 먹는데 차슈 라면 권함
- ctl-slide6-memoff r2 · backend-120#101 [implicit] **wrong** — 고소공포증을 캐릭터 자신 것으로 돌리고 사용자에게 난간 쪽 사진 권함
- ctl-slide6-memoff r2 · baekho-120#110 [implicit] **wrong** — 우유를 권함
- ctl-slide6-memoff r2 · baekho-120#95 [implicit] **wrong** — 복숭아 알레르기 무시하고 복숭아 권함
- ctl-slide6-memoff r2 · sejong-120#87 [char_promise] **wrong** — 글자 가르쳐 주기는 58턴에 캐릭터가 실제로 한 말(원문 확인) — 물은 약속(바둑) 대신 다른 말을 함 [v1 fabricated: 하위 에이전트가 원문 확인 도구를 못 써 근거 없음으로 봄, 조정 세션이 조건 이름 없이 원문 확인 후 정정]
- ctl-slide6-memoff r1 · naruto-120#82 [implicit] **wrong** — 돼지고기 차슈 라면 권함
- ctl-slide6-memoff r1 · backend-120#110 [implicit] **wrong** — 카페인 끊은 사용자에게 아아 권함
- ctl-slide6-memoff r1 · naruto-120#100 [event] **fabricated** — 약초 배달 대신 쉬는 날이라 했다고 지어냄
- ctl-slide6-memoff r1 · baekho-120#95 [implicit] **wrong** — 복숭아 알레르기 사용자에게 복숭아 권함
- ctl-slide6-memoff r1 · baekho-120#104 [fact] **wrong** — 안경 대신 농구 시작이라고 틀리게 짐작
- ctl-slide6-memoff r1 · naruto-120#102 [pref] **wrong** — 피리 대신 수행 중 입으로 숨 쉰 탓이라고 짐작
- ctl-slide6-memoff r1 · naruto-120#114 [pref] **wrong** — 약초 분류 대신 장부 정리라고 함
- deepseek-on r2 · sejong-120#93 [update] **stale** — 옛 값 매화
- deepseek-on r2 · sejong-120#102 [pref] **wrong** — 매듭 대신 매화 수라고 함
- deepseek-on r2 · backend-120#102 [pref] **wrong** — 우쿨렐레 대신 클라이밍 때문이라고 함
- deepseek-on r2 · baekho-120#102 [pref] **wrong** — 기타 대신 농구 연습 때문이라고 단정
- deepseek-on r2 · sejong-120#104 [fact] **wrong** — 비녀 대신 다른 약속(기구 보는 법)을 답함
- deepseek-on r1 · baekho-120#102 [pref] **wrong** — 기타 대신 농구공·마이크로 추측
- deepseek-on r1 · sejong-120#120 [event] **wrong** — 강릉 대신 동래 혼례와 혼동
- deepseek-on r1 · naruto-120#93 [update] **stale** — 옛 값 해바라기를 말함
- deepseek-on r1 · backend-120#102 [pref] **wrong** — 우쿨렐레 대신 클라이밍이라고 함
- deepseek-on r1 · baekho-120#114 [pref] **wrong** — 미술 대신 수학이라고 함
- haiku-off r2 · backend-120#89 [partial_update] **stale** — 옛 값 목요일
- haiku-off r2 · sejong-120#112 [update] **stale** — 홀수와 함께 짝수 날도 간다고 함
- haiku-off r2 · baekho-120#110 [implicit] **wrong** — 우유를 권함
- haiku-off r2 · backend-120#110 [implicit] **wrong** — 카페인 끊은 사용자에게 아메리카노·라떼 권함
- haiku-off r2 · backend-120#102 [pref] **wrong** — 우쿨렐레 대신 클라이밍이 맞을 거라고 함
- haiku-off r2 · naruto-120#93 [update] **stale** — 옛 값 해바라기 언급
- haiku-off r2 · sejong-120#93 [update] **stale** — 동백과 함께 옛 값 매화도 지금 놓는다고 함
- haiku-off r1 · naruto-120#113 [user_promise] **wrong** — 먹을 것 질문에 경단 대신 연고라고 답함
- haiku-off r1 · backend-120#110 [implicit] **wrong** — 카페인 든 아아·바닐라라떼 권함
- haiku-off r1 · sejong-120#89 [partial_update] **stale** — 옛 토요일로 답함
- haiku-off r1 · backend-120#118 [fact] **wrong** — 사용자 집 모른다며 정자역을 캐릭터 집으로 착각
- haiku-off r1 · naruto-120#118 [fact] **fabricated** — 대나무 숲 대신 선착장 길을 지어냄
- haiku-off r1 · backend-120#102 [pref] **wrong** — 우쿨렐레 대신 클라이밍·기타로 추측
- haiku-off r1 · naruto-120#82 [implicit] **wrong** — 돼지고기 차슈 라면 권함
- haiku-off r1 · sejong-120#82 [implicit] **wrong** — 채식 사용자에게 국밥 권하고 두부조림 언급 없음
- haiku-off r1 · naruto-120#102 [pref] **wrong** — 피리 대신 검술·찬바람 탓이라고 짐작
- haiku-on r2 · naruto-120#111 [retract] **stale** — 취소된 불꽃놀이를 현재로 말함
- haiku-on r2 · sejong-120#101 [implicit] **wrong** — 높은 곳 무서워하는데 좋아하는 모양이라며 오르라 함
- haiku-on r2 · backend-120#102 [pref] **wrong** — 우쿨렐레 대신 클라이밍이라고 함
- haiku-on r2 · naruto-120#82 [implicit] **wrong** — 돼지고기 못 먹는 사용자에게 차슈 라면 권함
- haiku-on r2 · sejong-120#102 [pref] **wrong** — 매듭 공예 대신 말타기 때문이라고 함
- haiku-on r2 · baekho-120#114 [pref] **wrong** — 미술 좋아함을 잊고 수학 쪽이라 답함
- haiku-on r2 · backend-120#93 [update] **stale** — 옛 값 시그널을 말함
- haiku-on r2 · backend-120#101 [implicit] **wrong** — 사용자 고소공포증을 캐릭터 자신의 것으로 말하고 사용자에게 가 보라 함
- haiku-on r2 · naruto-120#93 [update] **stale** — 국화 대신 옛 값 해바라기를 말함
- haiku-on r1 · baekho-120#114 [pref] **wrong** — 수학을 기다릴 거라 짚음(정답 미술)
- haiku-on r1 · naruto-120#82 [implicit] **wrong** — 돼지고기 차슈 라멘 권함
- haiku-on r1 · sejong-120#106 [implicit] **stale** — 그만둔 활쏘기를 지금 배우는 것으로 권함 [재판정 전: wrong]
- haiku-on r1 · baekho-120#102 [pref] **wrong** — 기타 대신 농구 공 연습으로 짚음
- haiku-on r1 · naruto-120#106 [implicit] **wrong** — 돼지고기 차슈 권함, 종이학 언급 없음
- haiku-on r1 · backend-120#89 [partial_update] **stale** — 옛 목요일로 답함
- haiku-on r1 · sejong-120#112 [update] **stale** — 홀수와 옛 짝수 날을 함께 현재로 말함
- haiku-on r1 · naruto-120#113 [user_promise] **wrong** — 경단 대신 상처 연고로 혼동
- haiku-on r1 · sejong-120#102 [pref] **wrong** — 매듭 대신 말타기·바느질로 추측
- haiku-on r1 · naruto-120#102 [pref] **wrong** — 피리 대신 약초 캐러 다니는 탓이냐고 틀리게 짐작