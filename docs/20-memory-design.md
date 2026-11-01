# 기억저장 레이어 설계안 (조사 기반 초안)

작성: '기억저장' 세션, 2026-10-21. 2026-10-22 사용자 논의 후 확정 → `memory/` 구현 완료(단위 테스트 17개 통과). 아래 §3·§4 는 확정 내용으로 갱신됨.
범위: 과제가 요구하는 기억 니즈 정리 → 최근 사례(2025~2026) 조사 → 이 과제에 맞는 설계안 → 사용자와 정할 질문.
관련 문서: 과제 원문 `00-assignment.md`, 채팅앱 설계 `10-app-design.md` (§8 인터페이스 기대안).

---

## 1. 이 과제의 기억 니즈

과제(`00-assignment.md` §4)가 요구하는 것은 "모든 것을 기억"이 아니라 **최소한의 장기 기억**이며, 검증 항목은 4개다.

| # | 검증 항목 | 기억 레이어에 요구되는 능력 |
|---|---|---|
| M1 | 사용자 정보·선호를 다른 주제가 이어진 뒤에도 기억 | 최근 N턴 밖의 정보를 **저장**하고 **다시 꺼냄** |
| M2 | 캐릭터와 사용자 사이의 사건·약속을 이후 반영 | 사실뿐 아니라 **사건(에피소드)·약속**도 저장 |
| M3 | 사용자가 정보를 수정하면 옛 정보 대신 새 정보 반영 | **UPDATE(대체)** 가 가능해야 함. 단순 추가(append)만으로는 실패 |
| M4 | 대화에 없던 정보를 기억하는 척 지어내지 않음 | 기억마다 **출처(턴)** 가 있고, 기억에 없는 것은 "모른다"고 답하게 유도 |

여기에 과제 고유의 제약이 더해진다.

- **비용**: 기억 추출·검색·임베딩 호출 비용까지 모두 1턴 평균 1원 안에 포함. 즉 "매 턴 LLM 추출 + 임베딩 검색"처럼 호출이 많은 설계는 불리하다.
- **범위**: 대화(conversation)를 넘어 유지 (채팅앱 설계 §1). 사용자 1명(`demo`) 고정.
- **평가 사례**: "바로 앞 메시지만 읽어서는 통과 못 하는 사례"를 만들어야 하므로, 기억이 최근 N턴 창 **밖**에서 꺼내지는 것이 로그로 증명돼야 한다.
- **인프라**: 데모용(외부에서 3일 정도). 운영 규모의 검색 인프라는 불필요.

---

## 2. 최근 사례 조사 (2025~2026)

### 2.1 단기 기억(작업 기억)의 표준 패턴

| 패턴 | 사례 | 요점 |
|---|---|---|
| 최근 N턴 창 | 거의 모든 시스템 | 가장 싸고 단순. 창 밖은 잊는다. |
| 재귀 요약(rolling summary) | MemGPT/Letta 레거시: 창이 차면 대화를 재귀 요약해 메모리 블록에 저장 | 요약 호출 비용이 간헐적으로 발생. 수정(M3)·출처(M4)에 약함 — 요약은 옛 정보를 덮어쓰지 않고 섞일 수 있음 |
| 가벼운 연속성 | ChatGPT 무료 플랜(2025-06): "short-term continuity across conversations" 수준 | 무료 티어는 장기 이해 대신 가벼운 연속성만 제공 — 우리 '라이트 모드'와 같은 포지셔닝 |

2025년 12월 서베이("Memory in the Age of AI Agents", arXiv 2512.13564)는 **단기/장기 구분 자체가 불충분**하다고 보고, 기억을 *기능*(factual / experiential / working)과 *동역학*(formation / evolution / retrieval)으로 나눈다. 이 관점이 이 과제에 더 맞는다: M1은 factual, M2는 experiential, M3은 evolution(갱신), M4는 formation(무엇을 기억으로 만들지)의 문제다.

### 2.2 장기 기억의 대표 방식 5가지

| 방식 | 대표 사례 | 저장 형태 | 갱신 | 검색 | 비용 성격 |
|---|---|---|---|---|---|
| **A. 추출형 사실 목록** | Mem0(2025-04), ChatGPT "saved memories", LangMem collection | 원자적 사실 문장 리스트 | LLM이 유사 기억을 보고 ADD/UPDATE/DELETE/NOOP 결정 | 임베딩 유사도 | 추출 LLM 호출 + 임베딩 |
| **B. 프로필(단일 구조화 문서)** | Letta core memory blocks(라벨·설명·값, 글자 제한), LangMem profile | 하나의 JSON/텍스트 블록 | 블록 통째로 재작성 또는 필드 UPDATE | 검색 없음, **항상 주입** | 추출 호출만. 임베딩 0 |
| **C. 에피소드/시간 그래프** | Zep/Graphiti: 엣지마다 valid_from / invalid_at, 모순 시 **삭제 대신 무효화** | 그래프(Neo4j 등) | 시간 기반 무효화 | 그래프+임베딩+키워드 하이브리드 | 가장 무겁고 운영 복잡 |
| **D. 전체 기록 검색(RAG)** | ChatGPT "reference chat history", Letta recall memory | 원문 메시지 | 없음(append) | 임베딩/키워드 | 임베딩 비용 + 검색된 원문이 길어 입력 토큰 큼. 수정(M3)에 약함(옛 발화도 검색됨) |
| **E. 수동 고정** | Character.AI pinned(무료 15개/유료 30개) + "Chat Memories" 400자, Nomi shared notes | 사용자가 직접 고정 | 수동 | 항상 주입 | AI 비용 0이지만 과제 취지(자동 장기 기억)와 안 맞음 |

관찰:
- 상용 동반자 앱(Character.AI, Replika)은 **무료 티어에 수동 고정 + 소용량 메모리 필드**를 주고, 자동 추출은 유료다. 즉 "자동 추출은 비용이 든다"는 것을 상품 구조가 보여준다.
- Mem0 계열의 핵심은 추출이 아니라 **통합(consolidation)** 이다: 새 사실을 저장하기 전에 기존 유사 기억을 LLM에 같이 보여주고 ADD/UPDATE/DELETE/NOOP 중 하나를 고르게 한다. 이것이 M3(수정 반영)을 푸는 표준 방법이다.
- Zep의 "삭제 대신 무효화(invalidated_at)"는 M3·M4 둘 다에 유용하다: 옛 정보를 지우지 않고 `superseded` 로 남기면 "왜 이렇게 기억하나"를 로그로 설명할 수 있다. 그래프 DB 없이 **컬럼 두 개**로 흉내 낼 수 있다.
- 2026년 연구들은 Mem0의 약점으로 추출 JSON 파싱 실패(모델에 따라 약 25%)를 지적한다. 작은 모델로 추출할 때 **구조화 출력 실패 → 재시도 비용**을 설계에 넣어야 한다(과제도 실패 호출 비용 포함을 요구).

### 2.3 벡터 DB vs 일반 DB

| 질문 | 조사 결과 |
|---|---|
| 전용 벡터 DB가 필요한 규모 | 출처마다 다르나 공통적으로 **수백만 벡터 이상**, 또는 무거운 하이브리드 필터·멀티테넌트 격리가 필요할 때. 그 아래는 pgvector / sqlite-vec로 충분 |
| 사례들의 실제 저장소 | Letta: Postgres+pgvector. LangMem: LangGraph BaseStore(Postgres). Mem0: 벡터 스토어 + 선택적 그래프. Zep: Neo4j |
| 소규모 선택 기준 | "이미 쓰는 DB에 벡터 확장"이 운영 단순성에서 유리. SQLite 쪽은 sqlite-vec(코사인 중심) |

**이 과제 규모**: 사용자 1명, 데모 3일, 기억 아이템은 많아야 수십~수백 개. 기억 블록 예산이 400토큰이면 한 번에 주입 가능한 아이템이 15~25개 수준이다. 이 규모에서는 **"무엇을 검색할까"보다 "무엇을 남길까(통합·정리)"** 가 품질을 결정하며, 벡터 검색은 필요조건이 아니다.

### 2.4 비용-품질 벤치마크가 말하는 것 (LoCoMo, 벤더 보고 수치라 참고만)

| 접근 | 정확도 | 질의당 토큰 | 상대 비용 |
|---|---|---|---|
| 전체 기록을 그대로 넣기(full-context) | 87.5% | ~26,000 | 약 20배 |
| 압축 검색형(Memori, Zep, Mem0 등) | 62~82% (출처별 편차 큼) | 1,300~3,900 | 1배 |

→ full-context는 정확도는 가장 높지만 1원 제약에서 불가능하다(사용자의 이전 시뮬레이션: 전체 히스토리 방식 100턴 시 약 6원/턴). 압축형은 정확도를 5~10점 양보하고 토큰을 5~15%로 줄인다. 과제가 요구하는 "최소한의 기억"에는 압축형이 맞다.

---

## 3. 설계안: "프로필 + 사실 아이템 + 에피소드 요약, 벡터 검색은 miss 경로에서만"

> 2026-10-22 사용자 논의로 바뀐 점: (a) 사람 기억의 **구조**(작업/의미/에피소드 기억, 단서 회상)는 채택하고 **결함**(망각·왜곡·비싼 수면 통합)은 모방하지 않음. (b) 대화 종료 시 **에피소드 요약** 1개 추가(흐름·정서는 요약, 사실은 원자 아이템). (c) "기억 안 나?/전에 말했잖아" 신호 시 **원문 로그 깊은 검색**(임베딩+키워드) 추가 — 한국어는 키워드 매칭이 약해 임베딩이 유리. 임베딩 단가가 낮아 비용 영향은 미미(모델 세션 확정 예정). (d) 벡터 DB 는 별도 서버가 아니라 `memory_items.embedding` BLOB + 브루트포스 코사인(규모 커지면 sqlite-vec 교체). Docker 불필요.

### 3.1 선택 요약

**B(프로필) + A(추출형 아이템)의 결합. C(그래프)의 무효화 아이디어만 컬럼으로 차용. 검색은 예산 내 전체 주입으로 시작하고, 벡터 검색은 확장 지점으로만 남긴다.**

선택 이유:
1. **비용**: 임베딩 호출 0, 검색 호출 0. AI 비용은 추출 호출 하나뿐이고 그마저 게이트·배치로 빈도를 줄인다.
2. **M3(수정)**: 추출 시 현재 기억 전체(작으므로 가능)를 함께 주면 Mem0식 "유사 기억 비교"가 유사도 검색 없이 성립한다. UPDATE는 `superseded_by`로 옛 아이템을 무효화.
3. **M4(지어내기 방지)**: 모든 아이템에 `source_turn` 이 있어 "출처 없는 기억은 없다". 프롬프트 규칙으로 "기억 블록에 없는 과거는 모른다고 답함"을 강제.
4. **설명 가능성**: 평가자가 `GET /memory` 로 기억 목록·출처·대체 이력을 그대로 볼 수 있다. 벡터 유사도 점수보다 설득력 있다.
5. 포기한 것: 수백 개 이상 기억에서의 정밀 검색(데모 범위 밖), 시간 질의("3주 전에 뭐라고 했지")의 정확한 처리.

### 3.2 기억 계층

```
L0 작업 기억   최근 N턴(≈6)                         채팅앱 소유. 기억 레이어는 관여 안 함
L1 프로필      구조화 슬롯 (항상 주입, ≤ ~150토큰)     이름·호칭·직업·거주·핵심 선호·관계 상태
L2 아이템      원자 사실/사건/약속 목록 (예산 내 주입)   type ∈ fact | preference | event | promise
L3 원문 로그   messages 테이블                        채팅앱 소유. 데모에서는 검색하지 않음(출처 조회용)
```

- L1은 Letta core memory처럼 **슬롯 고정**이라 수정(M3)이 자연스럽다("직업: 학생 → 직장인"은 덮어쓰기).
- L2는 Mem0식 원자 문장. 하나의 아이템은 한 문장, 한 사실. 사건·약속(M2)은 `type` 으로 구분하고 날짜가 있으면 `when` 에 보관.

### 3.3 저장 스키마 (SQLite, 일반 DB만)

```sql
memory_profile(user_id, slot, value, source_turn, updated_at)        -- L1. PK(user_id, slot)
memory_items(
  id, user_id, type, text, when_text,
  source_conversation_id, source_turn,          -- M4: 출처 필수
  status,                                       -- active | superseded | deleted
  superseded_by, invalidated_at,                -- M3: 삭제 대신 무효화 (Zep 아이디어의 경량판)
  importance, last_used_turn, created_at
)
memory_ops_log(id, user_id, conversation_id, turn_no, op, item_id, reason, created_at)  -- 검증·리포트용
-- 확장 지점(지금은 만들지 않음): memory_items.embedding BLOB + sqlite-vec, 또는 FTS5 가상 테이블
```

- 파일은 채팅앱 `app/data/app.db` 와 **같은 파일**을 써도 되고(트랜잭션·배포 단순) 별도 파일이어도 된다. 제안: 같은 파일, 테이블 접두사 `memory_`.
- 벡터 DB·Docker 불필요. 사용자가 데모 인프라로 "docker로 db, vector db"를 고려했는데, **기억 레이어 관점에서는 둘 다 필수가 아니다.** 보여주기용으로 넣을 수는 있지만 1원 비용 근거에는 도움이 안 된다.

### 3.4 읽기: `retrieve` (검색 없이 예산 내 주입)

```
입력: user_id, conversation_id, query(현재 사용자 메시지), budget_tokens(≈400)
1. 프로필 슬롯 전부 → 블록 상단 (≈100~150토큰)
2. active 아이템을 점수순 정렬: importance 가중 + 최근성 + (선택) query와 키워드 겹침
3. 예산이 찰 때까지 담는다. 남은 예산이 없으면 끊는다.
4. 반환 text 예:
   ## 기억 (대화에서 확인된 것만. 여기 없는 과거는 모른다고 답할 것)
   - 사용자: 이름 민수, 직장인(2026-10-19 수정), 매운 음식 싫어함
   - 사건: 10/18 면접 봤고 결과 기다리는 중 (대화 A, 7턴)
   - 약속: 결과 나오면 제일 먼저 알려주기로 함 (대화 A, 9턴)
attempts: []   ← AI 호출 없음
```

- AI 호출이 없으므로 `attempts` 는 빈 배열. 비용 0, 지연 ~ms.
- 아이템이 예산을 넘기 시작하면(데모에서는 거의 없음) 2단계 확장: FTS5 키워드 → 그래도 부족하면 임베딩. 이때부터 `retrieve` 에 임베딩 비용이 생긴다. 확장 시점과 비용은 문서에 "미검증·확장안"으로 분리 표기.

### 3.5 쓰기: `update` (게이트 + 배치 추출 + 통합)

```
입력: user_id, conversation_id, turn_no, messages(최근 K턴)
0. 게이트(AI 호출 없음): 아래 중 하나면 추출 후보
   - 사용자 메시지에 1인칭 정보/선호 신호 ("나는", "내가", "좋아해", "싫어해", "요즘")
   - 수정 신호 ("아니", "사실은", "이제", "바뀌었", "말고")
   - 약속/사건 신호 ("하기로", "약속", "다음에", "내일", 날짜 표현)
   - 사용자 메시지 길이 ≥ 임계(예: 20자)
   - 마지막 추출 이후 K턴(예: 3) 경과  ← 게이트를 놓쳐도 최대 K턴 안에 잡힘
1. 추출 호출 1회 (모델 레이어 purpose:'extract', tag:'extract', turn_no 태깅)
   입력 = 지시문(~300) + 현재 프로필·active 아이템(≤400) + 최근 K턴(~360) ≈ 1,000~1,100 토큰
   출력 = JSON ops ≤ ~100 토큰
     [{op:'ADD', type:'fact', text:'...', source_turn:12},
      {op:'UPDATE', item_id:7, text:'...', source_turn:12},
      {op:'NONE'}]
2. 적용: ADD → insert / UPDATE → 옛 아이템 status=superseded, superseded_by=new / 프로필 슬롯은 덮어쓰기
3. 파싱 실패 시 재시도 1회(비용은 attempts에 그대로 기록). 2회 실패면 NONE 처리하고 로그.
4. 대화 종료(/end) 시 통합 호출 1회(선택): 중복·모순 정리, 아이템 수 상한(예: 60) 유지
```

추출 지시문의 M4 장치: "대화에 **명시적으로** 나온 것만. 추론·일반화 금지. 캐릭터가 한 말은 사용자 정보로 저장하지 않음. 불확실하면 NONE."

### 3.6 비용 가정 (모델 단가 확정 전, 토큰 수만)

| 항목 | 호출당 | 빈도 가정 | 턴당 환산 |
|---|---|---|---|
| retrieve | 0 | 매 턴 | 0 |
| extract | 입력 ~1,050 / 출력 ~80 | 턴의 약 1/3 (게이트 통과율 + K=3 상한) | 입력 ~350 / 출력 ~27 |
| 재시도 | 동일 | 추출의 ~5% (가정) | 입력 ~18 / 출력 ~1 |
| 종료 통합 | 입력 ~900 / 출력 ~150 | 대화당 1회 (30턴 가정) | 입력 ~30 / 출력 ~5 |
| 임베딩 | 0 | — | 0 |
| **합계** | | | **입력 ≈ 400 / 출력 ≈ 33 토큰/턴** |

응답 호출의 기억 블록(≤400 입력 토큰/턴. 실측 3 참고: 당시 추정기 기준이며 실제 토큰으로는 ≈650)은 채팅앱 입력 예산에 이미 포함되어 있다.
→ 모델 세션에 전달할 숫자: **추출 1회 입력 ~1,050 / 출력 ~80, 빈도 ~1/3턴, 재시도율 5% 가정, 임베딩 0.**
모든 수치는 가정이며 실측 usage로 대체한다(과제: 실측·추정 구분).

**실측 (2026-10-22, claude-haiku-5-5 추출·응답, gemini-embedding-001 임베딩, `memory/scripts/run-direct.mjs` 40턴):**

| 항목 | 호출당 실측 | 빈도 실측 | 턴당 원 |
|---|---|---|---|
| retrieve | AI 0회 | 매 턴 | 0 |
| extract | 입력 ~1,175(그중 ~810 캐시 읽기) / 출력 ~43 | 17/40턴 = 43% | 0.040 |
| 재시도(파싱 실패) | — | 0/17 (JSON 모드) | 0 |
| 종료 통합 | 입력 ~1,075 / 출력 ~156 | 대화당 1회 | 0.026 (10턴 대화) |
| 임베딩 | 아이템 색인 ~25토큰, deep search ~160토큰 | 아이템 추가 시·miss 턴만 | 0.003 |
| **합계** | | | **≈0.07원/턴** (응답 호출 제외) |

**실측 2 (같은 날, 정보가 촘촘한 40턴 벤치 대본 yuna-40, `memory/scripts/run-bench-direct.mjs`):** 첫 측정에서 추출이 턴당 0.57원으로 1원을 위협했다. 원인은 매 턴 최근 6턴 전체를 추출기에 다시 보여 같은 정보를 반복 ADD 하고(항목·입력·출력 모두 증가), 출력이 400토큰에서 잘려 재시도까지 발생한 것. 수정: 마지막 추출 이후 새 턴만 추출(문맥 1턴), 기존 항목은 관련 상위 20개, 잘리면 max_tokens 2배로 재시도, stair 묶음은 3턴씩 분할, 종료 요약 입력 상한. 결과 slide 추출 0.21원/턴(전체 0.58), stair 0.09원/턴(전체 0.47), 잘림 0, 수정·철회 정보 모두 반영(상세는 memory/README.md 실측 2).

가정 대비: 추출 빈도는 1/3 → 43%로 높음(3턴 안전망 `interval`이 대부분, 그 2/3가 빈 결과). 입력은 ~1,050 → ~1,175로 근접, 출력은 80 → 43으로 적음. 재시도는 0. 과제 M1~M4는 단독 경로·채팅앱 경로 모두 17/17 PASS. 채팅앱 경로 턴당 전체 AI 비용 평균 0.30원(최대 0.56원).

**실측 4 (2026-10-23, 앱 경유 결과 재판독):** 모델 세션 stair v4/v5 의 미채점 응답을 직접 읽은 결과 kang 4~5문항·yuna 1문항이 예산(650)에서 밀린 항목 때문에 "기억 없음"으로 실패했다. 활성 항목 전체는 603~872토큰이고, stair 는 정리 턴 질의로 만든 블록을 6턴 재사용해 질의 가중이 무력하다. 기억저장 단독 벤치의 "11/11"은 매 턴 질의 기반 retrieve 를 호출해 앱과 달랐으므로 공식 수치에서 제외한다. 수정: 블록 머리말을 앱 RULES 로 이동, 예산 1,000(추정 +0.015원/턴), 항목 임베딩 끔, when 절대 날짜화·약속 닫기, 이월 묶음 출처 기록, 토큰 계수 보정, lang 수신. 상세 `memory/README.md` 실측 4, 공유 목록 `docs/40-bug-review.md`.

**실측 5 (2026-10-23, 재측정 r1 8런 대조 → 보강):** 예산 1,000 이후 30개 정리 턴 예산 탈락 0. 남은 실패는 전부 추출 누락(사용자 선호·사용자 약속), 1원 초과 턴 2건은 전부 추출 출력 잘림 재시도. 콜드 캐시 비용은 토큰 사용량에서 계산식으로 정확히 나와(실측 구조 일치) 대기 측정을 대체했고, 정리 크기는 12/6 유지(9/3 은 평균 +14~34%, 콜드 최고 1.34→0.92). 보강: 항목 정규화 코드 강제(절단·취소→fact·사소한 약속 폐기), 사건·약속 근사 중복 → UPDATE, 날짜 환산을 모델에서 코드(`memory/dates.js`)로 이동(모델 환산 5회 중 2회 오류), `extractMaxTokens` 600, end_flush 6턴 조각. 추출 재현율 5회 반복 11/11. 상세 `memory/README.md` 보강 절, `docs/40-bug-review.md`.

**실측 3 (같은 날, 토큰 추정 보정):** 토큰 추정(글자수/1.5)이 한국어를 35~45% 과소 추정하고 있었다(Anthropic count_tokens 실측: 한글 음절 ≈1.45토큰, 그 외 문자 ≈0.4토큰). 따라서 위 "기억 블록 ≤400 토큰"은 실제로는 ≈650토큰이었고, 종료 요약 입력 상한도 실제로는 넘겨졌다. 기억 레이어는 보정 추정기(`memory/tokens.js`)로 바꿨고, **블록 예산은 실제 토큰 650** 으로 읽어야 같은 내용이 들어간다(채팅앱 memory_budget_tokens 400 → 650). 아울러 추출 시스템 프롬프트 1,488 → 1,264토큰, 항목 길이 30자 안팎, 블록 선별에 시점(when)·약속 질의 가중, 캐릭터 발화는 약속 신호가 있는 줄만 길게. 재측정(stair, 예산 650, 응답 캐시 없는 단독 실행): yuna-40 0.40원/턴(추출 0.077), kang-40 0.35원/턴(추출 0.066), 자동판정 probe 모두 11/11. stair 정리 턴은 추출 2조각이 한 턴에 몰려 추출만 0.4~0.75원(앱 경유 최고 ≈0.9원/턴). 평균 1원 기준은 충족하며, 최고치를 더 낮추려면 앱이 3턴마다 3턴을 넘겨 조각을 1개로 만드는 선택지가 있다(채팅앱 결정 사항).

### 3.7 대안 비교 (왜 이것을 골랐나)

| 대안 | 턴당 AI 비용 경향 | M1 | M2 | M3 수정 | M4 지어내기 | 판단 |
|---|---|---|---|---|---|---|
| 전체 히스토리 주입 | 턴 수에 비례해 증가(100턴 ≈ 6원) | ◎ | ◎ | △(옛 발화도 남음) | ○ | 비용 불가 |
| 롤링 요약만 | 요약 호출 간헐적, 낮음 | ○ | ○ | ✕(요약에 섞임) | △(요약이 윤색) | M3 취약 |
| 원문 RAG(임베딩 검색) | 임베딩 매 턴 + 검색 원문 길이 | ○ | ○ | ✕(옛 발화 검색됨) | ○ | M3 취약, 임베딩 비용 |
| **프로필+아이템(선택안)** | 추출만, 게이트·배치 | ○ | ○ | ◎ | ◎(출처 필수) | **채택** |
| 시간 그래프(Zep류) | 추출+그래프+임베딩, 가장 높음 | ◎ | ◎ | ◎ | ◎ | 데모·1원에 과함 |

### 3.8 인터페이스 (채팅앱 §8 기대안에 맞춤, Node 22 ESM, `memory/` 디렉터리)

```js
memory.retrieve({ user_id, conversation_id, query, budget_tokens })
  → { text, items: [{id,type,text,source_turn}], attempts: [] }
memory.update({ user_id, conversation_id, turn_no, messages })
  → { ops: [{op,type,item_id?,text?,source_turn}], skipped?: 'gate'|'interval', attempts: [...] }
memory.consolidate({ user_id, conversation_id })      // /end 시 선택 호출
  → { ops, attempts }
memory.list({ user_id, include_superseded = false }) → items   // GET /memory
```

---

## 3.9 구현 메모 (memory/, 2026-10-22)

- 파일: `index.js`(retrieve/update/consolidate/list), `policy.js`(호출 시점 한 곳에서 조정 — 모델 세션 요청), `gate.js`(추출 게이트·miss 신호·키워드), `prompts.js`, `store.js`, `schema.js`, `vector.js`, `fake-model.js`(테스트용), `test/`, `scripts/run-scenario.mjs`(M1~M4 검증 실행·실측 저장).
- retrieve 블록은 예산 안이면 **id 순 결정적** → 기억이 안 바뀐 동안 바이트 동일(프롬프트 캐시 친화). 넘치면 중요도·최근성·질의의 드문 키워드로 선별. `retrieveMode:'on_change'` 면 기억 버전이 같을 때 이전 블록을 그대로 재사용.
- 깊은 검색은 현재 턴과 같은 대화의 최근 6턴을 제외하고, 결과를 그 턴에만 주입하며 다음 update 의 추출 입력에 "과거 대화 발췌"로 넘겨 기억으로 승격시킨다.
- 추출 실패(JSON 깨짐·호출 실패)는 1회 재시도 후 NONE. 실패 시도도 attempts 에 남아 비용에 포함.
- 활성 아이템 상한 80개 초과 시 중요도·사용횟수 낮은 것부터 archived(삭제 아님).

## 4. 결정 사항 (2026-10-22 확정)

| 항목 | 결정 |
|---|---|
| 추출 빈도 | 게이트(1인칭 정보·수정·약속 신호) 통과 시 즉시 + 마지막 추출 후 3턴 상한. `policy.extractEveryTurns` 로 조정 |
| 기억 블록 예산 | 400 토큰 유지 (호출 인자 우선) |
| 벡터 검색 | 포함. 같은 SQLite 파일, 별도 서버 없음. miss 턴과 아이템 저장 시에만 임베딩 호출 |
| 캐릭터 측 기억 | 저장. `type: promise | event` |
| 종료 시 통합 | 포함. 에피소드 요약 1개 + 중복 병합. 2턴 미만 대화는 생략 |
| 망각 규칙 | 시간 감쇠 없음. 활성 80개 상한만(archived, 삭제 아님). 삭제 대신 superseded 무효화 |

### 4.1 남은 쟁점 (모델 세션 예고, 미확정)
- 응답 호출 프롬프트 캐시 최소 길이(1,024 또는 4,096)에 따라 "계단식 창(12턴 append → 6턴 정리 시점에만 extract+retrieve)" 대안이 유리할 수 있음. `policy.extractEveryTurns` 와 `retrieveMode` 만 바꾸면 되도록 구성해 둠. 실제 모델 캐시 조건 확인 후 결정.

## (참고) 논의 전 질문 목록

1. **추출 빈도**: 게이트 + K=3턴 상한(제안) vs 매 턴 vs 종료 시 한 번. 매 턴이면 추출 비용 3배, 종료 시만이면 같은 대화 안의 M1·M2 검증이 약해짐.
2. **기억 블록 예산 400토큰** 유지 여부. 줄이면 응답 입력이 싸지고, 아이템 선별 로직이 더 중요해짐.
3. **벡터 검색을 데모에 넣을지**: 비용 근거에는 불필요. 다만 "확장 시 이렇게 된다"를 보여주기 위해 sqlite-vec 옵션을 코드로 두되 기본 off로 할지, 문서로만 남길지.
4. **캐릭터 쪽 기억**: 사용자 정보만 저장할지, 캐릭터가 한 약속·관계 상태(M2)도 아이템으로 저장할지(제안: 저장. `type:promise|event` 로 구분).
5. **종료 시 통합 호출**: 넣을지(아이템 정리·중복 제거, 대화당 1회 비용) 뺄지.
6. **아이템 상한과 망각 규칙**: 예: active 60개 초과 시 importance·last_used 기준으로 archived. 과제가 "무엇을 중요하게, 얼마나 오래"를 직접 정의하라고 했으므로 여기서 명문화.

---

## 5. 출처 (조회일 2026-10-21)

- Mem0 논문 초록: https://arxiv.org/abs/2504.19413 (full-context 대비 토큰 비용 90%↓, p95 지연 91%↓ 주장)
- Mem0 아키텍처 해설(2차): https://medium.com/@zeng.m.c22381/mem0-overall-architecture-and-principles-8edab6bc6dc4
- Mem0 추출 JSON 실패율 지적(2026 연구): https://arxiv.org/pdf/2606.15903 , https://arxiv.org/pdf/2609.10413
- LangMem(semantic/episodic/procedural, profile vs collection): https://blog.langchain.com/langmem-sdk-launch
- Letta/MemGPT(core·recall·archival, 재귀 요약): https://docs.letta.com/guides/agents/architectures/memgpt , https://docs.letta.com/guides/legacy/memgpt-agents-legacy
- Zep/Graphiti 시간 그래프·무효화: https://blog.getzep.com/beyond-static-knowledge-graphs/ , https://help.getzep.com/zep-vs-graphiti , https://pypi.org/project/graphiti-core/0.29.3/
- 서베이 "Memory in the Age of AI Agents"(2025-12): https://arxiv.org/abs/2512.13564 ; 그래프 관점 서베이(2026-02): https://www.arxiv.org/abs/2602.05665
- ChatGPT 메모리(saved memories / chat history, 무료 티어는 경량): https://help.openai.com/en/articles/11146739-how-does-reference-saved-memories-work , https://openai.com/index/memory-and-new-controls-for-chatgpt/
- 동반자 앱 메모리 상품 구조(Character.AI pinned 15/30, 400자 등, 2차 출처): https://www.indiehackers.com/post/every-ai-companion-app-advertises-memory-i-checked-five-and-not-one-publishes-a-number-bc332bffb1 , https://cave.co.nl/blog/ai-companion-apps-with-memory/
- Mem0의 동반자 앱 가이드(사용자 기억/캐릭터 기억 분리, run_id 단기 컨텍스트): https://mem0.ai/blog/how-to-add-long-term-memory-to-ai-companions-a-step-by-step-guide
- pgvector vs 전용 벡터 DB 임계: https://dev.to/aditigroverexperts/postgresql-pgvector-vs-standalone-vector-database-a-cost-comparison-for-production-ai-applications-57c9 , https://dev.to/jonbiz/implementing-a-rag-system-inside-an-rdbms-sqlite-and-postgres-with-sqlite-vec-pgvector-4d5h
- LoCoMo 비용·정확도 비교(벤더 보고, 방법론 논쟁 있음): https://www.memorilabs.ai/blog/memori-locomo-paper-results/ , https://mem0.ai/blog/zep-vs-mem0-which-ai-memory-layer-should-you-choose

주의: 벤치마크 수치는 대부분 벤더 자체 보고이며 Mem0 LoCoMo 점수는 출처에 따라 62~92%로 크게 다르다. 본 문서는 "full-context가 가장 정확하지만 20배 비싸다"는 공통 패턴만 근거로 쓴다.

---

## 부록 A. 채팅앱 측 확정 사항 (2026-10-22, '채팅앱' 세션 통보)

- `user_id` = 사용자가 입력한 이름 문자열. 같은 이름이면 기억 공유, 다른 이름이면 다른 사용자. 인증 없음. (단일 사용자 전제 폐기)
- 호출은 **매 턴 동기**: `retrieve({user_id, conversation_id, query, budget_tokens:400})` → 응답 생성 → `update({user_id, conversation_id, turn_no, messages})`.
- `update.messages` = 최근 6턴 + 현재 턴, `[{role:'user'|'assistant', text}]`.
- `/end` 시 `consolidate({user_id, conversation_id})` 1회, 비용은 `turn_no 0`(대화 단위)으로 기록.
- `attempts` 는 모델 레이어 attempt 형식 그대로. 시도마다 `tag` 가 있으면 그 태그로, 없으면 retrieve/extract/consolidate 로 기록.
- `GET /api/memory?user=<이름>` 이 `list({user_id})` 를 그대로 반환.
- 저장은 `app/data/app.db` 공유, 테이블 접두사 `memory_`.
- 현재 `app/lib/memory.js` 는 아무것도 기억하지 않는 가짜(stub). 실제 모듈이 나오면 re-export 로 교체.

기억 레이어 영향: 사용자가 여러 명이므로 모든 테이블에 `user_id` 가 키에 들어가야 하고(이미 스키마에 반영), 깊은 검색(miss 시 원문 로그 조회)도 `user_id` 로 한정한다.

## 구조 재설계 (2026-10-24, 사용자 결정: 단어 겹침 휴리스틱 제거)

**왜:** 항목이 자연어 text 한 줄뿐이어서 정정·이름 전파·딸린 약속·근사 중복·꺼내기 선별을 gate.js `keywords()`(공백 split + 한국어 조사 제거) 겹침으로 추측했다. zh/ja 에서는 문장 전체가 토큰 1개가 되어 무력(B5)하고, 한국어에서도 같은 원인의 버그가 반복됐다(B41 고양/고양이, B42 달린다/달리기, B33 id 오지목 방어). 사용자가 설계 실수로 보고 "언어와 무관한 데이터 구조"로 고치기로 결정.

**항목 구조:** `memory_items` 에 `slot`("<대상>.<속성>" 영어 고정 키: 대상 user|pet|family|friend|partner|colleague|character|event|promise|other, 속성 name|job|location|age|allergy|health|diet|like|dislike|hobby|routine|skill|status|plan|promise|relation|other), `entity`(같은 대상 묶음 라벨: user, character, pet#1, family#1, event#2, promise#3), `depends_on`(딸린 항목 id JSON 배열), `value`(*.name 슬롯의 이름 값) 컬럼 추가. text 는 원어 표시용으로 유지. 추출기 출력에 네 필드와 `closed`(취소·이행) 를 요구하고, 코드가 `normStruct` 로 어휘 밖 값을 정규화한다(other 로 흡수, 대상 생략은 type 으로 보정, entity 소문자 `<대상>#n`). 프로필 슬롯 키도 영어(name, nickname, job, location, age, relation)로 바꾸고 표시 라벨만 언어별. init 때 기존 DB 를 마이그레이션(컬럼 추가 + 프로필 키 변환, 멱등).

**휴리스틱 → 구조 치환표**

| 전 | 후 |
|---|---|
| UPDATE 안전 규칙(내용어 겹침 0 이면 차단, 출처 발화 겹침 근거) | id 가 가리키는 항목의 slot·entity 가 op 와 같으면 UPDATE. 다르면 같은 slot+entity 활성 항목이 하나뿐일 때만 그쪽으로(UPDATE_RETARGET), 아니면 UPDATE_SKIPPED → ADD. 구조 없는 옛 항목은 id 를 믿는다 |
| nearDuplicate(키워드 60% 겹침, event/promise ADD→UPDATE) | 같은 entity(event#N/promise#N)의 ADD 는 그 항목의 UPDATE. 값이 하나뿐인 속성(name·job·location·age·diet·relation·status·plan·promise)도 같은 slot+entity 면 UPDATE |
| propagateRename(바뀐 토큰 한 쌍 추정 → 문자열 치환) | *.name 항목의 value 가 바뀌면 옛 value 문자열을 품은 활성 항목을 새 value 로 치환(PROPAGATE). 어떤 토큰이 이름인지 추측하지 않음 |
| closeDependents(같은 날짜/시점) + closeByRemovedKeywords(사라진 드문 키워드) | 사건·약속이 fact 로 닫히면 depends_on 으로 그 항목(또는 그 항목으로 대체된 옛 id 계보)을 가리키는 활성 항목을 닫는다 |
| 에피소드 옛 이름(superseded 전용 이름꼴 토큰 추정, renamePairs) | 이름 슬롯 이력 `nameHistory`(superseded value → 활성 value) 그대로 |
| 블록 선별(질의 키워드 희소도 가중) | 중요도·최근성·정정 결과·열린 사건/약속·이름 슬롯 가중만(질의 무관 → 블록이 질의에 따라 흔들리지 않아 캐시에도 유리). 예산 1000 에서 40턴 대본은 전부 들어가므로 안전망 |
| relevantItems(새 턴 키워드 겹침 우선) | 이름 슬롯·열린 사건/약속 고정 + 최근순 |
| CLOSED 과거형 정규식(ko) | 구조 필드 closed 우선. 정규식은 구조 없는 출력에만 보조(실측: "만나기로 했으나 일요일로 미뤘다"의 "했으나"를 닫힘으로 오판) |

**남긴 언어 의존 코드(별도 승인 대기):** gate.js 의 추출 게이트·miss 신호·CHAR_PROMISE(한국어 정규식), composePromise(한국어 약속 주어 합성, ko 에서만 호출), profileNameOk(ko 에서만; 다른 언어는 "발화에 값이 있는가"만), 깊은 검색의 키워드 점수(임베딩 없는 모델일 때 fallback), dates.js(한국어 시점 표현). 추출기 출력 text 는 대화 언어로 쓰므로 블록은 언어 무관.

**실측(2026-10-24, naruto nc7 1~18턴 입력, 3묶음 6호출):** 시스템 프롬프트 1,701 → 2,131토큰(count_tokens, 캐시 접두). 추출 출력 1,717~1,972토큰(이전 1,249~1,780), 묶음 비용 2.57~2.98원(이전 같은 입력 5회 평균 2.22원, 약 +25%, n=3). 구조 필드 누락 0/14 × 3회. 같은 입력에서 이름 변경 PROPAGATE(하늘이→보리가 약속 텍스트에 반영), depends_on 사용(약속→사건 id), 취소 UPDATE 모두 정상. 전체 턴 비용 영향은 벤치 재측정으로 확인(추정 +0.02원/턴).
