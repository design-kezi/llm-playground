# 오픈웨이트 LLM 출시 타임라인 (2024-01 ~ 2026-11-01)

작성 기준일: 2026-11-01. 표기 규칙:
- **등급 A**: 1차 출처(공식 블로그, HF 모델 카드/LICENSE, 공식 GitHub, arXiv, 공식 API 릴리스 노트) URL이 있는 항목. 이 중 이번 조사에서 직접 열어 확인한 것은 HF 카드 4건(Gemma 4 26B-A4B, Kimi K2, MiniMax-M2, GLM-4.5)뿐이고, 나머지는 1차 URL을 달아 둔 정리 페이지(hidekazu-konishi 타임라인, slash-digital) 경유.
- **등급 B**: 2차 출처(블로그, 집계 사이트, 언론)만 있는 항목. 날짜, 크기가 틀릴 수 있음.
- "확인 못 함" = 출처는 찾았으나 해당 값이 없거나 출처끼리 충돌. "조사했으나 찾지 못함" = 검색했지만 해당 항목 정보 자체가 안 나옴.
- 파라미터 표기: 총/활성. Dense는 총 = 활성.

주요 정리 페이지(경유 출처):
- H = [hidekazu-konishi, Open-Weights LLM Release History and Timeline](https://hidekazu-konishi.com/entry/open_weights_llm_release_history_and_timeline.html) (각 항목에 1차 URL 달려 있음)
- S = [slash-digital, Open-weight models 2026](https://slash-digital.io/en/insights/open-weight-models-2026/)
- P = [promptquorum, Local LLM 2026](https://www.promptquorum.com/local-llms/local-llm-model-updates-2026) (2차, 내부 모순 많음. 아래 Gaps 참조)

## 질문 1. 계열별 주요 오픈웨이트 출시 목록 (날짜, 크기, 구조, 컨텍스트, 라이선스)

### Takeaway
2024년은 Llama 3 계열, Qwen 1.5~2.5, Gemma 1~2, Mistral(Mixtral 8x22B, NeMo, Large 2), DeepSeek V2~V3 같은 대부분 Dense 모델(DeepSeek, Mixtral만 MoE)이 중심이었다. 2025년 DeepSeek-R1(1월) 뒤로 대형 MoE와 MIT/Apache 2.0 쪽으로 옮겨 갔고, 2026년에는 1T급 이상 MoE(DeepSeek V4-Pro 1.6T, Kimi K3 2.8T, Qwen3.8 2.4T)와 1M 컨텍스트가 흔해졌다. 다만 2026년 항목의 상당수는 2차 출처뿐이다.

### Cited Findings

#### 2024년 (전부 등급 A, H 경유)
| 날짜 | 모델 | 총/활성 | 구조 | 컨텍스트 | 라이선스 | 출처 |
|---|---|---|---|---|---|---|
| 2024-02-05 | Qwen1.5 (여러 크기) | 확인 못 함 | 확인 못 함 | 확인 못 함 | 확인 못 함 | [QwenLM GitHub](https://github.com/QwenLM/Qwen3) (H 경유) |
| 2024-02-21 | Gemma 2B, 7B | 2B, 7B | Dense | 확인 못 함 | Gemma Terms of Use | [Google blog](https://blog.google/technology/developers/gemma-open-models/) (H 경유) |
| 2024-03-28 | Qwen1.5-MoE-A2.7B | 확인 못 함/2.7B | MoE (Qwen 첫 MoE) | 확인 못 함 | 확인 못 함 | [QwenLM GitHub](https://github.com/QwenLM/Qwen3) (H 경유) |
| 2024-04-17 | Mixtral 8x22B | 141B/39B | Sparse MoE | 64K | Apache 2.0 | [Mistral](https://mistral.ai/news/mixtral-8x22b/) (H 경유) |
| 2024-04-18 | Llama 3 8B, 70B | 8B, 70B | Dense | 8K(학습 시퀀스 8,192) | Llama Community License | [Meta](https://ai.meta.com/blog/meta-llama-3/) (H 경유) |
| 2024-04-23 | Phi-3-mini | 3.8B | Dense | 128K | MIT | [Microsoft](https://azure.microsoft.com/en-us/blog/introducing-phi-3-redefining-whats-possible-with-slms/) (H 경유) |
| 2024-05-06 | DeepSeek-V2 | 236B/21B | MoE, MLA | 128K | DeepSeek Model License | [GitHub](https://github.com/deepseek-ai/DeepSeek-V2) (H 경유) |
| 2024-05-29 | Codestral 22B | 22B | 코드 특화 | 확인 못 함 | Mistral AI Non-Production License(상업 이용 제한) | [Mistral](https://mistral.ai/news/codestral/) (H 경유) |
| 2024-06 (일자 확인 못 함) | DeepSeek-Coder-V2 | 확인 못 함 | MoE (V2 기반) | 확인 못 함 | 확인 못 함 | [GitHub](https://github.com/deepseek-ai/DeepSeek-Coder-V2) (H 경유) |
| 2024-06-06 | Qwen2 | 확인 못 함 | 확인 못 함 | 확인 못 함 | 확인 못 함 | [QwenLM GitHub](https://github.com/QwenLM/Qwen3) (H 경유) |
| 2024-06-27 | Gemma 2 9B, 27B (2B는 이후) | 9B, 27B | Dense | 확인 못 함 | Gemma Terms of Use | [Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/google-gemma-2/) (H 경유) |
| 2024-07-18 | Mistral NeMo 12B | 12B | Dense | 128K | Apache 2.0 | [Mistral](https://mistral.ai/news/mistral-nemo/) (H 경유) |
| 2024-07-23 | Llama 3.1 8B, 70B, 405B | 8B/70B/405B | Dense | 128K | Llama Community License | [Meta](https://ai.meta.com/blog/meta-llama-3-1/) (H 경유) |
| 2024-07-24 | Mistral Large 2 | 123B | 확인 못 함 | 128K | Mistral Research License(상업 이용 별도 계약) | [Mistral](https://mistral.ai/news/mistral-large-2407/) (H 경유) |
| 2024-09-17 | Pixtral 12B | 12B + 400M 비전 인코더 | 멀티모달 | 128K | Apache 2.0 | [Mistral](https://mistral.ai/news/pixtral-12b/) (H 경유) |
| 2024-09-19 | Qwen2.5 (여러 크기, Coder/Math 포함) | 확인 못 함 | 확인 못 함 | 확인 못 함 | 확인 못 함 | [QwenLM GitHub](https://github.com/QwenLM/Qwen3) (H 경유) |
| 2024-09-25 | Llama 3.2 1B, 3B, 11B Vision, 90B Vision | 1B~90B | Dense (11B/90B 비전) | 128K | Llama Community License | [Meta](https://ai.meta.com/blog/llama-3-2-connect-2024-vision-edge-mobile-devices/) (H 경유) |
| 2024-10-16 | Ministral 3B, 8B | 3B, 8B | 엣지용 | 최대 128K | 확인 못 함 | [Mistral](https://mistral.ai/news/ministraux/) (H 경유) |
| 2024-11-28 | QwQ-32B-Preview | 32B(이름 기준) | 추론 모델 | 확인 못 함 | 확인 못 함 | [Qwen blog](https://qwenlm.github.io/blog/qwq-32b-preview/) (H 경유) |
| 2024-12-06 | Llama 3.3 70B | 70B | Dense, 텍스트 전용 | 128K | Llama Community License | [HF](https://huggingface.co/meta-llama/Llama-3.3-70B-Instruct) (H 경유) |
| 2024-12-12 | Phi-4 | 14B | Dense | 확인 못 함 | MIT | [HF](https://huggingface.co/microsoft/phi-4) (H 경유). 발표일 기준이며 HF 가중치 공개 날짜는 확인 못 함 |
| 2024-12-26 | DeepSeek-V3 | 671B/37B | MoE | 128K | DeepSeek Model License(코드는 MIT) | [GitHub](https://github.com/deepseek-ai/DeepSeek-V3) (H 경유) |

#### 2025년
| 날짜 | 모델 | 총/활성 | 구조 | 컨텍스트 | 라이선스 | 등급 | 출처 |
|---|---|---|---|---|---|---|---|
| 2025-01-20 | DeepSeek-R1 (+R1-Zero, 증류 6종) | 671B/37B | MoE 추론 | 128K | MIT | A | [GitHub](https://github.com/deepseek-ai/DeepSeek-R1) (H 경유) |
| 2025-01-30 | Mistral Small 3 | 24B | Dense | 확인 못 함 | Apache 2.0 | A | [Mistral](https://mistral.ai/news/mistral-small-3/) (H 경유) |
| 2025-03-10 | Gemma 3 1B, 4B, 12B, 27B | 1B~27B | Dense, 비전 | 128K | Gemma Terms of Use | A | [Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-3/) (H 경유) |
| 2025-04-05 | Llama 4 Scout, Maverick | 총 확인 못 함/각 17B | 네이티브 멀티모달 MoE | Scout 10M, Maverick 1M | Llama 4 Community License | A | [Meta](https://ai.meta.com/blog/llama-4-multimodal-intelligence/) (H 경유). Behemoth는 예고만 하고 미공개(H) |
| 2025-04 (일자 확인 못 함) | HyperCLOVA X SEED 0.5B, 1.5B, 3B | 0.5B/1.5B/3B | 확인 못 함 | 확인 못 함 | 상업 이용 제한 없음이라고 보도 | B | [bizhankook](https://en.bizhankook.com/articles/29480.html). 날짜는 [아시아경제 기사](https://cm.asiae.co.kr/en/article/2025042315332863913) URL의 2025-04-23뿐이고 본문은 확인 못 함 |
| 2025-04-29 | Qwen3 (235B-A22B 등) | 235B/22B 외 | Dense+MoE, 하이브리드 thinking | 확인 못 함 | Apache 2.0 | A | [QwenLM/Qwen3](https://github.com/QwenLM/Qwen3) (H 경유) |
| 2025-04-30 | Phi-4-reasoning, -plus, Phi-4-mini-reasoning | 14B(reasoning) | Dense 추론 | 확인 못 함 | MIT | A | [Microsoft](https://azure.microsoft.com/en-us/blog/one-year-of-phi-small-language-models-making-big-leaps-in-ai/) (H 경유) |
| 2025-05-21 | Devstral Small | 확인 못 함 | 에이전트 코딩 | 확인 못 함 | Apache 2.0 | A | [Mistral](https://mistral.ai/news/devstral/) (H 경유) |
| 2025-06-10 | Magistral Small | 24B | 추론 | 확인 못 함 | Apache 2.0 | A | [Mistral](https://mistral.ai/news/magistral/) (H 경유) |
| 2025-06-26 | Gemma 3n E2B, E4B | 확인 못 함 | 모바일 멀티모달, Per-Layer Embeddings | 확인 못 함 | Gemma Terms of Use | A | [Google Developers](https://developers.googleblog.com/en/introducing-gemma-3n/) (H 경유) |
| 2025-07-03 | SKT A.X 4.0 (표준, 경량) | 72B, 7B | Qwen2.5 기반 한국어 추가 학습 | 확인 못 함 | 학술, 상업 이용 제한 없음이라고 보도(라이선스 원문 확인 못 함) | A | [SKT 뉴스룸](https://news.sktelecom.com/213534), [디지털데일리](https://www.ddaily.co.kr/page/view/2025070309302424908) |
| 2025-07 (HF 변경 로그 첫 항목 07-15) | Kimi K2 Instruct | 1T/32B | MoE | 128K | Modified MIT | A | [HF](https://huggingface.co/moonshotai/Kimi-K2-Instruct) (직접 확인). 정확한 최초 공개일은 카드에 없어 확인 못 함 |
| 2025-07 | LG EXAONE 4.0 | 32B, 1.2B | 추론/비추론 통합 | 확인 못 함 | EXAONE AI Model License 1.2 - NC(비상업) | A | [arXiv 2507.11407](https://arxiv.org/abs/2507.11407), [HF LICENSE](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-32B/blob/main/LICENSE). 일자는 확인 못 함 |
| 2025-07-21 | Qwen3-235B-A22B-Instruct-2507 | 235B/22B | MoE | 256K | Apache 2.0 | A | [QwenLM/Qwen3](https://github.com/QwenLM/Qwen3) (H 경유) |
| 2025-07-22 | Qwen3-Coder-480B-A35B | 480B/35B | MoE 코딩 | 256K(외삽 시 1M) | Apache 2.0 | A | [Qwen blog](https://qwenlm.github.io/blog/qwen3-coder/) (H 경유) |
| 2025-08-08 이전 (정확한 날짜 확인 못 함) | GLM-4.5, GLM-4.5-Air | 355B/32B, 106B/12B | MoE | 128K | MIT | A | [HF](https://huggingface.co/zai-org/GLM-4.5) (직접 확인. 기술 보고서 2025-08-08) |
| 2025-08-05 | gpt-oss-120b, gpt-oss-20b | 117B/5.1B, 21B/3.6B | MoE 추론 | 128K | Apache 2.0 | A | [OpenAI](https://openai.com/index/introducing-gpt-oss/) (H 경유) |
| 2025-08-21 | DeepSeek-V3.1 | 확인 못 함 | 하이브리드 thinking | 확인 못 함 | MIT | A | [DeepSeek](https://api-docs.deepseek.com/news/news250821) (H 경유) |
| 2025-09 (일자 확인 못 함) | DeepSeek-V3.2-Exp | 확인 못 함 | 실험판 | 확인 못 함 | 확인 못 함 | A | [DeepSeek](https://api-docs.deepseek.com/news/news251201) (H 경유) |
| 날짜 확인 못 함 | MiniMax-M2 | 230B/10B (카드의 크기 필드는 229B) | MoE | 확인 못 함(128K는 평가 설정) | 태그는 modified-mit, 링크 텍스트는 MIT로 카드 안에서 불일치 | A | [HF](https://huggingface.co/MiniMaxAI/MiniMax-M2) (직접 확인) |
| 2025-10-29 | gpt-oss-safeguard 120b, 20b | 확인 못 함 | gpt-oss 파인튜닝 | 확인 못 함 | Apache 2.0 | A | [OpenAI](https://openai.com/index/introducing-gpt-oss-safeguard/) (H 경유) |
| 날짜 확인 못 함 | Kimi K2 Thinking | 확인 못 함 | 확인 못 함 | 확인 못 함 | 확인 못 함 | B | [NVIDIA 포럼 글](https://forums.developer.nvidia.com/t/could-you-please-update-kimi-k2-with-the-thinking-model/350444/1)(가중치가 HF에 올라왔다는 언급) |
| 2025-12-01 | DeepSeek-V3.2 | 확인 못 함 | DeepSeek Sparse Attention | 확인 못 함 | MIT | A | [DeepSeek](https://api-docs.deepseek.com/news/news251201) (H 경유) |
| 2025-12-02 | Mistral Large 3 | 675B/41B | Sparse MoE | 256K | Apache 2.0 | A | [Mistral 3](https://mistral.ai/news/mistral-3/) (H 경유) |
| 2025-12-02 | Ministral 3 3B, 8B, 14B | 3B~14B | Dense | 256K(14B, S 기준) | Apache 2.0 | A | [Mistral 3](https://mistral.ai/news/mistral-3/) (H 경유) |
| 2025-12-15 | NVIDIA Nemotron 3 Nano 30B-A3B | 30B/3B(이름 기준) | 확인 못 함 | 확인 못 함 | 확인 못 함 | B | [llm-stats](https://llm-stats.com/models/compare/kimi-k2.5-vs-nemotron-3-nano-30b-a3b), HF repo nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16 |
| 2025-12-29 | HyperCLOVA X SEED Think 32B | 32B | 확인 못 함 | 확인 못 함 | HyperCLOVA X SEED 전용 라이선스(조건 상세는 확인 못 함) | A | [HF LICENSE](https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Think-32B/blob/main/LICENSE)(공개일 2025-12-29 명시), [arXiv 2601.03286](https://arxiv.org/abs/2601.03286?context=cs) |

#### 2026년 (2026-11-01까지)
| 날짜 | 모델 | 총/활성 | 구조 | 컨텍스트 | 라이선스 | 등급 | 출처 |
|---|---|---|---|---|---|---|---|
| 2026-01 (기술 보고서 기준, HF 공개일 확인 못 함) | Upstage Solar Open 100B | 102B/11B | MoE, 한영 이중언어 | 확인 못 함 | 확인 못 함 | A | [arXiv 2601.07022](https://www.arxiv.org/pdf/2601.07022) |
| 2026-01-27 | Kimi K2.5 | 약 1T/약 32B | MoE, 멀티모달 | 확인 못 함 | Modified MIT라는 출처와 MIT라는 출처가 충돌 | B | [Epoch AI](https://epoch.ai/models/kimi-k2-5), [SiliconANGLE](https://siliconangle.com/?p=729159) |
| 날짜 확인 못 함 (2026년 상반기로 추정되나 확인 못 함) | GLM-5 | 744B/40B (745B/44B라는 출처도 있음) | MoE | 200K(Noqta) | MIT | B | [The Decoder](https://the-decoder.com/chinese-ai-lab-zhipu-releases-glm-5-under-mit-license-claims-parity-with-top-western-models/), [Noqta](https://noqta.tn/en/news/zhipu-glm-5-open-source-model-rivals-western-ai-2026) |
| 2026-02-16 (02-15라는 출처도 있음) | Qwen3.5-397B-A17B | 397B/17B | MoE | 확인 못 함 | Apache 2.0 | A | [Qwen3.6 GitHub](https://github.com/QwenLM/Qwen3.6), [HF 컬렉션](https://huggingface.co/collections/Qwen/qwen35) (H 경유) |
| 2026-02-24 | Qwen3.5 122B-A10B, 35B-A3B, 27B | 이름 기준 122B/10B, 35B/3B, 27B | MoE + Dense | 확인 못 함 | Apache 2.0 | A | [Qwen3.6 GitHub](https://github.com/QwenLM/Qwen3.6) (H 경유) |
| 2026-03-02 | Qwen3.5 9B, 4B, 2B, 0.8B | 0.8B~9B | 확인 못 함 | 확인 못 함 | Apache 2.0 | A | [Qwen3.6 GitHub](https://github.com/QwenLM/Qwen3.6) (H 경유) |
| 2026-03-04 | Phi-4-reasoning-vision | 15B | 멀티모달 추론 | 확인 못 함 | 확인 못 함(Phi 계열은 MIT라고만 H에 있음) | A | [Microsoft Research](https://www.microsoft.com/en-us/research/blog/phi-4-reasoning-vision-and-the-lessons-of-training-a-multimodal-reasoning-model/) (H 경유) |
| 2026-03-16 | Mistral Small 4 | 119B/약 6.5B(S는 약 6B) | Sparse MoE | 256K | Apache 2.0 | A | [Mistral](https://mistral.ai/news/mistral-small-4/) (H 경유) |
| 2026-04-02 | **Gemma 4** E2B, E4B, 26B-A4B, 31B | E2B 2.3B 유효(임베딩 포함 5.1B), E4B 4.5B 유효(8B), **26B-A4B: 25.2B/3.8B**, **31B: 30.7B Dense** | 26B-A4B는 MoE(128개 전문가 중 8개 활성 + 공유 1개), 31B는 Dense | 26B-A4B와 31B 256K, E2B와 E4B 128K | **Apache 2.0**(Gemma 1~3의 Gemma Terms에서 바뀜) | A | [HF gemma-4-26B-A4B-it](https://huggingface.co/google/gemma-4-26B-A4B-it) (직접 확인), [Google blog](https://blog.google/innovation-and-ai/technology/developers-tools/gemma-4/) (H 경유), [Gemma 4 모델 카드](https://ai.google.dev/gemma/docs/core/model_card_4) (S 경유). HF 카드에는 "12B Unified"(11.95B, 256K)도 나오지만 출시일은 확인 못 함. 2026-06-05 QAT 4비트 체크포인트가 나왔다는 출처는 2차 하나뿐([wavespeed](https://wavespeed.ai/blog/posts/what-is-google-gemma-4/) 등) |
| 2026-04-07 | GLM-5.1 | 744B/40B | MoE | 확인 못 함 | MIT | B | P |
| 2026-04-16 | Qwen3.6-35B-A3B | 35B/3B | MoE(이름 기준) | 확인 못 함 | Apache 2.0 | A | [Qwen3.6 GitHub](https://github.com/QwenLM/Qwen3.6) (H 경유) |
| 2026-04-20 | Kimi K2.6 | 1T/32B | MoE | 확인 못 함 | Modified MIT | B | P |
| 2026-04-22 | Qwen3.6-27B | 27B | 확인 못 함 | 262K(P) | Apache 2.0 | A | [Qwen3.6 GitHub](https://github.com/QwenLM/Qwen3.6) (H 경유) |
| 2026-04-24 (P는 04-23) | DeepSeek-V4-Pro, V4-Flash (프리뷰) | 1.6T/49B, 284B/13B | MoE, DeepSeek Sparse Attention | 1M | MIT(2차 출처 여러 곳. H에는 명시 없음) | A | [DeepSeek](https://api-docs.deepseek.com/news/news260424) (H 경유), [NYU RITS](https://rits.shanghai.nyu.edu/ai/deepseek-releases-v4-open-source-1-6t-moe-with-1m-context). 2026-03-09 "V4-Lite 200B"는 출처 하나뿐이라 확인 못 함 |
| 2026-04 (일자 확인 못 함) | MiniMax M2.7 | 230B/10B | MoE | 확인 못 함 | 비상업이라고 S에 있음 | B | [taskade 등 집계](https://www.taskade.com/blog/open-source-llms), S |
| 2026-04 (일자 확인 못 함) | NVIDIA Nemotron 3 Nano Omni | 확인 못 함 | 오디오, 비디오, 이미지 입력 | 확인 못 함 | 확인 못 함 | B | 검색 요약(집계 사이트) |
| 2026-05-22 | Mistral Medium 3.5 | 128B Dense | Dense | 256K | Modified MIT | A | [Mistral](https://mistral.ai/news/vibe-remote-agents-mistral-medium-3-5/) (H 경유) |
| 2026-06 (일자 확인 못 함) | MiniMax-M3 | 약 428B/약 23B | MoE | 1M | MiniMax Community License(커스텀) | A | [HF LICENSE](https://huggingface.co/MiniMaxAI/MiniMax-M3/blob/main/LICENSE) (S 경유) |
| 2026-06 (일자 확인 못 함) | GLM-5.2 | 약 744B | MoE | 1M이라는 저품질 출처 있음 | MIT | B | P, [Feedbagel](https://feedbagel.com/post/zhipu-ai-open-sources-glm-52-with-1-million-token-context)(저품질) |
| 2026-06 (일자 확인 못 함) | Kimi K2.7 Code | 확인 못 함 | 확인 못 함 | 확인 못 함 | 확인 못 함 | B | P |
| 2026-07-02 | Poolside Laguna XS 2.1 | 33B/3B | MoE | 256K | OpenMDW-1.1 | B | P |
| 2026-07-16 발표, 07-27 가중치 공개 | Kimi K3 | 2.8T/104B | MoE | 1M | Kimi K3 License(커스텀. K2의 Modified MIT에서 바뀜) | A | [HF LICENSE](https://huggingface.co/moonshotai/Kimi-K3/blob/main/LICENSE) (S 경유) |
| 2026-08-11 | NVIDIA Nemotron 3.5 Lightning | 30B/3B | Mamba-2 + MoE + 어텐션 하이브리드 | 최대 1M | 확인 못 함 | B | 검색 요약(집계 사이트) |
| 2026-08-12 | Qwen3.8-2.4T-A95B | 2.4T/95B | MoE | 262K(약 1M까지) | Qwen3.8-Max License(커스텀) | A | [HF 모델 카드](https://huggingface.co/Qwen/Qwen3.8-2.4T-A95B) (S 경유) |
| 2026-08-14 | Qwen3.8-27B | 27B Dense | Dense | 262K(약 1M까지) | Apache 2.0(S). P에는 명시 없음 | B | S, P |
| 2026-08 (일자 확인 못 함) | Meta Muse Glimmer 30B | 약 30B Dense | Dense | 131K 이상 | Apache 2.0 | B | S(출처 없음) |
| 2026-08-25 | GLM-5.3, GLM-5.3-Flash | 744B/40B, 320B/18B | MoE | 1M, 300K | GLM-5.3 License(커스텀). Flash는 MIT | A(5.3), B(Flash) | [HF LICENSE](https://huggingface.co/zai-org/GLM-5.3/blob/main/LICENSE) (S 경유) |
| 2026-09-10 (10-17 갱신) | DeepSeek V4.1-Flash | 552B/8B~16B | MoE | 1M | MIT | A | [DeepSeek](https://api-docs.deepseek.com/news/news260910) (S 경유) |
| 2026-09 (일자 확인 못 함) | Xiaomi MiMo-V2.6-Pro | 1.02T/42B | MoE | 1M | MIT | B | S(출처 없음) |
| 2026-10-15 | Meta Muse Spark Open | 816B/42B | MoE | 1M | Muse Model License(커스텀) | A | [HF 모델 카드](https://huggingface.co/meta-models/Muse-Spark-Open-816B-A42B-NVFP4) (S 경유) |
| 2026-10-15 | NVIDIA Nemotron 3.5 Bolt | 74B/9B | VLM | 확인 못 함 | 확인 못 함 | B | 검색 요약(집계 사이트) |
| 2026-10-31 예정 (실제 공개는 확인 못 함) | Mistral Large 4 | 확인 못 함 | 확인 못 함 | 확인 못 함 | 확인 못 함 | B | 검색 요약. 2026-10-06 API 프리뷰, 10-31 가중치 공개 예정이라는 2차 출처 |
| 2026-11-04 예정 (기간 밖) | Kimi K3.1 Pro | 확인 못 함 | 확인 못 함 | 확인 못 함 | 확인 못 함 | B | [Let's Data Science](https://letsdatascience.com/news/moonshot-releases-kimi-k31-pro-api-open-weights-due-nov-4-786e160c). 10-23 API만 먼저 공개 |

기타(날짜 없이 S에 이름만 나옴, 집계에서 뺌): NVIDIA Nemotron 3 Super와 Ultra(2026 출시라고 [Wikipedia](https://en.wikipedia.org/wiki/Nemotron)에 있음. Ultra 550B는 [dev.to](https://dev.to/gentic_news/nvidia-nemotron-3-ultra-550b-open-weight-model-challenges-glm-kimi-p5n) 제목 기준), Tencent Hy3-preview와 Hy3(Apache 2.0), Ai2 Olmo 3와 3.1(Apache 2.0), Cohere Command A+(Apache 2.0), MiniMax M2.5, Swiss AI Apertus v1.5. 출처는 모두 S.

### Inferences
- 우리 테스트에 쓴 gemma-4-31B와 gemma-4-26B-A4B는 2026-04-02 Gemma 4 첫 출시분이다. 31B는 30.7B Dense, 26B-A4B는 총 25.2B에 활성 3.8B인 MoE이고 둘 다 256K, Apache 2.0이다(HF 카드 직접 확인).
- Meta는 Llama 4(2025-04) 뒤로 "Llama" 이름의 새 오픈웨이트를 냈다는 1차 출처를 찾지 못했다. 2026년 Meta 오픈웨이트는 "Muse" 브랜드(Glimmer 30B, Spark Open 816B)로만 나온다(S). 브랜드가 바뀐 것으로 보이지만, Meta 공식 발표로 확인한 것은 아니다.
- 2026년에는 라이선스가 반대 방향으로 갈렸다. Google(Gemma 4)은 Apache 2.0으로 풀었고, Moonshot(K3), Zhipu(GLM-5.3), Alibaba(Qwen3.8 최대 모델), MiniMax(M3), Meta(Muse Spark Open)는 플래그십에 커스텀 라이선스를 붙였다(S).

### Gaps
- 2024~2025 항목 상당수(Llama, Qwen, Mistral 등)는 1차 페이지를 직접 열지 않고 H에 달린 1차 URL만 옮겼다. 출처 URL은 1차지만 이번 세션에서 원문을 다시 대조하지 않았다.
- 다음은 알려진 출시지만 이번 조사에서 출처를 확보하지 못해 목록에서 뺐다(모두 **확인 못 함**): Phi-3.5, DeepSeek-V2.5, DeepSeek-V3-0324, R1-0528, V3.1-Terminus, QwQ-32B 정식판, Qwen2.5-VL/Omni, Qwen3-Next, Mistral Small 3.1/3.2, Magistral Small 1.1/1.2, Devstral 2, Phi-4-mini, GLM-4.6/4.7, MiniMax-M1/M2.1, Kimi-K2-Instruct-0905(이름만 HF 카드에 있고 날짜 없음), Llama-Nemotron/Nemotron Nano 2, LG EXAONE 3.0/3.5/Deep, Upstage Solar Pro, Kakao Kanana 1세대.
- Kakao Kanana(1세대, Kanana-2 모두): **조사했으나 찾지 못함**.
- 2026년 한국 모델(EXAONE 4.5나 후속, A.X 후속, Kanana 후속): **조사했으나 찾지 못함**.
- gpt-oss 후속(2026): **조사했으나 찾지 못함**. P는 gpt-oss를 2026으로 적었지만 1차 출처(OpenAI)는 2025-08-05라서 P 쪽 오류로 본다.
- Phi 계열 2026: Phi-4-reasoning-vision(03-04) 말고는 **조사했으나 찾지 못함**.
- P의 일부 항목은 1차 출처와 충돌해서 뺐다. Gemma 3을 2026-02, Apache 2.0으로 적었지만 Google은 2025-03-10, Gemma Terms다. Llama 4 Scout를 2026-03 프리뷰로 적었지만 Meta는 2025-04-05다. Phi-4 Mini를 2026-01로 적었다. P는 신뢰도가 낮다.
- 2026년 7월 이후 항목(Kimi K3, Qwen3.8, GLM-5.3, Muse, V4.1-Flash 등)은 거의 S 하나에만 기대고 있다. S가 단 HF 링크를 직접 열어 보지 않았다.

## 질문 2. 월별 출시 건수와 분기 요약 (2024-01 ~ 2026-11)

### Takeaway
이번 조사에서 확보한 항목은 2024년 22건, 2025년 23건, 2026년(10월까지) 30건이다. 분기로는 2026년 2분기(12건, 4월만 8건)가 가장 많았다. 하지만 수집 편향(2024년 중국, 한국 군소 출시 누락, 2026년은 2차 집계가 촘촘함)이 커서 "출시가 늘었다"는 결론의 근거로 쓰면 안 된다.

### Cited Findings
집계 규칙: 위 질문 1 표에서 한 행 = 1건. 단, 같은 날 같은 회사가 함께 발표한 것은 1건으로 묶었다(예: 2025-12-02 Mistral Large 3와 Ministral 3은 표에서는 2행이지만 1건으로 셈). 날짜(월)를 확인하지 못한 행(MiniMax-M2, Kimi K2 Thinking, GLM-5)과 GLM-4.5(08-08 이전만 확인), 예정 항목(Mistral Large 4, K3.1 Pro), "기타" 묶음은 뺐다. "A"는 등급 A만 센 수다. 각 건의 출처는 질문 1 표에 있다.

| 월 | 전체 | A | 해당 출시 |
|---|---|---|---|
| 2024-01 | 0 | 0 | 없음(조사 범위 안에서 찾지 못함) |
| 2024-02 | 2 | 2 | Qwen1.5, Gemma |
| 2024-03 | 1 | 1 | Qwen1.5-MoE |
| 2024-04 | 3 | 3 | Mixtral 8x22B, Llama 3, Phi-3-mini |
| 2024-05 | 2 | 2 | DeepSeek-V2, Codestral |
| 2024-06 | 3 | 3 | DeepSeek-Coder-V2, Qwen2, Gemma 2 |
| 2024-07 | 3 | 3 | Mistral NeMo, Llama 3.1, Mistral Large 2 |
| 2024-08 | 0 | 0 | 없음(Phi-3.5, EXAONE 3.0은 출처 못 구해 뺌) |
| 2024-09 | 3 | 3 | Pixtral 12B, Qwen2.5, Llama 3.2 |
| 2024-10 | 1 | 1 | Ministral |
| 2024-11 | 1 | 1 | QwQ-32B-Preview |
| 2024-12 | 3 | 3 | Llama 3.3, Phi-4, DeepSeek-V3 |
| 2025-01 | 2 | 2 | DeepSeek-R1, Mistral Small 3 |
| 2025-02 | 0 | 0 | 없음(출처 확보분 기준) |
| 2025-03 | 1 | 1 | Gemma 3 |
| 2025-04 | 4 | 3 | Llama 4, HyperCLOVA X SEED(B), Qwen3, Phi-4-reasoning |
| 2025-05 | 1 | 1 | Devstral Small |
| 2025-06 | 2 | 2 | Magistral Small, Gemma 3n |
| 2025-07 | 5 | 5 | A.X 4.0, Kimi K2, EXAONE 4.0, Qwen3-2507, Qwen3-Coder |
| 2025-08 | 2 | 2 | gpt-oss, DeepSeek-V3.1 |
| 2025-09 | 1 | 1 | DeepSeek-V3.2-Exp |
| 2025-10 | 1 | 1 | gpt-oss-safeguard |
| 2025-11 | 0 | 0 | 없음(Kimi K2 Thinking은 날짜 확인 못 해 뺌) |
| 2025-12 | 4 | 3 | DeepSeek-V3.2, Mistral Large 3/Ministral 3(묶어 1건으로 셈), Nemotron 3 Nano(B), SEED Think 32B |
| 2026-01 | 2 | 1 | Solar Open 100B, Kimi K2.5(B) |
| 2026-02 | 2 | 2 | Qwen3.5-397B, Qwen3.5 중형 |
| 2026-03 | 3 | 3 | Qwen3.5 소형, Phi-4-reasoning-vision, Mistral Small 4 |
| 2026-04 | 8 | 4 | Gemma 4, GLM-5.1(B), Qwen3.6-35B-A3B, Kimi K2.6(B), Qwen3.6-27B, DeepSeek V4, MiniMax M2.7(B), Nemotron 3 Nano Omni(B) |
| 2026-05 | 1 | 1 | Mistral Medium 3.5 |
| 2026-06 | 3 | 1 | MiniMax-M3, GLM-5.2(B), Kimi K2.7 Code(B) |
| 2026-07 | 2 | 1 | Laguna XS 2.1(B), Kimi K3 |
| 2026-08 | 5 | 2 | Nemotron 3.5 Lightning(B), Qwen3.8-2.4T, Qwen3.8-27B(B), Muse Glimmer(B), GLM-5.3 |
| 2026-09 | 2 | 1 | DeepSeek V4.1-Flash, MiMo-V2.6-Pro(B) |
| 2026-10 | 2 | 1 | Muse Spark Open, Nemotron 3.5 Bolt(B) |
| 2026-11(01일까지) | 0 | 0 | 없음 |

참고: 2025-12의 Mistral 3는 묶어서 1건으로 셌다(DeepSeek-V3.2 + Mistral 3 + Nemotron 3 Nano + SEED Think = 4).

분기 요약:
| 분기 | 전체 | A |
|---|---|---|
| 2024 Q1 | 3 | 3 |
| 2024 Q2 | 8 | 8 |
| 2024 Q3 | 6 | 6 |
| 2024 Q4 | 5 | 5 |
| **2024 합계** | **22** | **22** |
| 2025 Q1 | 3 | 3 |
| 2025 Q2 | 7 | 6 |
| 2025 Q3 | 8 | 8 |
| 2025 Q4 | 5 | 4 |
| **2025 합계** | **23** | **21** |
| 2026 Q1 | 7 | 6 |
| 2026 Q2 | 12 | 6 |
| 2026 Q3 | 9 | 4 |
| 2026 Q4(10월까지) | 2 | 1 |
| **2026 합계** | **30** | **17** |

### Inferences
- A만 세면 분기당 3~8건 안팎으로 기간 내내 비슷하다. 2026년 2분기의 급증은 대부분 B(2차 집계) 항목이 늘어난 결과다. 실제로 출시가 몰렸다기보다 출처 밀도가 달라진 영향일 수 있다.
- 2026-04는 A만 세도 Gemma 4, Qwen3.6 2종, DeepSeek V4가 몰린 달이다.

### Gaps
- 이 표는 실제 생태계 전체가 아니라 "이번 조사에서 출처를 확보한 출시"만 센 것이다. 2024년의 Yi, InternLM, Command R, DBRX, Jamba, EXAONE 3.x 같은 출시는 조사 범위 밖이거나 출처를 못 구해 빠졌다. 그래서 2024~2025 건수가 실제보다 적게 나왔을 가능성이 크다(**확인 못 함**).
- "1건"의 기준(크기 묶음, 파생 모델)에 따라 건수가 크게 달라진다. 미세 조정판(Instruct-2507, 0905 등)을 넣을지 말지도 판단에 따라 갈린다.

## 질문 3. 라이선스 유형과 상업 이용 제한

### Takeaway
MIT(DeepSeek R1 이후, GLM-4.5/5, Phi), Apache 2.0(Qwen 대부분, Mistral 소형과 Large 3, gpt-oss, Gemma 4)이 주류다. Llama Community License, Gemma Terms(Gemma 1~3), Mistral Research/Non-Production, EXAONE NC 같은 제한형 라이선스도 계속 있다. 2026년에는 중국 플래그십과 Meta Muse가 커스텀 라이선스로 돌아섰다.

### Cited Findings
- Meta Llama 3/3.1/3.2/3.3: Llama Community License. Llama 4: Llama 4 Community License — H
- Gemma 1/2/3/3n: Gemma Terms of Use. Gemma 4: Apache 2.0 — H; [HF Gemma 4 카드](https://huggingface.co/google/gemma-4-26B-A4B-it). 이전 Gemma 라이선스에는 일부 상업 이용 제한과 사용 기준이 있었다는 2차 설명이 있다 — [aitoolsatlas](https://aitoolsatlas.ai/blog/google-gemma-4-open-models-apache-license)
- Mistral: Mixtral 8x22B, NeMo, Pixtral, Small 3/4, Magistral Small, Devstral Small, Large 3, Ministral 3는 Apache 2.0. Codestral 22B는 Non-Production License, Large 2는 Research License(상업 이용 제한), Medium 3.5는 Modified MIT — H
- Qwen: Qwen3, 3.5, 3.6은 Apache 2.0 — H. Qwen3.8-2.4T-A95B는 Qwen3.8-Max License(커스텀) — S. Qwen1.5, 2, 2.5의 라이선스는 H에 없어 확인 못 함
- DeepSeek: V2와 V3는 DeepSeek Model License(V3 코드는 MIT). R1, V3.1, V3.2는 MIT — H. V4와 V4.1-Flash는 MIT — S, [NYU RITS](https://rits.shanghai.nyu.edu/ai/deepseek-releases-v4-open-source-1-6t-moe-with-1m-context)
- Microsoft Phi-3, Phi-4, Phi-4-reasoning: MIT — H
- OpenAI gpt-oss와 gpt-oss-safeguard: Apache 2.0 — H
- Moonshot Kimi K2: Modified MIT — [HF](https://huggingface.co/moonshotai/Kimi-K2-Instruct). K2.5는 Modified MIT라는 출처와 MIT라는 출처가 충돌 — [검색 요약](https://wavespeed.ai/blog/posts/kimi-k2-5-everything-we-know-about-moonshots-visual-agentic-model). K3는 Kimi K3 License(커스텀) — S
- Zhipu GLM-4.5: MIT(상업 이용과 2차 개발 허용) — [HF](https://huggingface.co/zai-org/GLM-4.5). GLM-5: MIT — [The Decoder](https://the-decoder.com/chinese-ai-lab-zhipu-releases-glm-5-under-mit-license-claims-parity-with-top-western-models/). GLM-5.3: 커스텀, 5.3-Flash: MIT — S
- MiniMax-M2: 카드 안에서 modified-mit와 MIT 표기가 섞여 있음 — [HF](https://huggingface.co/MiniMaxAI/MiniMax-M2). M2.5는 카드에 modified-mit라고 했지만 LICENSE 파일에 금지 용도가 추가되어 있음. M2.7은 비상업, M3는 MiniMax Community License — S
- Meta Muse Spark Open: Muse Model License(커스텀). Muse Glimmer: Apache 2.0 — S
- LG EXAONE 4.0: EXAONE AI Model License 1.2 - NC(비상업) — [HF LICENSE](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-32B/blob/main/LICENSE)
- Naver HyperCLOVA X SEED(0.5B/1.5B/3B): 상업 이용 제한 없이 공개했다는 보도 — [bizhankook](https://en.bizhankook.com/articles/29480.html). SEED Think 32B는 전용 LICENSE 파일이 있고 조건 상세는 확인 못 함 — [HF](https://huggingface.co/naver-hyperclovax/HyperCLOVAX-SEED-Think-32B/blob/main/LICENSE)
- SKT A.X 4.0: 학술, 상업 이용 제한 없음이라는 보도(라이선스 원문 확인 못 함) — [아시아경제](https://www.asiae.co.kr/en/article/2025070309142262024)
- Poolside Laguna XS 2.1: OpenMDW-1.1 — P
- Tencent Hy3-preview: EU, 영국, 한국을 이용 지역에서 제외. 정식 Hy3는 Apache 2.0 — S

### Inferences
- 한국에서 상업용으로 자체 운영할 때 걸리는 지점: EXAONE 4.0은 비상업(NC)이고, Tencent Hy3-preview는 한국을 지역 제외했다(S, 2차). Apache 2.0이나 MIT 쪽(Gemma 4, Qwen3.x, DeepSeek, gpt-oss, GLM-4.5/5)이 제약이 가장 적다.
- "Modified MIT"(Kimi, Mistral Medium 3.5)나 커스텀 라이선스는 이름만 보고 판단하면 안 된다. MiniMax M2.5처럼 카드 표기와 LICENSE 파일 내용이 다른 사례가 있다(S).

### Gaps
- Llama Community License의 구체 조건(월간 활성 사용자 7억 명 기준 등)은 이번 조사에서 원문을 확인하지 않았다 — **확인 못 함**.
- Qwen1.5/2/2.5(일부 크기의 Qwen License 적용 여부), Ministral 8B, Upstage Solar Open, SEED Think 32B, Nemotron 계열(NVIDIA Open Model License 여부)의 라이선스 — **확인 못 함**.
- Kakao Kanana 라이선스 — **조사했으나 찾지 못함**.
