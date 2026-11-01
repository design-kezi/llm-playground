// 추론 켬 설정 확인용 연결 점검(측정 아님). 모델마다 짧은 질문 1개를 MODEL_REASONING 값으로 보내 오류·추론 토큰을 본다.
// 사용: MODEL_REASONING=on node judge/reason/probe.mjs <model...>
import * as model from '../../index.js';
for (const m of process.argv.slice(2)) {
  try {
    const r = await model.complete({ model: m, purpose: 'reason_probe', max_tokens: 2000, response_format: 'json',
      system: [{ text: 'Answer with one JSON object {"answer": <integer>}.' }],
      messages: [{ role: 'user', content: 'A train leaves at 9:40 and the trip takes 2h 35m. Then a 50-minute bus. At what minute past the hour do I arrive? Return only the minute number.' }] });
    const a = r.attempts.at(-1);
    console.log(JSON.stringify({ m, mode: process.env.MODEL_REASONING, ok: true, text: r.text.slice(0, 80), out: a.output_tokens, reasoning: a.reasoning_tokens, finish: a.finish_reason, krw: a.cost_krw }));
  } catch (e) {
    console.log(JSON.stringify({ m, mode: process.env.MODEL_REASONING, ok: false, err: String(e.message ?? e).slice(0, 200) }));
  }
}
