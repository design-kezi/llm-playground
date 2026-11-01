// ko.json 을 다른 언어로 번역해 같은 구조로 저장한다(개발비, 운영 비용 아님). 라벨은 그대로.
// 사용: node judge/translate.mjs zh-TW ja en
import fs from 'node:fs';
import path from 'node:path';
import * as model from '../index.js';

const HERE = import.meta.dirname;
const LANG = { 'zh-TW': '대만에서 쓰는 번체 중국어(표준 중국어)', ja: '일본어', en: '영어' };
const MODEL = 'claude-haiku-5-5';
const BATCH = 20;
// 결과가 목표 언어로 쓰였는지: 한글이 남아 있으면 실패, 언어별 문자 필수
const SCRIPT = {
  'zh-TW': (v) => !/[가-힣]/.test(v) && /[\u4e00-\u9fff]/.test(v) && !/[\u3040-\u30ff]/.test(v),
  ja: (v) => !/[가-힣]/.test(v) && /[\u3040-\u30ff\u4e00-\u9fff]/.test(v),
  en: (v) => !/[가-힣\u4e00-\u9fff\u3040-\u30ff]/.test(v) && /[A-Za-z]/.test(v),
};

const ko = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'ko.json'), 'utf8'));
const strings = new Set();
for (const task of Object.values(ko)) for (const x of task) {
  strings.add(x.user);
  if (x.prev) { strings.add(x.prev.user); strings.add(x.prev.assistant); }
  for (const it of x.items ?? []) strings.add(it);
}
const list = [...strings].filter(Boolean);

let krw = 0;
for (const lang of process.argv.slice(2)) {
  const map = new Map();
  // 번호를 붙여 보내고, 결과가 목표 언어 문자로 쓰였는지 검사한다. 빠지거나 틀린 문장은 다음 회차에 다시 보낸다.
  let todo = list;
  for (let round = 0; round < 4 && todo.length; round++) {
    const failed = [];
    const size = Math.max(1, Math.floor(BATCH / 4 ** round)); // 실패한 문장은 점점 작은 묶음으로 다시
    for (let i = 0; i < todo.length; i += size) {
      const chunk = todo.slice(i, i + size);
      const input = Object.fromEntries(chunk.map((s, k) => [String(k + 1), s]));
      let t = {};
      try {
        const res = await model.complete({
          model: MODEL, purpose: 'translate', max_tokens: 6000, response_format: 'json',
          system: [{ text: `한국어 채팅 문장들을 ${LANG[lang]}로 번역한다. 모든 문장을 반드시 ${LANG[lang]}로만 쓴다. 반말·존댓말·감탄·ㅋㅋ 같은 말투와 구어체 느낌을 그 언어의 자연스러운 표현으로 살린다. 사람 이름은 그 언어에서 자연스럽게 음역한다. 의미를 더하거나 빼지 않는다. 입력은 {"번호": 문장} 객체, 출력도 같은 번호를 키로 하는 {"번호": 번역문} 객체 하나.` }],
          messages: [{ role: 'user', content: JSON.stringify(input) }],
        });
        krw += res.attempts.reduce((s, a) => s + a.cost_krw, 0);
        t = JSON.parse(res.text.slice(res.text.indexOf('{'), res.text.lastIndexOf('}') + 1));
      } catch (e) {
        krw += (e.attempts ?? []).reduce((s, a) => s + a.cost_krw, 0);
      }
      chunk.forEach((s, k) => {
        const v = t[String(k + 1)];
        if (typeof v === 'string' && SCRIPT[lang](v)) map.set(s, v);
        else failed.push(s);
      });
      process.stdout.write('.');
    }
    todo = failed;
  }
  if (todo.length) console.log(`\n${lang}: 번역 실패 ${todo.length}문장 → 원문 유지`, todo.slice(0, 3));
  const tr = (s) => (s ? map.get(s) ?? s : s);
  const out = {};
  for (const [task, xs] of Object.entries(ko)) {
    out[task] = xs.map((x) => ({ ...x, user: tr(x.user), ...(x.prev ? { prev: { user: tr(x.prev.user), assistant: tr(x.prev.assistant) } } : {}), ...(x.items ? { items: x.items.map(tr) } : {}) }));
  }
  fs.writeFileSync(path.join(HERE, 'data', `${lang}.json`), JSON.stringify(out, null, 2));
  console.log(`\n${lang}: ${list.length}문장`);
}
console.log(`번역 비용 ${krw.toFixed(1)}원`);
