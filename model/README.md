# model/ — 모델 레이어

제공사별 클라이언트 클래스와, 그 위에 앉은 공통 진입점 하나로 되어 있다.

```
model/
  index.js            complete / embed / pricing / estimateTokens (앱·기억이 쓰는 것)
  pricing.json        단가표 (USD/1M 토큰, 출처·기준일·환율)
  clients/
    base.js           공통 결과 모양, ProviderError
    anthropic.js      AnthropicClient   (@anthropic-ai/sdk)
    openai.js         OpenAIClient      (openai)
    deepseek.js       DeepSeekClient    extends OpenAIClient
    deepinfra.js      DeepInfraClient   extends OpenAIClient
    gemini.js         GeminiClient      (@google/genai)
```

키는 레포 루트 `.env`에서 읽는다(커밋 제외). 설치: `cd model && npm install`.

## 클라이언트 클래스

모든 클래스는 `call(req)` 하나를 가진다. 재시도 없이 1회만 호출한다(SDK 자동 재시도도 끔 — 재시도 비용을 빠짐없이 세기 위해).
결과는 `{ text, finish_reason, usage }`, `usage`는 제공사와 무관하게 같은 뜻이다.

| 필드 | 뜻 |
|---|---|
| `input_tokens` | 캐시되지 않은 입력(정가) |
| `cache_read_tokens` | 캐시에서 읽은 입력 |
| `cache_write_tokens` | 캐시에 쓴 입력(Claude만) |
| `output_tokens` | 추론 토큰 포함 전체 출력 |
| `reasoning_tokens` | 그중 추론 토큰 |

제공사별 차이는 클래스 안에서 흡수한다.

| | 캐시 | 추론 끄기(`MODEL_REASONING=off`) | 기타 |
|---|---|---|---|
| Anthropic | 명시적 `cache_control` | `thinking: disabled` + effort low | Haiku 5.5는 temperature 미지원 |
| OpenAI | 자동, `prompt_cache_key`=대화별 | `reasoning_effort` (모델별 값) | GPT-5 계열 temperature 미지원 |
| Gemini | 암시적 자동 | `thinkingBudget:0` / `thinkingLevel:MINIMAL` | 임베딩 응답에 토큰 수 없음 → 추정 |
| DeepSeek | 자동(hit/miss 별도 표기) | — | 단가는 피크 기준 |
| DeepInfra | 일부 모델만 | — | `max_tokens` 구 필드 사용 |

## 진입점

```js
import * as model from '../model/index.js';
const { text, attempts } = await model.complete({
  system: [{ text: 캐릭터시트, cache: true }, { text: 기억 }],
  messages: [{ role: 'user', content: '...' }],
  max_tokens: 200, purpose: 'response', tag: 'response', conversation_id, turn_no,
  response_format: 'json',   // 선택
  cache_history: true,       // 선택: 대화 이력까지 캐시(Claude만 의미). 다음 호출이 이 접두사를 그대로 이어 쓸 때만(stair·full)
  model: 'claude-sonnet-5-5', // 선택: 환경변수 무시하고 지정(심판용)
});
```

- `purpose: 'response'` → `MODEL_RESPONSE`, 그 외 → `MODEL_EXTRACT`.
- 실패하면 throw, `e.attempts`에 실패 시도까지 전부 있다.
- 재시도: 429·5xx·타임아웃만 최대 2회. 잔액 부족·4xx는 바로 실패.

| 환경변수 | 기본 | 값 |
|---|---|---|
| `MODEL_RESPONSE` | `claude-haiku-5-5` | pricing.json 의 채팅 모델 |
| `MODEL_EXTRACT` | `MODEL_RESPONSE`와 같음 | 〃 |
| `MODEL_EMBED` | `gemini-embedding-001` | 임베딩 모델 또는 `off` |
| `MODEL_CACHE` | `on` | `off`: Claude는 마커 안 붙임, 끌 수 없는 제공사는 캐시분을 정가로 계산(`cache_priced_as: 'uncached'`) |
| `MODEL_REASONING` | `off` | `off` / `minimal` / `default` |

## 캐시 최소 길이 (이보다 짧은 접두사는 표시해도 조용히 캐시 안 됨)

| 모델 | 최소 | 근거 |
|---|---|---|
| Claude Haiku 5.5 | 512토큰 | Anthropic 문서 + 실측: full 3턴째 프롬프트 ~598토큰에서 cache_write 594 시작, 추출 지시문 ~808토큰 cache_read 확인 |
| OpenAI (GPT-5 nano 등) | 1,024토큰 | OpenAI 문서 (미실측: 잔액 0) |
| Gemini 3.x Flash-Lite | 미확인 (3rd-party 4,096 설) | 실측 예정 |

캐릭터 시트+규칙이 ~200토큰이라 지금은 시스템 블록 단독으로는 캐시되지 않는다. 응답 호출 캐시는
(1) 대화 이력까지 캐시(`cache_history`, stair·full)하거나 (2) 시트를 512토큰 넘게 보강할 때만 효과가 있다.
