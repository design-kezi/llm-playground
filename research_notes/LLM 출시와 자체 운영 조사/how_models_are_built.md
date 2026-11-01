# 새 LLM 버전은 어떻게 만들어지는가: 공개 자료 기반 파이프라인 정리 (2024–2026)

> 표기 규칙
> - **[공식]**: 벤더가 기술보고서·시스템카드·공식 블로그에서 직접 밝힌 내용
> - **[추론]**: 외부 관찰자 또는 본 노트 작성자가 공식 자료로부터 추론한 내용
> - **[공개되지 않음]**: 벤더가 밝히지 않은 내용
> - **(미열람)**: 이번 조사 세션에서 원문을 직접 열지 못하고 기존 지식으로 URL만 단 항목. 리포트 작성 시 재확인 권장.
> - 조사 시점: 2026-11-01. 이번 세션에서 직접 열람한 1차 자료: DeepSeek-V3·R1, Llama 3, Qwen3, Gemma 3, Kimi K2, Gemini 2.5 보고서, Tülu 3 초록, Anthropic ASL-3 공지. OpenAI GPT-5 시스템카드 페이지는 403으로 막혀 검색 요약으로만 확인함.

## 1. 기술보고서·시스템카드가 밝힌 사전학습(pretraining) 내용: 데이터 규모, 컴퓨트, 아키텍처(MoE), 긴 컨텍스트

### Takeaway
오픈 웨이트 진영(DeepSeek, Meta, Qwen, Kimi, Gemma)은 토큰 수, 파라미터 수, GPU 시간까지 상당히 구체적으로 공개한다. 2025년 이후 대형 모델은 대부분 MoE(전체 파라미터는 크고 토큰당 활성 파라미터는 작음)이며, 사전학습은 "일반 데이터 대량 학습 → 고품질·추론 데이터 비중을 높인 단계(어닐링/mid-training) → 긴 컨텍스트 확장" 순서가 공통 패턴이다. 폐쇄형 연구소(Google Gemini, OpenAI, Anthropic)는 아키텍처 계열 정도만 밝히고 파라미터 수와 데이터 규모는 공개하지 않는다.

### Cited Findings
**DeepSeek-V3 (2024-12)**
- [공식] MoE 구조로 전체 671B, 토큰당 활성 37B 파라미터. 14.8T 토큰으로 사전학습. MLA(Multi-head Latent Attention), DeepSeekMoE, 보조 손실 없는(auxiliary-loss-free) 부하 분산, 멀티토큰 예측(MTP) 목표를 사용함. 학습 중 "복구 불가능한 loss spike나 롤백이 없었다"고 밝힘. — [DeepSeek-V3 Technical Report (arXiv 2412.19437)](https://arxiv.org/abs/2412.19437)
- [공식] H800 GPU 시간: 사전학습 2,664K, 컨텍스트 확장 119K, 사후학습 5K, **합계 2,788K(2.788M)**. GPU 1시간당 $2로 환산하면 **$5.576M**. 단 "아키텍처·알고리즘·데이터에 대한 사전 연구와 ablation 실험 비용은 제외"라는 단서가 붙어 있음. — [DeepSeek-V3 보고서 HTML, Table 1](https://arxiv.org/html/2412.19437v2)
- [공식] H800 2,048장 클러스터에서 학습. 초대형 모델에서 FP8 혼합정밀 학습을 "처음으로" 검증했다고 주장함. 컨텍스트는 YaRN으로 4K → 32K → 128K 두 단계(각 1,000 step)로 확장함. — [DeepSeek-V3 보고서 HTML](https://arxiv.org/html/2412.19437v2)

**Llama 3 "Herd of Models" (2024-07)**
- [공식] 최대 모델은 **dense** 405B 파라미터, 컨텍스트 최대 128K. 학습 안정성을 위해 MoE 대신 dense 구조를 택했다고 밝힘. — [The Llama 3 Herd of Models (arXiv 2407.21783)](https://arxiv.org/abs/2407.21783)
- [공식] 405B는 약 **15.6T** 텍스트 토큰, 약 **3.8×10²⁵ FLOPs**, H100 최대 **16K**장으로 학습함. 데이터 구성은 일반 지식 약 50%, 수학·추론 25%, 코드 17%, 다국어 8%. 긴 컨텍스트는 8K에서 128K까지 6단계로 늘렸고 약 800B 토큰을 사용함. 마지막 어닐링(annealing) 단계에서 고품질 데이터를 쓴 것도 기술됨. — [Llama 3 보고서 HTML](https://arxiv.org/html/2407.21783v3)
- [공식] 54일 동안 작업 중단이 466회 있었고 그중 419회가 예기치 않은 중단이었으며, 그 약 78%가 하드웨어 문제였음. 대규모 사전학습의 운영 난이도를 보여주는 수치. — [Llama 3 보고서 HTML](https://arxiv.org/html/2407.21783v3)

**Qwen3 (2025-05)**
- [공식] 약 **36T** 토큰, 119개 언어·방언(Qwen2.5의 29개에서 확대). 0.6B~235B 크기의 dense 6종과 MoE 2종(30B-A3B, 235B-A22B, 둘 다 전문가 128개 중 8개 활성). Apache 2.0 라이선스. — [Qwen3 Technical Report (arXiv 2505.09388)](https://arxiv.org/abs/2505.09388)
- [공식] 사전학습 3단계. S1 일반 단계는 30T 토큰 이상, 길이 4,096. S2 추론 단계는 STEM·코드·추론 비중을 높인 약 5T 토큰. S3 긴 컨텍스트 단계는 수천억 토큰을 32,768 길이로 학습했고 RoPE base 조정, YaRN, Dual Chunk Attention을 사용함. — [Qwen3 보고서 HTML](https://arxiv.org/html/2505.09388v1)
- [공식, 미열람] Qwen2.5는 18T 토큰으로 사전학습함. Qwen3에서는 약 2배로 늘었다는 근거가 됨. — [Qwen2.5 Technical Report (arXiv 2412.15115)](https://arxiv.org/abs/2412.15115)

**Kimi K2 (Moonshot, 2025-07)**
- [공식] MoE 전체 1T(본문에서는 1.04T), 활성 32B. **15.5T** 토큰으로 사전학습했고 "loss spike가 0"이었다고 밝힘. Muon 옵티마이저에 QK-Clip을 더한 **MuonClip**으로 학습 불안정을 해결함. 지식·수학 텍스트를 재서술(rephrasing)한 합성 데이터로 고품질 토큰의 활용도를 높임. 4,096 길이로 사전학습한 뒤 YaRN으로 128K까지 확장함. — [Kimi K2 Technical Report (arXiv 2507.20534)](https://arxiv.org/html/2507.20534v1)

**Gemma 3 (Google, 2025-03, 오픈 웨이트)**
- [공식] 1B/4B/12B/27B. 사전학습 토큰은 27B 14T, 12B 12T, 4B 4T, 1B 2T. 지역(local)과 전역(global) 어텐션을 5:1로 섞음(지역 어텐션은 1,024 슬라이딩 윈도). 컨텍스트 128K(1B만 32K). 학습 하드웨어는 TPUv5e(1B·4B), TPUv4(12B), TPUv5p(27B). — [Gemma 3 Technical Report (arXiv 2503.19786)](https://arxiv.org/html/2503.19786v1)

**Gemini 2.5 (Google, 폐쇄형)**
- [공식] "sparse mixture-of-experts" 트랜스포머이며 텍스트·비전·오디오를 네이티브로 처리함. TPUv5p로 학습한 첫 모델 계열이고, 여러 데이터센터에 걸친 8,960칩 pod 여러 개에서 동기식 데이터 병렬로 학습함. 데이터 컷오프는 2.0이 2024-06, 2.5가 2025-01. — [Gemini 2.5 Technical Report (arXiv 2507.06261)](https://arxiv.org/html/2507.06261v1)
- [공개되지 않음] 파라미터 수, 전문가 수, 레이어 수, 학습 토큰 총량. — [Gemini 2.5 보고서](https://arxiv.org/html/2507.06261v1) (열람한 범위 기준)

**완전 공개 레시피(OLMo 2 / Tülu 3, AI2)**
- [공식] Tülu 3는 Llama 3.1 base 위에서 SFT, DPO, RLVR로 학습했고 데이터셋, 데이터 정제·평가 툴킷, 학습 코드와 인프라를 모두 공개함. — [Tülu 3 (arXiv 2411.15124)](https://arxiv.org/abs/2411.15124)
- [공식, 미열람] OLMo 2는 사전학습 데이터, mid-training 데이터("Dolmino" mix), 중간 체크포인트까지 공개한 완전 오픈 모델임. 사전학습 후반에 고품질 데이터로 학습률을 낮추며 추가 학습하는 mid-training(어닐링) 단계를 명시적으로 기술함. — [2 OLMo 2 Furious (arXiv 2501.00656)](https://arxiv.org/abs/2501.00656)

### Inferences
- [추론] 2024년 15T 안팎이던 대형 모델의 사전학습 데이터는 2025년 Qwen3에서 36T로 늘었다. 고품질 웹 데이터가 바닥나는 문제를 재서술(Kimi K2) 같은 합성 데이터로 보완하는 흐름이 보인다.
- [추론] "mid-training"이라는 용어는 업체마다 다르게 쓴다. 다만 Llama 3의 어닐링, Qwen3의 S2 추론 단계, OLMo 2의 Dolmino 단계는 모두 사전학습 후반에 고품질·추론 데이터 비중을 높이는 같은 기법으로 볼 수 있다.
- [추론] DeepSeek-V3의 $5.576M은 마지막 학습 1회분의 GPU 임대료 환산치일 뿐 총 개발비가 아니다. 보고서 자체가 연구·ablation 비용을 뺐다고 밝히므로 "600만 달러로 GPT-4급을 만들었다"는 식의 해석은 과장이다.
- [추론] Llama 3는 dense를 택했지만 이후 주요 대형 모델(DeepSeek-V3, Qwen3-235B, Kimi K2, Gemini 2.5)은 MoE로 수렴했다. 토큰당 연산량을 줄여 학습·추론 비용을 낮추려는 선택으로 보인다.

### Gaps
- OpenAI(GPT-4o/o-시리즈/GPT-5)와 Anthropic(Claude 3.x/4.x) 모델의 파라미터 수, 아키텍처(MoE 여부), 학습 토큰 수, 컴퓨트: **공개되지 않음**.
- Gemini 3과 Gemma 4의 공식 기술보고서는 이번 검색에서 찾지 못함. 검색 결과에는 2차 블로그와 커뮤니티 파인튜닝 모델만 나왔다([검색 결과 예: DEV Community](https://dev.to/jubinsoni/mastering-gemma-4-a-comprehensive-deep-dive-into-googles-next-generation-open-model-architecture-2f91)). 그래서 Gemma 4의 학습 방식(teacher 증류 여부 등)은 확인되지 않음.
- 폐쇄형 연구소의 데이터 구성 비율과 데이터 출처: **공개되지 않음**.

## 2. 사후학습(post-training): SFT, 보상모델 기반 RLHF, RLAIF/Constitutional AI, DPO, 검증 가능한 보상 RL(RLVR/GRPO), 추론("thinking") 모델

### Takeaway
2024년 사후학습은 "SFT → 보상모델 + 거부 샘플링/DPO" 반복(Llama 3)이 표준이었다. 2025년부터는 수학·코드처럼 정답을 자동 검증할 수 있는 과제에서 규칙 기반 보상으로 대규모 RL을 돌리는 방식(RLVR, GRPO)이 핵심이 됐다. 이것이 o1, R1 같은 "thinking" 모델을 만든 방법이다. 오픈 진영은 단계별 데이터 양까지 공개하지만, OpenAI와 Anthropic은 "RL로 추론을 학습시켰다" 수준만 밝힌다.

### Cited Findings
**고전적 RLHF / DPO**
- [공식, 미열람] InstructGPT는 SFT → 인간 선호 비교로 보상모델 학습 → PPO 순서의 3단계 RLHF를 정립함. — [Training language models to follow instructions with human feedback (arXiv 2203.02155)](https://arxiv.org/abs/2203.02155)
- [공식, 미열람] DPO는 별도의 보상모델과 RL 없이 선호 쌍 데이터로 정책을 직접 최적화하는 방법임. — [Direct Preference Optimization (arXiv 2305.18290)](https://arxiv.org/abs/2305.18290)
- [공식] Llama 3 사후학습의 한 라운드는 SFT, 보상모델로 거른 거부 샘플링(rejection sampling), DPO로 구성되며 이를 6라운드 반복함. — [Llama 3 보고서 HTML](https://arxiv.org/html/2407.21783v3)
- [공식] Tülu 3는 SFT → DPO → RLVR 순서로 학습했고, RLVR(Reinforcement Learning with Verifiable Rewards)이라는 이름을 붙인 것도 이 보고서임. — [Tülu 3 (arXiv 2411.15124)](https://arxiv.org/abs/2411.15124)

**RLAIF / Constitutional AI (Anthropic)**
- [공식, 미열람] Constitutional AI는 인간이 작성한 원칙 목록("헌법")을 기준으로 모델이 스스로 답을 비판·수정하는 SL 단계와, AI가 매긴 선호로 보상모델을 학습하는 RL 단계(RLAIF)로 무해성(harmlessness)을 학습시킴. — [Constitutional AI: Harmlessness from AI Feedback (arXiv 2212.08073)](https://arxiv.org/abs/2212.08073)
- [공식] Claude Opus 4의 ASL-3 배포 보호 장치에는 CBRN 유해 콘텐츠를 막는 "Constitutional Classifiers"가 포함됨. 이 분류기는 합성 탈옥(jailbreak) 데이터로 재학습해 개선함. — [Anthropic: Activating ASL-3 Protections](https://www.anthropic.com/news/activating-asl3-protections)

**RLVR / GRPO / 추론 모델**
- [공식, 미열람] GRPO는 별도의 value(critic) 모델 없이 같은 질문에 대한 여러 샘플의 보상을 그룹 내에서 상대 비교해 advantage를 계산하는 PPO 변형임. DeepSeekMath에서 처음 제안됨. — [DeepSeekMath (arXiv 2402.03300)](https://arxiv.org/abs/2402.03300)
- [공식] **DeepSeek-R1-Zero**는 DeepSeek-V3-Base에 SFT 없이 바로 GRPO를 적용하고, 정답 정확도와 출력 형식에 대한 규칙 기반 보상만 사용함. 학습 중 반성(reflection) 같은 추론 행동이 저절로 나타났고(중간 체크포인트의 "aha moment"), 대신 가독성이 낮고 여러 언어가 섞이는 문제가 있었음. — [DeepSeek-R1 (arXiv 2501.12948, HTML)](https://arxiv.org/html/2501.12948v1)
- [공식] **DeepSeek-R1**은 4단계로 학습함. (1) 긴 CoT 예시 수천 개로 cold-start SFT, (2) 언어 일관성 보상을 추가한 추론 RL, (3) 거부 샘플링으로 약 80만 샘플(추론 약 60만 + 비추론 약 20만)을 만들어 SFT, (4) 모든 시나리오 대상의 2차 RL(유용성·무해성 포함). — [DeepSeek-R1 HTML](https://arxiv.org/html/2501.12948v1)
- [공식] R1에서 신경망 보상모델을 쓰지 않은 이유는 reward hacking과 재학습 비용·복잡도 때문임. 실패한 시도로 PRM(단계 정의와 라벨링이 어렵고 reward hacking이 생김)과 MCTS(탐색 공간이 너무 크고 value 모델 학습이 어려움)를 보고함. — [DeepSeek-R1 HTML](https://arxiv.org/html/2501.12948v1)
- [공식] R1 논문은 2025년 Nature 645권 633–638쪽에 게재됨. — [arXiv 2501.12948 메타데이터](https://arxiv.org/abs/2501.12948)
- [공식] DeepSeek-V3의 사후학습은 SFT와 RL로 구성되고, R1 계열 모델에서 추론 능력을 증류함. RL에서는 규칙 기반 보상모델과 모델 기반 보상모델을 GRPO와 함께 사용함. 사후학습에 든 GPU 시간은 5K로, 전체의 0.2% 미만임. — [DeepSeek-V3 HTML](https://arxiv.org/html/2412.19437v2)
- [공식] **Qwen3** 플래그십의 사후학습 4단계는 (1) Long-CoT cold start, (2) GRPO 기반 추론 RL, (3) Thinking Mode Fusion(생각 모드와 비생각 모드를 한 모델에 통합), (4) 20개 이상 과제 대상의 일반 RL임. 사용자가 추론 연산량을 조절하는 "thinking budget"도 지원함. — [Qwen3 HTML](https://arxiv.org/html/2505.09388v1)
- [공식] **Kimi K2**는 검증 가능한 보상(RLVR)과, 정답이 없는 과제에서 모델이 루브릭으로 자기 출력을 평가하는 self-critique rubric reward를 합친 RL 단계를 사용함. 에이전트 학습용으로 실제 MCP 도구 3,000개 이상과 합성 도구 20,000개 이상으로 도구 사용 시연 데이터를 대량 합성함. — [Kimi K2 HTML](https://arxiv.org/html/2507.20534v1)
- [공식] **Gemma 3**의 사후학습은 대형 instruction-tuned teacher로부터의 증류와, 개선된 BOND/WARM/WARP 기반 RL로 이루어짐. 보상은 가중평균 보상모델(인간 피드백), 코드 실행 결과, 수학 정답을 사용함. — [Gemma 3 HTML](https://arxiv.org/html/2503.19786v1)
- [공식] **Gemini 2.5**의 thinking 모델은 "Reinforcement Learning으로 학습"해 답하기 전에 추론 시간 연산을 더 쓰도록 만듦. 사후학습에서 RL에 배정한 컴퓨트를 늘렸고, 검증 가능한 보상과 모델 기반 생성형 보상을 사용하며, RL 안정성을 높이는 알고리즘을 개선했다고 기술함. — [Gemini 2.5 HTML](https://arxiv.org/html/2507.06261v1)
- [공식, 미열람] OpenAI o1은 대규모 RL로 chain-of-thought를 쓰도록 학습되었고, 학습 시 컴퓨트(train-time compute)와 추론 시 컴퓨트(test-time compute)가 늘수록 성능이 오른다고 밝힘. — [OpenAI: Learning to reason with LLMs](https://openai.com/index/learning-to-reason-with-llms/)

### Inferences
- [추론] 2025년 이후 오픈 보고서들의 공통 레시피는 "소량의 긴 CoT로 cold start → 검증 가능 과제에서 GRPO 계열 RL → 거부 샘플링 SFT로 일반 능력 회복 → 일반·안전 RL"이다(R1, Qwen3). 수학·코드 밖의 과제는 정답을 자동 검증할 수 없으므로 루브릭이나 생성형 보상모델을 쓰는 쪽으로 넓혀가고 있다(Kimi K2, Gemini 2.5).
- [추론] DeepSeek-V3에서 사후학습 GPU 시간은 전체의 0.2%에 불과했다. 반면 R1 이후 업체들은 "RL 컴퓨트를 늘렸다"고 밝힌다(Gemini 2.5). 사후학습이 차지하는 컴퓨트 비중이 커지는 추세로 보이지만, 정확한 비율은 대부분 공개되지 않았다.

### Gaps
- OpenAI o1/o3/GPT-5와 Anthropic Claude의 RL 알고리즘, 보상모델 구조, RL 데이터 양, RL 컴퓨트: **공개되지 않음**.
- 현행 Claude 모델이 Constitutional AI를 실제로 어떻게 쓰는지(2022년 논문 방식 그대로인지, 변형인지)는 이번 세션에서 확인하지 못함.

## 3. 작은 티어(flash/mini/nano/haiku 등)는 어떻게 만드는가: 큰 teacher로부터의 증류

### Takeaway
Google(Gemini Flash 이하, Gemma 3), Qwen(Qwen3 소형), DeepSeek(R1-Distill)는 큰 모델로부터 증류했다고 **공식적으로 확인**했다. Meta는 405B를 소형 모델 사후학습 품질 향상에 활용했다고 밝혔다(미열람). OpenAI의 mini/nano와 Anthropic의 Haiku가 어떻게 만들어지는지는 **공개되지 않음**.

### Cited Findings
- [공식] Gemini 2.5에서 "Flash 크기 이하" 모델은 증류로 학습함. teacher의 다음 토큰 분포를 어휘 전체가 아니라 **k-sparse 분포로 근사**해 저장 비용을 줄였음. — [Gemini 2.5 HTML](https://arxiv.org/html/2507.06261v1)
- [공식] Gemma 3는 **모든** 모델을 지식 증류로 학습함. 토큰마다 teacher 확률에 따라 256개 logit을 샘플링하고, 학생 모델이 그 분포를 cross-entropy로 학습함. 사후학습에서도 대형 IT teacher로부터 증류함. — [Gemma 3 HTML](https://arxiv.org/html/2503.19786v1)
- [공식] Qwen3는 소형 dense 5종(0.6B~14B)과 30B-A3B를 **strong-to-weak distillation**으로 만듦. off-policy 단계에서는 teacher의 생각 모드와 비생각 모드 출력을 학습하고, on-policy 단계에서는 Qwen3-32B 또는 235B-A22B teacher와 학생의 logit 사이 KL divergence를 최소화함. 4단계 학습 대비 GPU 시간이 "1/10"이며, Qwen3-8B 비교에서는 on-policy 증류 1,800 GPU시간 대 RL 17,920 GPU시간이었음. — [Qwen3 HTML](https://arxiv.org/html/2505.09388v1)
- [공식] DeepSeek는 R1이 생성한 80만 샘플로 Qwen2.5와 Llama의 1.5B~70B 모델을 **SFT만으로**(RL 없이) 증류함. 소형 모델에 대규모 RL을 직접 하는 것보다 증류가 낫다고 결론 내림. RL만 한 32B는 QwQ-32B-Preview 수준이었고, 증류한 32B가 훨씬 우수했음. — [DeepSeek-R1 HTML](https://arxiv.org/html/2501.12948v1)
- [공식] OpenAI GPT-5 시스템카드에는 gpt-5-main, gpt-5-main-mini, gpt-5-thinking, gpt-5-thinking-mini 같은 모델 구분이 나옴. — [OpenAI GPT-5 System Card](https://openai.com/index/gpt-5-system-card) (페이지가 403이어서 검색 요약으로 확인)

### Inferences
- [추론] 증류에는 두 형태가 있다. teacher 출력 텍스트로 SFT하는 hard-label 방식(R1-Distill)과 teacher logit 분포를 학습하는 soft-label 방식(Gemma 3, Gemini Flash, Qwen3 on-policy)이다. logit 증류는 teacher 가중치에 접근할 수 있는 같은 회사 내부에서만 가능하다.
- [추론] OpenAI mini/nano와 Claude Haiku도 업계 관행상 증류를 썼을 가능성이 높아 보인다. 그러나 이는 외부 추정일 뿐 공식 확인은 없다.

### Gaps
- OpenAI(GPT-4o mini, o-mini, GPT-5 mini/nano)와 Anthropic(Haiku 3.5/4.5 등)의 소형 모델 제작 방법: **공개되지 않음**.
- [미확인] Llama 3 보고서가 405B를 소형 모델 사후학습 데이터 품질 개선에 썼다고 밝혔는지는 이번 세션에서 해당 부분을 열람하지 못해 확인하지 못함.

## 4. 포인트 버전(x.5, x.1, 날짜 버전)에서는 무엇이 바뀌는가: 새 사전학습인가, 사후학습만인가

### Takeaway
공개 근거가 있는 사례에서 보면 큰 번호 변경(Qwen2.5 → Qwen3)은 새 사전학습(데이터 2배, 새 아키텍처)을 동반한다. Gemini 2.0 → 2.5처럼 데이터 컷오프가 바뀐 경우는 새로운(또는 연장된) 사전학습이 있었다고 추론할 수 있다. DeepSeek-V3 → R1은 **같은 base 위의 사후학습 차이**임이 공식 확인된다. 폐쇄형 연구소(OpenAI, Anthropic)는 포인트 버전마다 base를 새로 학습했는지 대개 밝히지 않는다.

### Cited Findings
- [공식] DeepSeek-R1과 R1-Zero는 모두 **DeepSeek-V3-Base**에서 출발함. 즉 V3(채팅 모델)와 R1은 base가 같고 사후학습만 다름. — [DeepSeek-R1 HTML](https://arxiv.org/html/2501.12948v1)
- [공식] Qwen2.5 → Qwen3에서 사전학습 데이터가 18T에서 36T로, 언어가 29개에서 119개로 늘었고 MoE 라인업이 추가됨. 새 사전학습임. — [Qwen3 HTML](https://arxiv.org/html/2505.09388v1); [Qwen2.5 보고서 (미열람)](https://arxiv.org/abs/2412.15115)
- [공식] Gemini 2.0과 2.5의 데이터 컷오프가 각각 2024-06과 2025-01로 다름. — [Gemini 2.5 HTML](https://arxiv.org/html/2507.06261v1)

### Inferences
- [추론] 데이터 컷오프가 바뀌었다면 최소한 새 데이터로 계속 사전학습(continued pretraining)을 했거나 새로 학습했다는 뜻이다. Gemini 2.5는 2.0보다 새로운 사전학습 데이터를 반영한 것으로 보인다. 다만 처음부터 새로 학습했는지는 공개되지 않았다.
- [추론] 오픈 진영의 날짜·소수점 버전(예: DeepSeek-V3-0324, V3.1)은 같은 base에 계속 사전학습 또는 사후학습만 더한 경우가 많다고 알려져 있다. 이번 세션에서 해당 모델 카드를 열람하지 못했으므로 확인이 필요하다.

### Gaps
- Claude 3 → 3.5 → 3.7 → 4 → 4.5, GPT-4o → 4.1 → 4.5 → 5 → 5.x 같은 포인트 버전마다 새로 사전학습했는지 여부: **공개되지 않음**. 시스템카드와 모델카드에는 보통 학습 데이터 컷오프만 나온다(이번 세션에서 개별 확인 못 함).
- DeepSeek-V3.1/V3.2, Qwen3 이후 버전(Qwen3-2507 등)의 변경 범위는 이번 세션에서 1차 자료로 확인하지 못함.

## 5. 출시를 결정하는 요인: 평가, 안전 프레임워크(Anthropic RSP, OpenAI Preparedness, Google Frontier Safety Framework), 단계적 출시

### Takeaway
세 폐쇄형 연구소는 모두 출시 전에 위험 역량(CBRN, 사이버, AI R&D 자동화, 기만적 정렬 등)을 평가한다. 역량이 임계치를 넘었거나 넘지 않았다고 **배제할 수 없을 때**는 추가 보호 장치를 켠 상태로 출시한다. 2025년에는 Claude Opus 4(ASL-3)와 GPT-5 thinking(생물·화학 "High")이 모두 "예방적" 상향 조치와 함께 출시됐다. 반면 Gemini 2.5 Pro는 어떤 CCL에도 도달하지 않았다고 보고됐다.

### Cited Findings
- [공식] Anthropic은 Claude Opus 4를 **ASL-3** 기준으로 배포함. CBRN 역량이 개선되어 "ASL-3 위험을 명확히 배제하는 것이 불가능"했기 때문이며, 이를 "예방적이고 잠정적인 조치"라고 설명함. RSP는 필요 이상으로 높은 기준을 적용해 배포하는 것을 허용함. Opus 4는 ASL-4가 필요 없고, Sonnet 4는 ASL-3가 필요 없다고 판단함. — [Anthropic: Activating ASL-3 Protections](https://www.anthropic.com/news/activating-asl3-protections)
- [공식] ASL-3 배포 기준에는 Constitutional Classifiers, 탈옥 모니터링, 버그 바운티, 위협 인텔리전스가 포함됨. 보안 기준에는 100개 이상의 통제 항목이 있으며 가중치 접근 시 2인 승인, 대량 외부 전송을 감지하는 egress 대역폭 통제 등이 들어감. — [같은 출처](https://www.anthropic.com/news/activating-asl3-protections)
- [공식, 미열람] Anthropic Responsible Scaling Policy 원문. — [Anthropic RSP](https://www.anthropic.com/responsible-scaling-policy)
- [공식] OpenAI는 gpt-5-thinking을 Preparedness Framework 기준으로 생물·화학 역량 **High**로 분류하고 관련 보호 장치를 적용함. 초보자가 심각한 생물학적 피해를 일으키도록 의미 있게 도울 수 있다는 확정적 증거는 없지만 예방적으로 판단했다고 밝힘(ChatGPT agent와 같은 접근). — [OpenAI GPT-5 System Card](https://openai.com/index/gpt-5-system-card) (검색 요약으로 확인, 원문 403)
- [공식, 미열람] OpenAI o1 시스템카드에는 Preparedness 평가와 외부 레드팀 결과가 실려 있음. — [OpenAI o1 System Card](https://openai.com/index/openai-o1-system-card/)
- [공식] Gemini 2.5 보고서는 Frontier Safety Framework에 따라 사이버보안, CBRN, ML R&D, 기만적 정렬(Deceptive Alignment)을 평가했고, Gemini 2.5 Pro는 "어떤 영역에서도 Critical Capability Level에 도달하지 않았다"고 밝힘. — [Gemini 2.5 HTML](https://arxiv.org/html/2507.06261v1)
- [공식, 미열람] Google DeepMind Frontier Safety Framework 소개. — [Introducing the Frontier Safety Framework](https://deepmind.google/discover/blog/introducing-the-frontier-safety-framework/)
- [공식] Llama 3 출시 때 Meta는 안전 분류기 Llama Guard 3를 함께 공개함. 초록에는 멀티모달 확장 모델이 "아직 광범위하게 공개되지 않았다(개발 중)"는 문구도 있어 기능별로 단계적으로 출시했음을 보여줌. — [Llama 3 보고서](https://arxiv.org/abs/2407.21783)

### Inferences
- [추론] 안전 프레임워크는 출시를 막는 장치라기보다 "어떤 보호 장치를 켜고 출시할지"를 정하는 장치로 작동하고 있다. 2025년 두 사례(Opus 4, GPT-5 thinking) 모두 임계치 판단이 불확실한 상태에서 상향 조치와 함께 출시됐다.
- [추론] 출시 주기는 (1) 새 base 사전학습(수개월, 큰 번호 변경), (2) 같은 base 위의 사후학습·RL 개선(짧은 주기, 포인트·날짜 버전), (3) 증류 소형 티어 파생으로 나뉜다. 그 사이에 위험 역량 평가와 외부 레드팀이 관문 역할을 하는 것으로 보인다. 다만 연구소별 내부 일정과 결정 기준의 세부는 공개되지 않았다.

### Gaps
- 평가 결과 때문에 출시를 연기했거나 취소한 구체적 사례: 이번 세션에서 1차 자료로 확인하지 못함.
- 2026년 개정된 RSP, Preparedness Framework, FSF 버전의 세부 변경 사항: 이번 세션에서 확인하지 못함.
- 중국 오픈 웨이트 업체(DeepSeek, Qwen, Moonshot)의 출시 전 위험 역량 평가 절차: 보고서 안에서 찾지 못했고 **공개되지 않음**으로 판단함(열람한 범위 기준).
