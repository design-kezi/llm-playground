# 출시는 두 배로 늘고, 자체 운영은 아직 API를 못 이긴다

2024년 1월부터 2026년 10월까지 이 조사의 집계 기준(새 모델 이름이 붙은 상용 텍스트 LLM만, 같은 날 같은 패밀리는 1건)을 통과한 상용 출시는 **98건**이다. **2024년 20건, 2025년 38건, 2026년 1~10월 40건**으로 해마다 약 두 배씩 늘었다. 가장 많이 몰린 달은 **2026년 9월(8건)**로, GPT-6, Claude 5.5, Grok 4.7, Gemini 3.8 Flash가 한 달 안에 나왔다. 오픈웨이트는 출처를 확보한 것만 세면 2024년 22건, 2025년 23건, 2026년 30건이다. 그런데 1차 출처(등급 A)만 세면 분기당 3~8건으로 기간 내내 비슷하다. 그래서 오픈웨이트 쪽 증가는 실제로 출시가 늘었다기보다 출처가 촘촘해진 영향일 수 있다. 새 버전을 만드는 방식은 공개 기술보고서 기준으로 "대량 사전학습 → 고품질 데이터 어닐링 → 긴 컨텍스트 확장 → SFT와 선호학습 → 검증 가능한 보상 RL → 큰 모델에서 소형 티어 증류 → 위험 역량 평가 후 보호 장치를 켜고 출시"라는 공통 흐름으로 정리된다. 다만 OpenAI와 Anthropic은 파라미터 수, 데이터, RL 세부, 소형 모델 제작법을 **공개하지 않았다**. 한국어 롤플레이 챗을 1턴 1원 이하로 운영한다는 과제에 대입하면, 같은 오픈 모델을 서버리스 API로 쓸 때 턴당 **약 0.2~0.6원**(계산값)이다. H100 1장을 직접 빌려 쓰면 가동률 100%라는 이상적 가정에서도 **약 0.4~3원**(계산값)이다. 저트래픽 단계에서 우리가 상용 API를 쓰는 선택은 비용 면에서 근거가 있다. 오픈 모델을 개선하는 수단은 비용이 낮은 순서로 프롬프트와 thinking 끄기, 프리픽스 캐싱, 제약 디코딩, 규칙 판정 후 재생성, LoRA 파인튜닝이다. 이 중 파인튜닝은 서버리스 단가를 쓸 수 없게 만들어 1원 제약과 충돌할 수 있다.

**출처 등급 표기 (노트의 표기를 그대로 따름)**

| 표기 | 뜻 |
|---|---|
| [1차] / 등급 A | 벤더 공식 문서, 기술보고서, 시스템카드, HF 모델 카드, 공식 changelog |
| [2차] / 등급 B | 블로그, 집계 사이트, 언론, 위키 |
| [공식] / [추론] | 벤더가 직접 밝힌 내용 / 공식 자료에서 추론한 내용 |
| (미열람) / [미재확인] | 조사 세션에서 원문을 다시 열지 않고 URL만 단 항목. 인용 전에 재확인 필요 |
| [추정] / 계산값 | 공개 수치를 넣어 직접 계산했거나 추정한 값. 실측 아님 |
| 확인 못 함 | 출처는 찾았으나 값이 없거나, 출처끼리 충돌하거나, 2차 출처 하나뿐임 |
| 조사했으나 찾지 못함 | 검색했지만 정보 자체가 나오지 않음 |
| 공개되지 않음 | 벤더가 밝히지 않음 |

환율은 1,400원/USD, 가격은 모두 2026-11-01 열람 기준이다.

---

## 1. 상용 출시는 2024년 20건에서 2026년 40건으로, 2026년 9월에 8건이 몰렸다

### 1.1 집계 규칙과 출처의 신뢰도

월별 숫자는 집계 규칙에 따라 크게 달라지므로 규칙부터 적는다. 텍스트 LLM 가운데 **새 모델 이름**이 나온 경우만 1건으로 셌다. 같은 벤더가 같은 날 낸 패밀리(GPT-4.1/mini/nano 등)는 1건이다. 스냅샷 갱신(gpt-4o-2024-08-06 등), experimental 빌드(gemini-exp-1114 등), 같은 모델의 preview→GA 전환, 음성·이미지·임베딩 모델, 오픈웨이트, 제한 공개 모델(Claude Mythos Preview, gpt-6-rosalind 등)은 세지 않았다. Google은 이 규칙에 특히 민감하다. experimental 빌드와 GA 전환을 따로 세면 2024년에만 10건 넘게 늘어난다.

출처 신뢰도는 벤더마다 다르다. OpenAI는 [1차] API changelog의 등재일을 썼다 ([OpenAI changelog](https://developers.openai.com/api/docs/changelog)). Google도 [1차] Gemini API changelog를 썼다 ([Gemini changelog](https://ai.google.dev/gemini-api/docs/changelog)). Anthropic은 [2차] 위키 표의 날짜에 위키가 인용한 시스템카드 URL을 붙였다. 그리고 [1차] deprecation 페이지의 "은퇴일 하한 = 출시일 + 1년" 규칙으로 교차 확인했다 ([Anthropic deprecations](https://platform.claude.com/docs/en/docs/about-claude/model-deprecations)). 이 규칙은 Opus 4.5 하나만 빼고 맞았다. xAI는 [2차] 위키에만 기댔고 xAI 공식 페이지는 확인 못 함이다 ([Grok 위키](https://en.wikipedia.org/wiki/Grok_(chatbot))). Amazon, Mistral, Cohere, 중국 벤더도 대부분 [2차]다.

### 1.2 모델별 출시일

**OpenAI** — 31건, [1차] changelog 등재일 ([OpenAI changelog](https://developers.openai.com/api/docs/changelog))

| 연도 | 출시(날짜, 모델) |
|---|---|
| 2024 | 04-09 GPT-4 Turbo with Vision GA · 05-13 GPT-4o · 07-18 GPT-4o mini · 09-12 o1-preview/o1-mini · 12-17 o1(API) |
| 2025 | 01-31 o3-mini · 02-27 GPT-4.5(research preview) · 03-19 o1-pro · 04-14 GPT-4.1/mini/nano · 04-16 o3, o4-mini · 05-15 codex-mini-latest · 06-10 o3-pro · 06-24 o3/o4-mini-deep-research · **08-07 GPT-5/mini/nano** · 09-23 gpt-5-codex · 10-06 gpt-5-pro · 11-13 GPT-5.1 패밀리 · 12-04 gpt-5.1-codex-max · 12-11 GPT-5.2 |
| 2026 | 01-14 gpt-5.2-codex · 02-24 gpt-5.3-codex · 03-03 gpt-5.3-chat-latest · 03-05 GPT-5.4/5.4-pro · 03-17 GPT-5.4-mini/nano · 04-24 GPT-5.5/5.5-pro · 07-09 GPT-5.6-sol/-terra/-luna · 08-07 gpt-5.6-cyber · 09-03 GPT-6 Astra · **09-22 GPT-6 Sol, GPT-6 Luna** · 09-29 GPT-6.1 Sol · 10-26 GPT-6.1 Terra |

집계에서 뺀 것은 스냅샷(2024-01-25 GPT-4 Turbo preview 갱신, gpt-3.5-turbo-0125, gpt-4o-2024-08-06/11-20), 2026-09-08 gpt-rosalind-research(성격 확인 못 함), 2026-10-30 gpt-6-rosalind(제한 공개)다. GPT-6 Luna가 ChatGPT Free/Go 플랜에 2026-10-08부터 들어갔다는 내용은 [2차]뿐이라 확인 못 함이다 ([evolink](https://evolink.ai/blog/gpt-6-luna-release-date)).

**Anthropic** — 21건, [2차] 위키 표 + 위키가 인용한 [1차] 시스템카드 ([Claude 위키](https://en.wikipedia.org/wiki/Claude_(language_model)))

| 연도 | 출시 |
|---|---|
| 2024 | 03-04 Claude 3 Opus/Sonnet · 03-13 Claude 3 Haiku(위키 본문은 3/4로 적어 위키 안에서 날짜가 엇갈림) · 06-20 Claude 3.5 Sonnet · 10-22 3.5 Sonnet 업그레이드 + 3.5 Haiku(3.5 Haiku의 실제 API 제공일은 확인 못 함) |
| 2025 | 02-24 Claude 3.7 Sonnet · 05-22 Claude Sonnet 4/Opus 4 · 08-05 Opus 4.1(위키에 인용 없음, 모델 ID와 일치) · 09-29 Sonnet 4.5 · 10-15 Haiku 4.5 · 11-24 Opus 4.5 |
| 2026 | 02-05 Opus 4.6 · 02-17 Sonnet 4.6 · 04-16 Opus 4.7 · 05-28 Opus 4.8 · 06-09 Mythos 5/Fable 5 · 06-30 Sonnet 5 · 07-24 Opus 5 · 09-01 Mythos 5.1/Fable 5.1(위키에 인용 없음) · 09-22 Opus 5.5 · 09-28 Sonnet 5.5 · **10-07 Haiku 5.5** |

2026-04-07 Claude Mythos Preview(Project Glasswing 제한 공개)는 집계에서 뺐다. 시스템카드 예시로 [Opus 5.5 System Card](https://www-cdn.anthropic.com/fc1b44717c85dc068bc6ba5024219938094694bd/Claude%20Opus%205.5%20System%20Card.pdf), [Haiku 5.5 System Card](https://www.anthropic.com/claude-haiku-5-5-system-card)가 있다. Haiku 5.5는 대부분 10-07로 적혀 있다. 반면 DataLearner와 Emergent는 "9/22 발표, 아직 출시 전"이라고 썼는데, 10/7 이전에 쓴 글로 보인다 ([emergent](https://emergent.sh/news/claude-haiku-5-5-release-date)).

**Google Gemini** — 19건, [1차] changelog (2024년 2월 두 건만 뉴스 출처) ([Gemini changelog](https://ai.google.dev/gemini-api/docs/changelog))

| 연도 | 출시 |
|---|---|
| 2024 | 02-08 Gemini 1.0 Ultra(소비자 제품. 개발자 API 제공 여부는 확인 못 함, [Engadget](https://www.engadget.com/googles-gemini-15-pro-is-a-new-more-efficient-ai-model-181909354.html)) · 02-15 Gemini 1.5 Pro(제한 preview) · 05-10 1.5 Flash preview · 10-03 1.5 Flash-8B · 12-11 2.0 Flash(exp) · 12-19 2.0 Flash Thinking |
| 2025 | 02-05 2.0 Flash GA/2.0 Pro exp/Flash-Lite preview · 03-25 2.5 Pro exp · 04-17 2.5 Flash preview · 06-17 2.5 Pro/Flash GA + 2.5 Flash-Lite preview · 11-18 Gemini 3 Pro preview · 12-17 Gemini 3 Flash preview |
| 2026 | 02-19 3.1 Pro preview · 03-03 3.1 Flash-Lite preview · 05-19 3.5 Flash GA · **07-21 3.6 Flash + 3.5 Flash-Lite GA** · 08-13 3.7 Flash · 09-02 3.8 Flash · 10-13 gemini-4-argon(changelog에 이름만 있음. Pro급인지 등 정체는 확인 못 함) |

2026년 Pro 라인은 3.1-pro-preview(02-19) 이후 changelog에 새 모델이 없다. 3.5부터는 Flash 계열만 나왔다. gemini-omni 계열은 텍스트 LLM인지 확인 못 해서 뺐다.

**xAI Grok** — 12건, [2차] 위키, xAI 공식은 확인 못 함 ([Grok 위키](https://en.wikipedia.org/wiki/Grok_(chatbot)))

2024-05-15 Grok-1.5, 2024-08-14 Grok-2/mini(위키에 8/20 출시라는 서술도 있음), 2025-02-17 Grok 3/mini(API는 2025년 4월, 일자 확인 못 함), 2025-07-09 Grok 4/Heavy, 2025-08-28 Grok Code Fast 1, 2025-09 Grok 4 Fast(일자 확인 못 함), 2025-11-17 Grok 4.1/4.1 Fast, 2026-02 Grok 4.20(일자 확인 못 함), 2026-04 Grok 4.3(일자 확인 못 함), 2026-07-08 Grok 4.5, 2026-08-12 Grok 4.6, 2026-09-21 Grok 4.7. Grok 5는 2026-11-01 기준 위키에 없어 조사했으나 찾지 못함이다.

**기타 벤더** — 대부분 [2차]

Amazon은 3건이다. Nova Micro/Lite/Pro가 2024-12-03 Bedrock에 나왔고 ([aiwiki](https://aiwiki.ai/wiki/amazon_nova)), Nova Premier GA는 2025-04-30 ([hidekazu-konishi](https://hidekazu-konishi.com/entry/amazon_nova_model_release_timeline.html)), Nova 2는 2025-12-02 re:Invent에서 발표됐다 ([labo-llm](https://www.labo-llm.fr/en/acteurs/amazon-nova/)). Nova 2 Pro GA 날짜는 조사했으나 찾지 못함이다. Mistral은 클로즈드 API 모델만 세서 5건이다. Mistral Large 1세대(2024-02-26, [scriptbyai](https://www.scriptbyai.com/mistral-ai-timeline/)), Medium 3(2025-05-07, [1차 Mistral](https://mistral.ai/news/mistral-medium-3/)), Medium 3.1(2025-08-12), Medium 3.5(2026-04-29), Large 4 public preview(2026-10-06, [innfactory](https://innfactory.ai/en/ai-models/mistral/))다. Cohere는 3건으로 Command R+(2024-04-04, Azure 발표일. 다른 출처는 4/24), Command A(2025-03-13), Command A+(2026-05-20)다. 중국 벤더는 4건으로 ERNIE 4.5/X1(2025-03-16, [위키](https://en.wikipedia.org/wiki/Ernie_Bot)), ERNIE 5.0 preview(2025-11-13), ERNIE 5.0 정식판(2026-01-22, 집계 사이트 한 곳뿐이라 확인 못 함), Doubao Seed 2.0(2026-02-14, [위키](https://en.wikipedia.org/wiki/Doubao))이다. Microsoft MAI 계열과 Doubao 1.5는 조사했으나 찾지 못함이다. Alibaba Qwen 클로즈드 API, Zhipu, Tencent Hunyuan은 조사하지 않아서 해당 달 건수가 과소 집계됐을 수 있다.

### 1.3 월별·분기별 분포

아래 표의 개별 항목과 출처는 1.2절에 있다. 약어는 O=OpenAI, A=Anthropic, G=Google, X=xAI, Am=Amazon, M=Mistral, C=Cohere, CN=중국이다.

| 월 | 건수 | 내역 |
|---|---|---|
| 2024-01 | 0 | 스냅샷만 있음 |
| 2024-02 | 3 | G 1.0 Ultra, G 1.5 Pro, M Large |
| 2024-03 | 2 | A Claude 3 Opus/Sonnet, A Claude 3 Haiku |
| 2024-04 | 2 | C Command R+, O GPT-4 Turbo GA |
| 2024-05 | 3 | G 1.5 Flash, O GPT-4o, X Grok-1.5 |
| 2024-06 | 1 | A 3.5 Sonnet |
| 2024-07 | 1 | O GPT-4o mini |
| 2024-08 | 1 | X Grok-2 |
| 2024-09 | 1 | O o1-preview/mini |
| 2024-10 | 2 | G 1.5 Flash-8B, A 3.5 Sonnet new/3.5 Haiku |
| 2024-11 | 0 | Gemini exp 빌드만 있음 |
| 2024-12 | 4 | Am Nova, G 2.0 Flash, O o1, G 2.0 Flash Thinking |
| 2025-01 | 1 | O o3-mini |
| 2025-02 | 4 | G 2.0 Flash GA 등, X Grok 3, A 3.7 Sonnet, O GPT-4.5 |
| 2025-03 | 4 | C Command A, CN ERNIE 4.5/X1, O o1-pro, G 2.5 Pro |
| 2025-04 | 4 | O GPT-4.1, O o3/o4-mini, G 2.5 Flash, Am Nova Premier |
| 2025-05 | 3 | M Medium 3, O codex-mini, A Claude 4 |
| 2025-06 | 3 | O o3-pro, G 2.5 GA + Flash-Lite, O deep-research |
| 2025-07 | 1 | X Grok 4 |
| 2025-08 | 4 | A Opus 4.1, O GPT-5, M Medium 3.1, X Grok Code Fast 1 |
| 2025-09 | 3 | X Grok 4 Fast(일자 확인 못 함), O gpt-5-codex, A Sonnet 4.5 |
| 2025-10 | 2 | O gpt-5-pro, A Haiku 4.5 |
| 2025-11 | 5 | O GPT-5.1, CN ERNIE 5.0 preview, X Grok 4.1, G Gemini 3 Pro, A Opus 4.5 |
| 2025-12 | 4 | Am Nova 2, O 5.1-codex-max, O GPT-5.2, G Gemini 3 Flash |
| 2026-01 | 2 | O 5.2-codex, CN ERNIE 5.0(확인 못 함) |
| 2026-02 | 6 | A Opus 4.6, CN Doubao Seed 2.0, A Sonnet 4.6, G 3.1 Pro, O 5.3-codex, X Grok 4.20 |
| 2026-03 | 4 | G 3.1 Flash-Lite, O 5.3-chat, O GPT-5.4, O 5.4-mini/nano |
| 2026-04 | 4 | A Opus 4.7, O GPT-5.5, M Medium 3.5, X Grok 4.3 |
| 2026-05 | 3 | G 3.5 Flash, C Command A+, A Opus 4.8 |
| 2026-06 | 2 | A Mythos 5/Fable 5, A Sonnet 5 |
| 2026-07 | 4 | X Grok 4.5, O GPT-5.6, G 3.6 Flash + 3.5 Flash-Lite, A Opus 5 |
| 2026-08 | 3 | O 5.6-cyber, X Grok 4.6, G 3.7 Flash |
| 2026-09 | **8** | A Mythos/Fable 5.1, G 3.8 Flash, O GPT-6 Astra, X Grok 4.7, O GPT-6 Sol/Luna, A Opus 5.5, A Sonnet 5.5, O GPT-6.1 Sol |
| 2026-10 | 4 | M Large 4 preview, A Haiku 5.5, G gemini-4-argon, O GPT-6.1 Terra |
| 2026-11 | 0 | 11/1 기준 |
| **합계** | **98** | |

| 분기 | 2024 | 2025 | 2026 |
|---|---|---|---|
| Q1 | 5 | 9 | 12 |
| Q2 | 6 | 10 | 9 |
| Q3 | 3 | 8 | **15** |
| Q4 | 6 | 11 | 4(10월만) |
| **계** | **20** | **38** | **40(1~10월)** |

출시 간격도 줄었다. 아래는 노트가 위 날짜로 직접 계산한 값이다(첫 집계일부터 마지막 집계일까지 일수 ÷ (건수−1)).

| 벤더 | 건수 | 평균 간격 |
|---|---|---|
| OpenAI | 31 | 약 31일. 주력 번호 버전(GPT-5 → 5.1 → 5.2 → 5.4 → 5.5 → 5.6 → 6 Astra → 6.1 Sol)만 세면 약 60일 |
| Anthropic | 21 | 약 47일. 2024년 안에서는 약 77일, 2026년 안에서는 약 24일 |
| Google | 19 | 약 54일 |
| xAI | 12 | 약 78일 |
| Mistral(클로즈드) | 5 | 약 238일 |
| Amazon | 3 | 약 182일 |

이 숫자에서 세 가지를 읽을 수 있다. 첫째, 출시는 특정 달에 몰린다. 2024-12, 2025-11, 2026-09에는 3~4개 벤더가 몇 주 안에 연달아 냈고, 2024-01과 2024-11은 0건이었다. 둘째, 가속 폭이 가장 큰 곳은 Anthropic이다. 2024년 약 2.5개월 간격에서 2026년 약 3.5주 간격으로 빨라졌다. 셋째, 2026년에는 세대 교체가 겹쳤다. OpenAI는 GPT-5.x에서 GPT-6/6.1로, Anthropic은 Claude 4.x에서 5/5.5로, Google은 Gemini 3.x에서 4로 넘어갔다.

### 1.4 우리 테스트 모델의 위치와 종료 일정

과제에 쓴 네 모델은 모두 [1차] 출처로 출시일을 확인했다. claude-haiku-5-5는 2026-10-07 출시, Active 상태이고 은퇴는 2027-10-07 이후다 ([Anthropic deprecations](https://platform.claude.com/docs/en/docs/about-claude/model-deprecations)). gpt-6-luna는 2026-09-22에 gpt-6-sol과 같은 날 API에 나왔다 ([OpenAI changelog](https://developers.openai.com/api/docs/changelog)). gemini-3.5-flash-lite는 2026-07-21에 GA가 됐고 종료 예정일은 조사했으나 찾지 못함이다 ([Gemini changelog](https://ai.google.dev/gemini-api/docs/changelog)). gpt-5-nano는 2025-08-07에 나왔고 2026-06-11 deprecation 발표에 따라 **2026-12-11에 종료**된다. 대체 모델은 gpt-5.6-luna다 ([OpenAI deprecations](https://developers.openai.com/api/docs/deprecations)). 테스트 중 gpt-4.1-nano에서 404가 난 것은 2026-04-22 발표된 **2026-10-23 종료**와 맞는다. 같은 날 o1, o3-mini, o4-mini, gpt-4-turbo, gpt-3.5-turbo-0125도 함께 종료됐다 ([OpenAI deprecations](https://developers.openai.com/api/docs/deprecations)). 2026-11-30에는 claude-sonnet-4-5도 종료될 예정이다 ([Anthropic deprecations](https://platform.claude.com/docs/en/docs/about-claude/model-deprecations)).

소형 티어 계보도 1차 출처로 이어 붙일 수 있다. OpenAI는 gpt-4.1-nano(2025-04-14) → gpt-5-nano(2025-08-07) → gpt-5.4-nano(2026-03-17) → gpt-5.6-luna(2026-07-09) → gpt-6-luna(2026-09-22)다. Anthropic Haiku는 3(2024-03-13) → 3.5(2024-10-22) → 4.5(2025-10-15) → 5.5(2026-10-07)이고, Haiku 5와 4.6~4.8은 위키 표에 없다. Gemini Flash-Lite는 2.0(2025-02) → 2.5(2025-06/07) → 3.1(2026-03/05) → 3.5(2026-07-21)다. 공지에서 종료까지 주는 기간은 OpenAI가 대개 3~6개월, Anthropic이 약 2개월이다. Google은 GA나 후속 모델이 나오면 preview를 몇 주~몇 달 안에 종료하거나 리다이렉트한다. 그래서 이 과제의 모델 ID는 출시보다 종료 일정에 맞춰 관리해야 한다. 가격은 GPT-6 Luna와 Haiku 5.5 모두 입력 $0.10/M, 출력 $0.50/M이라는 출처가 있지만, 둘 다 2차 출처만 있어 확인 못 함이다 ([llm-stats](https://llm-stats.com/models/gpt-6-luna), [apidog](https://apidog.com/blog/what-is-claude-haiku-5-5/)).

### 1.5 오픈웨이트 출시: 건수 증가는 출처 밀도 효과일 수 있다

오픈웨이트 목록의 2024~2025 항목은 대부분 **등급 A**다. 다만 직접 연 1차 페이지는 HF 카드 4건(Gemma 4 26B-A4B, Kimi K2, MiniMax-M2, GLM-4.5)뿐이다. 나머지는 1차 URL이 달린 정리 페이지([hidekazu-konishi 타임라인](https://hidekazu-konishi.com/entry/open_weights_llm_release_history_and_timeline.html), 이하 H)를 거쳤다. 2026년 7월 이후 항목은 대부분 [slash-digital](https://slash-digital.io/en/insights/open-weight-models-2026/)(이하 S) 하나에 기댔고, S가 단 HF 링크도 직접 열지 않았다. [promptquorum](https://www.promptquorum.com/local-llms/local-llm-model-updates-2026)(P)은 Gemma 3를 2026-02 Apache 2.0으로, Llama 4 Scout를 2026-03으로 적는 등 1차 출처와 충돌한다. 그래서 P에만 있는 항목은 신뢰도가 낮다.

| 날짜 | 모델 | 총/활성 파라미터 | 라이선스 | 등급 |
|---|---|---|---|---|
| 2024-02-21 | Gemma 2B/7B | Dense | Gemma Terms | A(H) |
| 2024-04-17 | Mixtral 8x22B | 141B/39B MoE | Apache 2.0 | A(H) |
| 2024-04-18 | Llama 3 8B/70B | Dense | Llama Community | A(H) |
| 2024-05-06 | DeepSeek-V2 | 236B/21B MoE | DeepSeek Model License | A(H) |
| 2024-06-27 | Gemma 2 9B/27B | Dense | Gemma Terms | A(H) |
| 2024-07-23 | Llama 3.1 8B/70B/405B | Dense, 128K | Llama Community | A(H) |
| 2024-09-19 | Qwen2.5 | 확인 못 함 | 확인 못 함 | A(H) |
| 2024-12-06 | Llama 3.3 70B | Dense | Llama Community | A(H) |
| 2024-12-26 | DeepSeek-V3 | 671B/37B MoE | DeepSeek Model License | A(H) |
| 2025-01-20 | DeepSeek-R1(+증류 6종) | 671B/37B | MIT | A(H) |
| 2025-03-10 | Gemma 3 1B~27B | Dense, 128K | Gemma Terms | A(H) |
| 2025-04-05 | Llama 4 Scout/Maverick | 활성 17B MoE | Llama 4 Community | A(H) |
| 2025-04-29 | Qwen3 | 235B/22B 등 | Apache 2.0 | A(H) |
| 2025-07-03 | SKT A.X 4.0 | 72B, 7B | 상업 제한 없음 보도(원문 확인 못 함) | A |
| 2025-07 | Kimi K2 | 1T/32B | Modified MIT | A(직접 확인) |
| 2025-07 | LG EXAONE 4.0 | 32B, 1.2B | NC(비상업) | A |
| 2025-08-05 | gpt-oss-120b/20b | 117B/5.1B, 21B/3.6B | Apache 2.0 | A(H) |
| 2025-12-02 | Mistral Large 3 + Ministral 3 | 675B/41B | Apache 2.0 | A(H) |
| 2025-12-29 | HyperCLOVA X SEED Think 32B | 32B | 전용 라이선스(조건 확인 못 함) | A |
| 2026-01 | Upstage Solar Open 100B | 102B/11B | 확인 못 함 | A |
| 2026-02-16 | Qwen3.5-397B-A17B | 397B/17B | Apache 2.0 | A(H) |
| 2026-03-16 | Mistral Small 4 | 119B/약 6.5B | Apache 2.0 | A(H) |
| **2026-04-02** | **Gemma 4** E2B/E4B/26B-A4B/31B | 26B-A4B 25.2B/3.8B, 31B 30.7B Dense, 256K | **Apache 2.0** | A(직접 확인) |
| 2026-04-24 | DeepSeek-V4-Pro/Flash(preview) | 1.6T/49B, 284B/13B, 1M | MIT(2차 여러 곳) | A(H) |
| 2026-05-22 | Mistral Medium 3.5 | 128B Dense | Modified MIT | A(H) |
| 2026-07-27 | Kimi K3(07-16 발표) | 2.8T/104B | 커스텀 | A(S 경유) |
| 2026-08-12 | Qwen3.8-2.4T-A95B | 2.4T/95B | 커스텀 | A(S 경유) |
| 2026-08-25 | GLM-5.3 | 744B/40B | 커스텀 | A(S 경유) |
| 2026-09-10 | DeepSeek V4.1-Flash | 552B/8~16B | MIT | A(S 경유) |
| 2026-10-15 | Meta Muse Spark Open | 816B/42B | 커스텀 | A(S 경유) |

주요 항목만 뽑은 표다. 전체 75건의 월별 내역은 노트에 있다. 우리가 테스트한 gemma-4-31B와 gemma-4-26B-A4B는 2026-04-02 Gemma 4 첫 출시분이다. 31B는 30.7B Dense, 26B-A4B는 총 25.2B에 활성 3.8B인 MoE(전문가 128개 중 8개 + 공유 1개)이고, 둘 다 256K, Apache 2.0이다. 이 값은 HF 카드에서 직접 확인했다 ([HF gemma-4-26B-A4B-it](https://huggingface.co/google/gemma-4-26B-A4B-it)).

| 분기 | 2024 전체/A | 2025 전체/A | 2026 전체/A |
|---|---|---|---|
| Q1 | 3/3 | 3/3 | 7/6 |
| Q2 | 8/8 | 7/6 | **12/6** |
| Q3 | 6/6 | 8/8 | 9/4 |
| Q4 | 5/5 | 5/4 | 2/1(10월까지) |
| **계** | **22/22** | **23/21** | **30/17** |

2026년 2분기 급증(4월만 8건)은 대부분 등급 B가 늘어난 결과다. A만 세도 2026-04에는 Gemma 4, Qwen3.6 2종, DeepSeek V4가 몰렸다. 수집 편향도 반대 방향으로 작용한다. 2024년의 Yi, InternLM, Command R, DBRX, Jamba, EXAONE 3.x와 Phi-3.5, DeepSeek-V2.5, R1-0528, GLM-4.6/4.7 같은 출시는 출처를 확보하지 못해 빠졌다(확인 못 함). 그래서 2024~2025 건수는 실제보다 적게 나왔을 가능성이 크다. Kakao Kanana, 2026년 한국 모델 후속작(EXAONE, A.X), gpt-oss 후속은 조사했으나 찾지 못함이다.

라이선스는 2026년에 두 방향으로 갈렸다. Google은 Gemma 4를 Apache 2.0으로 풀었다. 반면 Moonshot(K3), Zhipu(GLM-5.3), Alibaba(Qwen3.8 최대 모델), MiniMax(M3), Meta(Muse Spark Open)는 플래그십에 커스텀 라이선스를 붙였다(S, 2차). Meta는 Llama 4 이후 "Llama" 이름의 새 오픈웨이트를 냈다는 1차 출처를 찾지 못했다. 2026년 Meta 오픈웨이트는 S에서 "Muse" 브랜드로만 나오는데, Meta 공식 발표로 확인한 것은 아니다.

---

## 2. 새 버전은 사전학습, 사후학습 RL, 증류, 위험 평가의 네 관문을 거친다

### 2.1 사전학습: 15T에서 36T 토큰으로, dense에서 MoE로

오픈 진영 기술보고서는 토큰 수, 파라미터 수, GPU 시간까지 공개한다. 폐쇄형 연구소는 아키텍처 계열 정도만 밝힌다. **DeepSeek-V3**는 [공식] 전체 671B, 토큰당 활성 37B인 MoE이고 14.8T 토큰으로 학습했다. MLA, 보조 손실 없는 부하 분산, 멀티토큰 예측을 썼다 ([DeepSeek-V3 보고서](https://arxiv.org/abs/2412.19437)). H800 GPU 시간은 사전학습 2,664K, 컨텍스트 확장 119K, 사후학습 5K로 **합계 2.788M**이고, 시간당 $2로 환산하면 **$5.576M**이다. 보고서는 이 금액에 "아키텍처·알고리즘·데이터 사전 연구와 ablation 비용은 제외"라고 단서를 달았다 ([보고서 Table 1](https://arxiv.org/html/2412.19437v2)). 그러니 "600만 달러로 GPT-4급을 만들었다"는 해석은 과장이다([추론]). **Llama 3 405B**는 [공식] dense 구조로 약 15.6T 토큰, 약 3.8×10²⁵ FLOPs, H100 최대 16K장을 썼다. 데이터는 일반 지식 약 50%, 수학·추론 25%, 코드 17%, 다국어 8%이고, 컨텍스트는 8K에서 128K까지 6단계로 늘렸다(약 800B 토큰). 54일 동안 중단이 466회 있었고, 그중 예기치 않은 중단 419회의 약 78%가 하드웨어 문제였다 ([Llama 3 보고서](https://arxiv.org/html/2407.21783v3)). 대규모 사전학습이 연구 못지않게 운영 문제라는 점을 보여 주는 숫자다.

2025년에는 데이터와 구조가 함께 바뀌었다. **Qwen3**는 [공식] 약 **36T** 토큰과 119개 언어로 학습했고, 3단계 사전학습(30T 이상 일반 → 약 5T STEM·코드·추론 → 수천억 토큰 32K 긴 컨텍스트)을 거쳤다 ([Qwen3 보고서](https://arxiv.org/html/2505.09388v1)). Qwen2.5의 18T와 비교하면 약 두 배다(Qwen2.5 보고서는 미열람). **Kimi K2**는 [공식] 1T/32B MoE를 15.5T 토큰으로 학습하면서 "loss spike 0"을 주장했다. MuonClip 옵티마이저를 썼고, 지식·수학 텍스트를 재서술한 합성 데이터로 고품질 토큰을 늘렸다 ([Kimi K2 보고서](https://arxiv.org/html/2507.20534v1)). **Gemini 2.5**는 [공식] sparse MoE이고 TPUv5p 8,960칩 pod 여러 개에서 학습했다고만 밝혔다. 파라미터 수, 전문가 수, 학습 토큰 총량은 **공개되지 않음**이다 ([Gemini 2.5 보고서](https://arxiv.org/html/2507.06261v1)). [추론]으로 정리하면 공통 순서는 "일반 데이터 대량 학습 → 고품질·추론 데이터 비중을 높인 어닐링(mid-training) → 긴 컨텍스트 확장"이다. Llama 3의 어닐링, Qwen3의 S2 단계, OLMo 2의 Dolmino 단계(미열람, [OLMo 2](https://arxiv.org/abs/2501.00656))가 같은 기법에 해당한다. Llama 3는 학습 안정성 때문에 dense를 택했다. 반면 이후 대형 모델(DeepSeek-V3, Qwen3-235B, Kimi K2, Gemini 2.5)은 MoE로 수렴했다. OpenAI와 Anthropic 모델의 파라미터 수, MoE 여부, 토큰 수, 컴퓨트, 데이터 구성은 모두 **공개되지 않음**이다. Gemini 3과 Gemma 4의 공식 기술보고서는 이 세션에서 찾지 못했다. 다만 다른 노트에 따르면 Gemma 4 HF 카드가 기술보고서 arXiv 2607.02770을 표기하고 있다 ([HF gemma-4-31B-it](https://huggingface.co/google/gemma-4-31B-it)). 그래서 Gemma 4의 학습 방식(teacher 증류 여부 등)은 확인 못 함이다.

### 2.2 사후학습: SFT·DPO 반복에서 검증 가능한 보상 RL로

2024년의 표준은 Llama 3였다. [공식] SFT, 보상모델로 거른 거부 샘플링, DPO를 한 라운드로 묶어 **6라운드** 반복했다 ([Llama 3 보고서](https://arxiv.org/html/2407.21783v3)). 이 방식의 뿌리는 SFT → 보상모델 → PPO의 InstructGPT RLHF(미열람, [arXiv 2203.02155](https://arxiv.org/abs/2203.02155))와, 보상모델 없이 선호 쌍으로 직접 최적화하는 DPO(미열람, [arXiv 2305.18290](https://arxiv.org/abs/2305.18290))다. Anthropic의 Constitutional AI는 원칙 목록으로 모델이 스스로 답을 비판·수정하는 단계와, AI가 매긴 선호로 보상모델을 학습하는 RLAIF 단계로 구성된다(미열람, [arXiv 2212.08073](https://arxiv.org/abs/2212.08073)). 현행 Claude가 이 방식을 그대로 쓰는지 변형했는지는 확인 못 함이다.

2025년의 전환점은 정답을 자동 검증할 수 있는 과제에서 규칙 기반 보상으로 RL을 돌리는 방식이다. Tülu 3가 RLVR이라는 이름을 붙였고 ([arXiv 2411.15124](https://arxiv.org/abs/2411.15124)), DeepSeekMath의 GRPO는 critic 없이 같은 질문에 대한 여러 샘플의 보상을 그룹 안에서 비교한다(미열람, [arXiv 2402.03300](https://arxiv.org/abs/2402.03300)). **DeepSeek-R1-Zero**는 [공식] V3-Base에 SFT 없이 바로 GRPO를 적용했고, 보상은 정답 정확도와 형식 규칙뿐이었다. 학습 중 반성 같은 추론 행동이 저절로 나타났지만 가독성이 낮고 언어가 섞였다. **R1**은 [공식] 이를 4단계로 다듬었다. 수천 개 긴 CoT로 cold-start SFT를 하고, 언어 일관성 보상을 더한 추론 RL을 돌리고, 거부 샘플링으로 약 80만 샘플(추론 약 60만, 비추론 약 20만)을 만들어 SFT를 한 뒤, 유용성·무해성을 포함한 2차 RL을 했다. 신경망 보상모델은 reward hacking과 비용 때문에 쓰지 않았고, PRM과 MCTS는 실패 사례로 보고했다 ([R1 보고서](https://arxiv.org/html/2501.12948v1)). **Qwen3**의 [공식] 4단계(Long-CoT cold start → GRPO 추론 RL → Thinking Mode Fusion → 20개 이상 과제 일반 RL)는 생각 모드와 비생각 모드를 한 모델에 합치고 "thinking budget"을 노출한다 ([Qwen3 보고서](https://arxiv.org/html/2505.09388v1)). 정답이 없는 과제로 RL을 넓히는 흐름도 있다. Kimi K2는 [공식] 모델이 루브릭으로 자기 출력을 평가하는 self-critique rubric reward를 썼고, 실제 MCP 도구 3,000개 이상과 합성 도구 20,000개 이상으로 도구 사용 데이터를 합성했다 ([Kimi K2 보고서](https://arxiv.org/html/2507.20534v1)). Gemini 2.5는 [공식] thinking 모델을 RL로 학습했고, RL 컴퓨트를 늘렸으며, 검증 가능한 보상과 모델 기반 생성형 보상을 함께 썼다고 밝혔다 ([Gemini 2.5 보고서](https://arxiv.org/html/2507.06261v1)). OpenAI는 o1이 대규모 RL로 CoT를 학습했고 train-time과 test-time 컴퓨트가 늘수록 성능이 오른다고만 밝혔다(미열람, [OpenAI](https://openai.com/index/learning-to-reason-with-llms/)). OpenAI o1/o3/GPT-5와 Claude의 RL 알고리즘, 보상모델 구조, RL 데이터 양, RL 컴퓨트는 **공개되지 않음**이다.

컴퓨트 배분도 바뀌고 있다. DeepSeek-V3에서 사후학습 GPU 시간은 전체의 0.2% 미만(5K)이었다 ([보고서](https://arxiv.org/html/2412.19437v2)). 반면 Gemini 2.5는 RL 컴퓨트를 늘렸다고 밝혔다. [추론]으로는 사후학습 비중이 커지는 추세다. 하지만 정확한 비율은 대부분 공개되지 않았다.

### 2.3 작은 티어는 증류로 만든다는 공식 확인은 Google·Qwen·DeepSeek뿐이다

Flash, mini, nano, Haiku 같은 소형 티어의 제작법은 회사마다 공개 수준이 다르다. Gemini 2.5는 [공식] "Flash 크기 이하" 모델을 증류로 학습했다. teacher의 다음 토큰 분포를 k-sparse로 근사해 저장 비용을 줄였다 ([Gemini 2.5 보고서](https://arxiv.org/html/2507.06261v1)). Gemma 3는 [공식] **모든** 모델을 증류로 학습했다. 토큰마다 teacher 확률에 따라 logit 256개를 샘플링해 학생이 cross-entropy로 배운다 ([Gemma 3 보고서](https://arxiv.org/html/2503.19786v1)). Qwen3는 [공식] 소형 dense 5종과 30B-A3B를 strong-to-weak 증류로 만들었다. Qwen3-8B 기준으로 on-policy 증류가 1,800 GPU시간, RL이 17,920 GPU시간이어서 **약 1/10**이었다 ([Qwen3 보고서](https://arxiv.org/html/2505.09388v1)). DeepSeek는 [공식] R1이 생성한 80만 샘플로 Qwen2.5와 Llama의 1.5B~70B를 **SFT만으로** 증류했다. 같은 32B에서 RL만 한 모델은 QwQ-32B-Preview 수준이었고 증류한 모델이 훨씬 나았다. DeepSeek는 이를 근거로 소형 모델에는 직접 RL보다 증류가 낫다고 결론 내렸다 ([R1 보고서](https://arxiv.org/html/2501.12948v1)).

[추론]으로 보면 증류에는 두 형태가 있다. teacher 출력 텍스트로 SFT를 하는 hard-label 방식(R1-Distill)과 teacher logit을 배우는 soft-label 방식(Gemma 3, Gemini Flash, Qwen3 on-policy)이다. soft-label 방식은 teacher 가중치에 접근할 수 있는 같은 회사 안에서만 가능하다. OpenAI GPT-5 시스템카드에는 gpt-5-main, main-mini, thinking, thinking-mini 같은 구분이 나온다. 이 내용은 원문 403으로 검색 요약에서만 확인했다 ([GPT-5 System Card](https://openai.com/index/gpt-5-system-card)). OpenAI mini/nano와 Claude Haiku의 제작법은 **공개되지 않음**이다. 업계 관행상 증류를 썼을 가능성은 외부 추정일 뿐 공식 확인이 없다. Llama 3가 405B를 소형 모델 사후학습에 활용했다는 내용은 이 세션에서 해당 부분을 열람하지 못해 확인 못 함이다.

### 2.4 포인트 버전: 공개 근거가 있는 경우는 일부뿐이다

base를 새로 학습했는지가 확인되는 사례는 몇 개 없다. DeepSeek-V3 → R1은 [공식] **같은 V3-Base 위의 사후학습 차이**다 ([R1 보고서](https://arxiv.org/html/2501.12948v1)). Qwen2.5 → Qwen3은 데이터가 18T에서 36T로, 언어가 29개에서 119개로 늘고 MoE가 추가된 새 사전학습이다 ([Qwen3 보고서](https://arxiv.org/html/2505.09388v1)). Gemini 2.0과 2.5는 [공식] 데이터 컷오프가 각각 2024-06, 2025-01로 다르다. 그래서 최소한 새 데이터로 계속 사전학습을 했다고 추론할 수 있다. 처음부터 새로 학습했는지는 공개되지 않음이다 ([Gemini 2.5 보고서](https://arxiv.org/html/2507.06261v1)). Claude 3 → 3.5 → 3.7 → 4 → 4.5, GPT-4o → 4.1 → 4.5 → 5 → 5.x에서 포인트 버전마다 새로 사전학습했는지는 **공개되지 않음**이다. DeepSeek-V3.1/V3.2나 Qwen3-2507의 변경 범위는 1차 자료로 확인 못 함이다. [추론]으로 출시 주기를 나누면 세 가지다. (1) 새 base 사전학습(수개월, 큰 번호 변경), (2) 같은 base 위의 사후학습·RL 개선(짧은 주기, 포인트·날짜 버전), (3) 증류로 파생한 소형 티어다. 1장의 월 단위 출시 리듬은 (2)와 (3)이 늘어난 결과로 해석할 수 있다. 그러나 이 해석을 뒷받침할 벤더의 내부 일정은 공개되지 않았다.

### 2.5 안전 프레임워크는 출시를 막기보다 어떤 보호 장치를 켤지 정한다

세 폐쇄형 연구소는 출시 전에 CBRN, 사이버, AI R&D 자동화, 기만적 정렬 같은 위험 역량을 평가한다. Anthropic은 [공식] Claude Opus 4를 **ASL-3** 기준으로 배포했다. CBRN 역량이 개선되어 "ASL-3 위험을 명확히 배제할 수 없었기" 때문이고, 이를 "예방적이고 잠정적인 조치"라고 설명했다. 같은 판단에서 Sonnet 4는 ASL-3가 필요 없다고 봤다. ASL-3 배포 보호에는 Constitutional Classifiers, 탈옥 모니터링, 버그 바운티, 위협 인텔리전스가 들어간다. 보안 기준은 100개 이상 통제 항목으로 구성되며, 가중치 접근 2인 승인과 egress 대역폭 통제가 포함된다 ([Anthropic ASL-3](https://www.anthropic.com/news/activating-asl3-protections)). OpenAI는 [공식] gpt-5-thinking을 Preparedness Framework 기준 생물·화학 **High**로 분류했다. 확정적 증거는 없지만 예방적으로 판단했다고 밝혔다. 이 내용은 원문 403으로 검색 요약에서 확인했다 ([GPT-5 System Card](https://openai.com/index/gpt-5-system-card)). Google은 [공식] Frontier Safety Framework로 평가했고, Gemini 2.5 Pro는 "어떤 영역에서도 Critical Capability Level에 도달하지 않았다"고 보고했다 ([Gemini 2.5 보고서](https://arxiv.org/html/2507.06261v1)). Meta는 Llama 3를 내면서 안전 분류기 Llama Guard 3를 함께 공개했고, 멀티모달 확장은 "아직 광범위하게 공개되지 않았다"고 적어 기능별 단계적 출시를 보여 줬다 ([Llama 3 보고서](https://arxiv.org/abs/2407.21783)).

[추론]으로 보면 2025년 두 사례(Opus 4, GPT-5 thinking) 모두 임계치 판단이 불확실한 상태에서 상향 조치를 켜고 출시했다. 프레임워크가 관문이라기보다 보호 장치 선택 장치로 작동한다는 뜻이다. 평가 결과 때문에 출시를 연기하거나 취소한 구체 사례는 1차 자료로 확인 못 함이다. 2026년에 개정된 RSP, Preparedness, FSF의 세부 변경도 확인 못 함이다. 중국 오픈웨이트 업체의 출시 전 위험 역량 평가 절차는 열람한 보고서 범위 안에서 **공개되지 않음**이다.

---

## 3. 자체 운영은 가동률 100%를 가정해도 턴당 0.4~3원, 같은 모델 API는 0.2~0.6원

### 3.1 쓸 수 있는 모델: 상업 이용 제약이 적은 쪽은 Apache 2.0과 MIT

한국어 롤플레이 챗 후보 가운데 상업 이용 제약이 가장 적은 것은 Gemma 4(Apache 2.0), Qwen3(Apache 2.0), DeepSeek V4-Flash(MIT)다. **Gemma 4 31B**는 [1차] dense 30.7B, 60층, 256K이고 "140개 이상 언어로 사전학습, 35개 이상 즉시 지원"이라고 하지만 한국어를 따로 언급하지 않는다. 점수는 MMLU Pro 85.2, MMMLU 88.4, GPQA Diamond 84.3이다. 26B-A4B는 MMLU Pro 82.6, MMMLU 86.3이다 ([HF gemma-4-31B-it](https://huggingface.co/google/gemma-4-31B-it)). **Qwen3-32B**는 [1차] 64층, KV 헤드 8개(GQA), 기본 32K(YaRN 시 131K)이고 100개 이상 언어를 지원한다 ([HF Qwen3-32B](https://huggingface.co/Qwen/Qwen3-32B)). **DeepSeek V4-Flash**는 [1차] 284B/13B MoE, FP4/FP8 혼합 가중치, 100만 토큰 컨텍스트, MIT다 ([HF DeepSeek-V4-Flash](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash)). [추정]으로 가중치만 150~200GB급이어서 단일 80GB GPU에는 올라가지 않는다. 이 프로젝트 규모에서는 API로 쓰는 것이 현실적이다.

한국 모델은 라이선스가 걸린다. **EXAONE 4.0**은 [1차] "EXAONE AI Model License 1.2 - NC"이고, 상업 이용 허용 여부는 페이지에 명시되어 있지 않다 ([HF EXAONE-4.0-32B](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-32B)). LG 블로그는 상업 이용을 상용 API로 제공한다고 설명한다 ([LG AI Research](https://www.lgresearch.ai/blog/view?seq=576)). 상업 조건(가격, 절차)은 확인 못 함이다. 공개된 한국어 벤치마크로는 EXAONE 모델카드의 EXAONE 4.0 32B 대 Qwen3-32B 비교 정도만 찾았다.

| 지표(모델카드 기재) | EXAONE 4.0 32B | Qwen3 32B |
|---|---|---|
| KMMLU-Pro (추론 / 비추론) | 67.7 / 60.0 | 61.4 / 58.3 |
| KMMLU-Redux (추론 / 비추론) | 72.7 / 64.8 | 67.5 / 64.4 |
| KSM (추론 / 비추론) | 87.6 / 59.8 | 82.8 / 41.3 |
| Ko-LongBench (비추론) | 76.9 | 73.9 |

출처: [HF EXAONE-4.0-32B](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-32B). 벤더가 직접 기재한 비교라는 점을 감안해야 한다. Gemma 4의 KMMLU, LogicKor, KoMT-Bench 점수는 조사했으나 찾지 못함이다. W&B Horangi 한국어 리더보드는 버전 4까지 나왔지만 현재 순위는 확인 못 함이다 ([Horangi](https://wandb.ai/wandb-korea/korean-llm-leaderboard/reports/Horangi-LLM-Leaderboard-Evaluating-Korean-Language-Proficiency--Vmlldzo2OTg0MDU2)). 롤플레이 품질(캐릭터 유지, 한국어 문체)은 공개 벤치마크로 대신 판단할 수 없어 자체 실측이 필요하다. Llama 4는 계열사 포함 MAU 7억 초과 시 별도 라이선스가 필요하고, EU 소재 기업·개인의 멀티모달 모델 권리가 제한된다 ([Meta FAQ](https://developer.meta.com/ai/faq/)). Tencent Hy3-preview는 한국을 이용 지역에서 제외했다(S, 2차).

### 3.2 서빙 엔진: TGI는 유지보수 모드, 기본 선택지는 vLLM과 SGLang

HF 공식 문서에 따르면 [1차] TGI는 "now in maintenance mode"이고 vLLM과 SGLang을 권장한다 ([HF TGI docs](https://huggingface.co/docs/text-generation-inference/en/index.md)). 전환 날짜를 2025-12-11로, 저장소 보관을 2026-03-21로 적은 2차 출처가 있지만 공식으로는 확인 못 함이다 ([Spheron](https://www.spheron.network/blog/migrate-tgi-to-vllm-sglang-2026/)). vLLM에는 [1차] Gemma 4 공식 레시피가 있다. 26B-A4B는 BF16으로 A100/H100 1장(`--max-model-len 32768 --gpu-memory-utilization 0.90`)에 올리고, 31B는 2장 TP 예시를 든다. 전용 assistant 모델로 추측 디코딩(권장 추측 토큰 26B-A4B 4, 31B 4~8)을 하고, `--kv-cache-dtype fp8`로 KV 메모리를 약 50% 줄인다. 배포는 nightly wheel이나 `vllm/vllm-openai:latest` 이미지로 한다 ([vLLM Gemma 4 레시피](https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html)).

이 서비스에서 가장 중요한 엔진 기능은 프리픽스 캐싱이다. 시스템 프롬프트, 캐릭터 카드, 메모리 블록이 턴마다 반복되기 때문이다. vLLM V1은 [1차] KV 블록 해시를 부모 블록 해시, 블록 토큰, LoRA ID·멀티모달 해시·`cache_salt` 같은 추가 키로 만든다. 가득 찬 블록만 캐시하고, 참조 없는 블록은 LRU로 축출한다. 해시 키에 LoRA ID가 들어가므로 LoRA 서빙과 프리픽스 캐시가 함께 동작한다. 기본 해시 sha256은 pickle을 쓰기 때문에 Python이나 vLLM 버전이 다르면 해시가 어긋날 수 있다. 결정적 캐싱이 필요하면 `sha256_cbor`를 쓰고, 멀티테넌트 격리는 `cache_salt`로 한다 ([vLLM Prefix Caching](https://docs.vllm.ai/en/latest/design/prefix_caching.html)). 프리픽스 캐싱이 기본으로 켜지는지는 이 문서에 없어 확인 못 함이다. SGLang RadixAttention 공식 문서는 열람하지 못했다.

엔진 간 처리량 비교는 공개 자료가 하나뿐이다. GPUStack이 Qwen3-32B BF16, H100 SXM 1장, ShareGPT 1,000건, 동시성 제한 없음 조건에서 측정한 결과다 ([GPUStack](https://docs.gpustack.ai/latest/performance-lab/qwen3-32b/h100)).

| 엔진(버전) | 출력 tok/s | 총 tok/s | 평균 TTFT | 평균 TPOT |
|---|---|---|---|---|
| vLLM v0.11.0 | 1,131.55 | 2,352.82 | 78.1 s | 88.09 ms |
| SGLang v0.5.5.post1 | 814.03 | 1,690.84 | 115.7 s | 57.86 ms |
| TensorRT-LLM v1.2.0rc1 | 1,280.04 | 2,659.50 | 65.3 s | 61.90 ms |

요청 1,000건을 한꺼번에 넣은 측정이라 TTFT가 수십 초다. 대화형 SLA와는 조건이 다르므로 처리량 상한 참고치로만 써야 한다. SGLang, TRT-LLM, LMDeploy, llama.cpp, Ollama의 공식 기능 목록(continuous batching, multi-LoRA, 추측 디코딩, OpenAI 호환 API)은 이 조사에서 열람하지 못했다. Gemma 4를 엔진별로 비교한 공개 벤치마크는 조사했으나 찾지 못함이다. llama.cpp와 Ollama는 GGUF 기반 로컬·소규모용이라는 것이 일반적인 이해다. 다만 공식 비교 자료는 확보하지 못했다.

### 3.3 서버 구성: Gemma 4 슬라이딩 윈도가 KV를 4분의 1로 줄인다

메모리는 가중치와 KV 캐시로 나뉜다. 가중치는 대략 "파라미터 수 × 바이트"(BF16 2, FP8 1, INT4 약 0.5~0.6)다. KV는 "층 × KV 헤드 × head_dim × 2(K,V) × 바이트 × 토큰"이다. [1차] config 값은 이렇다. Gemma 4 31B는 60층(sliding 50, full 10)이고, sliding 층은 KV 16개 × head_dim 256, global 층은 KV 4개 × 512, 윈도 1,024, `attention_k_eq_v: true`다 ([config.json](https://huggingface.co/google/gemma-4-31B-it/raw/main/config.json)). 26B-A4B는 30층(sliding 25, full 5)이고 sliding KV 8개 × 256, global KV 2개 × 512다 ([config.json](https://huggingface.co/google/gemma-4-26B-A4B-it/raw/main/config.json)). Qwen3-32B는 64층 × KV 8개이고, head_dim 128은 직접 재확인하지 않은 전제다. 이 값으로 계산하면 다음과 같다.

| 모델 | 4K 토큰 대화 1건당 KV (BF16) | FP8 KV | 비고 |
|---|---|---|---|
| Qwen3-32B | ≈1.05 GB | ≈0.52 GB | 256 KiB/토큰 |
| Gemma 4 31B(윈도 적용) | ≈1.0 GB | ≈0.5 GB | 엔진이 윈도 밖 블록을 해제하지 않으면 ≈3.4 GB |
| Gemma 4 26B-A4B(윈도 적용) | ≈0.25 GB | ≈0.13 GB | |

계산값이다. Gemma 4의 절감 효과는 엔진이 슬라이딩 윈도 밖 블록을 실제로 해제하는지, K=V 통합이 저장에 반영되는지에 달려 있다. 이 부분은 확인 못 함이다. 가중치는 [1차] vLLM 레시피 기준으로 31B BF16 약 59.0GB, QAT W4A16 약 19.8GB다. 26B-A4B는 int8 per-channel로 약 47% 줄어든다. 26B MoE는 전문가 차원이 작아 4비트 품질 손실이 커서 QAT W4A16 대상에서 빠졌다. 공식 최소 사양은 두 모델 모두 BF16 기준 80GB GPU 1장이다 ([vLLM Gemma 4 레시피](https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html)). 80GB GPU에서 utilization 0.9(약 72GB 사용 가능)로 어림한 동시 4K 대화 수는 다음과 같다. 31B BF16은 약 10건이고, 레시피가 31B를 TP 2장으로 안내하는 것과 맞는다. 31B W4A16은 약 50건(FP8 KV면 약 100건), 26B-A4B BF16은 약 80건, Qwen3-32B FP8은 약 38건이다. 모두 [추정]이다.

| GPU | 적합 구성 [추정, 계산 기반] |
|---|---|
| RTX 4090 / L4 (24GB) | 30B급은 INT4만 들어가고 KV 여유가 거의 없음. 양자화 26B-A4B를 L4 1장에서 돌린 사례 있음 ([DEV](https://dev.to/ratibor78/running-gemma-4-26b-on-gke-with-a-single-l4-gpu-4l6g)) |
| RTX 5090 (32GB) | 31B W4A16 + KV 약 10GB |
| L40S (48GB) | 31B W4A16 또는 FP8(약 31GB), 26B-A4B int8(약 26GB) |
| A100/H100 80GB | 26B-A4B BF16 1장, 31B는 FP8/INT4로 1장 또는 BF16으로 2장 |
| H200 (141GB) | 31B BF16 + KV 약 60GB |

양자화 근거는 영어 벤치마크 위주다. Red Hat·IST Austria의 Llama-3.1 50만 회 이상 평가에서 FP8 W8A8은 오차 범위 안에서 정확도를 유지했고, INT8은 1~3% 하락, INT4 weight-only는 INT8과 경쟁할 만했다. 이 연구에서는 GPTQ가 AWQ보다 나았다 ([arXiv 2411.02355](https://arxiv.org/html/2411.02355v2)). 반대로 405B까지 평가한 2024년 연구는 AWQ의 하락이 더 작다고 보고했다 ([arXiv 2409.11055](https://arxiv.org/html/2409.11055v1)). GPUStack에서 Qwen3-32B를 FP8로 바꾸자 처리량이 50.6% 늘었다 ([GPUStack](https://docs.gpustack.ai/latest/performance-lab/qwen3-32b/h100)). 한국어 롤플레이 문체에 양자화가 미치는 영향을 잰 연구는 조사했으나 찾지 못함이다. 그래서 BF16과 자체 비교 측정이 필요하다. A100이 FP8 텐서코어가 없는 세대라는 점은 일반 지식이고, 이 조사에서 출처는 확보하지 못했다.

운영 리스크도 문서로 남아 있다. Gemma 4 26B를 vLLM data-parallel로 띄우면 기동은 되지만 첫 요청에서 실패한다는 사용자 보고가 있다 ([HF 포럼](https://discuss.huggingface.co/t/successfully-running-gemma4-26b-on-prem-looking-to-discuss-deployment-struggles-stable-setups/176145)). 레시피가 nightly나 latest 이미지를 안내한다는 점도 버전 고정이 어렵다는 신호다. TGI의 유지보수 모드 전환은 엔진 선택 자체가 장기 리스크라는 사례다. GPU가 1~2장이면 단일 장애점이 되므로, 같은 오픈 모델을 파는 API를 폴백으로 두는 구성이 자연스럽다([추정]). 추적할 지표는 TTFT, TPOT, 프리픽스 캐시 적중률, KV 사용률이다. 모델 로딩과 콜드스타트 실측, RunPod 서버리스 콜드스타트 수치, vLLM Prometheus 메트릭 목록, KServe·Ray Serve 오토스케일링 가이드는 조사했으나 찾지 못했거나 열람하지 못했다.

### 3.4 비용 추정: 손익분기는 H100 1장당 시간당 약 13,850턴

턴 가정은 입력 약 4,000토큰(시스템 프롬프트 + 메모리 + 최근 대화, 대부분 캐시 적중), 출력 100~300토큰이다. 셀프호스팅 턴당 비용은 "GPU 시간당 가격 ÷ 시간당 처리 턴 수"다. GPU 가격([1차] 2026-11-01 열람)은 이렇다. RunPod H100 SXM은 Secure $3.99, Community $2.69, Serverless $5.39이고, L40S는 $1.09/$0.79/$1.75, A100 80GB는 $1.79/$1.19~1.39/$2.72, L4는 $0.59/$0.44/$0.75다 ([RunPod pricing](https://www.runpod.io/pricing)). Lambda H100 SXM 1장은 $4.29, B200은 $6.99다 ([Lambda](https://lambda.ai/pricing)). AWS g6e.xlarge(L40S 1장)는 On-Demand $1.861, 3년 RI $0.804다 ([vantage](https://instances.vantage.sh/aws/ec2/g6e.xlarge)). DeepInfra 전용 GPU는 H100 $2.90, H200 $3.49다 ([DeepInfra](https://deepinfra.com/pricing)). RunPod H100 SXM이 2026년 7월 중순 $2.99에서 인상됐다는 추적 기록도 있다. 출처마다 값이 다르므로 결제 전에 다시 확인해야 한다 ([usagepricing](https://usagepricing.com/blueprint/activity/runpod-2026-07-14-price-change)). AWS가 2026-07-01부터 GPU 가격을 20% 올렸다는 단일 한국어 출처는 미검증이다. 네이버클라우드, NHN의 H100 시간당 요금은 조사했으나 찾지 못함이고, KT K GPUaaS 시간당 요금은 확인 못 함이다.

GPUStack 처리량(Qwen3-32B, H100 SXM 1장, 랜덤 데이터라 프리픽스 캐시 효과 없음)을 대입한 계산값은 다음과 같다 ([GPUStack](https://docs.gpustack.ai/latest/performance-lab/qwen3-32b/h100)).

| 시나리오 | 총 tok/s | 턴/시간 | RunPod Secure $3.99 | Community $2.69 |
|---|---|---|---|---|
| 4K/200, vLLM BF16 | 2,149 | ≈1,842 | ≈3.0원 | ≈2.0원 |
| 4K/200, FP8 최적화 | 4,929 | ≈4,225 | ≈1.32원 | ≈0.89원 |
| 2K/100, vLLM BF16 | 3,195 | ≈5,477 | ≈1.02원 | ≈0.69원 |
| 2K/100, FP8 최적화 | 5,902 | ≈10,118 | ≈0.55원 | ≈0.37원 |

전제는 24시간 내내 포화 상태(가동률 100%)라는 것이다. 동시 요청을 대량으로 넣은 측정이라 TTFT가 수십 초이고, 대화형 응답 시간을 지키려고 동시성을 낮추면 처리량도 떨어진다. "최적화" 행의 서빙 명령은 문서에 trtllm-serve와 sglang이 섞여 있어 어느 엔진 수치인지 불분명하다(문서 자체의 불일치).

같은 오픈 모델을 서버리스 API로 쓰면 이렇다. [1차] DeepInfra 가격($/1M 토큰, 입력/캐시 입력/출력)은 Gemma 4 31B turbo 0.09/0.05/0.34, Gemma 4 26B A4B 0.07/–/0.34, Qwen3-32B 0.08/–/0.28, DeepSeek-V4-Flash 0.09/0.018/0.18이다 ([DeepInfra pricing](https://deepinfra.com/pricing)). 입력 4,000 중 3,500 캐시 적중, 출력 200을 가정한 계산값은 Gemma 4 31B turbo **약 0.40원**(캐시 미적용 0.60원), 26B-A4B 0.49원, Qwen3-32B 0.53원, DeepSeek-V4-Flash **약 0.20원**이다. 비교용으로 우리가 쓰는 상용 소형 모델도 계산해 볼 수 있다. GPT-6 Luna와 Haiku 5.5를 2차 출처 가격(입력 $0.10, 출력 $0.50)에 캐시 없이 같은 턴으로 넣으면 약 0.70원이다. 다만 가격이 확인 못 함이고 캐시 할인율도 반영하지 않은 [추정]이다.

손익분기도 계산값으로 나온다. H100 $3.99/h로 Gemma 4 31B turbo API 턴당 $0.000288과 같아지려면 시간당 **약 13,850턴**(초당 약 3.85턴)을 쉬지 않고 처리해야 한다. DeepSeek-V4-Flash API와 맞추려면 시간당 약 27,700턴이 필요하다. 공개 벤치마크 최고치(시간당 약 10,100턴)로도 여기에 못 미친다. 반대 방향의 요인도 있다. 실제 턴은 입력 대부분이 캐시 적중이라 prefill 부하가 벤치마크보다 훨씬 작고, 26B-A4B(활성 3.8B)는 dense 32B보다 처리량이 몇 배 높을 수 있다. 하지만 Gemma 4의 공개 처리량, 캐시 적중률이 높은 워크로드 실측, L40S의 30B급 수치는 모두 조사했으나 찾지 못함이다. 그러니 이 방향은 부하 테스트 전까지 가설이다. 서버리스 GPU는 상시 Pod보다 27~61% 비싸지만(RunPod: H100 +35%, L40S +61%, L4 +27%) 저트래픽 때 유휴 비용을 없앤다 ([RunPod](https://www.runpod.io/pricing)). 정리하면 가동률이 낮은 과제 단계에서는 상용 API나 오픈 모델 서버리스 API가 1원 목표에 더 쉽게 들어간다. 셀프호스팅은 꾸준히 높은 트래픽으로 GPU 가동률을 유지할 수 있을 때만 경쟁력이 생긴다.

---

## 4. 오픈 모델 개선은 학습 없는 수단부터, 파인튜닝은 서빙 비용과 함께 따져야 한다

### 4.1 학습 없는 개선이 비용 대비 효과가 가장 크다

기억 추출 JSON은 학습보다 제약 디코딩으로 형식 오류를 먼저 막는 것이 순서다. vLLM은 [본문 확인] `json`(JSON schema/Pydantic), `regex`, `choice`, `grammar`(EBNF), `structural_tag`를 지원한다. 백엔드는 xgrammar와 guidance(기본 `auto`)이고, lm-format-enforcer는 v0.33.0부터 deprecated다. OpenAI 호환 API에서는 `response_format={"type":"json_schema", ...}`로 넘긴다. 문서는 백엔드마다 결과가 다를 수 있으니 먼저 검증하라고 하고, 프롬프트에도 스키마를 적으라고 권한다 ([vLLM Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html)). 단, 제약 디코딩은 형식 유효성만 보장하고 누락·환각 같은 내용 정확성은 보장하지 않는다. 그래서 지표를 형식 통과율과 사실 단위 precision/recall로 나눠야 한다([추론]). Qwen3는 [본문 확인] thinking 모드가 기본값이고 `enable_thinking=False`로 끌 수 있다. 권장 샘플링은 non-thinking에서 T=0.7, TopP 0.8, TopK 20이다 ([HF Qwen3-32B](https://huggingface.co/Qwen/Qwen3-32B)). 롤플레이 응답과 JSON 추출에서 thinking 토큰은 비용만 늘린다. 비용 순서로 놓으면 (1) thinking 끄기와 출력 길이 제한, (2) 고정 접두부 캐싱, (3) 제약 디코딩, (4) 말투 규칙 판정 후 재생성(재생성 비율만큼 비용 증가), (5) 파인튜닝이다([추론]). 앞 단계로 목표를 달성하면 파인튜닝이 필요 없을 수 있다. 말투 지시 준수율을 프롬프트 기법별로 비교한 한국어 연구는 조사했으나 찾지 못함이다. DeepSeek와 DeepInfra API의 캐시 할인율과 JSON schema 강제 지원 여부도 확인 못 함이다.

### 4.2 파인튜닝: 30B급 QLoRA는 1장, 하지만 LoRA는 덜 배우고 덜 잊는다

메모리 기준선은 [본문 확인] Unsloth 문서에 있다. QLoRA(4-bit)/LoRA(16-bit) 최소 VRAM은 27B 22GB/64GB, 32B 26GB/76GB, 70B 41GB/164GB이고, 문서 스스로 "the absolute minimum"이라고 한다 ([Unsloth Requirements](https://unsloth.ai/docs/get-started/beginner-start-here/unsloth-requirements)). Gemma 4는 31B QLoRA 22GB, 26B-A4B LoRA >40GB다. 26B-A4B(MoE)는 full FT를 하지 말고 16-bit LoRA를 쓰라고 하며, 코드 주석에 "MoE QLoRA not recommended, dense 31B is fine"이라고 적혀 있다 ([Unsloth Gemma 4](https://unsloth.ai/docs/models/gemma-4/train)). 26B-A4B 16-bit LoRA를 ~24GB+로 적은 2차 출처도 있지만 공식 문서(>40GB)가 우선이다. 예제 하이퍼파라미터는 r=8, alpha=8, max_seq_length 8192, lr 2e-4, adamw_8bit, 전체 학습은 1 epoch다. 알려진 이슈도 있다. loss가 100, 300처럼 나오면 gradient accumulation 문제이고, `num_kv_shared_layers = 0` 때문에 IndexError가 나며, RL(GRPO)에서는 "Gemma 4 is not supported by vLLM"이라 `fast_inference=False`를 쓰라고 한다. 이 문구가 vLLM 추론 일반을 말하는지 Unsloth의 fast_inference 경로만 말하는지는 확인 못 함이다. export 후 품질이 떨어지면 학습 때와 chat template, EOS가 같은지부터 확인하라고 안내한다.

방법 선택의 근거는 이렇다. LoRA는 GPT-3 175B에서 학습 파라미터를 10,000배, GPU 메모리를 3배 줄였다([미재확인], [arXiv 2106.09685](https://arxiv.org/abs/2106.09685)). QLoRA는 65B를 48GB GPU 1장에서 학습하면서 16-bit full FT 성능을 유지했다고 주장한다([미재확인], [arXiv 2305.14314](https://arxiv.org/abs/2305.14314)). 반면 "LoRA Learns Less and Forgets Less"는 [본문 확인] 코딩·수학에서 LoRA가 full FT에 "substantially underperforms"하지만 목표 밖 성능과 생성 다양성은 더 잘 보존한다고 보고했다. full FT가 학습하는 변화량의 rank는 일반 LoRA 설정보다 10~100배 높았다 ([arXiv 2405.09673](https://arxiv.org/abs/2405.09673)). 그래서 LoRA는 말투나 JSON 형식 같은 좁은 행동 교정에 맞고 새 지식 주입에는 덜 맞는다. 비용은 [추정]으로 수천~1만 샘플 SFT 1 epoch에 H100 1장 수 시간~하루, 시간당 $2~4면 약 $10~100이다. 30B급 LoRA 실측 학습 시간과 비용은 확인 못 함이다. 도구로는 TRL·PEFT([미재확인], [TRL](https://huggingface.co/docs/trl/index)), Unsloth([본문 확인]), Axolotl, LLaMA-Factory, torchtune([미재확인])이 있고, torchtune의 현재 유지보수 상태는 확인 못 함이다.

핵심 함정은 학습 비용보다 서빙 비용이다. 파인튜닝한 모델은 3.4절의 서버리스 단가를 그대로 쓸 수 없고, LoRA 어댑터를 받아 주는 호스팅이나 자체 GPU가 필요하다. 이는 1원/턴 제약과 충돌할 수 있다([추론]). Qwen3-32B와 DeepSeek의 LoRA 어댑터를 서버리스로 서빙할 수 있는지, 단가는 얼마인지는 확인 못 함이다. DeepSeek-V3/R1급의 LoRA 메모리는 조사했으나 공식 수치를 찾지 못했다.

### 4.3 선호 최적화: 자동 판정 가능한 실패는 KTO와 GRPO의 데이터 비용을 낮춘다

방법마다 필요한 데이터와 부품이 다르다. 아래 표는 노트가 각 논문 초록에서 정리한 것이고, 각 논문은 모두 [미재확인]이다.

| 방법 | 필요한 데이터 | 참조 모델 | 보상모델 | 온라인 생성 | 출처 |
|---|---|---|---|---|---|
| PPO-RLHF | 순위/쌍 선호 → RM | 필요 | 필요 | 필요 | [arXiv 2203.02155](https://arxiv.org/abs/2203.02155) |
| DPO | 쌍(chosen/rejected) | 필요 | 불필요 | 불필요 | [arXiv 2305.18290](https://arxiv.org/abs/2305.18290) |
| ORPO | 쌍, SFT와 동시 | 불필요 | 불필요 | 불필요 | [arXiv 2403.07691](https://arxiv.org/abs/2403.07691) |
| KTO | 단일 출력 + 좋음/나쁨 | 필요 | 불필요 | 불필요 | [arXiv 2402.01306](https://arxiv.org/abs/2402.01306) |
| SimPO | 쌍 | 불필요 | 불필요 | 불필요 | [arXiv 2405.14734](https://arxiv.org/abs/2405.14734) |
| GRPO | 프롬프트 + 보상 함수 | 보통 KL용 | 규칙으로 대체 가능 | 필요 | [arXiv 2402.03300](https://arxiv.org/abs/2402.03300) |

KTO는 1B~30B에서 DPO와 같거나 더 낫다고 보고했다. SimPO는 AlpacaEval 2에서 DPO보다 최대 6.4점 높았다고 보고했다. 이 제품의 대표 실패인 "반말 캐릭터가 존댓말을 섞음"은 어미 패턴 규칙으로 자동 라벨링할 수 있다. 그래서 KTO의 이진 데이터나 GRPO의 보상으로 바로 바꿀 수 있다([추론]). 기억 추출은 정답 라벨이 있으면 SFT가 먼저다. 형식은 제약 디코딩이 맡으므로 학습은 무엇을 추출하는지에 써야 한다. 다만 위 결과는 대부분 영어 벤치마크다. 한국어 롤플레이에 DPO·KTO를 적용한 정량 결과와, 같은 조건에서 방법끼리 비교한 연구는 조사했으나 찾지 못함이다.

### 4.4 데이터와 증류: 상용 API 출력은 약관이 막고, Apache 2.0 교사가 가장 깨끗하다

큰 모델 출력으로 작은 모델을 학습하는 방법의 효과는 R1-Distill로 확인됐다(2.3절). 그러나 상용 API 출력을 학습 데이터로 쓰는 것은 약관 문제다. Anthropic AUP는 [본문 확인] 사전 승인 없이 출력으로 AI 모델을 학습하는 행위('모델 증류' 포함)를 금지한다 ([Anthropic AUP](https://www.anthropic.com/legal/aup)). 상업 약관 D.4는 경쟁 AI 모델 학습을 금지하고, Section B에서 출력 소유권은 고객에게 있다고 한다 ([Commercial Terms](https://www.anthropic.com/legal/commercial-terms)). Google Gemini API 추가 약관은 [본문 확인] 서비스와 경쟁하는 모델 개발을 금지한다 ([Gemini API Terms](https://ai.google.dev/gemini-api/terms)). OpenAI 약관의 "using Output to develop models that compete with OpenAI" 금지는 페이지 403으로 검색 결과에서만 확인했다 ([OpenAI Terms](https://openai.com/policies/row-terms-of-use/)). Gemma 4 라이선스 링크는 [본문 확인] Apache 2.0 전문으로 연결된다. 기존 Gemma Terms(증류를 파생물에 포함)는 Appendix에 나열된 모델에만 적용되는데, Gemma 4는 Appendix에 없다 ([Gemma 4 license](https://ai.google.dev/gemma/apache_2)). 옆에 있는 별도 "Prohibited use" 링크가 Gemma 4에 적용되는지는 확인 못 함이다. DeepSeek API 약관의 출력 학습 조항과 이 약관들의 한국 법상 집행 가능성도 확인 못 함이다. 법률 자문은 아니지만, 교사 모델로는 Apache 2.0 오픈 모델(Gemma 4, Qwen3)이 가장 안전하다. 상용 API를 판정(judge)용으로 쓰는 것과 그 출력을 학습 데이터로 쓰는 것은 따로 판단해야 한다.

공개 한국어 데이터는 바로 쓰기 어렵다. huggingface-KREW/korean-role-playing은 [본문 확인] Apache 2.0, 약 35.3k 멀티턴이다. 다만 약 32.4k가 영어 SmolTalk를 gpt-4o-mini로 한국어화한 것이고, 890개는 gpt-4o 응답이다. user 남성/assistant 여성 가정과 응답 스타일 편향을 카드가 직접 밝힌다 ([KREW 데이터셋](https://huggingface.co/datasets/huggingface-KREW/korean-role-playing)). 데이터셋 라이선스와 별개로 원 생성물의 OpenAI 약관 문제가 남는다([추론]). NLPBada/korean-persona-chat-dataset(MIT)에는 파일명상 반말 데이터로 보이는 파일이 있지만 카드 내용은 확인 못 함이다 ([NLPBada](https://huggingface.co/datasets/NLPBada/korean-persona-chat-dataset/blob/main/banmal_train_8263.csv)). NVIDIA Nemotron-Personas-Korea는 대화가 아니라 KOSIS 기반 합성 페르소나 프로필 100만 레코드(CC BY 4.0)여서 캐릭터 시드로 쓸 수 있다. 이 내용은 검색 결과 요약으로만 확인했다 ([헤럴드경제](https://www.heraldk.com/article/2026042023131252045)). 하오체 같은 말투 라벨이 붙은 공개 롤플레이 데이터와 한국어 장기기억 JSON 추출 데이터셋은 조사했으나 찾지 못함이다. 영어권 방법론으로는 RoleLLM(168,093 샘플, 캐릭터 프로필 → 강한 모델로 말투 합성 → 오픈 모델 학습, [arXiv 2310.00746](https://arxiv.org/html/2310.00746v3))과, 엄선한 1,000개 예시로 SFT한 LIMA([미재확인], [arXiv 2305.11206](https://arxiv.org/abs/2305.11206))가 근거가 된다. 둘을 합치면 말투 데이터는 캐릭터 카드에 말투를 지정하고, Apache 2.0 교사로 생성하고, 어미 규칙 판정기로 거른 뒤, 위반 샘플은 KTO의 undesirable 라벨로 재활용하는 방식으로 직접 합성할 수 있다([추론]). 기억 추출은 사람이 만든 정답 JSON 수백 개를 held-out 평가셋으로 먼저 고정한 뒤 학습셋을 합성하는 순서가 맞다.

### 4.5 평가: 개선은 고정된 held-out 셋과 편향을 통제한 판정으로만 주장할 수 있다

LLM-as-judge는 사람 선호와 80% 이상 일치해 사람끼리의 일치도와 비슷하다. 다만 위치, 장황함, 자기 강화 편향이 있다([미재확인], [arXiv 2306.05685](https://arxiv.org/abs/2306.05685)). 그래서 말투처럼 규칙으로 잴 수 있는 항목은 규칙 판정을 쓰고, 품질 비교는 위치를 바꿔 두 번 판정하며, 교사와 같은 계열 모델이 판정하지 않게 해야 한다. 롤플레이 전용 벤치마크로는 CharacterEval(중국어, 캐릭터 77명, 멀티턴 대화 1,785개, 13개 지표. 사람 주석으로 학습한 CharacterRM이 GPT-4보다 사람과 상관이 높음, [arXiv 2401.01275](https://arxiv.org/html/2401.01275v1))과 RPEval([arXiv 2505.13157](https://arxiv.org/pdf/2505.13157))이 있다. 한국어 롤플레이·말투 일관성 공개 벤치마크와 한국어에서 judge와 사람의 일치도는 조사했으나 찾지 못함이다. LoRA도 망각이 0은 아니므로([arXiv 2405.09673](https://arxiv.org/abs/2405.09673)) 학습 전후로 일반 한국어 능력과 안전 거부 행동의 회귀 테스트가 필요하다. 파인튜닝이 안전 정렬을 약화시킨다는 연구([arXiv 2310.03693](https://arxiv.org/abs/2310.03693))는 원문을 확인 못 했다. 위험 목록은 합성 데이터의 말투 편향, 판정 모델과 교사 모델의 자기 선호, 평가셋 오염, 약관 위반 데이터, 안전 정렬 약화, LoRA 서빙 때문에 서버리스 단가를 못 쓰는 비용 위험이다. 측정 순서는 평가셋·지표·합격선을 먼저 고정하고, 현재 프롬프트로 기준선을 잰 뒤, 한 번에 한 변수만 바꿔 표로 비교하는 것이다.

---

## 결론

이 조사에서 가장 쓸모 있는 발견은 공개 범위의 비대칭이다. 출시 날짜는 1차 출처로 촘촘하게 확인되고, 오픈 진영은 GPU 시간과 단계별 샘플 수까지 공개한다. 반면 실제로 우리가 호출하는 상용 소형 모델(gpt-6-luna, claude-haiku-5-5, gemini-3.5-flash-lite)이 어떻게 만들어졌는지는 하나도 공개되지 않았다. 그래서 면접에서 "상용 LLM은 이렇게 만든다"고 말할 때 근거는 DeepSeek, Qwen, Gemma, Gemini 보고서다. 상용 소형 티어에 대해서는 "Google은 Flash 이하를 증류로 만든다고 공식 확인했고, OpenAI와 Anthropic은 공개하지 않았다"까지가 사실의 경계다. 이 경계를 지키는 것 자체가 실측으로만 결정한다는 과제의 원칙과 맞는다.

비용 쪽 결론은 숫자 하나로 압축된다. H100 1장이 같은 오픈 모델의 API 단가를 이기려면 시간당 약 13,850턴을 24시간 처리해야 하는데, 공개 벤치마크 최고치도 그 아래다. 우리가 상용 API를 쓰는 이유는 취향이 아니라 이 가동률 문턱이다. 이 문턱을 낮출 수 있는 두 변수, 즉 캐시 적중이 높은 실제 워크로드의 처리량과 Gemma 4 26B-A4B 같은 MoE의 처리량은 공개 자료가 없어 자체 부하 테스트로만 확인할 수 있다. 개선 쪽에서는 파인튜닝이 품질 문제를 비용 문제로 바꾼다는 점이 드러났다. 학습은 $10~100 규모로 싸지만([추정]), 어댑터를 서빙하는 순간 턴당 0.2~0.6원짜리 서버리스 단가를 잃는다. 그래서 학습 없는 수단(thinking 끄기, 캐싱, 제약 디코딩, 규칙 판정 재생성)을 측정으로 소진한 뒤에야 파인튜닝을 검토할 근거가 생긴다. 1장의 종료 일정(gpt-5-nano 2026-12-11, claude-sonnet-4-5 2026-11-30)은 비교 기준선 모델을 언제 바꿔야 하는지를 정한다.
