// 기억 레이어의 "언제" 를 한 곳에서 바꾼다. (모델 세션 요청: 캐시 전략 확정 전까지 호출 시점을 한 곳에서 조정)
// init({ policy: {...} }) 또는 환경변수로 덮어쓸 수 있다.
export const DEFAULT_POLICY = {
  // --- update (추출) 시점 ---
  extractEveryTurns: 3,        // 마지막 추출 후 이 턴 수가 지나면 게이트와 무관하게 추출
  gateEnabled: true,           // 1인칭 정보·수정·약속 신호가 있으면 즉시 추출
  minUserChars: 8,             // 이보다 짧은 사용자 메시지는 게이트 통과 불가 ("응", "ㅋㅋ")
  extractRetries: 1,           // JSON 파싱 실패 시 재시도 횟수
  extractMaxTokens: 600,         // 3턴 조각 출력 상한. 400 은 r1 벤치에서 잘림 재시도(잘린 호출 0.5원 순손실)를 냈다
  extractItemsMax: 20,          // 추출 프롬프트에 보여주는 기존 항목 수(새 턴과 겹치는 것 우선)
  extractChunkTurns: 3,         // 한 번에 추출할 새 턴 수 상한. 넘으면(stair 정리 묶음 등) 이만큼씩 나눠 순차 추출
  extractFlushChunkTurns: 6,    // 종료 정리(reason 'end_flush') 묶음의 조각 크기. 남은 창 ≤11턴 → 2조각
  extractContextTurns: 1,       // 새 턴 앞에 문맥으로 붙이는 이전 턴 수(추출 대상 아님)
  extractAssistantChars: 160,   // 추출 프롬프트에서 캐릭터 발화 길이 — 약속·제안 신호(gate.CHAR_PROMISE)가 있는 줄
  extractAssistantPlainChars: 90, // 신호가 없는 캐릭터 발화 길이(지시 대상 파악용. 사용자 정보는 사용자 발화에서 나온다)
  extractContextAssistantChars: 60, // 문맥용 이전 턴의 캐릭터 발화 길이(지시 대상 파악용이라 짧게)
  indexItemEmbeddings: false,   // 새 항목 임베딩 저장. 읽는 곳이 없어(블록 선별은 키워드) 기본 끔 — 쓰지 않는 비용은 0 으로. 벡터 선별을 켤 때 true

  // --- retrieve (조회) 시점 ---
  // 'every_turn' : 매 턴 현재 기억으로 블록 생성 (예산 안이면 기억이 안 바뀐 동안 바이트 동일 → 캐시 유지 가능)
  // 'on_change'  : 마지막 추출 이후 기억이 바뀌지 않았으면 이전 블록 텍스트를 그대로 재사용 (deep search 신호 있을 때만 예외)
  retrieveMode: 'every_turn',
  budgetTokens: 400,           // 호출 인자가 우선. 없을 때 기본값
  budgetOverride: false,       // true 면 호출 인자보다 policy.budgetTokens 를 우선 (벤치용 MEMORY_BUDGET_TOKENS)
  maxEpisodes: 2,              // 블록에 넣는 최근 에피소드 요약 수
  deepSearchEnabled: true,     // "기억 안 나?/전에 말했잖아" 신호 시 원문 로그 검색
  deepSearchExtraTokens: 150,  // 깊은 검색 결과에 허용하는 추가 예산
  deepSearchTopK: 3,
  deepSearchCandidateLimit: 200,
  embedCooldownMs: 2 * 60 * 1000,  // 임베딩 429/quota 실패 뒤 이 시간 동안은 임베딩 없이 키워드 검색. nc9 의 429 는 분 단위 한도(약 5분)였으므로 짧게 — 길면 벤치의 다음 런까지 키워드로 떨어진다

  // --- consolidate ---
  consolidateMinTurns: 2,      // 이보다 짧은 대화는 요약 호출 생략
  consolidateMaxTokens: 500,
  consolidateInputTokens: 2500, // 종료 요약 입력(대화 부분) 상한. 넘으면 캐릭터 발화부터 줄인다
  maxActiveItems: 80,          // 초과 시 오래 안 쓰인 아이템을 archived 로 (삭제 아님). v2 에서 archived 는 보충·추출 입력·원문 검색 후보로 남는다

  // --- v2 (2026-11-01 장기 기억 재설계, docs/21 §3) ---
  memoryMode: 'v2',            // 'v2' 임베딩 기반(고정부 + 질문 보충) / 'v1' 이전 동작(전부 주입 + bigram 보충 + miss 신호 깊은 검색)
  embedProvider: 'auto',       // 'local'(서버 안 bge-m3 int8) / 'model'(model.embed API) / 'off' / 'auto'(local 패키지가 있으면 local, 없으면 model, 둘 다 없으면 off)
  embedModelId: 'Xenova/bge-m3', embedDtype: 'q8', // docs/21 §2 비교로 선택. 바꾸면 embed_model 이 달라져 전부 재임베딩된다
  fixedBudgetTokens: 2000,     // 블록 고정부(캐시 접두사) 예산. 호출 인자 budget 보다 크면 budget 으로 깎인다. 800 은 120턴에서 넘쳐 제약·선호가 떨어졌다(lt7 2026-11-01) → v1 과 같은 2000
  recallTokens: 200,           // 질문 보충(사용자 메시지 뒤) 예산
  // 보정(2026-11-01, bge-m3 int8, 실제 런 항목 145문항 vs 잡담 212턴): 질문→항목 코사인은 0.44~0.70 에 몰려 절대 임계값만으로는 되묻기와 잡담을 못 가른다
  // (0.45: 근거 통과 83%·잡담 끌어옴 99%, 0.55: 48%·53%). 그래서 하한 0.45 + 상위 K + "최고점에서 margin 안쪽만" 으로 턴당 토큰을 묶는다. 실제 토큰·정답은 §6 측정으로 본다.
  recallTopK: 3, recallThreshold: 0.45, recallMargin: 0.10,
  excerptTokens: 150, excerptTopK: 3, excerptThreshold: 0.45, // 원문 발췌: 되묻기 신호(ko 정규식) 또는 시점 표현이 있을 때만, 전체 이력에서
  extractSimilarK: 10,         // 추출 입력에 넣는 "새 턴과 가까운 항목" 수(활성·보관)
  dupThreshold: 0.80,          // 종료 정리 때 중복·모순 후보로 보는 유사도(같은 사실 쌍 p50 .76 근방)
  recentPinTurns: 12,          // 고정부에 넣는 "최근 N턴 안에 저장·정정된 항목"
  reindexPerCall: 32,          // 호출 1회당 뒤늦게 채우는 임베딩 수(마이그레이션·모델 교체 뒤 점진 채움)
};

export function resolvePolicy(overrides = {}) {
  const env = process.env;
  const p = { ...DEFAULT_POLICY, ...overrides };
  if (env.MEMORY_EXTRACT_EVERY_TURNS) p.extractEveryTurns = Number(env.MEMORY_EXTRACT_EVERY_TURNS);
  if (env.MEMORY_GATE_ENABLED) p.gateEnabled = env.MEMORY_GATE_ENABLED !== '0';
  if (env.MEMORY_RETRIEVE_MODE) p.retrieveMode = env.MEMORY_RETRIEVE_MODE;
  if (env.MEMORY_DEEP_SEARCH) p.deepSearchEnabled = env.MEMORY_DEEP_SEARCH !== '0';
  if (env.MEMORY_MAX_EPISODES) p.maxEpisodes = Number(env.MEMORY_MAX_EPISODES);
  if (env.MEMORY_BUDGET_TOKENS) { p.budgetTokens = Number(env.MEMORY_BUDGET_TOKENS); p.budgetOverride = true; }
  if (env.MEMORY_MODE) p.memoryMode = env.MEMORY_MODE;
  if (env.MEMORY_EMBED) p.embedProvider = env.MEMORY_EMBED; // local|model|off|auto
  if (env.MEMORY_FIXED_BUDGET) p.fixedBudgetTokens = Number(env.MEMORY_FIXED_BUDGET);
  if (env.MEMORY_RECALL_TOKENS) p.recallTokens = Number(env.MEMORY_RECALL_TOKENS);
  return p;
}
