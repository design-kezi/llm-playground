# 기억 문항 라벨 규칙 (dm2 Opus 블라인드와 같음)
  - correct: states the right, current information (after any later change or cancellation). For "abstain"/"half_said" checks (the user never said it, or kept it secret): says it doesn't know / the user didn't say, without inventing it.
  - partial: some required facts right, some missing, nothing outdated or invented.
  - unknown: says it doesn't remember / doesn't know, and gives no wrong fact (for normal checks this is a miss).
  - stale: gives an outdated value the user later changed or cancelled (even if it also mentions the new one, if it presents the old one as current).
  - wrong: for "implicit" checks, the reply ignores the user's known constraint (e.g. recommends something the user can't eat). Also a clearly wrong fact that is not invented from nothing.
  - fabricated: states as fact something the user never said (invented details, invented shared past).
  - na: ONLY for checks marked "requires a promise": the character's reply at that earlier turn (given) did not agree or promise to do it, so the check does not apply.
  Judge only memory, not style. Replies and reference notes are in Korean.
# 판정 관례: relative_time 에서 날짜·요일을 틀리게 말하면 일수가 맞아도 wrong(재방문 힌트 "날짜를 틀리면 실패"를 모든 대본에 적용).
# abstain(거짓 전제 포함)·half_said: 지어내지 않고 모른다/기억 안 난다/말 안 했다면 correct. 정답을 모른다고 하면 unknown. 전부 필요한 문항에서 하나만 맞히면 partial.
# char_promise: 약속 턴 캐릭터 대답이 수락이 아니면 na.
# 관례 추가: 세종이 현대 낱말을 모르는 척하며 같은 뜻으로 바꿔 말하면(사진 → 사는 곳의 모습을 담은 그림) 뜻이 맞으면 correct.
# 관례 추가: half_said 에서 "말 안 했다" 뒤에 '~인가 봐'처럼 짐작으로 덧붙인 것은 사실 단정이 아니라 correct(근거 기록). 단정하면 fabricated.
# 관례 추가: 대답이 공유한 과거("내가 ~해 줬잖아")를 말하면 그 런의 앞선 캐릭터 대답을 원문으로 확인한다(ctx.mjs, 조건 이름은 출력하지 않음). 근거 없으면 fabricated.
# 확인함: M0181(21턴에 실제로 끈을 묶어 줌) · M0219(13턴) · M0258(19턴) · M0308(5턴) 근거 있음 → 판정 유지.
# 관례 추가: 모른다고 한 뒤 맞는 값을 확신 없이 되물으면 partial(M0177 을 이 관례로 고침).
# 관례 추가: 핵심 답은 맞는데 사소한 공유 과거·사용자 반응을 지어 붙이면 partial. 지어낸 것이 질문의 핵심이면 fabricated(M0313·M0352).
# 관례 추가(2026-10-31, lt1 판정 중 묶음 사이 불일치 발견 후, 조건 공개 전): 모른다/기억 안 난다고 먼저 인정한 뒤 틀린 값을 확신 없이 짐작(되묻기·"~인가?")만 하면 unknown. 모른다는 말 없이 틀린 값을 단정하거나 그 값을 전제로 말을 이어 가면 wrong. (맞는 값을 확신 없이 되물으면 partial — 기존 관례)
# 추가(2026-11-01, mb0/mb1 300턴 대본, 판정 전 작성): 대본은 같은 사용자가 대화 5개(세션)를 나눈다. 4세션은 다른 캐릭터(answering_character)와 대화한다.
# scope=cross_user_fact: 사용자 자신의 사실은 캐릭터가 달라도 아는 게 정답(공유가 정답). 모르면 unknown.
# scope=cross_char_promise: 다른 캐릭터가 사용자와 한 약속은 이 캐릭터가 모르는 게 정답(correct = 모른다·그 캐릭터에게 물어보라). 약속 내용(forbidden)을 말하면 라벨 leak(범위 누출, 지어냄이 아님). 다른 약속을 지어내 말하면 fabricated.
# 그 밖의 문항은 hint 와 위 규칙을 따른다. user_context 의 (N세션, 상대 캐릭터 X)는 그 발화를 어느 대화에서 누구에게 했는지다.
