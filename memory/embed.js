// 임베딩 제공자(v2, docs/21 §2·§3). 세 가지 중 하나를 같은 모양으로 감싼다:
//   local : 서버 안에서 돌리는 공개 모델(@huggingface/transformers, onnxruntime CPU). API 비용 0·한도 없음. CPU 시간만 attempts 에 남긴다(자체 호스팅 추론 비용, 사용자 결정 2026-11-01).
//   model : 모델 레이어의 embed(API). 비용·한도는 모델 레이어가 집계.
//   fake  : 테스트용(키워드 해시 벡터, 결정적).
// 공통 모양: { id, dim, async embed(texts, meta) → { vectors: Float32Array[], attempts: [...] } }
// 저장된 벡터는 id 가 같을 때만 비교할 수 있다. id 가 바뀌면 재임베딩(index.js reindex).
import os from 'node:os';
import path from 'node:path';
import { hashVec } from './fake-model.js';

export const DEFAULT_MODEL_DIR = path.join(os.homedir(), '.cache', 'lite-memory', 'models'); // memory/·app/ 밖(벤치 신선도 검사·앱 빌드와 분리)

export function createLocalEmbedder({ modelId = 'Xenova/bge-m3', dtype = 'q8', modelDir = process.env.MEMORY_MODEL_DIR || DEFAULT_MODEL_DIR, pooling = 'cls', batch = 16 } = {}) {
  let pipe = null, loading = null, lib = null;
  const id = `local:${modelId}@${dtype}`;
  async function load() {
    if (pipe) return pipe;
    if (!loading) loading = (async () => {
      lib = await import('@huggingface/transformers');
      lib.env.cacheDir = modelDir; lib.env.allowLocalModels = false;
      const t0 = performance.now();
      pipe = await lib.pipeline('feature-extraction', modelId, { dtype, device: 'cpu' });
      loadMs = Math.round(performance.now() - t0);
      return pipe;
    })();
    return loading;
  }
  let loadMs = null, dim = null;
  return {
    id, kind: 'local', modelId, dtype, modelDir,
    get dim() { return dim; }, get loadMs() { return loadMs; },
    async ready() { await load(); return { id, loadMs }; },
    async embed(texts, meta = {}) {
      const p = await load();
      const out = [];
      const c0 = process.cpuUsage(); const w0 = performance.now();
      for (let i = 0; i < texts.length; i += batch) {
        const b = texts.slice(i, i + batch);
        const r = await p(b, { pooling, normalize: true });
        const [n, d] = r.dims; dim = d;
        for (let k = 0; k < n; k++) out.push(Float32Array.from(r.data.slice(k * d, (k + 1) * d)));
      }
      const c = process.cpuUsage(c0);
      // 비용 기록: cost_krw 0(API 과금 없음). cpu_ms 는 자체 호스팅 추론 비용 계산 근거(vCPU초 단가 × cpu_ms). 리포트는 가정값 100ms/턴을 상한으로 쓴다.
      return { vectors: out, attempts: [{ tag: 'embed', model: id, ok: true, input_tokens: texts.reduce((s, t) => s + Math.ceil(t.length / 1.5), 0), output_tokens: 0, cost_krw: 0, input_krw: 0, output_krw: 0, latency_ms: Math.round(performance.now() - w0), cpu_ms: Math.round((c.user + c.system) / 1000), local: true, purpose: meta.purpose ?? null }] };
    },
  };
}

export function createModelEmbedder(model) {
  if (!model?.embed) return null;
  const id = `model:${model.embedModelId ?? model.config?.embed ?? 'embed'}`;
  return {
    id, kind: 'model', get dim() { return model.embedDim ?? null; },
    async ready() { return { id }; },
    async embed(texts, meta = {}) {
      const r = await model.embed({ tag: 'embed', texts, purpose: meta.purpose ?? 'memory', conversation_id: meta.conversation_id ?? null, turn_no: meta.turn_no ?? null });
      return { vectors: r.vectors.map((v) => (v instanceof Float32Array ? v : Float32Array.from(v))), attempts: (r.attempts ?? []).map((a) => ({ tag: 'embed', ...a })) };
    },
  };
}

// 테스트용: 키워드 해시 벡터(같은 단어를 공유하면 가깝다). near 로 "글자가 안 겹쳐도 가까운 쌍" 을 지정할 수 있다 — 의미 유사를 흉내.
export function createFakeEmbedder({ dim = 64, near = [] } = {}) {
  const calls = [];
  const alias = new Map(); for (const group of near) for (const t of group) alias.set(t, group[0]);
  return {
    id: 'fake:hash', kind: 'fake', dim, calls,
    async ready() { return { id: 'fake:hash' }; },
    async embed(texts, meta = {}) {
      calls.push({ texts, ...meta });
      const vectors = texts.map((t) => { const v = hashVec(alias.get(t) ?? t, dim); let n = 0; for (const x of v) n += x * x; n = Math.sqrt(n) || 1; return Float32Array.from(v, (x) => x / n); });
      return { vectors, attempts: [{ tag: 'embed', model: 'fake:hash', ok: true, input_tokens: 0, output_tokens: 0, cost_krw: 0, latency_ms: 0, cpu_ms: 0, local: true }] };
    },
  };
}

// 제공자 선택: auto → local 패키지가 있으면 local, 없으면 model, 둘 다 없으면 null
export async function pickEmbedder(provider, { model, policy } = {}) {
  if (provider === 'off') return null;
  if (provider === 'model') return createModelEmbedder(model);
  if (provider === 'local' || provider === 'auto') {
    let hasLocal = true;
    try { await import('@huggingface/transformers'); } catch { hasLocal = false; }
    if (hasLocal) return createLocalEmbedder({ modelId: policy?.embedModelId, dtype: policy?.embedDtype });
    if (provider === 'local') throw new Error('MEMORY_EMBED=local 인데 @huggingface/transformers 가 없다');
    return createModelEmbedder(model);
  }
  return null;
}
