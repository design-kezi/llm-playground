# 채팅앱 레이어 (데모, 최소 구현)

작성: '채팅앱' 세션. 갱신 2026-10-22. 상태: 가짜 모델·가짜 기억으로 끝까지 동작 확인.
원칙: 비용절감 데모 테스트용. **앱 레이어 오버스펙 금지.** 인증·권한·접근제한 없음. 필요한 기능은 다른 세션이 요청.

## 실행
```bash
cd app && npm install && npx next build && npx next start -p 3000   # 로컬. 외부 공개는 나중에 ngrok
scripts/demo.sh http://localhost:3000 <이름> <캐릭터id> <턴수>       # curl로 N턴 대화 + 종료 리포트
```
스택: Next.js 16 + node:sqlite(Node 22 내장, `app/data/app.db`). 외부 패키지는 next/react뿐.

## 사용자·캐릭터
- 사용자 = 입력한 이름 문자열. 같은 이름이면 같은 사용자(기억 공유), 다른 이름이면 다른 사용자.
- 캐릭터 4개: `app/characters/{baekho,naruto,backend,sejong}.json` = `{id, name, order, tagline, prompt, prompt_en, i18n}` (강백호·나루토·백엔드 직장인 박준호·세종대왕(1443년 조선, 현대어를 못 알아듣는 설정)). 옛 윤아·강도현·세라 시트는 `app/characters-legacy/` (로드 안 됨).
- UI: ChatGPT 형태 — 사이드바(날짜별 대화 목록, 새 채팅, 항목 ⋯ 메뉴로 이름 바꾸기·삭제), 상단 캐릭터 선택 메뉴, 가운데 입력창 빈 화면, 사용자 말풍선/캐릭터 본문(지문은 제 줄 기울임), Enter 전송·Shift+Enter 줄바꿈(한글 조합 처리), 실시간 스트리밍(SSE)과 중지, 메시지 수정, 다시 생성, 버전 넘기기 ‹ 1/2 ›, 복사·턴 비용, 맨 아래로 버튼, /c/:id 주소, Ctrl+Shift+O 새 채팅, 다크 모드·모바일 서랍. 이름은 첫 화면 모달에서 받아 localStorage 에 둔다.
- 추가 API(기존 curl 흐름은 그대로):
  - `GET /api/conversations?user=` 사이드바 목록(hidden 제외, title 우선), `PATCH /api/conversations/:id {title}` 이름 바꾸기, `DELETE /api/conversations/:id` 목록에서 숨김(비용·기억은 남김)
  - `POST .../messages?stream=1` SSE: `{delta}` 조각들, 답 저장 직후 `{saved}`, 기억 정리까지 끝나면 `{done, turn_no, reply, turn_cost_krw}` 또는 `{error}`. 연결을 끊으면 중지(본 데까지만 저장). 화면은 `{saved}`에서 입력을 풀고, 같은 캐릭터의 다음 요청(전송·수정·다시 생성·버전 전환·종료)은 앞 요청이 `done`될 때까지 브라우저에서 기다렸다 보낸다. 제공사 응답에 섞인 깨진 글자(U+FFFD)는 저장·스트리밍 전에 뺀다(건수는 원장 `replacement_chars`). 알려진 한계: 이 줄은 탭 하나 안에서만 지켜져서, 같은 캐릭터를 탭 두 개로 열고 동시에 보내면 서버에서 접기가 겹칠 수 있다(패치 전과 같음). `?stream=1` 없으면 기존 JSON
  - `POST .../regenerate` 마지막 답 다시 생성, `POST .../edit {turn_no, text}` 사용자 메시지 수정(그 턴부터 접고 새 턴), `POST .../switch {message_id}` 버전 넘기기. 셋 다 stair 창 안(아직 기억으로 안 넘어간) 턴만
  - `GET .../messages` 는 active 행만, 각 행에 `id, editable, versions[]`, assistant 행에 `cost_krw`
- 메시지 버전: 행을 지우지 않고 `messages.active=0` 으로 접는다. `parked_under` = 그 행들을 접게 한 버전 id, `slot` = 수정된 사용자 메시지의 원래 자리. 다시 생성은 같은 turn_no 에 assistant 행 추가, 수정은 새 turn_no. 버린 답의 호출 비용은 그대로 합계에 남는다.
- 캐릭터 주입 방식은 모델 세션과 논의 중. `app/lib/context.js` 의 `characterText()` 한 곳만 바뀐다.

## API
| 메서드 | 경로 | body / 반환 |
| --- | --- | --- |
| GET | `/api/characters` | `[{id,name}]` |
| POST | `/api/conversations` | `{user_name, character_id}` → `{conversation_id, user_id, character_id}` |
| POST | `/api/conversations/:id/messages` | `{text}` → `{turn_no, reply, turn_cost_krw}` |
| GET | `/api/conversations/:id/messages` | 전체 메시지 |
| POST | `/api/conversations/:id/end` | 기억 정리 호출 후 종료 → 리포트 |
| GET | `/api/conversations/:id/report` | 리포트 |
| GET | `/api/memory?user=<이름>[&include_superseded=1][&include_log=1]` | 기억 레이어 `list` 결과 그대로(검증용) |

## 턴 처리 (`app/lib/chat.js`, 전부 동기)
1. 사용자 메시지 저장, turn_no 부여
2. `memory.retrieve` → 기억 텍스트 (예산 400토큰)
3. 조립: system = [캐릭터+규칙(cache:true), 기억] / messages = 창 방식에 따른 이전 대화(완료된 턴만) + 현재 메시지
4. `model.complete` → 답변 저장. 실패 시 시도 비용은 기록하고 502, 그 턴은 미완료
5. `memory.update` (같은 요청 안에서) → 응답 반환 시점에 턴 비용 확정
- `/end` 는 `memory.consolidate` 를 turn_no 0(대화 단위)으로 기록

## 벤치 조건 환경변수 (docs/30-bench-design.md §3.1, `app/lib/config.js`)
| 변수 | 값 (기본) | 동작 |
| --- | --- | --- |
| `APP_WINDOW_MODE` | `full` / `slide` / `stair` (`slide`) | full: 완료된 턴 전부 / slide: 최근 N턴 / stair: 마지막 정리 이후 전부 |
| `APP_RECENT_TURNS` | 정수 (6) | slide 의 N, stair 정리 후 남기는 턴 수 |
| `APP_STAIR_MAX` | 정수 (12) | stair 창 최대. 응답 후 창이 이만큼 차면 정리 |
| `APP_MEMORY` | `on` / `off` (`on`) | off: retrieve·update·consolidate 생략(대조군) |
| `APP_CHARACTER_VARIANT` | `full` / `short` (`full`) | short: 시트의 `prompt_short` 사용. 없으면 대화 시작 400 |
| `APP_MAX_TOKENS` | 정수 (200) | 응답 상한. 길이는 규칙 문구로 조절 |

- 잘못된 값이면 첫 요청에서 오류(로그에 허용값 표시).
- stair 정리: 오래된 턴(창 − N)을 `memory.update`(`force: true, reason: 'stair_evict'`, 게이트 무시하고 반드시 추출) 1회로 넘기고 → `memory.retrieve` 1회로 새 기억 블록을 만들어 대화에 저장 → 다음 정리까지 그 블록을 매 턴 그대로 재사용(캐시 접두사 유지). 비용은 정리가 일어난 턴에 기록. stair 의 첫 턴에도 retrieve 1회.
- 그 외 모드는 매 턴 retrieve + update.
- 대화 시작 시점의 설정(`app` 값 + `APP_/MODEL_/MEMORY_` 환경변수 전체)을 대화에 저장하고 리포트 `settings` 로 반환(재현용).

## 비용 기록·리포트
- 모든 호출 시도를 `calls` 테이블에 `(conversation_id, turn_no, tag)` 와 함께 저장. tag = response | retrieve | extract | consolidate (시도에 `tag` 가 있으면 그걸 씀)
- 리포트: 완료 턴 수, 입력(보낸 쪽)·출력(받은 쪽) 원화와 토큰, 합계, 턴당 평균(= 전체 비용 ÷ 완료 턴), 태그별, 초반·중반·후반 평균(턴 3등분), 최대 턴, 실패 호출 수, 가격 메타
- 가짜 모델 단계에서는 `pricing.estimated = true` 로 "추정치" 표시

## 다른 레이어와의 인터페이스 (앱이 import 하는 것)
`app/lib/memory.js` 는 `memory/` 모듈 re-export 로 통합됨(2026-10-22). `app/lib/model.js` 는 `model/index.js` 를 **번들하지 않고** Node 동적 import 로 불러온다(2026-10-22). 번들하면 모델 모듈의 `import.meta.dirname` 이 비어 `.env`·가격표 경로를 못 찾는다. 키는 레포 루트 `.env` 를 모델 모듈이 직접 읽고, 빌드 결과물(`.next`)에 키가 없음을 확인. 레포 루트 모듈 import 는 `next.config.mjs` 의 turbopack root 설정으로 확인 완료.

```js
// 모델
complete({ system:[{text, cache?}], messages:[{role,content}], max_tokens, purpose, tag, conversation_id, turn_no })
  → { text, attempts }        // 끝내 실패하면 throw, error.attempts 에 시도 기록
pricing() → { source, as_of, fx_krw_per_usd, estimated? }
// attempt = { model, ok, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
//             input_krw, output_krw, cost_krw, latency_ms, error?, tag? }
//   input_krw 는 캐시 읽기·쓰기 포함 입력 쪽 전체. 리포트의 "보낸 쪽/받은 쪽" 표시에 필요

// 기억 (docs/20-memory-design.md 부록 A 그대로)
init({ db, model })    // 앱이 프로세스당 1회 호출. db = 앱의 DatabaseSync, model = app/lib/model.js
retrieve({ user_id, conversation_id, query, budget_tokens }) → { text, items, attempts }
update({ user_id, conversation_id, turn_no, messages:[{role,text}] }) → { ops, attempts }
consolidate({ user_id, conversation_id }) → { ops, attempts }
list({ user_id }) → items
```

## 확인한 것 (2026-10-22)
- 실제 모델(claude-haiku-5-5) 연결 후 3턴: 응답·리포트·기억(이름, 선호, 에피소드 요약) 정상. next start / next dev 모두 동작.
- 리포트 tokens.input 은 캐시 안 된 입력만. 전체 입력 = input + cache_read + cache_write.
- 품질 관찰(미해결): 첫 대화인데 캐릭터가 없던 과거를 지어냄(kang: "어제도 국밥 얘기했었지"), 반말 설정인 캐릭터가 존댓말 사용(yuna).

### 가짜 모델 기준
- curl 10턴: 턴 비용이 6턴까지 증가 후 7턴부터 평평(최근 6턴 제한 동작). 구간·최대 턴 계산 정상.
- 종료된 대화에 전송 409, 없는 대화 404, 이름 없음 400.
- 조건 확인(가짜 모델): full 은 입력이 매 턴 증가, slide N=2·기억 off 는 3턴부터 평평하고 기억 호출 0, stair 최대 4·유지 2 는 4·6·8턴에 정리되고 창 시작이 계산대로 이동. force 전달 후 4·6·8턴 정리마다 추출 발생 확인.
- 기억 모듈 통합 후 `memory/scripts/run-scenario.mjs` 가 앱 API로 끝까지 실행됨. 가짜 모델이라 판정은 대부분 FAIL(예상).
- 미확인: 모델 실패 경로(가짜 모델이 실패하지 않음), 실제 토큰·비용, 캐시 히트.

## 열린 것
- 캐릭터 주입 방식, 캐시 최소 길이(1,024토큰 가능성) → 모델 세션
- 기억 갱신 빈도·예산 → 기억저장 세션(앱은 설정값만 받음)

## 대화 따르기(APP_FOLLOW) 수정 (2026-11-01, 사용자 지시)
- '먼저 답하기' 규칙에서 "캐릭터 화제는 그다음"을 뺐다 → 사용자 질문·부탁에 직접 답하고 사용자 화제를 이어 감. 캐릭터 화제는 사용자가 꺼낸 화제가 없을 때만.
- 언어 따르기: 답 언어를 코드가 정한다(`context.js` replyLang, AI 호출 없음). 이번 턴 사용자 말 끝에 `(이번 답 언어: …)` 한 줄을 붙이고, 규칙은 "그 줄의 언어 하나로, 지문까지, 섞지 않음".
  - 언어를 직접 요청하면 바로 전환('영어로 말해줘', '英語で話して', 'please speak English'). 한국어는 조사 '로/으로'가 있어야 요청('영어 얘기 그만'은 아님).
  - 다른 언어로 충분히 길면(라틴 4단어·한글/한자/가나 8글자 이상) 바로, 짧으면 같은 언어로 두 번 연속일 때 전환.
  - 판정 안 되는 말(ㅋㅋ·ok·이모지·숫자)은 무시. 다른 언어 단어가 몇 개 섞이면 다수(60%) 언어로 본다. 지문(*…*)은 판정에서 뺀다.
  - 대화 언어(conversations.language)에서 시작해 최근 창의 사용자 말 + 이번 말을 차례로 본다(상태 저장 없음).
- 단위 시험: 0원 22개 사례 통과(스크래치패드 langtest.mjs). 모델 실측(fl1 재측정)은 최종 구성 측정 때.
- 질문 연속 끊기(C안, 2026-11-01 사용자 결정): follow 에서 nudge 를 끄자 물음표로 끝난 답 5.6 → 64.1%, '질문이 부담스러움' 0.6 → 14.4%(fl1 3차 블라인드). 최근 3답 중 2답 이상이 (지문을 뺀) 대사 끝 물음표면 언어 줄에 " · 이번 답은 질문 없이 끝낸다"를 덧붙인다(`questionStreak`, AI 호출 없음). '한 답에 질문 여러 개'는 규칙의 "물음표 한 번"에 맡긴다. 효과는 fl1 재측정으로 확인.

### 2026-11-01: follow 6차 수정 — 질문 연속 끊기 강화·준호 'ㅋㅋ'
- 계기: 5차에서 '질문이 부담스러움' 8.4%(기준 ≤ 5%)·물음표 2개 이상 18.1%(기준 ≤ 7.8%) 미달. 프롬프트 문장("질문은 한 답에 한 문장만")은 효과가 없었고, 코드가 매 턴 붙이는 줄(언어 줄·C안)은 효과가 있었다. 사용자 결정 "개선해줘".
- `questionStreak`: 최근 3답 중 2답 → 직전 답의 대사(지문 뺀) 끝이 ?/？ 이면 이번 사용자 말 끝 언어 줄에 " · 이번 답은 질문 없이 끝낸다". AI 호출 0, follow on 일 때만.
- 준호 시트(follow on, 한국어 시트만 치환): "'ㅋㅋ'·'아 진짜'를 섞는다." → "가끔 … 섞는다(매 답에 넣지 않는다)." 끝맺기 규칙의 입버릇 예시에 'ㅋㅋ' 추가. 5차 준호 'ㅋㅋ' 33.8%.
- 단위 시험: 질문 연속 7개·언어 22개 통과. 6차 측정·판정 기준은 docs/50.
