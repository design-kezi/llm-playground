import { OpenAIClient } from './openai.js';

// DeepInfra: 오픈소스 모델 호스팅, OpenAI 호환 엔드포인트.
// 일부 모델만 캐시 단가가 있고 usage 의 cached_tokens 로 나온다(없으면 0).
export class DeepInfraClient extends OpenAIClient {
  constructor({ apiKey = process.env.DEEPINFRA_API_KEY, timeoutMs } = {}) {
    super({ apiKey, baseURL: 'https://api.deepinfra.com/v1/openai', timeoutMs, name: 'DEEPINFRA_API_KEY' });
  }

  buildParams(req) {
    const params = super.buildParams({ ...req, cache_key: undefined });
    // 오픈소스 모델 서버는 max_completion_tokens 를 모를 수 있어 구 필드로 보낸다.
    params.max_tokens = params.max_completion_tokens;
    delete params.max_completion_tokens;
    return params;
  }
}
