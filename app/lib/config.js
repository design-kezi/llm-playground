// 벤치 조건 전환용 설정. 프로세스 시작 시 환경변수에서 1회 읽는다. (docs/30-bench-design.md §3.1)
const env = process.env;
const pick = (name, allowed, def) => {
  const v = env[name] ?? def;
  if (!allowed.includes(v)) throw new Error(`${name}=${v} — 허용값: ${allowed.join('|')}`);
  return v;
};
const int = (name, def) => {
  const v = Number(env[name] ?? def);
  if (!Number.isInteger(v) || v < 1) throw new Error(`${name}=${env[name]} — 양의 정수여야 함`);
  return v;
};

export const config = Object.freeze({
  window_mode: pick('APP_WINDOW_MODE', ['full', 'slide', 'stair'], 'stair'),
  recent_turns: int('APP_RECENT_TURNS', 6),
  stair_max: int('APP_STAIR_MAX', 12),
  memory: pick('APP_MEMORY', ['on', 'off'], 'on'),
  character_variant: pick('APP_CHARACTER_VARIANT', ['full', 'short'], 'full'),
  max_tokens: int('APP_MAX_TOKENS', 2000), // 대화 모델 추론 켬(deepseek-on) 기본: 추론 토큰 포함 출력 한도. 사전 점검에서 300 은 잘림(docs/50)
  memory_budget_tokens: int('APP_MEMORY_BUDGET', 2000), // 개선판(v2-dsx) 채택. lt1 은 1000 (120턴 활성 항목 중앙값 1,839토큰, docs/50 2026-11-01)
  recall: pick('APP_RECALL', ['on', 'off'], 'on'), // 블록에 없는 기억 중 이번 발화와 겹치는 것을 그 턴에만 덧붙임(memory.recall)
  reply_style: pick('APP_REPLY_STYLE', ['v1', 'v2'], 'v2'), // v2: 대사 2~4문장 + 캐릭터 자신의 반응 하나 이상(lt1 deepseek-on 답이 짧음)
  follow: pick('APP_FOLLOW', ['on', 'off'], 'on'), // 사용자 말에 먼저 답하기 + 사용자 언어로 답하기 + 질문 연속 끊기(docs/50 follow 6차 사전 기준 통과 → 2026-11-01 기본 on)
  date: pick('APP_DATE', ['on', 'v2', 'gate', 'off'], 'gate'), // 이번 사용자 말 끝에 오늘 날짜(서울, 앱 시계 기준) 한 줄. on: 날짜만, v2: '물을 때만 쓴다' 문구 포함, gate: v2 문구 + 사용자 말에 시간 표현이 있는 턴에만(needsDate). 이력·캐시 접두사에는 안 남는다(docs/50 2026-11-01, gate 채택)
  async_fold: pick('APP_ASYNC_FOLD', ['on', 'off'], 'on'), // stair 정리(추출+블록)를 응답 요청 밖에서. 다음 턴·종료는 정리 완료를 기다린다
  clock_offset_days: Number(env.APP_CLOCK_OFFSET_DAYS ?? 0), // 벤치 전용: 시각을 N일 뒤로(재방문·약속 만료 재현)
});
if (!Number.isInteger(config.clock_offset_days)) throw new Error(`APP_CLOCK_OFFSET_DAYS=${env.APP_CLOCK_OFFSET_DAYS} — 정수여야 함`);
if (config.window_mode === 'stair' && config.stair_max <= config.recent_turns) {
  throw new Error('APP_STAIR_MAX 는 APP_RECENT_TURNS 보다 커야 함');
}

// 재현용: 실행 시점의 조건 관련 환경변수 전체
export function runSettings() {
  const vars = Object.fromEntries(Object.entries(env).filter(([k]) => /^(APP|MODEL|MEMORY)_/.test(k)).sort());
  return { app: config, env: vars };
}
