# 오픈 웨이트 LLM을 제품에 맞게 개선하는 방법 (한국어 롤플레이 + 장기기억, 턴당 1원 이하)

> 작성일 2026-11-01. 표기 규칙: **[본문 확인]** = 이번 조사에서 해당 URL을 직접 열어 확인함. **[미재확인]** = 널리 알려진 논문 초록/문서 내용으로 URL은 정확하지만 이번 세션에서 원문을 다시 열지 않음(리포트 작성 시 인용 전 재확인 권장). "확인 못 함" / "조사했으나 찾지 못함"은 그대로 표기.
> 대상 후보: gemma-4-31B(dense), gemma-4-26B-A4B(MoE), Qwen3-32B, DeepSeek. 과제: (1) 캐릭터 대사(반말/하오체 등 말투 일관성), (2) 기억 추출(구조화 JSON 사실 추출).

## 1. 파인튜닝: Full FT vs LoRA vs QLoRA, 도구, ~30B LoRA의 GPU/비용

### Takeaway
30B급은 QLoRA면 GPU 1장(24GB대~)에서도 학습할 수 있고, 16-bit LoRA는 64~76GB가 필요해 H100 80GB 1장이 기준선이다. LoRA는 full FT보다 새 지식/기술 습득은 덜하지만 기존 능력을 덜 잊으므로, "말투·형식 맞추기"처럼 좁은 행동 교정에 맞는다. gemma-4-26B-A4B(MoE)는 QLoRA를 권장하지 않는다는 Unsloth 문서 문구가 있다.

### Cited Findings
**논문 근거**
- LoRA: GPT-3 175B 기준 Adam full FT 대비 학습 파라미터 수를 10,000배, GPU 메모리를 3배 줄였고, 품질은 full FT와 같거나 더 좋으며 추론 지연이 추가되지 않는다(가중치 병합 가능). [미재확인] — [Hu et al., LoRA, arXiv 2106.09685](https://arxiv.org/abs/2106.09685)
- QLoRA: 4-bit NF4 양자화 + Double Quantization + Paged Optimizer로 65B 모델을 48GB GPU 1장에서 학습하면서 16-bit full FT 성능을 유지했다고 주장. Guanaco가 Vicuna 벤치마크에서 ChatGPT의 99.3%에 도달했고, GPU 1장으로 24시간 학습. 같은 논문에서 GPT-4 평가가 사람 평가를 저렴하게 대신할 만하다고 보면서도 당시 챗봇 벤치마크는 믿기 어렵다고 지적. [미재확인] — [Dettmers et al., QLoRA, arXiv 2305.14314](https://arxiv.org/abs/2305.14314)
- "LoRA Learns Less and Forgets Less": 코딩·수학에서 일반적인 low-rank LoRA는 full FT보다 "substantially underperforms"(instruction FT 약 10만 쌍, continued pretraining 20B 토큰 모두). 대신 목표 도메인 밖 성능을 더 잘 보존하고(weight decay·dropout보다 망각을 더 줄임) 생성 다양성도 더 유지. full FT가 학습하는 변화량의 rank가 일반 LoRA 설정보다 10~100배 높음. [본문 확인] — [Biderman et al., arXiv 2405.09673](https://arxiv.org/abs/2405.09673)

**메모리 요구량 (Unsloth 공식 문서, 최소값)**
- QLoRA(4-bit) / LoRA(16-bit) VRAM: 27B = 22GB / 64GB, 32B = 26GB / 76GB, 70B = 41GB / 164GB. 문서는 이 수치가 "the absolute minimum"이고 모델에 따라 더 필요할 수 있다고 명시. [본문 확인] — [Unsloth Requirements](https://unsloth.ai/docs/get-started/beginner-start-here/unsloth-requirements)
- Gemma 4: 31B QLoRA "22GB", 26B-A4B LoRA ">40GB". 26B-A4B(MoE)는 LoRA를 쓰고 full FT는 하지 말 것, 메모리가 되면 16-bit/bf16 LoRA 권장, 코드 주석에 "MoE QLoRA not recommended, dense 31B is fine". 최고 품질이 목표이고 메모리가 충분하면 31B 권장. [본문 확인] — [Unsloth Gemma 4 Fine-tuning Guide](https://unsloth.ai/docs/models/gemma-4/train)
- 2차 출처는 26B-A4B 16-bit LoRA를 ~24GB+로 적는 등 수치가 서로 다름. 공식 Unsloth 문서(>40GB)를 우선해야 함. — [Lushbinary 가이드](https://lushbinary.com/blog/fine-tune-gemma-4-lora-qlora-complete-guide) vs [Unsloth](https://unsloth.ai/docs/models/gemma-4/train)

**일반적인 하이퍼파라미터 (Unsloth Gemma 4 예제)**
- 텍스트 SFT(26B-A4B 예): r=8, lora_alpha=8, lora_dropout=0, max_seq_length=8192, batch 1 × grad accumulation 4, lr 2e-4(긴 학습이면 2e-5로 낮추라고 안내), optim adamw_8bit, weight_decay 0.001, linear scheduler, warmup 5 steps, 예제는 max_steps=60(전체 학습은 num_train_epochs=1). 멀티모달 예: r=32, alpha=32, target_modules="all-linear", cosine, max_grad_norm 0.3, warmup_ratio 0.03. [본문 확인] — [Unsloth Gemma 4 Guide](https://unsloth.ai/docs/models/gemma-4/train)
- 26B/31B는 thinking 템플릿(`gemma-4-thinking`) 권장. 멀티턴 데이터는 이전 턴의 thought 블록 없이 최종 답만 남길 것. 다른 런타임으로 내보낸 뒤 품질이 떨어지면 학습 때와 chat template·EOS 토큰이 같은지 확인할 것. [본문 확인] — 같은 출처
- 알려진 이슈: 26B/31B 학습 loss는 대략 1~3 이하가 정상. loss가 100, 300처럼 나오면 gradient accumulation 처리 문제. 31B/26B 추론 시 `num_kv_shared_layers = 0` 때문에 IndexError 발생. RL(GRPO)용 "Gemma 4 is not supported by vLLM"이라 `fast_inference=False`를 쓰라고 안내. [본문 확인] — 같은 출처
- 2차 출처 보고: Gemma 3 파인튜닝 스크립트를 Gemma 4에 그대로 쓰면 동작하지 않고, PEFT가 일부 커스텀 레이어에 LoRA를 붙이지 못한 사례가 있음. [검색 스니펫만 확인] — [bittide 기사](https://bittide.aicompass.dev/article/8a827eac-e1a1-4b36-af23-9e3aae2781b0)

**도구**
- Hugging Face TRL(SFTTrainer, DPOTrainer, ORPO/KTO/GRPO 트레이너 포함)과 PEFT(LoRA 구현). [미재확인] — [TRL docs](https://huggingface.co/docs/trl/index), [PEFT docs](https://huggingface.co/docs/peft/index)
- Unsloth: Gemma 4 E2B~31B 가이드, GRPO 예제, 4-bit 로더 제공. [본문 확인] — [Unsloth Gemma 4 Guide](https://unsloth.ai/docs/models/gemma-4/train)
- Axolotl(YAML 설정 기반), LLaMA-Factory(웹 UI·다수 모델 지원), torchtune(PyTorch 네이티브). [미재확인] — [Axolotl](https://github.com/axolotl-ai-cloud/axolotl), [LLaMA-Factory](https://github.com/hiyouga/LLaMA-Factory), [torchtune](https://github.com/pytorch/torchtune)

**GPU 시간 단가**
- RunPod H100 80GB: 공식 가격 페이지는 "$1.99/hr부터"(초 단위 과금, 2026년 7월 갱신 표기). 추적 사이트는 Secure Cloud 기준 H100 PCIe $2.89, H100 SXM $3.99로 적었고, SXM은 2026년 7월 중순 $2.99에서 인상됐다고 보고. Community Cloud PCIe는 $1.80~2.40. 출처끼리 값이 다르므로 실제 결제 전 다시 확인해야 함. 스토리지는 별도 과금. [검색 결과 요약] — [RunPod pricing](https://www.runpod.io/gpu-cloud/pricing), [usagepricing 기록](https://usagepricing.com/blueprint/activity/runpod-2026-07-14-price-change), [hivenet 가이드](https://www.hivenet.com/post/runpod-pricing-complete-guide-to-gpu-cloud-costs)
- 다른 클라우드까지 넣으면 H100 대여가는 $1.49~$6.98/hr로 넓게 퍼져 있다는 비교 기사도 있음. [제목만 확인] — [IntuitionLabs](https://intuitionlabs.ai/articles/h100-rental-prices-cloud-comparison)

### Inferences
- 31B dense QLoRA는 H100 80GB 1장(또는 24~48GB 카드)에서 돌릴 수 있다. 26B-A4B는 16-bit LoRA(>40GB, 실제로는 80GB급 1장)가 안전한 구성이다. Qwen3-32B 16-bit LoRA는 최소 76GB라 H100 80GB에서 여유가 거의 없다.
- 비용 감(추정, 실측 아님): QLoRA 논문의 "GPU 1장 24시간"을 상한 감으로 쓰면, 수천~1만 샘플 SFT 1 epoch는 H100 1장 기준 수 시간~하루 정도, 시간당 $2~4면 대략 $10~100 범위로 추정된다. 실제 시간은 시퀀스 길이·샘플 수·처리량에 따라 크게 달라지므로 소규모로 처리량(tokens/s)을 먼저 재야 한다.
- "학습 비용"보다 "서빙 비용"이 더 큰 문제다. 파인튜닝한 모델은 서버리스 API 단가(DeepSeek 등)를 그대로 쓸 수 없고, LoRA 어댑터를 받아주는 호스팅이나 자체 GPU가 필요하다. 이게 1원/턴 제약과 충돌할 수 있다(호스팅별 LoRA 서빙 단가는 이번에 조사하지 않음).
- LoRA는 덜 배우고 덜 잊으므로, 말투·JSON 형식 같은 좁은 행동 교정에 적합하고 새 지식 주입에는 덜 맞는다.

### Gaps
- 30B급 LoRA의 샘플당 실제 학습 시간·비용 실측: 확인 못 함(벤더 문서에 표준 수치가 없음).
- 이번 프로젝트 후보 모델(Qwen3-32B, DeepSeek)의 LoRA 어댑터 서버리스 서빙(DeepInfra 등) 가능 여부와 단가: 이번 조사 범위에서 확인 못 함.
- DeepSeek-V3/R1급(수백 B MoE)의 LoRA 메모리: 조사했으나 공식 수치를 찾지 못함. 사실상 단일 GPU 대상이 아님.
- torchtune의 현재 유지보수 상태: 확인 못 함.
- Unsloth의 "Gemma 4 not supported by vLLM"이 vLLM 추론 일반을 말하는지 Unsloth fast_inference 경로만 말하는지 불명확함. 확인 못 함.

## 2. 선호 최적화: RLHF/PPO, DPO, ORPO, KTO, SimPO, GRPO

### Takeaway
PPO 기반 RLHF는 reward model과 온라인 샘플링이 필요해 무겁다. DPO/ORPO/SimPO는 쌍(chosen/rejected) 선호 데이터, KTO는 좋음/나쁨 이진 라벨만 필요하다. GRPO는 critic 없이 그룹 상대 보상을 쓰는 RL이라 검증 가능한 보상(JSON 스키마 통과, 말투 규칙 판정기)과 잘 맞는다. 말투 위반이나 JSON 오류처럼 "자동 판정 가능한 실패"가 많은 이 제품에서는 KTO(이진)나 GRPO(규칙 보상)의 데이터 비용이 가장 낮다.

### Cited Findings
- RLHF/PPO(InstructGPT): SFT → reward model(사람 순위 데이터) → PPO 3단계. 사람 평가에서 1.3B InstructGPT 출력이 175B GPT-3보다 선호됨. [미재확인] — [Ouyang et al., arXiv 2203.02155](https://arxiv.org/abs/2203.02155)
- DPO: 별도 reward model이나 RL 샘플링 없이, 선호 쌍에 대한 분류형 손실로 정책을 직접 최적화. 감정 제어·요약·단일 턴 대화에서 PPO 기반 RLHF와 같거나 더 나았다고 보고. 참조 모델(reference model)이 필요함. [미재확인] — [Rafailov et al., DPO, arXiv 2305.18290](https://arxiv.org/abs/2305.18290)
- ORPO: 참조 모델이 필요 없고 SFT 단계와 선호 정렬을 한 번에 함(odds ratio 페널티). 쌍 선호 데이터가 필요함. Mistral-ORPO 7B가 AlpacaEval 2.0 12.20%, IFEval 66.19%, MT-Bench 7.32를 기록했다고 보고. [미재확인] — [Hong et al., ORPO, arXiv 2403.07691](https://arxiv.org/abs/2403.07691)
- KTO: 쌍이 아니라 출력 하나하나에 "바람직함/바람직하지 않음" 이진 신호만으로 학습(전망이론 기반). 1B~30B 규모에서 DPO와 같거나 더 낫다고 보고. [미재확인] — [Ethayarajh et al., KTO, arXiv 2402.01306](https://arxiv.org/abs/2402.01306)
- SimPO: 시퀀스 평균 로그확률을 암묵적 보상으로 쓰고 참조 모델을 없앰. 목표 보상 마진을 둠. AlpacaEval 2에서 DPO보다 최대 6.4점, Arena-Hard에서 최대 7.5점 높았다고 보고. 쌍 선호 데이터가 필요함. [미재확인] — [Meng et al., SimPO, arXiv 2405.14734](https://arxiv.org/abs/2405.14734)
- GRPO: PPO 변형으로, critic(가치 모델) 없이 같은 프롬프트에서 뽑은 여러 출력의 점수로 baseline을 잡아 학습 자원을 줄임. DeepSeekMath 7B가 MATH 51.7%를 기록. [미재확인] — [Shao et al., DeepSeekMath, arXiv 2402.03300](https://arxiv.org/abs/2402.03300)
- Unsloth는 Gemma 4 E2B GRPO를 9GB로 안내하지만, Gemma 4 RL에서는 vLLM 대신 Unsloth 추론(`fast_inference=False`)을 쓰라고 함. 롤아웃 생성이 느려질 수 있음. [본문 확인] — [Unsloth Gemma 4 Guide](https://unsloth.ai/docs/models/gemma-4/train)

| 방법 | 필요한 데이터 | 참조 모델 | reward model | 온라인 생성 |
|---|---|---|---|---|
| PPO-RLHF | 순위/쌍 선호 → RM 학습 | 필요(KL) | 필요 | 필요 |
| DPO | 쌍 (prompt, chosen, rejected) | 필요 | 불필요 | 불필요 |
| ORPO | 쌍 | 불필요 | 불필요 | 불필요 |
| KTO | 단일 출력 + 좋음/나쁨 | 필요 | 불필요 | 불필요 |
| SimPO | 쌍 | 불필요 | 불필요 | 불필요 |
| GRPO | 프롬프트 + 보상 함수(규칙 또는 모델) | 보통 KL용으로 사용 | 규칙으로 대체 가능 | 필요 |

(표의 정리는 위 논문들 초록에서 정리함. 각 방법의 구현 세부는 TRL 트레이너 문서 참고: [TRL](https://huggingface.co/docs/trl/index) [미재확인])

### Inferences
- 말투 일관성: "반말 캐릭터가 존댓말을 섞음" 같은 실패는 규칙 판정기(어미 패턴)로 자동 라벨링할 수 있어 KTO 이진 데이터나 GRPO 보상으로 바로 바꿀 수 있다. 같은 프롬프트에 대해 맞는 답과 틀린 답을 쌍으로 만들면 DPO/ORPO/SimPO도 가능하다.
- 기억 추출 JSON: 형식 오류는 constrained decoding(4절)으로 0에 가깝게 만들 수 있으므로, 학습은 "형식"이 아니라 "무엇을 추출하는가"(누락/환각)에 써야 한다. 정답 라벨이 있으면 SFT가 우선이고, 선호 학습은 그다음이다.
- 위 논문 결과는 대부분 영어 벤치마크(AlpacaEval, MT-Bench 등)라서 한국어 롤플레이 품질 개선의 직접 증거는 아니다.

### Gaps
- 한국어 롤플레이/말투 일관성에 DPO·KTO 등을 적용한 정량 결과: 조사했으나 찾지 못함.
- DPO vs KTO vs SimPO를 같은 조건에서 롤플레이 과제로 비교한 연구: 조사했으나 찾지 못함.

## 3. 증류(Distillation)와 상용 API 출력 사용의 약관 문제

### Takeaway
큰 모델 출력으로 작은 모델을 학습하는 것은 효과가 확인된 방법이다(DeepSeek-R1 distill 계열). 다만 상용 API 출력을 학습 데이터로 쓰는 것은 약관상 제약이 있다. Anthropic은 사전 승인 없는 증류를 명시적으로 금지하고, OpenAI와 Google은 "경쟁 모델 개발"을 금지한다. Gemma 4(Apache 2.0)와 Qwen3(Apache 2.0)처럼 허용적 라이선스인 오픈 모델을 교사로 쓰는 쪽이 법적으로 가장 깨끗하다.

### Cited Findings
- DeepSeek-R1 초록: 큰 모델의 추론 패턴을 "systematically harnessed"해서 작은 모델의 추론 능력을 높일 수 있다고만 서술. 초록에는 distill 대상 base 모델명·크기가 없음. [본문 확인] — [DeepSeek-R1, arXiv 2501.12948](https://arxiv.org/abs/2501.12948)
- **Anthropic 이용 정책(AUP)**: "Anthropic의 사전 승인 없이 출력을 활용해 AI 모델을 학습하는 행위(예: '모델 스크레이핑' 또는 '모델 증류')"를 금지. [본문 확인] — [Anthropic Usage Policy](https://www.anthropic.com/legal/aup)
- **Anthropic 상업 약관 D.4**: "access the Services to build a competing product or service, including to train competing AI models"를 금지. 한편 Section B에서 고객이 "owns its Outputs". [본문 확인] — [Anthropic Commercial Terms](https://www.anthropic.com/legal/commercial-terms)
- **Google Gemini API 추가 약관**: "You may not use the Services to develop models that compete with the Services (e.g., Gemini API or Google AI Studio)", 서비스 구성요소의 reverse engineer/extract/replicate 금지, Google Search grounding 결과로 "train on" 금지. [본문 확인] — [Gemini API Additional Terms](https://ai.google.dev/gemini-api/terms)
- **OpenAI**: 이용약관 금지 항목에 "using Output to develop models that compete with OpenAI"가 있음. 한편 출력에 대한 권리는 사용자에게 양도된다고 함. OpenAI 페이지는 이번에 403으로 직접 열지 못했고 검색 결과로만 확인. [검색 결과만 확인] — [OpenAI EU Terms of Use](https://openai.com/policies/eu-terms-of-use/), [OpenAI Terms of Use](https://openai.com/policies/row-terms-of-use/)
- Azure OpenAI에는 이 OpenAI 약관 문구가 명시적으로 적용되지 않는다는 개발자 주장이 있지만 커뮤니티 의견이라 신뢰도가 낮음. — [Microsoft Q&A](https://learn.microsoft.com/en-us/answers/questions/1920477/are-there-any-restrictions-on-the-handling-of-outp)
- 여러 LLM 라이선스에서 출력을 학습에 써도 되는지 정리한 2차 자료. [제목만 확인] — [zenn.dev 정리](https://zenn.dev/hellorusk/articles/cdad2646691341?locale=en)
- **Gemma 4 라이선스**: Gemma 문서의 "Gemma 4 license" 링크가 Apache License 2.0 전문 페이지로 연결됨. 기존 Gemma Terms(파생물에 증류 포함, Prohibited Use Policy 적용)는 Appendix에 나열된 모델에만 적용되고 Gemma 4는 Appendix에 없음. Apache 페이지 옆에 별도 "Prohibited use" 링크가 있지만 그 내용이 Gemma 4에 적용되는지는 확인 못 함. [본문 확인] — [Gemma 4 license (Apache 2.0)](https://ai.google.dev/gemma/apache_2), [Gemma Terms](https://ai.google.dev/gemma/terms)
- **Qwen3-32B**: Apache 2.0, "100+ languages and dialects" 지원, thinking/non-thinking 전환. 권장 샘플링은 thinking에서 T=0.6, TopP 0.95, TopK 20이고 non-thinking에서 T=0.7, TopP 0.8, TopK 20. [본문 확인] — [Qwen/Qwen3-32B](https://huggingface.co/Qwen/Qwen3-32B)

### Inferences
- 이 프로젝트에서 교사 모델로 쓰기 가장 안전한 선택은 Apache 2.0 오픈 모델(Gemma 4, Qwen3)과 라이선스가 허용적인 DeepSeek 모델이다. 단 DeepSeek의 API 약관은 확인하지 않았다(아래 Gaps).
- Claude 출력으로 학습 데이터를 만드는 것은 AUP상 사전 승인 없이는 경쟁 여부와 상관없이 금지로 읽힌다. OpenAI·Google은 "경쟁 모델" 기준이라 해석 여지가 있지만, 그 해석을 근거로 쓰는 것은 위험하다(법률 자문 아님).
- 판정(judge)이나 평가 용도로 상용 API를 쓰는 것과 그 출력을 학습 데이터로 쓰는 것은 따로 판단해야 한다. 평가 결과를 직접 학습에 넣지 않도록 파이프라인을 나누는 것이 좋다.

### Gaps
- DeepSeek API 이용약관의 출력 학습 사용 조항과 DeepSeek-V3/R1 모델 라이선스 원문: 이번 조사에서 확인 못 함.
- DeepSeek-R1 distill 모델의 정확한 base(Qwen2.5/Llama 계열)·크기·샘플 수: 초록에 없고 본문/모델카드는 확인 못 함. 모델카드 확인 필요: [deepseek-ai on HF](https://huggingface.co/deepseek-ai).
- OpenAI 약관 원문 직접 확인: 403으로 실패.
- 위 약관의 한국 법상 집행 가능성: 조사 범위 밖, 확인 못 함.

## 4. 데이터: 롤플레이/페르소나 데이터셋 구축, 합성 데이터, 품질 필터링, 공개 한국어 데이터

### Takeaway
공개 한국어 롤플레이 데이터는 있지만 대부분 GPT-4o/4o-mini로 만든 합성 데이터(약관 문제 가능)이거나 연인 관계에 치우쳐 있다. 하오체 같은 특정 말투 라벨이 붙은 공개 데이터는 찾지 못했다. 영어권 연구(RoleLLM 등)는 "캐릭터 프로필 + 대사 예시 → 강한 모델로 합성 → 필터링" 방식이 표준이며, 소량이라도 고품질 데이터가 중요하다는 근거(LIMA)가 있다.

### Cited Findings
- **huggingface-KREW/korean-role-playing** (Apache 2.0, 약 35.3k 멀티턴 대화): gf-persona-data(약 1.92k, 연인 관계 페르소나), youtube-couple-data(125, 커플 유튜브 자막 정제), general-roleplay-data(약 32.4k, 영어 SmolTalk 롤플레이 subset을 gpt-4o-mini로 한국어화), exa-data(890, EXAONE 스타일 캐릭터 "EXA", gpt-4o로 응답 생성). user는 남성, assistant는 여성으로 가정함. 응답 스타일 편향과 LLM 생성 데이터라는 한계를 카드에서 직접 명시. [본문 확인] — [huggingface-KREW/korean-role-playing](https://huggingface.co/datasets/huggingface-KREW/korean-role-playing)
- **NLPBada/korean-persona-chat-dataset**: MIT, 10K~100K, `banmal_train_8263.csv`, `banmal_val_2066.csv` 파일이 있음(파일명상 반말 데이터로 보이지만 카드 내용은 확인 못 함). [검색 결과만 확인] — [NLPBada/korean-persona-chat-dataset](https://huggingface.co/datasets/NLPBada/korean-persona-chat-dataset/blob/main/banmal_train_8263.csv)
- **NVIDIA Nemotron-Personas-Korea**(2026): 대화 데이터가 아니라 합성 페르소나 프로필로, 100만 레코드에 약 700만 인물 묘사가 있음. KOSIS 등 공공 통계 기반, CC BY 4.0. 캐릭터 설정 다양화용 시드로 쓸 수 있음. [검색 결과 요약] — [헤럴드경제](https://www.heraldk.com/article/2026042023131252045), [다음 뉴스](https://v.daum.net/v/20260427102209174)
- AI Hub에는 콜센터·심리상담 대화 데이터가 있고, 한국어 페르소나 대화 데이터는 주로 영어 데이터를 번역해 만들어졌다는 학술 논문 서술이 있음. AI Hub의 "페르소나 대화" 데이터셋 자체는 찾지 못함. [검색 결과 요약] — [koreascience 논문](https://koreascience.or.kr/article/CFKO202226455348291.pdf)
- **RoleLLM/RoleBench**: 캐릭터 단위 롤플레이 벤치마크/데이터 168,093 샘플. 캐릭터 프로필 구축 → GPT로 말투 끌어내기(RoleGPT) → 오픈 모델 학습(Context-Instruct, RoCIT) 파이프라인. [검색 결과 확인] — [Wang et al., RoleLLM, arXiv 2310.00746](https://arxiv.org/html/2310.00746v3)
- **PIPPA**: Pygmalion 커뮤니티의 실제 사용자 롤플레이 로그로, 약 2.6만 대화 세션에 100만+ 발화. [미재확인] — [Gosling et al., PIPPA, arXiv 2308.05884](https://arxiv.org/abs/2308.05884)
- **LIMA**: 엄선한 1,000개 예시만으로 SFT한 65B 모델이 경쟁력 있는 결과를 보임("Superficial Alignment Hypothesis", 정렬은 주로 형식/스타일 학습). [미재확인] — [Zhou et al., LIMA, arXiv 2305.11206](https://arxiv.org/abs/2305.11206)

### Inferences
- korean-role-playing의 general-roleplay/exa subset은 OpenAI 출력 기반이라 3절의 "경쟁 모델 개발" 조항 문제가 남는다(데이터셋 라이선스가 Apache 2.0이어도 원 생성물의 약관 문제는 별개라고 보는 게 안전함).
- 말투 데이터는 직접 합성하는 게 현실적이다. (1) 캐릭터 카드에 말투(반말/하오체/해요체)를 지정하고, (2) Apache 2.0 교사(Gemma 4 31B, Qwen3)로 생성하고, (3) 어미 규칙 판정기로 말투 위반 샘플을 거르고, (4) 남은 위반 샘플은 KTO의 "undesirable" 라벨로 재활용한다. LIMA 근거로 보면 양보다 정제가 중요하다.
- 기억 추출 데이터: 대화 → 정답 JSON 쌍을 사람이 소량(수백 개) 만들고, 그것을 held-out 평가셋으로 먼저 고정한 뒤 학습셋을 합성하는 순서가 맞다.

### Gaps
- 하오체 등 특정 한국어 말투 라벨이 있는 공개 롤플레이 데이터: 조사했으나 찾지 못함.
- 한국어 장기기억/사실 추출(JSON) 공개 데이터셋: 조사했으나 찾지 못함.
- NLPBada 데이터셋의 생성 방식과 품질: 확인 못 함.

## 5. 비용 개선: 양자화와 speculative decoding (품질이 아니라 비용)

### Takeaway
FP8(W8A8-FP)은 사실상 무손실, INT8은 1~3% 하락, INT4 weight-only는 8-bit에 근접한다는 대규모 평가(Llama-3.1, 50만+ 평가)가 있다. Speculative decoding은 출력 분포를 바꾸지 않고 속도만 올린다. 둘 다 자체 GPU 서빙일 때 의미가 있고, 서버리스 API를 쓰면 제공자가 이미 적용했을 수 있다.

### Cited Findings
- "Give Me BF16 or Give Me Death": Llama-3.1 계열 50만+ 평가에서 W8A8-FP는 "effectively lossless across all model scales", 잘 튜닝된 W8A8-INT는 "1-3% accuracy degradation", W4A16-INT는 "rivaling 8-bit quantization". [본문 확인(초록)] — [Kurtic et al., arXiv 2411.02355](https://arxiv.org/abs/2411.02355)
- Speculative decoding: 작은 draft 모델이 제안하고 큰 모델이 병렬 검증해서 출력 분포를 바꾸지 않으면서 T5-XXL에서 2~3배 가속. [미재확인] — [Leviathan et al., arXiv 2211.17192](https://arxiv.org/abs/2211.17192)
- QLoRA로 학습한 어댑터는 4-bit base 위에서 학습되므로, 서빙 시 base 정밀도(bf16 병합 vs 4-bit)를 학습 때와 맞춰야 품질 차이를 줄일 수 있다. Unsloth도 export 후 품질 저하 시 chat template/EOS 불일치를 먼저 확인하라고 안내. [본문 확인(template 부분)] — [Unsloth Gemma 4 Guide](https://unsloth.ai/docs/models/gemma-4/train)

### Inferences
- 양자화 품질 근거는 영어 벤치마크 위주라 한국어 말투 같은 세밀한 스타일에 대한 영향은 따로 재야 한다. 특히 INT4는 저빈도 한국어 어미 토큰에서 손실이 클 가능성이 있지만 근거는 없다(가설).
- MoE(26B-A4B)는 활성 파라미터가 4B 수준이라 토큰당 연산은 싸지만 전체 가중치는 메모리에 올려야 하므로, 양자화의 이득은 주로 메모리(더 작은 GPU) 쪽이다.

### Gaps
- 한국어 생성 품질에 대한 양자화 영향 연구: 조사했으나 찾지 못함.
- Gemma 4 / Qwen3-32B의 FP8/AWQ 공식 체크포인트와 품질 수치: 이번에 확인 못 함.
- 롤플레이처럼 높은 temperature 샘플링에서 speculative decoding의 실효 가속률: 확인 못 함.

## 6. 학습 없는 개선: 프롬프트, 구조화 출력/제약 디코딩, RAG/기억 검색, 프롬프트 캐싱

### Takeaway
기억 추출 JSON은 학습보다 constrained decoding(vLLM `response_format: json_schema`, xgrammar/guidance 백엔드)으로 형식 오류를 막는 것이 먼저다. 말투는 시스템 프롬프트 + few-shot 예시 + 규칙 판정 후 재생성(rejection)으로 학습 없이 상당 부분 잡을 수 있다(정량 근거는 이 제품에서 직접 측정 필요). 캐릭터 카드와 시스템 프롬프트처럼 고정된 접두부는 prefix caching으로 비용을 줄일 수 있다.

### Cited Findings
- vLLM 구조화 출력: `json`(JSON schema/Pydantic), `regex`, `choice`, `grammar`(EBNF), `structural_tag` 지원. 백엔드는 xgrammar, guidance이고 기본값은 `auto`(`--structured-outputs-config.backend`로 지정). lm-format-enforcer는 v0.33.0부터 deprecated, v0.35.0에서 제거 예정. OpenAI 호환 API에서는 `extra_body={"structured_outputs": {"json": schema}}` 또는 `response_format={"type":"json_schema", ...}`로 넘김. 문서는 백엔드마다 결과가 다를 수 있으니 먼저 검증하라고 하고, 프롬프트에도 스키마와 필드 작성법을 적으면 결과가 좋아진다고 권함. [본문 확인] — [vLLM Structured Outputs](https://docs.vllm.ai/en/latest/features/structured_outputs.html)
- Outlines(정규식/JSON 스키마를 유한상태기계로 바꿔 토큰 마스킹): [미재확인] — [Willard & Louf, arXiv 2307.09702](https://arxiv.org/abs/2307.09702); XGrammar(CFG 기반 고속 제약 디코딩): [미재확인] — [Dong et al., arXiv 2411.15100](https://arxiv.org/abs/2411.15100)
- vLLM Automatic Prefix Caching: 같은 접두부의 KV cache를 재사용함. [미재확인] — [vLLM APC docs](https://docs.vllm.ai/en/latest/features/automatic_prefix_caching.html)
- RAG: 파라메트릭 모델에 검색 메모리를 붙여 지식 집약 과제를 개선. [미재확인] — [Lewis et al., RAG, arXiv 2005.11401](https://arxiv.org/abs/2005.11401)
- 장기 대화 기억 평가 벤치마크 LoCoMo(매우 긴 다회 세션 대화의 기억 QA/요약). [미재확인] — [Maharana et al., arXiv 2402.17753](https://arxiv.org/abs/2402.17753)
- Qwen3는 thinking 모드가 기본값이라 `enable_thinking=False`로 끌 수 있음. 롤플레이 응답과 JSON 추출에서 thinking 토큰은 비용을 늘림. [본문 확인] — [Qwen3-32B](https://huggingface.co/Qwen/Qwen3-32B)

### Inferences
- 제약 디코딩은 "형식 유효성"만 보장하고 "내용 정확성"(누락/환각된 사실)은 보장하지 않는다. 그래서 평가 지표를 형식 통과율과 사실 F1로 나눠야 한다.
- 비용 순서로 보면 (1) thinking 끄기와 출력 길이 제한, (2) 고정 접두부 캐싱, (3) 제약 디코딩, (4) 말투 규칙 판정 후 재생성(재생성 비율만큼 비용 증가), (5) 파인튜닝 순으로 투입하는 것이 자연스럽다. 앞 단계로 목표를 달성하면 서빙 복잡도를 늘리는 파인튜닝은 필요 없을 수 있다.
- 서버리스 API(DeepSeek 등)를 쓰면 제공자의 context caching 할인 정책이 prefix caching을 대신한다(아래 Gaps).

### Gaps
- DeepSeek/DeepInfra API의 context caching 할인율과 JSON schema 강제 지원 여부: 이번 조사에서 확인 못 함.
- 한국어 말투 지시 준수율을 프롬프트 기법별로 비교한 연구: 조사했으나 찾지 못함.

## 7. 평가: 개선 검증(held-out, LLM-as-judge, 사람 평가), 망각, 위험

### Takeaway
개선을 주장하려면 학습/프롬프트 수정 전에 held-out 평가셋과 지표를 먼저 고정해야 한다. LLM-as-judge는 사람과 80% 이상 일치하지만 위치·장황함·자기 선호 편향이 있으므로, 말투처럼 규칙으로 잴 수 있는 항목은 규칙 판정을 쓰고, 판정 모델은 위치를 바꿔 두 번 돌려야 한다. LoRA는 망각이 적지만 0은 아니므로 일반 능력 회귀 테스트가 필요하다.

### Cited Findings
- MT-Bench/Chatbot Arena: GPT-4 판정이 사람 선호와 80% 이상 일치해서 사람끼리의 일치도와 비슷한 수준. 위치 편향, 장황함 편향, 자기 강화 편향, 수학/추론 채점 한계를 지적하고 완화책(위치 교환 등)을 제시. [미재확인] — [Zheng et al., arXiv 2306.05685](https://arxiv.org/abs/2306.05685)
- CharacterEval(중국어): 77명 캐릭터, 1,785개 멀티턴 롤플레이 대화, 4개 차원 13개 지표(지식 일관성: 노출·정확도·환각, 페르소나 일관성: 행동·발화). 사람 주석으로 학습한 CharacterRM이 GPT-4보다 사람과의 상관이 높다고 보고. 서드파티 리더보드는 대화 수를 약 1,000으로 적어 논문과 다름(논문 우선). [검색 결과 확인] — [Tu et al., arXiv 2401.01275](https://arxiv.org/html/2401.01275v1), [steel.dev leaderboard](https://leaderboard.steel.dev/registry/benchmarks/charactereval)
- InCharacter(심리 척도로 역할 일관성 측정), RPEval(2025, 감정 이해·의사결정·도덕 정렬·캐릭터 일관성 자동 평가). [검색 결과 확인] — [RPEval, arXiv 2505.13157](https://arxiv.org/pdf/2505.13157)
- 롤플레이 에이전트 현황/과제 서베이(2026). [제목만 확인] — [arXiv 2601.10122](https://arxiv.org/pdf/2601.10122)
- 망각: LoRA는 full FT보다 목표 밖 도메인 성능을 더 잘 보존하지만, 같은 논문이 망각 자체를 측정해 보여준다(0이 아님). [본문 확인] — [arXiv 2405.09673](https://arxiv.org/abs/2405.09673)
- QLoRA 논문: 당시 챗봇 벤치마크는 챗봇 성능을 정확히 평가하기에 믿기 어렵다고 지적. [미재확인] — [arXiv 2305.14314](https://arxiv.org/abs/2305.14314)

### Inferences
- 제품용 평가 설계:
  - (a) 말투 준수율: 규칙 판정기로 어미를 분류해 캐릭터 지정 말투와 일치하는 턴의 비율을 잰다. LLM 판정 불필요.
  - (b) 기억 추출: JSON 형식 통과율, 사람이 만든 정답 대비 사실 단위 precision/recall.
  - (c) 캐릭터 품질/재미: 쌍대 비교 LLM judge로 위치를 바꿔 2회 판정하고, 같은 계열 모델이 판정하지 않게 하며, 일부는 사람 평가로 judge와의 일치도를 확인한다.
  - (d) 회귀: 학습 전후 일반 한국어 능력(예: 한국어 벤치마크 소수 문항)과 안전 거부 행동을 비교한다.
- 위험:
  - 합성 데이터의 말투 편향(KREW 카드가 직접 경고)
  - 판정 모델과 교사 모델이 같으면 생기는 자기 선호
  - 평가셋이 학습셋에 섞이는 오염
  - 약관 위반 데이터 사용(3절)
  - 파인튜닝 후 안전 정렬 약화
  - LoRA 서빙 때문에 서버리스 단가를 못 쓰게 되는 비용 위험(1절)
- 사전 등록 순서: 평가셋·지표·합격선을 먼저 고정하고, 기준선(현재 프롬프트)을 측정한 뒤, 한 번에 한 변수만 바꿔 측정하고, 결과는 표로 비교한다.

### Gaps
- 한국어 롤플레이/말투 일관성 공개 벤치마크: 조사했으나 찾지 못함(CharacterEval은 중국어, RoleBench는 영어·중국어).
- 파인튜닝이 안전 정렬을 약화시킨다는 연구(예: Qi et al. 2023, "Fine-tuning Aligned Language Models Compromises Safety")는 이번 세션에서 원문을 확인 못 함 — [arXiv 2310.03693](https://arxiv.org/abs/2310.03693) [미재확인].
- 한국어에서 LLM judge와 사람 평가의 일치도: 조사했으나 찾지 못함.
