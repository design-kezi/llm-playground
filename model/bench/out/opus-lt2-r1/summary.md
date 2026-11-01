# 2차(dm2) 기억 문항 — Opus 블라인드 판정

생성 2026-10-31T17:07:40.372Z · 문항 744개 · 회차 1+2 (opus-lt2-r1, opus-lt2-r2) · 조건 공개 결과 opus-lt2-r1/labels-unblinded.json

배점: 정답 +2 · 부분 +1 · 모름 0 · 옛 값 −1 · 틀림 −1 · 지어냄 −2 · 해당 없음(na) 제외. "기준선 대비"는 같은 대본·같은 턴 문항을 기준선과 짝지어 점수가 높으면 나음, 낮으면 못함(부호 검정, 양측).

| 조건 | 기억 점수(합) | r1 | r2 | 기억 대본 | 재방문 대본 | 정답/부분/모름/옛값/틀림/지어냄/na | 해로운 답(옛값+틀림+지어냄) | 기준선 대비 나음:못함 (p) | 키워드 채점 일치 |
|---|---|---|---|---|---|---|---|---|---|
| deepseek-on | 345/496 (69.6%) | 71.4% | 67.7% | 69.6% | –% | 163/32/40/2/11/0/0 | 13 | 기준선 | 89% (175) |
| v2-dsx | 434/496 (87.5%) | 88.3% | 86.7% | 87.5% | –% | 219/9/7/8/5/0/0 | 13 | 63:17 (0.000) | 95% (188) |
| v2-gemma | 417/494 (84.4%) | 85.4% | 83.5% | 84.4% | –% | 216/4/8/15/4/0/1 | 19 | 60:20 (0.000) | 95% (189) |

## 유형별 점수(%)

| 조건 | abstain | char_promise | combine | distractor | event | fact | half_said | implicit | multi_update | partial_update | pref | relative_time | retract | update | user_promise |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| deepseek-on | 100.0 | 90.6 | 12.5 | 68.8 | 95.3 | 56.3 | 100.0 | 68.8 | 100.0 | 81.3 | 12.5 | 100.0 | 100.0 | 16.7 | 93.8 |
| v2-dsx | 100.0 | 90.6 | 100.0 | 93.8 | 100.0 | 65.6 | 100.0 | 96.3 | 93.8 | 81.3 | 96.9 | 100.0 | 93.8 | 43.8 | 100.0 |
| v2-gemma | 100.0 | 100.0 | 100.0 | 100.0 | 90.6 | 68.8 | 100.0 | 97.5 | 100.0 | 56.3 | 100.0 | 100.0 | 100.0 | 16.7 | 93.8 |

유형별 문항 수(첫 조건 기준): abstain 16 · char_promise 16 · combine 8 · distractor 8 · event 32 · fact 32 · half_said 8 · implicit 40 · multi_update 8 · partial_update 8 · pref 16 · relative_time 8 · retract 8 · update 24 · user_promise 16

## 해로운 답 목록(옛 값·틀림·지어냄)

- deepseek-on r1 · baekho-120#114 [pref] **wrong** — 미술 대신 수학을 기다린다고 함
- deepseek-on r1 · naruto-120#93 [update] **stale** — 옛 해바라기라 함
- deepseek-on r1 · baekho-120#102 [pref] **wrong** — 기타 대신 농구공·마이크 짐작
- deepseek-on r1 · sejong-120#120 [event] **wrong** — 강릉 대신 동래로 짐작
- deepseek-on r1 · backend-120#102 [pref] **wrong** — 우쿨렐레 대신 클라이밍 단정
- deepseek-on r2 · sejong-120#104 [fact] **wrong** — 비녀 대신 기구 배우기 약속을 답함
- deepseek-on r2 · sejong-120#87 [char_promise] **wrong** — 바둑 대신 기구 보는 법을 답함
- deepseek-on r2 · baekho-120#102 [pref] **wrong** — 기타 대신 농구라고 단정
- deepseek-on r2 · sejong-120#93 [update] **stale** — 옛 값 매화를 말함
- deepseek-on r2 · naruto-120#82 [implicit] **wrong** — 차슈라면을 권함
- deepseek-on r2 · naruto-120#93 [update] **wrong** — 국화 놓치고 지금 안 키운다고 단정
- deepseek-on r2 · backend-120#102 [pref] **wrong** — 우쿨렐레 대신 클라이밍이라 함
- deepseek-on r2 · sejong-120#102 [pref] **wrong** — 매듭 대신 매화 수라고 답함
- v2-dsx r1 · backend-120#112 [update] **stale** — 옛 월수금이라 함
- v2-dsx r1 · baekho-120#93 [update] **stale** — 옛 아이유라 함
- v2-dsx r1 · sejong-120#115 [char_promise] **wrong** — 서고 대신 앙부일구·자격루 약속을 댐
- v2-dsx r1 · naruto-120#112 [update] **stale** — 옛 월수금을 현재로 말함
- v2-dsx r1 · naruto-120#116 [update] **stale** — 그만둔 달리기를 현재로 말함
- v2-dsx r1 · baekho-120#104 [fact] **wrong** — 안경 대신 수영이라 단정
- v2-dsx r2 · backend-120#93 [update] **stale** — 시그널을 현재처럼 함께 말함
- v2-dsx r2 · baekho-120#93 [update] **stale** — 아이유를 현재로 말함
- v2-dsx r2 · naruto-120#112 [update] **stale** — 월수금도 현재처럼 말함
- v2-dsx r2 · naruto-120#104 [fact] **wrong** — 머리띠 대신 달리기 그만둔 일을 답함
- v2-dsx r2 · backend-120#112 [update] **stale** — 옛 값 월수금
- v2-dsx r2 · baekho-120#104 [fact] **wrong** — 안경 대신 수영을 답함
- v2-dsx r2 · sejong-120#104 [fact] **wrong** — 비녀 대신 앙부일구 약속을 답함
- v2-gemma r1 · baekho-120#104 [fact] **wrong** — 안경 대신 수영이라 단정
- v2-gemma r1 · backend-120#116 [update] **stale** — 옛 수영이라 함
- v2-gemma r1 · baekho-120#93 [update] **stale** — 옛 아이유라 함
- v2-gemma r1 · backend-120#89 [partial_update] **stale** — 옛 목요일이라 함
- v2-gemma r1 · naruto-120#116 [update] **stale** — 옛 달리기라 함
- v2-gemma r1 · baekho-120#116 [update] **stale** — 그만둔 줄넘기를 현재로 말함
- v2-gemma r1 · naruto-120#112 [update] **stale** — 의료 인술을 옛 월수금으로 말함
- v2-gemma r1 · sejong-120#83 [event] **wrong** — 산사 일정을 자기 것으로 뒤바꿈
- v2-gemma r1 · sejong-120#116 [update] **stale** — 그만둔 활쏘기를 현재로 말함
- v2-gemma r2 · backend-120#89 [partial_update] **stale** — 목요일(옛 값)로 답함
- v2-gemma r2 · baekho-120#93 [update] **stale** — 아이유(옛 값)로 답함
- v2-gemma r2 · baekho-120#104 [fact] **wrong** — 안경 대신 아버지 출장이라 단정
- v2-gemma r2 · naruto-120#116 [update] **stale** — 달리기(옛 값)로 답함
- v2-gemma r2 · backend-120#112 [update] **stale** — 월수금을 현재처럼 말함
- v2-gemma r2 · backend-120#116 [update] **stale** — 수영(옛 값)으로 답함
- v2-gemma r2 · backend-120#83 [event] **wrong** — 사용자 봉사를 캐릭터 자기 일로 말함
- v2-gemma r2 · baekho-120#112 [update] **stale** — 화목과 함께 월수금을 현재로 말함
- v2-gemma r2 · baekho-120#116 [update] **stale** — 옛 값 줄넘기
- v2-gemma r2 · naruto-120#112 [update] **stale** — 월수금을 현재 강습으로 말함