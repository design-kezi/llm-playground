// 벤치 사전 호출: 벤치와 같은 환경변수로 응답·추출·임베딩 모델을 1회씩 불러 본다(키 만료·잔액 0·모델 없음을 시작 전에 잡기).
// 원장에는 purpose 'preflight' 로 남는다. 실패하면 종료 코드 1.
import * as model from '../index.js';

const c = model.config;
const checks = [
  ['response', () => model.complete({ purpose: 'response', model: c.response, max_tokens: 5, messages: [{ role: 'user', content: 'ping' }] })],
  ...(c.extract !== c.response ? [['extract', () => model.complete({ purpose: 'preflight', model: c.extract, max_tokens: 5, messages: [{ role: 'user', content: 'ping' }] })]] : []),
  ...(model.embed ? [['embed', () => model.embed({ texts: ['ping'], purpose: 'preflight' })]] : []),
];
let bad = 0;
for (const [name, fn] of checks) {
  try {
    const r = await fn();
    console.log(`preflight ${name} ok`, r.attempts.at(-1).model);
  } catch (e) {
    bad++;
    console.log(`preflight ${name} 실패`, e.message.slice(0, 200));
  }
}
console.log(JSON.stringify({ config: c, pricing: model.pricing() }));
process.exit(bad ? 1 : 0);
