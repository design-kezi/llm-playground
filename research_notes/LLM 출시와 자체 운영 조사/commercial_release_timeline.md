# 상용(클로즈드 웨이트, API) LLM 출시 타임라인 (2024-01 ~ 2026-11)

조사일: 2026-11-01. 표기 규칙은 이렇다. 출처가 있는 사실만 적었다. 출처끼리 다르면 둘 다 적었다. 날짜는 있지만 1차 출처로 교차 확인하지 못한 항목은 "확인 못 함"으로 표시했다. 찾아봤지만 나오지 않은 항목은 "조사했으나 찾지 못함"으로 표시했다.

**핵심 1차 출처 (아래에서 반복 인용)**
- [OPENAI-CL] OpenAI API changelog: https://developers.openai.com/api/docs/changelog
- [OPENAI-DEP] OpenAI deprecations: https://developers.openai.com/api/docs/deprecations (platform.openai.com/docs/deprecations에서 301 리다이렉트)
- [ANT-DEP] Anthropic model deprecations: https://platform.claude.com/docs/en/docs/about-claude/model-deprecations (docs.anthropic.com에서 301 리다이렉트)
- [ANT-WIKI] Wikipedia "Claude (language model)": https://en.wikipedia.org/wiki/Claude_(language_model). 각 날짜에 붙은 시스템 카드/뉴스 URL도 함께 적었다.
- [GEM-CL] Gemini API release notes: https://ai.google.dev/gemini-api/docs/changelog
- [GROK-WIKI] Wikipedia "Grok (chatbot)": https://en.wikipedia.org/wiki/Grok_(chatbot). xAI 공식 페이지는 이번에 직접 확인하지 못했다.

**집계 규칙 (월별 표에 적용)**
- 텍스트 LLM 중 *새 모델 이름*이 나온 것만 1건으로 셌다. 같은 벤더가 같은 날 낸 패밀리(예: GPT-4.1/mini/nano)는 1건이다.
- 세지 않은 것: 같은 모델의 스냅샷 갱신(예: gpt-4o-2024-08-06), experimental 빌드(gemini-exp-1114 등), 같은 모델이 preview에서 GA로 넘어간 것, 음성·이미지·TTS·임베딩 모델, 오픈 웨이트 모델, 제한 공개 모델(Claude Mythos Preview, gpt-6-rosalind 등).
- 날짜는 해당 출처에 처음 나온 날짜다(대개 발표일 또는 API 첫 제공일). preview인지 GA인지는 각 항목에 적었다.

---

## 질문 1. 벤더별로 어떤 모델이 언제 나왔나 (발표일 vs GA)

### Takeaway
2024-01~2026-10에 집계 기준을 통과한 상용 텍스트 LLM 출시는 98건이다. OpenAI(31건), Anthropic(21건), Google(19건), xAI(12건)가 대부분이다. 2026년에는 OpenAI가 GPT-5.x에서 GPT-6/6.1로, Anthropic이 Claude 4.x에서 5/5.5로, Google이 Gemini 3.x에서 4로 세대를 바꿨다.

### Cited Findings

#### OpenAI (출처: [OPENAI-CL] = https://developers.openai.com/api/docs/changelog 의 API 등재일)
| 날짜 | 모델 | 집계 | 비고 |
|---|---|---|---|
| 2024-01-25 | 업데이트된 GPT-4 Turbo preview, 임베딩 V3 | 제외(스냅샷) | changelog에 모델명 표기 없음 |
| 2024-02-01 | gpt-3.5-turbo-0125 | 제외(스냅샷) | |
| 2024-04-09 | GPT-4 Turbo with Vision (GA) | 1 | |
| 2024-05-13 | GPT-4o | 1 | |
| 2024-07-18 | GPT-4o mini | 1 | |
| 2024-08-06 / 08-15 | gpt-4o-2024-08-06 / chatgpt-4o-latest | 제외(스냅샷) | |
| 2024-09-12 | o1-preview, o1-mini | 1 | |
| 2024-11-20 | gpt-4o-2024-11-20 | 제외(스냅샷) | |
| 2024-12-17 | o1 (API) | 1 | |
| 2025-01-31 | o3-mini | 1 | |
| 2025-02-27 | GPT-4.5 (research preview) | 1 | |
| 2025-03-19 | o1-pro | 1 | |
| 2025-04-14 | GPT-4.1, 4.1-mini, 4.1-nano | 1 | |
| 2025-04-16 | o3, o4-mini | 1 | |
| 2025-05-15 | codex-mini-latest | 1 | |
| 2025-06-10 | o3-pro | 1 | |
| 2025-06-24 | o3-deep-research, o4-mini-deep-research | 1 | |
| 2025-08-07 | GPT-5, GPT-5-mini, **GPT-5-nano** | 1 | 사용자 테스트 모델 |
| 2025-09-23 | gpt-5-codex | 1 | |
| 2025-10-06 | gpt-5-pro | 1 | |
| 2025-11-13 | GPT-5.1, 5.1-codex, 5.1-chat-latest, 5.1-codex-mini | 1 | |
| 2025-12-04 | gpt-5.1-codex-max | 1 | |
| 2025-12-11 | GPT-5.2, 5.2-chat-latest | 1 | |
| 2026-01-14 | gpt-5.2-codex | 1 | |
| 2026-02-24 | gpt-5.3-codex | 1 | |
| 2026-03-03 | gpt-5.3-chat-latest | 1 | |
| 2026-03-05 | GPT-5.4, 5.4-pro | 1 | |
| 2026-03-17 | GPT-5.4-mini, 5.4-nano | 1 | |
| 2026-04-24 | GPT-5.5, 5.5-pro | 1 | |
| 2026-07-09 | GPT-5.6-sol / -terra / -luna (`gpt-5.6` 별칭은 sol로 라우팅) | 1 | |
| 2026-08-07 | gpt-5.6-cyber (gpt-daybreak-blue/red-latest도 같은 날) | 1 | 특화 모델 |
| 2026-09-03 | GPT-6 Astra | 1 | |
| 2026-09-08 | gpt-rosalind-research (GA) | 제외(연구 특화, 성격 확인 못 함) | |
| 2026-09-22 | **GPT-6 Sol, GPT-6 Luna** | 1 | 사용자 테스트 모델 gpt-6-luna |
| 2026-09-29 | GPT-6.1 Sol | 1 | |
| 2026-10-26 | GPT-6.1 Terra | 1 | |
| 2026-10-30 | gpt-6-rosalind (trusted access) | 제외(제한 공개) | |
- GPT-6 Luna는 ChatGPT에도 들어갔다. 보조 출처에 따르면 Free/Go 플랜 배포는 2026-10-08부터 시작됐다. 확인 못 함(2차 출처만 있음). — [evolink](https://evolink.ai/blog/gpt-6-luna-release-date), [datanorth](https://datanorth.ai/news/openai-launches-gpt-6-sol-and-luna)
- GPT-6 Luna 가격은 입력 $0.10/M, 출력 $0.50/M, 컨텍스트 1.1M이라고 한다. 확인 못 함(집계 사이트만 있음). — [llm-stats](https://llm-stats.com/models/gpt-6-luna)

#### Anthropic (출처: [ANT-WIKI] = https://en.wikipedia.org/wiki/Claude_(language_model) 의 표. 각 행의 URL은 위키가 인용한 원 출처)
| 날짜 | 모델 | 집계 | 원 출처 |
|---|---|---|---|
| 2024-03-04 | Claude 3 Opus, Sonnet | 1 | https://www.reuters.com/technology/anthropic-releases-more-powerful-claude-3-ai-tech-race-continues-2024-03-04/ |
| 2024-03-13 | Claude 3 Haiku | 1 | 위키 표 기준. 위키 본문은 패밀리 전체를 3/4로 적어서 위키 안에서 날짜가 엇갈린다 |
| 2024-06-20 | Claude 3.5 Sonnet | 1 | https://www.theverge.com/2024/6/20/24181961/anthropic-claude-35-sonnet-model-ai-launch |
| 2024-10-22 | Claude 3.5 Sonnet(업그레이드), Claude 3.5 Haiku | 1 | https://www-cdn.anthropic.com/c7822cdc35ad788ec87e14b3a9d45010f1f86c38.pdf. 3.5 Haiku는 이날 발표됐고, 실제 API 제공일은 확인 못 함 |
| 2025-02-24 | Claude 3.7 Sonnet | 1 | https://techcrunch.com/2025/02/24/anthropic-launches-a-new-ai-model-that-thinks-as-long-as-you-want/ |
| 2025-05-22 | Claude Sonnet 4, Opus 4 | 1 | https://www-cdn.anthropic.com/07b2a3f9902ee19fe39a36ca638e5ae987bc64dd.pdf |
| 2025-08-05 | Claude Opus 4.1 | 1 | 위키에 인용 없음. 모델 ID `claude-opus-4-1-20250805`와 일치 [ANT-DEP] |
| 2025-09-29 | Claude Sonnet 4.5 | 1 | https://www-cdn.anthropic.com/963373e433e489a87a10c823c52a0a013e9172dd.pdf |
| 2025-10-15 | Claude Haiku 4.5 | 1 | https://www-cdn.anthropic.com/7aad69bf12627d42234e01ee7c36305dc2f6a970.pdf |
| 2025-11-24 | Claude Opus 4.5 | 1 | https://www-cdn.anthropic.com/bf10f64990cfda0ba858290be7b8cc6317685f47.pdf |
| 2026-02-05 | Claude Opus 4.6 | 1 | https://www.anthropic.com/claude-opus-4-6-system-card |
| 2026-02-17 | Claude Sonnet 4.6 | 1 | https://www.anthropic.com/claude-sonnet-4-6-system-card |
| 2026-04-07 | Claude Mythos Preview (Project Glasswing 제한 공개) | 제외(제한 공개) | 위키에 인용 없음 |
| 2026-04-16 | Claude Opus 4.7 | 1 | https://platform.claude.com/docs/en/models/opus-4-7/overview |
| 2026-05-28 | Claude Opus 4.8 | 1 | https://www.anthropic.com/news/claude-opus-4-8 |
| 2026-06-09 | Claude Mythos 5, Claude Fable 5 | 1 | https://fortune.com/2026/06/09/anthropic-releases-its-first-mythos-model-to-the-public/ |
| 2026-06-30 | Claude Sonnet 5 | 1 | https://platform.claude.com/docs/en/models/sonnet-5/overview |
| 2026-07-24 | Claude Opus 5 | 1 | https://www-cdn.anthropic.com/b514064af1408018e64b1ad24e7d5e75850b4ffd/Claude%20Opus%205%20System%20Card.pdf |
| 2026-09-01 | Claude Mythos 5.1, Fable 5.1 | 1 | 위키에 인용 없음. [ANT-DEP]의 "Not sooner than September 1, 2027"과 맞는다 |
| 2026-09-22 | Claude Opus 5.5 | 1 | https://www-cdn.anthropic.com/fc1b44717c85dc068bc6ba5024219938094694bd/Claude%20Opus%205.5%20System%20Card.pdf |
| 2026-09-28 | Claude Sonnet 5.5 | 1 | https://www.anthropic.com/claude-sonnet-5-5-system-card |
| 2026-10-07 | **Claude Haiku 5.5** | 1 | https://www.anthropic.com/claude-haiku-5-5-system-card |
- 교차 검증 결과: [ANT-DEP]의 "Tentative retirement date: Not sooner than ..."는 거의 모든 모델에서 출시일 +1년이다. 예를 들어 opus-4-6는 2027-02-05, sonnet-4-6는 2027-02-17, haiku-5-5는 2027-10-07, sonnet-5-5는 2027-09-28이다. 이 값이 위키 출시일과 맞는다. 예외는 Opus 4.5다. 출시일은 2025-11-24인데 은퇴일 하한은 2026-11-24이다. — [ANT-DEP](https://platform.claude.com/docs/en/docs/about-claude/model-deprecations)
- Haiku 5.5 출시일은 대부분 2026-10-07로 적혀 있다. 반면 DataLearner와 Emergent(10/5자)는 "9/22에 발표됐고 아직 출시 전"이라고 썼다. 이 둘은 10/7 이전에 쓰인 글로 보인다. — [vals.ai](https://www.vals.ai/models/anthropic_claude-haiku-5-5), [apidog](https://apidog.com/blog/what-is-claude-haiku-5-5/), [datalearner](https://www.datalearner.com/ai-models/pretrained-models/claude-haiku-5-5), [emergent](https://emergent.sh/news/claude-haiku-5-5-release-date)
- Haiku 5.5 가격은 입력 $0.10/M, 출력 $0.50/M(100K 이하)이고 컨텍스트는 1M이라고 한다. 확인 못 함(2차 출처). — [apiyi](https://docs.apiyi.com/en/live/2026-10/claude-haiku-5-5), [apidog](https://apidog.com/blog/what-is-claude-haiku-5-5/)

#### Google Gemini (출처: [GEM-CL] = https://ai.google.dev/gemini-api/docs/changelog. 2024년 2월 두 항목은 뉴스 출처)
| 날짜 | 모델 | 단계 | 집계 |
|---|---|---|---|
| 2024-02-08 | Gemini 1.0 Ultra (Gemini Advanced) | 소비자 제품 출시 | 1. [Fortune](https://fortune.com/2024/02/15/google-gemini-pro-competition-openai/), [Engadget](https://www.engadget.com/googles-gemini-15-pro-is-a-new-more-efficient-ai-model-181909354.html)은 "지난주 출시"라고 썼다. 개발자 API 제공 여부는 확인 못 함 |
| 2024-02-15 | Gemini 1.5 Pro | 발표(개발자·기업 대상 제한 preview) | 1. [Engadget](https://www.engadget.com/googles-gemini-15-pro-is-a-new-more-efficient-ai-model-181909354.html). lunabot.ai 한 곳만 2/14로 적었다 |
| 2024-04-09 | gemini-1.5-pro-latest | API preview | 제외(2월에 이미 셈) |
| 2024-05-10 | gemini-1.5-flash-latest | Preview | 1 |
| 2024-05-23 | gemini-1.5-pro-001, 1.5-flash-001 | GA | 제외 |
| 2024-08-01, 08-27 | 1.5 pro/flash/flash-8b exp | Experimental | 제외 |
| 2024-09-24 | gemini-1.5-pro-002, flash-002 | GA(업데이트) | 제외 |
| 2024-10-03 | gemini-1.5-flash-8b-001 | Stable | 1 |
| 2024-11-14, 11-21 | gemini-exp-1114, exp-1121 | Experimental | 제외 |
| 2024-12-11 | Gemini 2.0 Flash (experimental) | Preview | 1 |
| 2024-12-19 | Gemini 2.0 Flash Thinking | Preview | 1 |
| 2025-02-05 | 2.0-flash-001 GA, 2.0-pro-exp, 2.0-flash-lite-preview | GA/Exp/Preview | 1 |
| 2025-02-25 | gemini-2.0-flash-lite | GA | 제외 |
| 2025-03-25 | gemini-2.5-pro-exp-03-25 | Experimental(신규 세대여서 셈) | 1 |
| 2025-04-17 | gemini-2.5-flash-preview-04-17 | Preview | 1 |
| 2025-06-17 | 2.5 Pro / 2.5 Flash GA, 2.5-flash-lite-preview | GA/Preview | 1 |
| 2025-07-22 | gemini-2.5-flash-lite | GA | 제외 |
| 2025-11-18 | gemini-3-pro-preview | Preview | 1 |
| 2025-12-17 | gemini-3-flash-preview | Preview | 1 |
| 2026-02-19 | gemini-3.1-pro-preview | Preview | 1 |
| 2026-03-03 | gemini-3.1-flash-lite-preview | Preview | 1 |
| 2026-05-07 | gemini-3.1-flash-lite | GA | 제외 |
| 2026-05-19 | gemini-3.5-flash | GA | 1 |
| 2026-06-30 | gemini-omni-flash-preview | Preview | 제외(옴니모달. 텍스트 LLM 여부 확인 못 함) |
| 2026-07-21 | gemini-3.6-flash, **gemini-3.5-flash-lite** | GA | 1 |
| 2026-08-13 | gemini-3.7-flash | GA | 1 |
| 2026-08-27 | gemini-omni-1.1-flash | GA | 제외(위와 같은 이유) |
| 2026-09-02 | gemini-3.8-flash | GA | 1 |
| 2026-10-13 | gemini-4-argon | GA | 1. changelog에 이름만 있다. 정체(Pro급인지 등)는 확인 못 함 |
- changelog 원문에서 2025-11-18(Gemini 3 Pro)이 12월 항목들 뒤에 나온다. 날짜는 그대로 옮겼다. — [GEM-CL](https://ai.google.dev/gemini-api/docs/changelog)
- Gemini 2.5 Pro는 Experimental로 처음 나왔다(03-25). Preview는 04-04, 05-06, 06-05에 나왔고 GA는 06-17이다. — [GEM-CL](https://ai.google.dev/gemini-api/docs/changelog)
- 2026년 Pro 라인은 3.1-pro-preview(02-19) 뒤로 changelog에 새 Pro가 없다. 3.5 이후로는 Flash 계열만 나왔다. Gemini Computer Use는 2026-10-30에 GA가 됐다. — [GEM-CL](https://ai.google.dev/gemini-api/docs/changelog)

#### xAI Grok (출처: [GROK-WIKI] = https://en.wikipedia.org/wiki/Grok_(chatbot))
| 날짜 | 모델 | 비고 | 집계 |
|---|---|---|---|
| 2024-05-15 | Grok-1.5 | X Premium 사용자 대상. API 제공일은 위키에 없음 | 1 |
| 2024-08-14 | Grok-2, Grok-2 mini | 발표일. 위키에 8/20 출시라는 서술도 있음 | 1 |
| 2025-02-17 | Grok 3, Grok 3 mini | API는 2025년 4월(일자 확인 못 함) | 1 |
| 2025-07-09 | Grok 4, Grok 4 Heavy | | 1 |
| 2025-08-28 | Grok Code Fast 1 | | 1 |
| 2025-09 (일자 확인 못 함) | Grok 4 Fast | | 1 |
| 2025-11-17 | Grok 4.1, 4.1 Fast | 4.1 Fast는 위키 인포박스에 11/19로도 나옴 | 1 |
| 2026-02 (일자 확인 못 함) | Grok 4.20 | | 1 |
| 2026-04 (일자 확인 못 함) | Grok 4.3 | | 1 |
| 2026-07-08 | Grok 4.5 | 위키는 "SpaceXSI API console"에서 출시됐다고 적음 | 1 |
| 2026-08-12 | Grok 4.6 | | 1 |
| 2026-09-21 | Grok 4.7 | | 1 |
- 위키에는 Grok 5가 나오지 않는다(2026-11-01 기준). 조사했으나 찾지 못함. — [GROK-WIKI](https://en.wikipedia.org/wiki/Grok_(chatbot))

#### Amazon Nova
- Nova Micro/Lite/Pro는 2024-12-03 Bedrock에서 제공을 시작했다. — [aiwiki](https://aiwiki.ai/wiki/amazon_nova) (2차)
- Nova Premier GA는 2025-04-30이다. — [hidekazu-konishi](https://hidekazu-konishi.com/entry/amazon_nova_model_release_timeline.html) (2차)
- Nova 2(Lite, Pro, Sonic, Omni)는 2025-12-02 re:Invent에서 발표됐다. Lite는 2025-12 GA, Pro와 Omni는 2026년 초까지 preview였다. — [labo-llm](https://www.labo-llm.fr/en/acteurs/amazon-nova/), [aiwiki](https://aiwiki.ai/wiki/amazon_nova) (2차)
- AWS 공식 release notes에서는 Nova 2 Sonic의 2026-05 갱신만 확인됐다. — [AWS](https://docs.aws.amazon.com/nova/latest/nova2-userguide/release-notes.html)
- Nova 2 Pro GA 날짜는 조사했으나 찾지 못함. "Nova 2.5 Sonic(2026-10-05)"은 한 곳만 주장해서 확인 못 함. — [innfactory](https://innfactory.ai/en/ai-models/amazon-titan/)

#### Mistral (클로즈드 API 모델만 셈)
- Mistral Large(1세대)는 2024-02-26에 Mistral Small, Le Chat과 함께 나왔다. 집계 1. — [scriptbyai](https://www.scriptbyai.com/mistral-ai-timeline/), [opper](https://opper.ai/model-releases/mistral)
- Mistral Large 2(2024-07-24), Large 2.1/Pixtral Large(2024-11-18), Large 3(2025-12-02, Apache 2.0)는 웨이트가 공개된 모델이라 집계에서 뺐다. — 같은 출처, [innfactory](https://innfactory.ai/en/ai-models/mistral/)
- Mistral Medium 3는 2025-05-07에 나왔다. 집계 1. — [Mistral 공식](https://mistral.ai/news/mistral-medium-3/). UC Strategies는 "공식 날짜 없음"이라고 썼다.
- Medium 3.1은 2025-08-12에 나왔다. 집계 1. — [opper](https://opper.ai/model-releases/mistral)
- Medium 3.5는 2026-04-29에 나왔다(ScriptByAI만 4/28로 적음). 집계 1, 라이선스는 확인 못 함. Medium 3(`mistral-medium-2505`)는 2026-08-31 은퇴 예정이다. — [Mistral docs](https://docs.mistral.ai/models/overview), [scriptbyai](https://www.scriptbyai.com/mistral-ai-timeline/)
- Mistral Large 4 public preview는 2026-10-06에 나왔다. 집계 1, 라이선스는 확인 못 함. — [innfactory](https://innfactory.ai/en/ai-models/mistral/)
- Mistral Small 4(2026-03-16)는 Small 라인이 보통 오픈 웨이트라서 집계에서 뺐다. 라이선스는 확인 못 함. — [opper](https://opper.ai/model-releases/mistral)

#### Cohere
- Command R+는 2024-04-04에 나왔다(Azure 발표일. 다른 출처는 4/24). 집계 1. — [Microsoft Tech Community](https://techcommunity.microsoft.com/blog/aiplatformblog/announcing-cohere-command-r-now-available-on-azure/4103512)
- Command A는 2025-03-13에 나왔다. 집계 1. — [opper](https://opper.ai/cohere)
- Command A+는 2026-05-20에 나왔고, Command A 패밀리의 마지막 모델이라고 한다. 집계 1. — [benchlm](https://benchlm.ai/model-updates/providers/cohere), [llm-stats](https://llm-stats.com/organizations/cohere)
- 참고로 Command R+와 Command A는 비상업 라이선스로 웨이트도 공개됐다(이번 조사에서 확인 못 함). 그래도 Cohere의 주력 상용 API 모델이라 집계에 넣었다.

#### Microsoft
- MAI-1 등 Microsoft 자체 클로즈드 LLM의 출시일은 조사했으나 찾지 못함.

#### 중국 클로즈드 API 모델
- Baidu ERNIE 4.5와 ERNIE X1은 2025-03-16에 발표됐다. 집계 1. ERNIE 4.5는 나중에 오픈 웨이트로 풀렸고, 6/25 날짜는 그 시점일 수 있다. — [Wikipedia Ernie Bot](https://en.wikipedia.org/wiki/Ernie_Bot)
- ERNIE 5.0 preview는 2025-11-13에 나왔다(집계 1). 정식판 2026-01-22는 집계 사이트 한 곳만 적어서 확인 못 함이지만 집계 1로 넣었다. — [note.com](https://note.com/teto_66/n/n8f3666effea7?hl=en), [llm-stats](https://llm-stats.com/models/compare/ernie-5.0-vs-kimi-k2-base)
- ByteDance Doubao Seed 2.0은 2026-02-14에 나왔다. 집계 1. — [Wikipedia Doubao](https://en.wikipedia.org/wiki/Doubao)
- Doubao 1.5 출시일은 조사했으나 찾지 못함.
- Moonshot Kimi K2(2025-07-11)는 오픈 웨이트라서 "API 전용" 기준에 맞지 않아 집계에서 뺐다. — [llm-stats](https://llm-stats.com/models/compare/ernie-5.0-vs-kimi-k2-instruct)

### Inferences
- 2025년 하반기부터 세 회사 모두 출시 간격이 크게 줄었다. OpenAI는 GPT-5 이후 0.x 단위 버전을 1~3개월마다 냈다. Anthropic은 2026년에 11건을 냈다. Google은 2026년 7~9월에 Flash 계열을 3.6, 3.7, 3.8로 3주~1개월 간격으로 냈다.
- Google의 집계는 기준에 따라 크게 달라진다. experimental 빌드와 GA 전환을 따로 세면 2024년에만 10건 넘게 늘어난다. 월별 표는 "새 모델 이름" 기준이라는 점을 감안해야 한다.

### Gaps
- xAI 공식 뉴스 페이지(x.ai/news)는 직접 확인하지 못했다. Grok 4 Fast, 4.20, 4.3은 일자를 확인 못 함이다.
- Amazon, Mistral, Cohere, 중국 모델은 대부분 2차 출처에만 기댔다. 공식 발표문은 확인 못 함이다.
- Claude 3.5 Haiku의 실제 API 제공일(발표 2024-10-22와 다를 수 있음)은 확인 못 함.
- Microsoft MAI 계열과 Doubao 1.5는 조사했으나 찾지 못함.

---

## 질문 2. 사용자 테스트 모델과 그 패밀리

### Takeaway
테스트에 쓴 4개 모델은 모두 1차 출처에서 확인됐다. 2026-11-01 기준 네 모델 모두 제공 중이다. 다만 gpt-5-nano는 2026-12-11 종료가 예정돼 있다.

### Cited Findings
| 모델 | 출시일 | 현재 상태 | 출처 |
|---|---|---|---|
| claude-haiku-5-5 | 2026-10-07 | Active. 은퇴는 2027-10-07 이후 | [ANT-WIKI 시스템카드](https://www.anthropic.com/claude-haiku-5-5-system-card), [ANT-DEP](https://platform.claude.com/docs/en/docs/about-claude/model-deprecations) |
| gpt-6-luna | 2026-09-22 (API, gpt-6-sol과 같은 날) | 제공 중. 10-06 Decisions API beta, 10-22 Decisions API GA | [OPENAI-CL](https://developers.openai.com/api/docs/changelog) |
| gemini-3.5-flash-lite | 2026-07-21 GA (gemini-3.6-flash와 같은 날) | 제공 중. changelog에 deprecation 항목 없음 | [GEM-CL](https://ai.google.dev/gemini-api/docs/changelog) |
| gpt-5-nano | 2025-08-07 (gpt-5, gpt-5-mini와 같은 날) | 2026-06-11 deprecation 발표, **2026-12-11 종료**. 대체 모델은 `gpt-5.6-luna` | [OPENAI-DEP](https://developers.openai.com/api/docs/deprecations) |

- 패밀리 흐름(OpenAI 소형): gpt-4.1-nano(2025-04-14) → gpt-5-nano(2025-08-07) → gpt-5.4-nano(2026-03-17) → gpt-5.6-luna(2026-07-09) → gpt-6-luna(2026-09-22). — [OPENAI-CL](https://developers.openai.com/api/docs/changelog)
- 패밀리 흐름(Anthropic Haiku): 3 Haiku(2024-03-13) → 3.5 Haiku(2024-10-22) → Haiku 4.5(2025-10-15) → Haiku 5.5(2026-10-07). Haiku 5와 Haiku 4.6~4.8은 위키 표에 없다. — [ANT-WIKI](https://en.wikipedia.org/wiki/Claude_(language_model))
- 패밀리 흐름(Gemini Flash-Lite): 2.0-flash-lite preview(2025-02-05)/GA(02-25) → 2.5-flash-lite preview(2025-06-17)/GA(07-22) → 3.1-flash-lite preview(2026-03-03)/GA(05-07) → 3.5-flash-lite GA(2026-07-21). 3.8-flash-lite는 TTS 모델(3.8-flash-lite-tts, 09-22)만 changelog에 있다. — [GEM-CL](https://ai.google.dev/gemini-api/docs/changelog)
- gemini-3.5-flash(Flash-Lite가 아닌 Flash)는 2026-10-08 deprecated 처리돼 gemini-3.6-flash로 라우팅된다. — [GEM-CL](https://ai.google.dev/gemini-api/docs/changelog)

### Inferences
- 테스트 대상 4개 중 3개는 출시된 지 4개월이 안 된 모델이다. gpt-5-nano만 한 세대 전 모델이고 40일 뒤 종료된다. 장기 비교 기준선으로 계속 쓰기는 어렵다.

### Gaps
- gemini-3.5-flash-lite의 종료 예정일은 조사했으나 찾지 못함(changelog에 항목 없음).

---

## 질문 3. 월별 건수, 분기 요약, 벤더별 평균 간격

### Takeaway
집계 기준을 통과한 출시는 2024년 20건, 2025년 38건, 2026년 1~10월 40건이다. 해마다 대략 2배씩 늘었다. 가장 몰린 달은 2026-09(8건)이고, 이달에는 GPT-6, Claude 5.5, Grok 4.7, Gemini 3.8 Flash가 한꺼번에 나왔다.

### Cited Findings
(아래 표의 개별 항목과 출처는 질문 1의 표에 있다. 벤더 약어는 O=OpenAI, A=Anthropic, G=Google, X=xAI, Am=Amazon, M=Mistral, C=Cohere, CN=중국)

**월별 건수**
| 월 | 건수 | 내역 |
|---|---|---|
| 2024-01 | 0 | 스냅샷(GPT-4 Turbo 0125)만 있어 제외 |
| 2024-02 | 3 | G Gemini 1.0 Ultra(8), G Gemini 1.5 Pro(15), M Large(26) |
| 2024-03 | 2 | A Claude 3 Opus/Sonnet(4), A Claude 3 Haiku(13) |
| 2024-04 | 2 | C Command R+(4), O GPT-4 Turbo GA(9) |
| 2024-05 | 3 | G 1.5 Flash(10), O GPT-4o(13), X Grok-1.5(15) |
| 2024-06 | 1 | A Claude 3.5 Sonnet(20) |
| 2024-07 | 1 | O GPT-4o mini(18) |
| 2024-08 | 1 | X Grok-2(14) |
| 2024-09 | 1 | O o1-preview/mini(12) |
| 2024-10 | 2 | G 1.5 Flash-8B(3), A 3.5 Sonnet new/3.5 Haiku(22) |
| 2024-11 | 0 | Gemini exp 빌드만 있어 제외 |
| 2024-12 | 4 | Am Nova(3), G 2.0 Flash(11), O o1(17), G 2.0 Flash Thinking(19) |
| 2025-01 | 1 | O o3-mini(31) |
| 2025-02 | 4 | G 2.0 Flash GA/Pro exp/Flash-Lite(5), X Grok 3(17), A 3.7 Sonnet(24), O GPT-4.5(27) |
| 2025-03 | 4 | C Command A(13), CN ERNIE 4.5/X1(16), O o1-pro(19), G 2.5 Pro(25) |
| 2025-04 | 4 | O GPT-4.1(14), O o3/o4-mini(16), G 2.5 Flash(17), Am Nova Premier(30) |
| 2025-05 | 3 | M Medium 3(7), O codex-mini(15), A Claude 4(22) |
| 2025-06 | 3 | O o3-pro(10), G 2.5 GA+Flash-Lite(17), O deep-research(24) |
| 2025-07 | 1 | X Grok 4(9) |
| 2025-08 | 4 | A Opus 4.1(5), O GPT-5(7), M Medium 3.1(12), X Grok Code Fast 1(28) |
| 2025-09 | 3 | X Grok 4 Fast(일자 확인 못 함), O gpt-5-codex(23), A Sonnet 4.5(29) |
| 2025-10 | 2 | O gpt-5-pro(6), A Haiku 4.5(15) |
| 2025-11 | 5 | O GPT-5.1(13), CN ERNIE 5.0 preview(13), X Grok 4.1(17), G Gemini 3 Pro(18), A Opus 4.5(24) |
| 2025-12 | 4 | Am Nova 2(2), O 5.1-codex-max(4), O GPT-5.2(11), G Gemini 3 Flash(17) |
| 2026-01 | 2 | O 5.2-codex(14), CN ERNIE 5.0(22, 확인 못 함) |
| 2026-02 | 6 | A Opus 4.6(5), CN Doubao Seed 2.0(14), A Sonnet 4.6(17), G 3.1 Pro(19), O 5.3-codex(24), X Grok 4.20(일자 확인 못 함) |
| 2026-03 | 4 | G 3.1 Flash-Lite(3), O 5.3-chat(3), O GPT-5.4(5), O 5.4-mini/nano(17) |
| 2026-04 | 4 | A Opus 4.7(16), O GPT-5.5(24), M Medium 3.5(29), X Grok 4.3(일자 확인 못 함) |
| 2026-05 | 3 | G 3.5 Flash(19), C Command A+(20), A Opus 4.8(28) |
| 2026-06 | 2 | A Mythos 5/Fable 5(9), A Sonnet 5(30) |
| 2026-07 | 4 | X Grok 4.5(8), O GPT-5.6(9), G 3.6 Flash+3.5 Flash-Lite(21), A Opus 5(24) |
| 2026-08 | 3 | O 5.6-cyber(7), X Grok 4.6(12), G 3.7 Flash(13) |
| 2026-09 | 8 | A Mythos/Fable 5.1(1), G 3.8 Flash(2), O GPT-6 Astra(3), X Grok 4.7(21), O GPT-6 Sol/Luna(22), A Opus 5.5(22), A Sonnet 5.5(28), O GPT-6.1 Sol(29) |
| 2026-10 | 4 | M Large 4 preview(6), A Haiku 5.5(7), G gemini-4-argon(13), O GPT-6.1 Terra(26) |
| 2026-11 | 0 | 11/1 기준 |
| **합계** | **98** | |

**분기 요약**
| 분기 | 건수 | | 분기 | 건수 | | 분기 | 건수 |
|---|---|---|---|---|---|---|---|
| 2024 Q1 | 5 | | 2025 Q1 | 9 | | 2026 Q1 | 12 |
| 2024 Q2 | 6 | | 2025 Q2 | 10 | | 2026 Q2 | 9 |
| 2024 Q3 | 3 | | 2025 Q3 | 8 | | 2026 Q3 | 15 |
| 2024 Q4 | 6 | | 2025 Q4 | 11 | | 2026 Q4 (10월만) | 4 |
| **2024 계** | **20** | | **2025 계** | **38** | | **2026 계(1~10월)** | **40** |

**벤더별 평균 출시 간격** (첫 집계 출시일부터 마지막 집계 출시일까지의 일수 ÷ (건수−1). 양 끝 날짜가 확정이면 중간 항목의 일자가 확인 못 함이어도 평균은 정확하다)
| 벤더 | 집계 건수 | 기간 | 평균 간격 |
|---|---|---|---|
| OpenAI | 31 | 2024-04-09 ~ 2026-10-26 (930일) | 약 31일 |
| OpenAI 주력 번호 버전만 (GPT-5 → 5.1 → 5.2 → 5.4 → 5.5 → 5.6 → 6 Astra → 6.1 Sol) | 8 | 2025-08-07 ~ 2026-09-29 | 약 60일 (98, 28, 84, 50, 76, 56, 26일) |
| Anthropic | 21 | 2024-03-04 ~ 2026-10-07 (947일) | 약 47일. 2024년 내 평균은 약 77일(232일÷3), 2026년 내 평균은 약 24일(244일÷10) |
| Google | 19 | 2024-02-08 ~ 2026-10-13 (978일) | 약 54일 |
| xAI | 12 | 2024-05-15 ~ 2026-09-21 (859일) | 약 78일 |
| Mistral (클로즈드만) | 5 | 2024-02-26 ~ 2026-10-06 (953일) | 약 238일 |
| Amazon | 3 | 2024-12-03 ~ 2025-12-02 (364일) | 약 182일 |
- 간격은 질문 1의 표에 인용된 날짜로 직접 계산했다. 날짜 출처는 [OPENAI-CL](https://developers.openai.com/api/docs/changelog), [ANT-WIKI](https://en.wikipedia.org/wiki/Claude_(language_model)), [GEM-CL](https://ai.google.dev/gemini-api/docs/changelog), [GROK-WIKI](https://en.wikipedia.org/wiki/Grok_(chatbot))다.

### Inferences
- 분기별 건수는 2024년 평균 5건에서 2025년 9.5건, 2026년 Q1~Q3 평균 12건으로 늘었다. 2026 Q3(15건)이 가장 많다.
- 출시는 특정 달에 몰리는 경향이 있다. 2024-12, 2025-11, 2026-09에는 3~4개 벤더가 몇 주 안에 연달아 냈다. 반대로 2024-11과 2024-01은 0건이었다.
- Anthropic은 2024년에 약 2.5개월 간격이었는데 2026년에는 약 3.5주 간격으로 빨라졌다. 증가 폭이 가장 크다.

### Gaps
- 집계 기준을 바꾸면 숫자가 크게 달라진다(experimental, 스냅샷, 오픈 웨이트, 특화 모델을 넣을지 여부). 이 표는 위의 규칙 하나만 적용한 결과다.
- 중국 벤더(Alibaba Qwen 클로즈드 API, Zhipu, Tencent Hunyuan 등)는 조사하지 않았다. 해당 월 건수는 과소 집계일 수 있다.

---

## 질문 4. 모델 종료/deprecation (gpt-4.1-nano 404 포함)

### Takeaway
gpt-4.1-nano는 2026-04-22에 deprecation이 발표됐고 **2026-10-23에 종료**됐다. 테스트에서 404가 난 것은 이 종료와 일치한다. 대체 모델은 `gpt-5.6-luna`다. 같은 날 o1, o3-mini, o4-mini, gpt-4o-2024-05-13, gpt-4-turbo, gpt-3.5-turbo도 함께 종료됐다.

### Cited Findings

**OpenAI** — 모두 [OPENAI-DEP](https://developers.openai.com/api/docs/deprecations)
| 발표 | 종료 | 대상 | 대체 |
|---|---|---|---|
| 2025-04-14 | 2025-07-14 | gpt-4.5-preview | gpt-4.1 |
| 2025-04-28 | 2025-07-28 | o1-preview | o3 |
| 2025-04-28 | 2025-10-27 | o1-mini | o4-mini |
| 2025-11-18 | 2026-02-17 | chatgpt-4o-latest | gpt-5.1-chat-latest |
| 2025-11-17 | 2026-02-12 | codex-mini-latest | gpt-5-codex-mini |
| 2025-09-26 | 2026-03-26 | gpt-4-0314, gpt-4-0125-preview(gpt-4-turbo-preview) | gpt-5 / gpt-4.1 |
| 2026-04-22 | 2026-07-23 | gpt-5-chat-latest, gpt-5-codex, gpt-5.1-chat-latest, gpt-5.1-codex(-max/-mini), gpt-5.2-codex, o3/o4-mini-deep-research, computer-use-preview, 4o search preview | gpt-5.6-sol / -terra |
| 2026-05-08 | 2026-08-10 | gpt-5.2-chat-latest, gpt-5.3-chat-latest | gpt-5.6-sol |
| **2026-04-22** | **2026-10-23** | **gpt-4.1-nano**, gpt-4o-2024-05-13, gpt-4-turbo, gpt-4-0613, gpt-4-1106-preview, gpt-3.5-turbo-0125, o1, o1-pro, o3-mini, o4-mini, gpt-image-1 | gpt-4.1-nano → gpt-5.6-luna 등 |
| 2026-06-11 | 2026-12-11 | gpt-5, gpt-5-mini, **gpt-5-nano**, gpt-5-pro, o3, o3-pro | gpt-5.6-sol / -terra / -luna |
| 2026-10-01 | 2027-04-01 | gpt-5.1, gpt-5.3-codex, gpt-5.4-nano | gpt-6-sol / gpt-6-luna |
| 2026-10-14 | 2027-01-14 | gpt-4o(2024-08-06, 2024-11-20), gpt-4o-mini, gpt-4.1, gpt-4.1-mini | gpt-6-luna |
- 모델 외에 종료되는 기능도 있다. Assistants API는 2026-08-26에 종료됐다. 2026-06-03 발표로 Evals 플랫폼은 2026-10-31부터 읽기 전용, 2026-11-30 종료다. Agent Builder와 reusable prompts(v1/prompts)도 2026-11-30 종료다. — [OPENAI-DEP](https://developers.openai.com/api/docs/deprecations)

**Anthropic** — 모두 [ANT-DEP](https://platform.claude.com/docs/en/docs/about-claude/model-deprecations)
| 발표 | 종료 | 대상 |
|---|---|---|
| 2024-09-04 | 2024-11-06 | Claude 1.x, Instant 1.x |
| 2025-01-21 | 2025-07-21 | Claude 2.0, 2.1, Claude 3 Sonnet |
| 2025-06-30 | 2026-01-05 | Claude 3 Opus |
| 2025-08-13 | 2025-10-28 | Claude 3.5 Sonnet (20240620, 20241022) |
| 2025-10-28 | 2026-02-19 | Claude 3.7 Sonnet |
| 2025-12-19 | 2026-02-19 | Claude 3.5 Haiku |
| 2026-02-19 | 2026-04-20 | Claude 3 Haiku |
| 2026-04-14 | 2026-06-15 | Claude Sonnet 4, Opus 4 |
| 2026-06-05 | 2026-08-05 | Claude Opus 4.1 |
| 2026-06-09 | 미정 | claude-mythos-preview (deprecated) |
| 2026-09-30 | 2026-11-30 (예정) | Claude Sonnet 4.5 → claude-sonnet-5-5 |
- claude-haiku-4-5-20251001은 아직 Active다. 은퇴 하한은 "Not sooner than October 15, 2026"인데 이 날짜는 이미 지났다. 은퇴 공지는 페이지에 없다. — [ANT-DEP](https://platform.claude.com/docs/en/docs/about-claude/model-deprecations)
- API 버전 `2026-10-21`에서 `temperature`, `top_p`, `top_k`가 제거됐다(설정하면 400 에러). — [ANT-DEP](https://platform.claude.com/docs/en/docs/about-claude/model-deprecations)

**Google** — 모두 [GEM-CL](https://ai.google.dev/gemini-api/docs/changelog)
- 2025-09-29: gemini-1.5-pro, 1.5-flash, 1.5-flash-8b 종료.
- 2026-03-09: gemini-3-pro-preview 종료. 이후 이 이름은 3.1-pro-preview를 가리킨다.
- 2026-05-25: gemini-3.1-flash-lite-preview 종료(GA판으로 대체).
- 2026-06-01: gemini-2.0-flash, 2.0-flash-001, 2.0-flash-lite, 2.0-flash-lite-001 종료.
- 2026-10-08: gemini-3.5-flash는 3.6-flash로, gemini-3.7-flash는 3.8-flash로 라우팅되는 deprecated 상태가 됐다.

**Amazon / Mistral**
- Nova Premier와 원조 Nova Sonic은 2026-09-14 EOL, Nova Canvas와 Nova Reel(v1)은 2026-09-30 EOL이다(2차 출처). — [tech-insider](https://tech-insider.org/au/amazon-nova-ai-models-deprecated-2026/), [cloudroute](https://www.cloudroutehq.com/aws-ai/amazon-nova)
- Mistral Medium 3(mistral-medium-2505)는 2026-08-31 은퇴 예정이다. — [Mistral docs](https://docs.mistral.ai/models/overview)

### Inferences
- OpenAI는 deprecation 발표부터 종료까지 대개 3~6개월을 준다. Anthropic은 약 2개월(최소 60일 공지 방침)을 준다. Google은 preview 모델을 GA나 후속 버전이 나오면 몇 주~몇 달 안에 종료하거나 리다이렉트한다.
- 2026년 하반기에는 2024~2025년 세대(GPT-4.x, o-시리즈, GPT-5, Claude 4/4.1, Gemini 2.0)가 한꺼번에 정리되고 있다. 테스트 스크립트의 모델 ID는 이 일정에 맞춰 관리해야 한다. 예를 들어 gpt-5-nano는 12/11에, claude-sonnet-4-5는 11/30에 종료된다.

### Gaps
- xAI, Cohere, 중국 벤더의 종료 일정은 조사했으나 찾지 못함.
- Google 페이지의 "Scheduled" 항목은 예정일이 지났더라도 실제 종료 여부를 확인 못 함(예: gemini-3.1-flash-image-preview, 2026-06-25 예정).
