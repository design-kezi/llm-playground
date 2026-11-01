# 오픈 웨이트 LLM 자체 운영(셀프호스팅) 조사 — 한국어 롤플레이 채팅, 턴당 ≤1원 기준

조사일: 2026-11-01. 환율 1,400원/USD. 가격 페이지는 모두 2026-11-01에 열람한 값입니다(페이지에 게시일이 없으면 "열람일 기준"으로 표기).
턴 가정: 입력 수천 토큰(시스템 프롬프트+메모리+최근 대화, 대부분 프롬프트 캐시 적중), 출력 100–300 토큰.

---

## 1. 한국어 채팅/롤플레이용 오픈 모델과 라이선스, 한국어 벤치마크

### Takeaway
Gemma 4(Apache 2.0), Qwen3(Apache 2.0), DeepSeek V4-Flash(MIT)는 상업적 사용 제약이 거의 없습니다. EXAONE 4.0은 라이선스 이름에 "NC"가 붙어 있어 상업용 자체 운영에는 별도 계약이 필요한 것으로 보입니다. Llama 4는 MAU 7억 조건과 EU 관련 조항이 있습니다. 공개된 한국어 벤치마크(KMMLU-Pro/Redux 등)는 EXAONE 모델카드에 있는 EXAONE 대 Qwen3-32B 비교 정도만 찾았고, Gemma 4의 한국어 전용 점수는 찾지 못했습니다.

### Cited Findings
**Gemma 4 (Google)**
- 라이선스는 Apache 2.0입니다. 31B는 dense 모델로 총 30.7B 파라미터, 60층, 컨텍스트 256K입니다. "140개 이상 언어로 사전학습, 35개 이상 언어 즉시 지원"이라고 되어 있지만 한국어를 따로 언급하지는 않습니다. — [HF 모델카드 google/gemma-4-31B-it](https://huggingface.co/google/gemma-4-31B-it)
- 31B-it 점수: MMLU Pro 85.2, MMMLU(다국어 MMLU) 88.4, GPQA Diamond 84.3. 26B-A4B 점수: MMLU Pro 82.6, MMMLU 86.3. — [같은 모델카드](https://huggingface.co/google/gemma-4-31B-it)
- 26B-A4B는 MoE 구조입니다. 총 25.2B, 활성 3.8B, 전문가 128개 중 8개 활성 + 공유 1개, 30층, 컨텍스트 256K이며 비전 인코더가 약 550M입니다. — [같은 모델카드](https://huggingface.co/google/gemma-4-31B-it)
- 기술 보고서는 arXiv 2607.02770이고, "Published Jul 2"(2026년)로 표기되어 있습니다. — [같은 모델카드](https://huggingface.co/google/gemma-4-31B-it)
- Gemma 계열 중 Apache 2.0으로 나온 것은 Gemma 4가 처음이라는 보도가 있습니다. — [The Decoder](https://the-decoder.com/googles-gemma-4-is-now-available-with-apache-2-0-licensing-for-the-first-time/)

**Qwen3 (Alibaba)**
- Qwen3-32B는 Apache 2.0입니다. 64층, Q 헤드 64개, KV 헤드 8개(GQA)이고 컨텍스트는 기본 32,768, YaRN 적용 시 131,072입니다. "100개 이상 언어와 방언"을 지원한다고 되어 있습니다. 기술 보고서는 2025-05-14에 나왔습니다. — [HF Qwen/Qwen3-32B](https://huggingface.co/Qwen/Qwen3-32B)

**DeepSeek V4-Flash**
- 총 284B, 활성 13B인 MoE입니다. 가중치는 FP4(전문가)와 FP8(나머지) 혼합이고, 컨텍스트는 100만 토큰, 라이선스는 MIT입니다. 기술 보고서는 Apr 26에 나왔습니다. — [HF deepseek-ai/DeepSeek-V4-Flash](https://huggingface.co/deepseek-ai/DeepSeek-V4-Flash)

**EXAONE 4.0 (LG AI연구원)**
- 라이선스는 "EXAONE AI Model License Agreement 1.2 - NC"입니다. 모델카드에는 출력물 소유권 주장을 없앴고, EXAONE과 경쟁하는 모델 개발에는 쓸 수 없으며, 교육 목적 사용은 허용한다고 되어 있습니다. 상업적 사용 허용 여부는 페이지에 명시되어 있지 않습니다. — [HF LGAI-EXAONE/EXAONE-4.0-32B](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-32B)
- LG 블로그는 교육기관에는 무료 라이선스를, 상업 이용은 상용 API로 확장 제공한다고 설명합니다. — [LG AI Research 블로그](https://www.lgresearch.ai/blog/view?seq=576)
- 한국어 벤치마크(모델카드 기재, EXAONE 4.0 32B / Qwen3 32B):
  - 추론 모드: KMMLU-Pro 67.7 / 61.4, KMMLU-Redux 72.7 / 67.5, KSM 87.6 / 82.8
  - 비추론 모드: KMMLU-Pro 60.0 / 58.3, KMMLU-Redux 64.8 / 64.4, KSM 59.8 / 41.3, Ko-LongBench 76.9 / 73.9
  - 출처: [HF EXAONE-4.0-32B](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-32B)
- 아키텍처: 64층, Q 40개, KV 8개, 로컬:글로벌 어텐션 3:1, 컨텍스트 131,072. — [같은 페이지](https://huggingface.co/LGAI-EXAONE/EXAONE-4.0-32B)

**Llama 4 (Meta)**
- Llama 4 Community License: 라이선스 대상 버전 출시 시점에 계열사 포함 MAU가 7억을 넘으면 Meta에 별도 라이선스를 요청해야 합니다. EU 관련 제한은 Meta FAQ 기준 멀티모달 모델에 대한 EU 소재 기업·개인의 권리 제한입니다. 2차 출처마다 해석이 다릅니다. — [Meta 개발자 FAQ](https://developer.meta.com/ai/faq/), [llama.com FAQ](https://www.llama.com/faq/)

**Mistral**
- Mistral-Small-3.2-24B-Instruct-2506은 DeepInfra에서 호스팅 판매 중입니다(가격은 5절 참고). 라이선스 원문은 이번 조사에서 직접 확인하지 못했습니다. — [DeepInfra pricing](https://deepinfra.com/pricing)

**한국어 리더보드**
- W&B "호랑이(Horangi)" 리더보드는 llm-kr-eval 기반 이해 평가와 MT-bench식 생성 평가로 구성되고, 버전 4까지 나왔습니다. Gemma 4, Qwen3의 현재 순위는 검색 결과로 확인하지 못했습니다. — [W&B Horangi 리포트](https://wandb.ai/wandb-korea/korean-llm-leaderboard/reports/Horangi-LLM-Leaderboard-Evaluating-Korean-Language-Proficiency--Vmlldzo2OTg0MDU2), [Horangi 4](https://wandb.ai/justintenuto/kn-jp-translations/reports/Horangi-W-B-Korean-LLM-Leaderboard-4--VmlldzoxNTIzNDgxOQ)

### Inferences
- 상업 서비스 기준으로 라이선스 걱정이 가장 적은 후보는 Gemma 4, Qwen3, DeepSeek V4-Flash입니다. EXAONE은 한국어 점수는 Qwen3-32B보다 높지만, NC 라이선스라서 자체 운영하려면 LG와 계약해야 할 가능성이 큽니다(추정).
- DeepSeek V4-Flash는 총 284B라 FP4/FP8로 줄여도 가중치만 대략 150–200GB급입니다(추정치, 파라미터 수와 정밀도로 계산). 그래서 단일 80GB GPU에는 올라가지 않고, 다중 GPU나 H200/B200 노드가 필요합니다. 이 프로젝트 규모의 셀프호스팅 대상으로는 현실성이 낮고 API 이용이 맞습니다.
- 롤플레이 품질(캐릭터 유지, 한국어 문체)은 공개 벤치마크로 대신 판단할 수 없습니다. 자체 실측 결과가 더 중요합니다.

### Gaps
- Gemma 4의 KMMLU, LogicKor, KoMT-Bench 점수: 조사했으나 찾지 못함.
- Mistral, Llama 최신 모델의 한국어 벤치마크와 Mistral Small 라이선스 원문: 확인 못 함.
- Horangi 4의 현재 순위표: 확인 못 함.
- EXAONE의 상업 이용 조건(가격, 절차): 확인 못 함.

---

## 2. 서빙 엔진 비교 (vLLM, SGLang, TGI, TensorRT-LLM, llama.cpp, Ollama, LMDeploy)

### Takeaway
TGI는 2025-12 무렵부터 유지보수 모드이고, HF 공식 문서가 vLLM과 SGLang을 권장합니다. 새로 시작한다면 vLLM(Gemma 4 공식 레시피 있음)이나 SGLang이 기본 선택지입니다. 한 공개 벤치마크(Qwen3-32B, H100 1장)에서는 TensorRT-LLM이 처리량이 가장 높았습니다.

### Cited Findings
- HF 공식 문서에 따르면 TGI는 "now in maintenance mode"이고, 앞으로는 사소한 버그 수정, 문서 개선, 가벼운 유지보수 PR만 받습니다. 다운스트림 엔진으로 vLLM과 SGLang을 권장합니다. — [HF TGI docs](https://huggingface.co/docs/text-generation-inference/en/index.md)
  - 날짜를 2025-12-11로 적은 2차 출처가 있고, 2026-03-21에 GitHub 저장소가 read-only로 보관되었다는 주장도 있습니다. 두 내용 모두 공식 출처로는 확인하지 못했습니다. — [Spheron 블로그](https://www.spheron.network/blog/migrate-tgi-to-vllm-sglang-2026/)
- vLLM 자동 프리픽스 캐싱(V1): KV 블록 해시를 (부모 블록 해시, 블록 토큰, LoRA ID·멀티모달 해시·cache salt 등 추가 키)로 만들고, 가득 찬 블록만 캐시합니다. 참조가 없는 블록은 LRU 순서로 축출되며, 끝난 요청의 블록은 역순으로 큐에 넣어 마지막 블록이 먼저 축출됩니다. 기본 해시는 sha256(v0.11부터)이고, 테넌트 간 공유를 막을 때는 요청별 `cache_salt`를 씁니다. 기본 활성화 여부는 이 페이지에 명시되어 있지 않습니다. — [vLLM Prefix Caching 설계 문서](https://docs.vllm.ai/en/latest/design/prefix_caching.html)
  - 해시 키에 LoRA ID가 들어간다는 점에서, vLLM의 LoRA 서빙과 프리픽스 캐시가 함께 동작한다는 것을 알 수 있습니다. 위 같은 문서에서 확인했습니다.
- vLLM Gemma 4 레시피:
  - 26B-A4B는 BF16으로 A100/H100 1장에 올립니다(`--max-model-len 32768 --gpu-memory-utilization 0.90`). 31B는 A100/H100 2장 TP 예시(`--tensor-parallel-size 2`)가 있습니다.
  - 추측 디코딩: 전용 assistant 모델로 `--speculative-config`를 쓰고, 권장 추측 토큰 수는 26B-A4B 4, 31B 4–8입니다.
  - `--kv-cache-dtype fp8`을 쓰면 KV 메모리가 약 50% 줄어듭니다. `--async-scheduling` 옵션도 있습니다.
  - 벤치마크할 때는 일관성을 위해 `--no-enable-prefix-caching`을 권장합니다.
  - 배포는 nightly wheel이나 `vllm/vllm-openai:latest` 도커 이미지로 합니다. 이 이미지 이름으로 보아 OpenAI 호환 서버입니다.
  - 출처: [vLLM Recipes – Gemma 4](https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html)
- vLLM에서 Gemma 4 26B를 data-parallel로 띄우면 기동은 되지만 첫 요청에서 실패한다는 사용자 보고가 있습니다. — [HF 포럼](https://discuss.huggingface.co/t/successfully-running-gemma4-26b-on-prem-looking-to-discuss-deployment-struggles-stable-setups/176145)
- GPUStack 벤치마크(Qwen3-32B BF16, H100 SXM 1장, ShareGPT 1,000건, 동시성 제한 없음). 엔진 버전은 vLLM v0.11.0, SGLang v0.5.5.post1, TRT-LLM v1.2.0rc1입니다. — [GPUStack Performance Lab](https://docs.gpustack.ai/latest/performance-lab/qwen3-32b/h100)

| 엔진 | 출력 tok/s | 총 tok/s | 평균 TTFT | 평균 TPOT |
|---|---|---|---|---|
| vLLM | 1,131.55 | 2,352.82 | 78.1 s | 88.09 ms |
| SGLang | 814.03 | 1,690.84 | 115.7 s | 57.86 ms |
| TensorRT-LLM | 1,280.04 | 2,659.50 | 65.3 s | 61.90 ms |

- 2차 출처 기준으로 TGI 고유 양자화 포맷(EETQ 등)은 vLLM/SGLang에 그대로 넣을 수 없습니다. — [Spheron](https://www.spheron.network/blog/migrate-tgi-to-vllm-sglang-2026/)

### Inferences
- 이 서비스는 시스템 프롬프트와 메모리 프리픽스 재사용률이 높아서 프리픽스 캐싱이 가장 중요한 기능입니다. vLLM과 SGLang 모두 이 기능을 지원합니다(SGLang RadixAttention은 이번 조사에서 공식 문서를 열람하지 못함). 캐릭터·사용자별로 같은 프리픽스가 반복되도록 프롬프트 순서를 고정하면 실제 prefill 비용이 크게 줄어들 것으로 추정합니다.
- GPUStack 표는 동시 요청 1,000건을 한꺼번에 넣은 측정이라 TTFT가 수십 초입니다. 대화형 서비스의 SLA와는 다른 조건이니, 처리량 상한 참고치로만 써야 합니다.
- llama.cpp와 Ollama는 GGUF 기반이고 로컬·소규모 용도에 맞습니다. 동시 사용자가 많은 서비스용 엔진으로는 vLLM/SGLang이 일반적입니다(아래 Gaps 참고. 이번 조사에서 공식 비교 자료는 확보하지 못함).

### Gaps
- SGLang, TensorRT-LLM, LMDeploy, llama.cpp, Ollama 각각의 공식 기능 목록(continuous batching, multi-LoRA, 추측 디코딩, OpenAI 호환 API): 이번 조사에서 공식 문서를 직접 열람하지 못함.
- vLLM V1에서 프리픽스 캐싱이 기본으로 켜지는지: 설계 문서에 명시되어 있지 않아 확인 못 함.
- Gemma 4를 vLLM, SGLang, TRT-LLM으로 비교한 공개 벤치마크: 찾지 못함.

---

## 3. GPU 메모리 계산 (가중치 + KV 캐시)과 GPU별 적합성

### Takeaway
가중치 메모리는 대략 "파라미터 수 × 바이트"입니다(BF16 2, FP8 1, INT4 약 0.5–0.6). KV 캐시는 "층 × KV헤드 × head_dim × 2(K,V) × 바이트 × 토큰"입니다. Gemma 4는 슬라이딩 윈도(1,024) 층이 5/6를 차지해서 긴 컨텍스트에서도 KV 증가가 작습니다. 4K 토큰 대화 기준 KV는 Qwen3-32B 약 1.07GB, Gemma 4 31B 약 1.0GB, Gemma 4 26B-A4B 약 0.25GB(BF16 KV)로 계산됩니다.

### Cited Findings
- Gemma 4 31B config: 60층(sliding 50, full 10, 5:1 반복). sliding 층은 KV 16개에 head_dim 256, global 층은 KV 4개에 global_head_dim 512이고, sliding_window 1024, `attention_k_eq_v: true`입니다. — [config.json](https://huggingface.co/google/gemma-4-31B-it/raw/main/config.json). 모델카드에는 "Global layers use unified Keys and Values"라고 적혀 있습니다. — [모델카드](https://huggingface.co/google/gemma-4-31B-it)
- Gemma 4 26B-A4B config: 30층(sliding 25, full 5). sliding 층은 KV 8개에 head_dim 256, global 층은 KV 2개에 head_dim 512입니다. hidden 2816, 전문가 128개, top-k 8. — [config.json](https://huggingface.co/google/gemma-4-26B-A4B-it/raw/main/config.json)
- Qwen3-32B: 64층, KV 8개. — [모델카드](https://huggingface.co/Qwen/Qwen3-32B). head_dim 128은 config 값을 전제로 했고, 이번 조사에서 직접 재확인하지는 않았습니다.
- vLLM 레시피의 가중치 메모리: Gemma 4 31B는 BF16 약 59.0GB, QAT W4A16 약 19.8GB입니다. 26B-A4B는 int8 per-channel로 약 47% 줄어듭니다. 26B MoE는 전문가 차원이 작아서 4비트로 내리면 품질 손실이 커 QAT W4A16 대상에서 빠졌습니다. 공식 최소 사양은 31B와 26B-A4B 모두 BF16 기준 80GB GPU 1장입니다. — [vLLM Gemma 4 레시피](https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html)
- 26B-A4B 가중치만 약 49GB라는 사용자 추정이 있습니다. — [HF 포럼](https://discuss.huggingface.co/t/successfully-running-gemma4-26b-on-prem-looking-to-discuss-deployment-struggles-stable-setups/176145)
- 양자화한 26B-A4B를 L4(24GB) 1장에서 GKE로 돌린 사례가 있습니다. — [DEV Community](https://dev.to/ratibor78/running-gemma-4-26b-on-gke-with-a-single-l4-gpu-4l6g)
- NVIDIA가 26B-A4B NVFP4 버전을 배포합니다(B200에서 검증). — [dev.co 요약](https://dev.co/ai/llms/gemma-4-26b-a4b-nvfp4). 1차 출처는 미확인입니다.
- L40S는 48GB입니다(AWS g6e). — [AWS g6e](https://aws.amazon.com/ec2/instance-types/g6e/)

### 계산 예시 (위 config 값으로 직접 계산, BF16 KV = 2바이트)

**토큰당 KV**
- Qwen3-32B: 64 × 8 × 128 × 2 × 2B = 262,144 B (256 KiB/토큰)
- Gemma 4 31B
  - sliding: 50 × 16 × 256 × 2 × 2B = 819,200 B/토큰, 단 최근 1,024 토큰까지만 보관
  - global: 10 × 4 × 512 × 1(K=V 통합) × 2B = 40,960 B/토큰. K와 V를 따로 저장하는 구현이라면 81,920 B
- Gemma 4 26B-A4B
  - sliding: 25 × 8 × 256 × 2 × 2B = 204,800 B/토큰 (≤1,024 토큰)
  - global: 5 × 2 × 512 × 1 × 2B = 10,240 B/토큰

**대화 1건(4,000 토큰)당 KV**

| 모델 | 계산 | 4K 토큰당 KV (BF16) | FP8 KV |
|---|---|---|---|
| Qwen3-32B | 262,144 × 4,000 | ≈1.05 GB | ≈0.52 GB |
| Gemma 4 31B (윈도 적용 시) | 819,200×1,024 + 40,960×4,000 | ≈0.84+0.16 = ≈1.0 GB | ≈0.5 GB |
| Gemma 4 31B (윈도 미적용 시) | 819,200×4,000 + 40,960×4,000 | ≈3.4 GB | ≈1.7 GB |
| Gemma 4 26B-A4B (윈도 적용 시) | 204,800×1,024 + 10,240×4,000 | ≈0.21+0.04 = ≈0.25 GB | ≈0.13 GB |

**80GB GPU(H100/A100), gpu-memory-utilization 0.9 ≈ 72GB 사용 가능 시 대략의 동시 4K 대화 수** (활성화 메모리 등 수 GB는 빼고 어림잡은 값)
- Gemma 4 31B BF16(59GB): 남는 KV 공간 약 10GB → 약 10건. 레시피가 31B를 TP 2장으로 안내하는 이유와 맞아떨어집니다.
- Gemma 4 31B W4A16(19.8GB): 약 50GB → 약 50건(BF16 KV), FP8 KV면 약 100건
- Gemma 4 26B-A4B BF16(약 49–50GB): 약 20GB → 약 80건
- Qwen3-32B BF16(32B×2 ≈ 64GB): 약 6GB 수준 → 매우 빠듯함. FP8(약 32GB)이면 약 38건

**GPU별 적합성(계산 기반 추정)**
- RTX 4090(24GB) / L4(24GB): 30B급은 INT4(약 18–20GB)만 들어가고 KV 여유가 거의 없습니다. 26B-A4B 양자화본은 L4 사례가 있습니다.
- RTX 5090(32GB): 31B W4A16(19.8GB)에 KV 약 10GB.
- L40S(48GB): 31B W4A16이나 FP8(약 31GB), 26B-A4B int8(약 26GB)이 실용권입니다. 26B-A4B BF16은 KV 여유가 거의 없습니다.
- A100/H100 80GB: 26B-A4B BF16 1장, 31B는 FP8/INT4로 1장 또는 BF16으로 2장.
- H200(141GB): 31B BF16에 KV 약 60GB.

### Inferences
- 26B-A4B는 KV가 작고 활성 파라미터가 3.8B라서 동시성과 디코드 속도 면에서 dense 31B보다 GPU당 처리 턴 수가 훨씬 많을 가능성이 큽니다. 다만 공개 실측은 찾지 못했습니다.
- Gemma 4 KV 절감 효과는 엔진이 슬라이딩 윈도 밖 블록을 실제로 해제하는지(vLLM 하이브리드 KV 할당 여부)에 달려 있습니다. 이번 조사에서는 확인하지 못했습니다. 해제하지 않는다면 31B의 4K 대화당 KV는 약 3.4GB로 커집니다.

### Gaps
- vLLM이 Gemma 4의 sliding/global 혼합 KV를 어떤 방식으로 할당하는지, K=V 통합이 저장에 반영되는지: 확인 못 함.
- Qwen3-32B 정확한 파라미터 수와 head_dim의 1차 출처 재확인: 이번 조사에서 하지 못함.

---

## 4. 양자화 포맷(GPTQ, AWQ, FP8, GGUF)과 품질 영향

### Takeaway
대규모 평가에서 FP8(W8A8)은 사실상 무손실이고, INT8은 1–3% 하락, INT4 weight-only도 경쟁력이 있다는 결과가 나왔습니다. GPTQ와 AWQ 중 어느 쪽이 나은지는 연구마다 다릅니다. Gemma 4 26B MoE는 4비트에 약하다고 vLLM 레시피가 명시합니다.

### Cited Findings
- Red Hat과 IST Austria의 "Give Me BF16 or Give Me Death?"는 Llama-3.1 계열 전체를 50만 회 이상 평가했습니다. 결과는 FP8 W8A8이 평가 오차 범위 안에서 정확도를 유지했고, 잘 튜닝한 INT8은 1–3% 하락, INT4 weight-only는 INT8 W8A8과 경쟁할 만했으며, GPTQ 변형이 실사용 생성 과제에서 AWQ보다 좋았다는 것입니다. — [arXiv 2411.02355](https://arxiv.org/html/2411.02355v2)
- 반대 결과도 있습니다. 405B까지 평가한 2024년 연구는 weight-only 방식 중 AWQ의 하락이 GPTQ보다 대체로 작다고 보고했습니다. — [arXiv 2409.11055](https://arxiv.org/html/2409.11055v1)
- 2025년 비교(Llama-3.1, Qwen-2.5)에서는 평균 하락이 FP8 0.2%, GPTQ-int8 0.8%였고 4비트는 더 컸습니다. — [arXiv 2505.20276](https://arxiv.org/pdf/2505.20276) (검색 요약 기준, 원문 미열람)
- GPUStack 측정에서는 Qwen3-32B를 FP8로 바꾸자 처리량이 50.6% 늘었습니다. 페이지는 FP8의 정확도 손실이 보통 1% 미만이라고 적고 있습니다. — [GPUStack](https://docs.gpustack.ai/latest/performance-lab/qwen3-32b/h100)
- Gemma 4 dense 계열은 공식 QAT W4A16 체크포인트(group size 32, compressed-tensors)를 제공하고, vLLM은 별도 플래그 없이 자동 인식합니다. 26B MoE는 4비트 품질 손실 때문에 제외되었고, 대신 int8 per-channel을 권장합니다. — [vLLM Gemma 4 레시피](https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html)
- vLLM에서 Gemma 4를 4비트로 돌릴 때는 GGUF가 아니라 W4A16을 써야 한다는 벤더 가이드가 있습니다. — [WZ-IT](https://wz-it.com/en/knowledge/ki/gemma-4-vllm-w4a16-vs-gguf/)

### Inferences
- H100/L40S/RTX 40·50 시리즈는 FP8을 지원하는 세대이고 FP8은 품질 손실이 사실상 없다는 근거가 있으니, 첫 선택은 FP8 가중치 + FP8 KV가 무난합니다. A100은 FP8 텐서코어가 없는 세대입니다(일반 지식, 이번 조사에서 출처 미확보).
- 한국어 롤플레이 문체에 양자화가 미치는 영향은 위 연구들이 다루지 않았습니다(대부분 영어 벤치마크). 자체 판단 모델로 BF16과 비교 측정해야 합니다.

### Gaps
- 한국어나 롤플레이 과제에서 양자화가 품질에 미치는 영향을 측정한 연구: 찾지 못함.
- GGUF(llama.cpp k-quant)를 대규모 서빙 관점에서 품질·처리량 비교한 공식 자료: 확인 못 함.

---

## 5. 처리량 → 턴당 비용 추정, 클라우드 GPU 가격

### Takeaway
공개 벤치마크(Qwen3-32B, H100 1장, 프리픽스 캐시 없음)와 열람일 기준 GPU 가격을 넣어 보면, 가동률 100%라는 이상적 가정에서도 셀프호스팅 턴당 비용은 약 0.9–3원입니다. 같은 모델을 DeepInfra API로 쓰면 턴당 약 0.2–0.6원입니다. 따라서 저트래픽 단계에서는 API가 훨씬 쌉니다.

### Cited Findings — GPU 시간당 가격 (2026-11-01 열람)
**RunPod** ([pricing](https://www.runpod.io/pricing)), 단위 $/GPU-h, Secure / Community / Serverless 순

| GPU | Secure | Community | Serverless |
|---|---|---|---|
| H100 PCIe | 2.89 | 1.99 | 5.39 |
| H100 SXM | 3.99 | 2.69 | 5.39 |
| H100 NVL | 3.19 | 2.59 | – |
| H200 | 5.29 | 3.59 | 6.99 |
| A100 80GB | 1.79 | 1.19–1.39 | 2.72 |
| L40S | 1.09 | 0.79 | 1.75 |
| L4 | 0.59 | 0.44 | 0.75 |
| RTX 4090 | 0.89 | 0.34 | 1.34 |
| RTX 5090 | 1.19 | 0.69 | 1.79 |

**Lambda** ([pricing](https://lambda.ai/pricing), 게시일 없음, "© 2026")
- H100 SXM: 1장 $4.29, 8장 기준 GPU당 $3.99
- H100 PCIe 1장 $3.29
- A100 SXM 80GB(8장) $2.79
- GH200 96GB $2.29
- B200 1장 $6.99
- L40S, H200은 목록에 없음

**AWS**
- g6e.xlarge(L40S 1장): On-Demand $1.861/h, Spot $1.691, 1년 RI $1.172, 3년 RI $0.804. 리전은 us-east-1로 보입니다. — [instances.vantage.sh](https://instances.vantage.sh/aws/ec2/g6e.xlarge)
- p5(H100)는 2025-06 가격 인하 후 GPU당 약 $3.90–3.93/h라는 2차 출처가 있습니다. 공식 가격 페이지는 확인하지 못했습니다. — [Spheron](https://spheron.network/blog/aws-h100-pricing-2026)
- AWS가 2026-07-01부터 GPU 인스턴스 가격을 20% 인상했다는 단일 한국어 출처가 있으나 미검증입니다. — [promptquorum](https://www.promptquorum.com/ko/prompt-bites/cloud-gpu-cost-per-hour)

**DeepInfra 전용 GPU**(커스텀 배포): A100 80GB $1.49, H100 $2.90, H200 $3.49, B200 $4.89 /GPU-h — [DeepInfra pricing](https://deepinfra.com/pricing)

**국내 클라우드**
- KT는 H100을 월 구독형 'K GPUaaS'로 제공한다는 보도가 있습니다. 시간당 요금은 확인 못 함. — [아시아경제](https://www.asiae.co.kr/en/article/2025120409191472383)
- 네이버클라우드와 NHN의 H100 시간당 요금: 조사했으나 찾지 못함.

### Cited Findings — 처리량 (GPUStack, Qwen3-32B, H100 SXM 1장, 랜덤 데이터라 프리픽스 캐시 효과 없음)
- 출처: [GPUStack](https://docs.gpustack.ai/latest/performance-lab/qwen3-32b/h100)
  - 2K 입력 / 100 출력: vLLM BF16 총 3,195 tok/s, 최적화(FP8 + chunked prefill) 총 5,902 tok/s
  - 4K 입력 / 200 출력: vLLM BF16 총 2,149 tok/s, 최적화 총 4,929 tok/s
  - 최적화 행의 서빙 명령은 문서에 trtllm-serve와 sglang이 섞여 표기되어 있어 어느 엔진 수치인지 불분명합니다(문서 자체의 불일치).

### 턴당 비용 계산 (공식: 턴당 비용 = GPU 시간당 가격 ÷ 시간당 처리 턴 수; 시간당 턴 수 = 총 tok/s ÷ 턴당 토큰 × 3600)

| 시나리오 | 턴/시간 | H100 SXM RunPod Secure $3.99 | RunPod Community $2.69 |
|---|---|---|---|
| 4K/200, vLLM BF16 (2,149÷4,200 ≈ 0.51 req/s) | ≈1,842 | $0.00217 ≈ 3.0원 | ≈2.0원 |
| 4K/200, FP8 최적화 (4,929÷4,200 ≈ 1.17 req/s) | ≈4,225 | $0.00094 ≈ 1.32원 | ≈0.89원 |
| 2K/100, vLLM BF16 (3,195÷2,100 ≈ 1.52 req/s) | ≈5,477 | $0.00073 ≈ 1.02원 | ≈0.69원 |
| 2K/100, FP8 최적화 (5,902÷2,100 ≈ 2.81 req/s) | ≈10,118 | $0.00039 ≈ 0.55원 | ≈0.37원 |

전제: 24시간 내내 위 처리량으로 포화되는 상태(가동률 100%)이고, 동시 요청을 대량으로 넣은 측정이라 TTFT가 수십 초입니다. 대화형 응답 시간을 지키려면 동시성을 낮춰야 하고, 그러면 처리량도 떨어집니다.

### Cited Findings — 같은 모델 API 가격 (DeepInfra, $/1M 토큰, 2026-11-01 열람) — [DeepInfra pricing](https://deepinfra.com/pricing)

| 모델 | 입력 | 캐시 입력 | 출력 |
|---|---|---|---|
| Gemma 4 31B (turbo) | 0.09 | 0.05 | 0.34 |
| Gemma 4 31B (standard) | 0.20 | – | 0.40 |
| Gemma 4 26B A4B | 0.07 | – | 0.34 |
| Qwen3-32B | 0.08 | – | 0.28 |
| DeepSeek-V4-Flash | 0.09 | 0.018 | 0.18 |
| DeepSeek-V4-Flash-0731 | 0.06 | 0.015 | 0.18 |
| Mistral-Small-3.2-24B | 0.075 | – | 0.20 |

**API 턴당 비용** (입력 4,000 토큰 중 3,500 캐시 적중, 출력 200 토큰 가정, 직접 계산)
- Gemma 4 31B turbo: 3,500×0.05 + 500×0.09 + 200×0.34 = 288 → $0.000288 ≈ 0.40원 (캐시 미적용 시 0.60원)
- Gemma 4 26B A4B(캐시 가격 없음): 4,000×0.07 + 200×0.34 = 348 → 0.49원
- Qwen3-32B: 4,000×0.08 + 200×0.28 = 376 → 0.53원
- DeepSeek-V4-Flash: 3,500×0.018 + 500×0.09 + 200×0.18 = 144 → 0.20원

### Inferences
- 손익분기(계산): H100 $3.99/h로 API 턴당 $0.000288(Gemma 4 31B turbo)과 같아지려면 시간당 약 13,850턴(초당 약 3.85턴)을 쉬지 않고 처리해야 합니다. DeepSeek-V4-Flash API($0.000144)와 비교하면 시간당 약 27,700턴이 필요합니다. 공개 벤치마크 최고치(2K/100 최적화, 시간당 약 10,100턴)로도 미치지 못합니다.
- 우리 턴은 입력 대부분이 캐시 적중이라 실제 prefill 부하가 위 벤치마크(캐시 없음)보다 훨씬 작습니다. 그래서 셀프호스팅 처리량은 위 추정보다 높을 수 있습니다. 26B-A4B(활성 3.8B)는 Qwen3-32B dense보다 처리량이 몇 배 높을 가능성이 있습니다. 둘 다 실측 근거는 없으니 자체 부하 테스트가 필요합니다.
- 결론적으로 가동률이 낮은 초기·과제 단계에서는 "1원/턴" 목표를 API로 맞추는 쪽이 비용상 유리합니다. 셀프호스팅은 꾸준히 높은 트래픽이 있고 GPU 가동률을 높게 유지할 수 있을 때만 경쟁력이 생깁니다.

### Gaps
- Gemma 4 31B와 26B-A4B의 공개 처리량 벤치마크(H100/L40S): 찾지 못함.
- 프리픽스 캐시 적중률이 높은 워크로드의 처리량 실측: 찾지 못함.
- L40S의 30B급 처리량 공개 수치: 찾지 못함.
- Together AI의 같은 모델 가격: 이번 조사에서 열람하지 못함.
- 국내 클라우드(네이버, KT, NHN) 시간당 GPU 가격: 찾지 못함.

---

## 6. 운영 이슈 (오토스케일링, 콜드스타트, 모델 로딩, 모니터링, 장애 대응)

### Takeaway
이번 조사에서 1차 출처로 확인한 운영 정보는 적습니다. 서버리스 GPU는 시간당 단가가 상시 Pod보다 35–80% 비쌉니다(RunPod 기준). 하지만 트래픽이 적을 때 유휴 비용을 없앨 수 있습니다. 엔진의 버그나 성숙도 문제(Gemma 4 DP 버그 등)도 운영 리스크입니다.

### Cited Findings
- RunPod 서버리스 단가는 Secure Pod 대비 H100 $5.39 vs $3.99(+35%), L40S $1.75 vs $1.09(+61%), L4 $0.75 vs $0.59(+27%)입니다. — [RunPod pricing](https://www.runpod.io/pricing)
- Gemma 4 26B를 vLLM data-parallel로 띄우면 첫 요청에서 실패한다는 보고가 있고, 온프레미스 배포에서 겪은 어려움을 논의하는 스레드도 있습니다. — [HF 포럼](https://discuss.huggingface.co/t/successfully-running-gemma4-26b-on-prem-looking-to-discuss-deployment-struggles-stable-setups/176145)
- vLLM Gemma 4 레시피는 nightly wheel이나 latest 도커 이미지를 안내합니다. 즉 안정 릴리스 고정이 쉽지 않을 수 있습니다. — [vLLM Gemma 4 레시피](https://docs.vllm.ai/projects/recipes/en/latest/Google/Gemma4.html)
- vLLM 프리픽스 캐시 해시(sha256)는 pickle을 써서 Python이나 vLLM 버전이 다르면 해시가 일치하지 않을 수 있습니다. 결정적 캐싱이 필요하면 `sha256_cbor`를 권장합니다. 멀티테넌트 환경에서는 `cache_salt`로 격리합니다. — [vLLM Prefix Caching](https://docs.vllm.ai/en/latest/design/prefix_caching.html)
- TGI 유지보수 모드 전환은 엔진 선택 자체가 장기 운영 리스크라는 사례입니다. — [HF TGI docs](https://huggingface.co/docs/text-generation-inference/en/index.md)

### Inferences
- 가중치 크기(BF16 기준 26B-A4B 약 50GB, 31B 약 59GB)는 콜드스타트 때 다운로드와 GPU 로딩 시간을 좌우합니다. 양자화본(약 20–31GB)은 로딩 부담도 줄여 줍니다(크기 비례 추정, 실측 없음).
- 장애 대응: 셀프호스팅 GPU가 1–2장이면 단일 장애점입니다. 같은 오픈 모델을 파는 API(DeepInfra 등)를 폴백으로 두는 구성이 자연스럽습니다(추정).
- 서비스 품질 관리용 지표로는 TTFT, TPOT, 프리픽스 캐시 적중률, KV 캐시 사용률을 추적해야 합니다(GPUStack 지표 체계 참고).

### Gaps
- vLLM/SGLang의 모델 로딩 시간과 콜드스타트 실측 수치: 찾지 못함.
- RunPod 서버리스 콜드스타트 시간이나 FlashBoot 같은 공식 수치: 확인 못 함.
- vLLM Prometheus 메트릭 목록, KServe나 Ray Serve 같은 오토스케일링 공식 가이드: 이번 조사에서 열람하지 못함.
