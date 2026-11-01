# 2차(dm2) 기억 문항 — Opus 블라인드 판정

생성 2026-10-31T08:48:38.085Z · 문항 2040개 · 회차 1+2 (opus-dm2, opus-dm2-r2) · 조건 공개 결과 opus-dm2/labels-unblinded.json

배점: 정답 +2 · 부분 +1 · 모름 0 · 옛 값 −1 · 틀림 −1 · 지어냄 −2 · 해당 없음(na) 제외. "기준선 대비"는 같은 대본·같은 턴 문항을 haiku-off 와 짝지어 점수가 높으면 나음, 낮으면 못함(부호 검정, 양측).

| 조건 | 기억 점수(합) | r1 | r2 | 기억 대본 | 재방문 대본 | 정답/부분/모름/옛값/틀림/지어냄/na | 해로운 답(옛값+틀림+지어냄) | 기준선 대비 나음:못함 (p) | 키워드 채점 일치 |
|---|---|---|---|---|---|---|---|---|---|
| deepseek-off | 440/480 (91.7%) | 92.5% | 90.8% | 91.8% | 91.5% | 222/7/1/0/9/1/0 | 10 | 23:10 (0.035) | 94% (195) |
| deepseek-on | 454/480 (94.6%) | 97.5% | 91.7% | 97.3% | 91.5% | 222/14/0/0/4/0/0 | 4 | 23:10 (0.035) | 92% (196) |
| gemma26-off | 423/480 (88.1%) | 92.9% | 83.3% | 93.4% | 82.1% | 212/15/0/4/6/3/0 | 13 | 21:15 (0.405) | 88% (195) |
| haiku-off | 429/480 (89.4%) | 90.8% | 87.9% | 91.4% | 87.1% | 209/20/2/0/9/0/0 | 9 | 기준선 | 86% (203) |
| haiku-on | 447/478 (93.5%) | 97.5% | 89.6% | 94.1% | 92.8% | 213/23/1/0/2/0/1 | 2 | 20:14 (0.392) | 87% (207) |
| luna-off | 441/478 (92.3%) | 95.4% | 89.1% | 95.7% | 88.3% | 220/10/0/3/6/0/1 | 9 | 22:10 (0.050) | 93% (204) |
| luna-on | 442/480 (92.1%) | 94.2% | 90.0% | 98.0% | 85.3% | 223/6/1/3/7/0/0 | 10 | 22:8 (0.016) | 93% (203) |
| qwen-off | 187/238 (78.6%) | 78.6% | – | 84.9% | 71.4% | 99/7/0/2/6/5/1 | 13 | 11:19 (0.200) | 87% (94) |
| ctl-full-memoff | 181/240 (75.4%) | 75.4% | – | 94.5% | 53.6% | 85/13/20/0/2/0/0 | 2 | 11:31 (0.003) | 92% (99) |
| ctl-slide6-memoff | 59/240 (24.6%) | 24.6% | – | 18.0% | 32.1% | 34/3/72/0/10/1/0 | 11 | 5:82 (0.000) | 91% (88) |

## 유형별 점수(%)

| 조건 | abstain | char_promise | combine | distractor | half_said | implicit | multi_update | partial_update | pref | relative_time | retract | update | user_promise |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| deepseek-off | 100.0 | 100.0 | 96.9 | 100.0 | 87.5 | 79.2 | 100.0 | 87.5 | 98.2 | 43.8 | 100.0 | 90.6 | 100.0 |
| deepseek-on | 98.4 | 96.9 | 100.0 | 100.0 | 96.9 | 100.0 | 100.0 | 87.5 | 94.6 | 62.5 | 100.0 | 96.9 | 93.8 |
| gemma26-off | 100.0 | 100.0 | 100.0 | 100.0 | 62.5 | 87.5 | 100.0 | 81.3 | 96.4 | 50.0 | 100.0 | 56.3 | 93.8 |
| haiku-off | 98.4 | 90.6 | 100.0 | 81.3 | 100.0 | 85.4 | 93.8 | 62.5 | 96.4 | 34.4 | 93.8 | 93.8 | 93.8 |
| haiku-on | 100.0 | 93.3 | 100.0 | 100.0 | 100.0 | 100.0 | 87.5 | 68.8 | 95.5 | 71.9 | 93.8 | 81.3 | 96.9 |
| luna-off | 100.0 | 100.0 | 100.0 | 93.8 | 90.6 | 100.0 | 100.0 | 68.8 | 95.5 | 59.4 | 93.8 | 71.9 | 100.0 |
| luna-on | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 100.0 | 81.3 | 95.5 | 34.4 | 100.0 | 71.9 | 100.0 |
| qwen-off | 100.0 | 78.6 | 100.0 | 100.0 | -25.0 | 79.2 | 100.0 | 100.0 | 94.6 | 37.5 | 100.0 | 62.5 | 75.0 |
| ctl-full-memoff | 100.0 | 43.8 | 75.0 | 100.0 | 93.8 | 70.8 | 100.0 | 87.5 | 67.9 | 50.0 | 87.5 | 93.8 | 43.8 |
| ctl-slide6-memoff | 96.9 | 0.0 | 0.0 | 0.0 | 100.0 | -4.2 | 0.0 | 0.0 | 23.2 | 0.0 | 0.0 | 0.0 | 0.0 |

유형별 문항 수(첫 조건 기준): abstain 32 · char_promise 16 · combine 16 · distractor 8 · half_said 16 · implicit 24 · multi_update 8 · partial_update 8 · pref 56 · relative_time 16 · retract 8 · update 16 · user_promise 16

## 해로운 답 목록(옛 값·틀림·지어냄)

- ctl-full-memoff r1 · naruto-revisit-40#31 [implicit] **wrong** — 알레르기 언급 없이 "무섭거나 불편하면 굳이 억지로 갈 필요는 없다" — 제약을 짚지 못함
- ctl-full-memoff r1 · sejong-revisit-40#31 [implicit] **wrong** — 알레르기 언급 없이 "다녀오는 것이 마땅하오"
- ctl-slide6-memoff r1 · sejong-40#28 [implicit] **wrong** — 채식 사용자에게 "대구 살… 생선전"을 권함(되물음 있지만 권한 것은 생선)
- ctl-slide6-memoff r1 · baekho-revisit-40#31 [implicit] **wrong** — "기억에 네가 고양이 알레르기 있다는 말은 없으니까 괜찮을 거야!"
- ctl-slide6-memoff r1 · backend-revisit-40#31 [implicit] **wrong** — "나 땅콩 알레르기 있는 거 알지? 너는 먹어도 되는데" — 사용자 알레르기를 자기 것으로 바꾸고 먹어도 된다고 함
- ctl-slide6-memoff r1 · sejong-revisit-40#31 [implicit] **wrong** — 알레르기 언급 없이 "가는 것이 당연하오"
- ctl-slide6-memoff r1 · naruto-40#27 [char_promise] **wrong** — 약속턴 수락(나선수리검) · "그림자 분신술 보여준다고 했었잖아" — 약속 내용을 틀림
- ctl-slide6-memoff r1 · baekho-40#20 [pref] **fabricated** — "너 늘 우유랑 삼각김밥 사 먹잖아… 우유는 키 크는 데 필수라고 내가 몇 번이나 말했지" — 정답(두유)과 반대, 삼각김밥·공유 과거 지어냄
- ctl-slide6-memoff r1 · baekho-40#33 [implicit] **wrong** — "그럼 우유지!… 나는 역시 우유!" — 우유 못 마시는 사용자에게 우유를 권함
- ctl-slide6-memoff r1 · naruto-revisit-40#31 [implicit] **wrong** — 알레르기 언급 없이 "갑자기 덤비면 깜짝 놀랄 수 있으니까 조심" — 제약을 짚지 못함
- ctl-slide6-memoff r1 · backend-40#20 [pref] **wrong** — "기억이 없네… 너도 아이스 아메리카노면 맞겠지 뭐" — 카페인 끊은 사용자에게 아메리카노를 짐작해 권함
- ctl-slide6-memoff r1 · naruto-40#33 [implicit] **wrong** — "된장 차슈 곱빼기… 하린이는 채소 빼고 다 좋아하지?" — 돼지고기 제약 무시, 다른 제약과 혼동
- ctl-slide6-memoff r1 · baekho-40#28 [implicit] **wrong** — "고기지!… 고기 싫으면 떡볶이나 라면 중에서 골라" — 매운 떡볶이를 대안으로 권함
- deepseek-off r1 · sejong-40#30 [relative_time] **wrong** — "스무엿새에"(25일이 맞음) — 닷새는 맞지만 날짜 틀림
- deepseek-off r1 · sejong-revisit-40#29 [relative_time] **wrong** — "오늘서 사흘 뒤" — 이틀이 맞음
- deepseek-off r1 · baekho-40#40 [half_said] **fabricated** — "나도 채소연 씨 좋아하는 거 비밀로 해 줬잖아" — 앞선 대화(9·14·22턴 확인)에 없는 공유 과거
- deepseek-off r1 · sejong-40#28 [implicit] **wrong** — "과인은 고기 반찬 한 접시를 권하겠소. 다만 그대가 채식하는 줄 아노니" — 제약을 알면서 반대로 권함
- deepseek-off r1 · naruto-40#33 [implicit] **wrong** — "이치라쿠 된장 차슈" — 돼지고기 못 먹는 사용자에게 차슈 라면
- deepseek-off r2 · naruto-revisit-40#29 [relative_time] **wrong** — "나흘인가?" — 남은 날 수 틀림
- deepseek-off r2 · naruto-40#33 [implicit] **wrong** — "된장 차슈 두 그릇" — 돼지고기 못 먹는 사용자
- deepseek-off r2 · sejong-revisit-40#29 [relative_time] **wrong** — "사흘 남았구려"
- deepseek-off r2 · baekho-revisit-40#29 [relative_time] **wrong** — "사흘인가 나흘인가?"
- deepseek-off r2 · backend-revisit-40#29 [relative_time] **wrong** — "수요일까지 닷새 남았네"
- deepseek-on r2 · backend-revisit-40#29 [relative_time] **wrong** — "수요일이 4일이었는데… 이미 지난 거 아냐"
- deepseek-on r2 · sejong-revisit-40#29 [relative_time] **wrong** — "나흘 뒤면 글씨 대회 예선"
- deepseek-on r2 · naruto-revisit-40#29 [relative_time] **wrong** — "예선은 11월 4일 수요일… 벌써 지난 날"
- deepseek-on r2 · baekho-revisit-40#29 [relative_time] **wrong** — "예선이 4일이었으니까… 벌써 지났잖아"
- gemma26-off r1 · naruto-revisit-40#29 [relative_time] **wrong** — "딱 사흘 남았다" — 이틀이 맞음
- gemma26-off r1 · naruto-40#33 [implicit] **wrong** — "돼지고기 빼고, 맛있는 된장 차슈 라면으로 먹자!" — 제약을 말하면서 돼지고기(차슈) 메뉴를 권함
- gemma26-off r1 · baekho-revisit-40#29 [relative_time] **wrong** — "4일 남았네!" — 정답 이틀
- gemma26-off r1 · backend-revisit-40#33 [update] **stale** — "매주 화요일이랑 목요일 저녁에" — 옛 값을 현재처럼 함께(M0045 등과 같은 처리)
- gemma26-off r2 · backend-revisit-40#36 [half_said] **fabricated** — "해커톤 예선 발표… 그게 제일 큰 고민이었을 텐데" — 숨긴 고민 내용을 지어 짐작 이상으로 말함(M1139 과 같은 처리)
- gemma26-off r2 · naruto-40#33 [implicit] **wrong** — "된장 차슈 라면" — 돼지고기 못 먹는 사용자
- gemma26-off r2 · sejong-40#40 [half_said] **fabricated** — "나와 잠시 시간을 보내기 위해 온 것이 아니었소?" — 숨긴 이유를 지어 되물음(M1139·N0047 과 같은 처리)
- gemma26-off r2 · baekho-revisit-40#33 [update] **stale** — "화요일이랑 목요일"
- gemma26-off r2 · baekho-revisit-40#29 [relative_time] **wrong** — "12일인가? 한 3일 정도 남았겠네"
- gemma26-off r2 · naruto-revisit-40#33 [update] **stale** — "화요일이랑 목요일"
- gemma26-off r2 · backend-revisit-40#33 [update] **stale** — "화요일이랑 목요일 저녁"
- gemma26-off r2 · sejong-revisit-40#29 [relative_time] **wrong** — "사흘째 남았구려"
- gemma26-off r2 · sejong-revisit-40#36 [half_said] **fabricated** — "고민이라기보다는, 글씨 대회 예선을 앞두고 마음을 다스리는 법" — 숨긴 고민 내용을 지어 단정
- haiku-off r1 · sejong-revisit-40#29 [relative_time] **wrong** — "오늘이 열하루라면… 열하루 뒤의 일" — 오늘 날짜를 틀림(이틀은 맞음)
- haiku-off r1 · naruto-revisit-40#29 [relative_time] **wrong** — "오늘이 9일이면 4일 남은 거지!" — 이틀이 맞음
- haiku-off r1 · naruto-40#28 [implicit] **wrong** — "강가 산책하면 딱이겠다" — 강가만 가도 다리가 떨린다는 사용자에게 강가를 권함
- haiku-off r1 · baekho-revisit-40#29 [relative_time] **wrong** — "예선은 11월 4일 수요일이었지? 그럼 벌써 지났잖아!"
- haiku-off r2 · backend-revisit-40#29 [relative_time] **wrong** — "오늘 11월 8일이야, 9일 아니고… 4일 남았다"
- haiku-off r2 · naruto-revisit-40#29 [relative_time] **wrong** — "다음 주 수요일이라는 거야, 4일… 이미 지나갔을 텐데"
- haiku-off r2 · baekho-revisit-40#29 [relative_time] **wrong** — "다음 주 수요일이 4일이니까… 5일 남았네! 아니, 4일이었나?"
- haiku-off r2 · sejong-revisit-40#29 [relative_time] **wrong** — "네 밤만 자면 되겠구려" — 남은 날 수 틀림
- haiku-off r2 · naruto-40#28 [implicit] **wrong** — "강가 아니야?… 물수제비 뜨고 놀자… 얕은 데서만" — 물을 무서워하는 걸 알면서 강가를 권함
- haiku-on r2 · backend-revisit-40#29 [relative_time] **wrong** — "4일 남았네"
- haiku-on r2 · sejong-revisit-40#29 [relative_time] **wrong** — "예선은 이미 지나간 셈이구려"
- luna-off r1 · backend-revisit-40#33 [update] **stale** — "화요일이랑 목요일 저녁에" — 옛 값을 현재처럼 함께
- luna-off r1 · baekho-revisit-40#33 [update] **stale** — "매주 화요일이랑 목요일이야"
- luna-off r1 · naruto-revisit-40#36 [half_said] **wrong** — "내가 아는 건 다음 주 친구네 큰 개 세 마리 때문에… 걱정한 거야" — 1세션의 말하지 않은 고민을 다른 일로 단정
- luna-off r2 · backend-revisit-40#29 [relative_time] **wrong** — "예선 발표는 11월 4일이었어… 이미 지났네"
- luna-off r2 · baekho-revisit-40#29 [relative_time] **wrong** — "예선은 11월 4일이니까… 이미 5일 전에 끝났잖아"
- luna-off r2 · backend-40#20 [pref] **wrong** — "마신다고 한 건 아직 못 들었어… 디카페인 아닌 다른 음료로 골라봐" — 정답(디카페인)을 빼라고 함
- luna-off r2 · backend-revisit-40#33 [update] **stale** — "화요일 저녁이라고 했어"
- luna-off r2 · naruto-revisit-40#29 [relative_time] **wrong** — "예선은 11월 4일… 이미 닷새 지났어"
- luna-off r2 · sejong-revisit-40#29 [relative_time] **wrong** — "예선 날짜는 11월 4일… 이미 닷새 지났으니"
- luna-on r1 · naruto-revisit-40#29 [relative_time] **wrong** — "오늘은 10월 25일이야… 17일 남았어!"
- luna-on r1 · baekho-revisit-40#33 [update] **stale** — "화요일이랑 목요일이라고 했잖아!"
- luna-on r1 · baekho-revisit-40#29 [relative_time] **wrong** — "오늘은 9일이 아니라 10월 25일이야!… 17일 남았어"
- luna-on r1 · backend-revisit-40#29 [relative_time] **wrong** — "내가 보는 날짜는 10월 25일… 11월 11일이면 17일 남았어" — 날짜(11일)는 맞으나 남은 날 수 틀림. ※ 프롬프트엔 11월 날짜만 들어감(코드 확인) → 모델이 실제 날짜를 꺼낸 것으로 보임, 라벨링 후 전 조건 집계 예정
- luna-on r2 · sejong-revisit-40#29 [relative_time] **wrong** — "예선이 이달 4일이라면… 닷새 전에 치른 셈"
- luna-on r2 · baekho-revisit-40#33 [update] **stale** — "화요일이랑 목요일이잖아!"
- luna-on r2 · baekho-revisit-40#29 [relative_time] **wrong** — "예선은 4일이었으니까 벌써 5일 지났잖아"
- luna-on r2 · backend-revisit-40#29 [relative_time] **wrong** — "내 달력엔 오늘 10월 25일… 11월 4일이면 열흘 남았어"
- luna-on r2 · backend-revisit-40#33 [update] **stale** — "화요일 저녁이라고도 했고 목요일 저녁이라고도 했어" — 옛 값을 함께(M0045 와 같은 처리)
- luna-on r2 · naruto-revisit-40#29 [relative_time] **wrong** — "예선은 4일이었으니까, 벌써 닷새 지났네"
- qwen-off r1 · naruto-revisit-40#29 [relative_time] **wrong** — "목요일까지는 2일" — 예선은 수요일(11일), 요일 틀림
- qwen-off r1 · sejong-revisit-40#36 [half_said] **fabricated** — "글씨 대회 준비와 오빠 생각 사이에서 마음이 떠나지 않으셨더군" — 고민 내용 지어냄
- qwen-off r1 · baekho-revisit-40#33 [update] **stale** — "화요일과 목요일이야" — 옛 값을 현재처럼 함께 말함
- qwen-off r1 · backend-40#27 [char_promise] **wrong** — 약속턴 수락 · "너는 나한테 점심 사기로 했었지" — 캐릭터가 할 일(코드 리뷰)을 사용자 약속과 혼동
- qwen-off r1 · sejong-40#40 [half_said] **fabricated** — "편집자로서 글을 찾아 궁에 오신다고 하셨노라" — 온 이유를 지어냄
- qwen-off r1 · backend-40#26 [user_promise] **wrong** — "컨슈머 코드 봐주는 거였지" — 사용자 약속(점심)을 캐릭터 약속과 혼동
- qwen-off r1 · backend-revisit-40#29 [relative_time] **wrong** — "수요일이면 3일 남았지" — 이틀이 맞음
- qwen-off r1 · baekho-40#30 [relative_time] **wrong** — "시험은 11월 8일이었지? 이미 지났잖아!" — 25일인데 날짜를 지어냄
- qwen-off r1 · baekho-revisit-40#36 [half_said] **fabricated** — "밴드 예선 준비와 기타 연습 시간 조율이었지!" — 고민 내용을 지어냄
- qwen-off r1 · backend-revisit-40#36 [half_said] **fabricated** — "해커톤 캐시 설계 이야기였지" — 고민 내용을 다른 일로 지어냄
- qwen-off r1 · naruto-revisit-40#36 [half_said] **fabricated** — "피리 예선 준비 때문에 걱정이 많았지?" — 나중에 말하겠다던 고민 내용을 지어 단정
- qwen-off r1 · naruto-40#33 [implicit] **wrong** — "된장 차슈면" — 돼지고기 못 먹는 사용자에게 차슈 권함
- qwen-off r1 · backend-revisit-40#33 [update] **stale** — "화요일이랑 목요일이었지" — 옛 값을 현재처럼 함께