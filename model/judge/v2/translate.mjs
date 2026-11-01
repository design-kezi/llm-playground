// v2 한국어 데이터를 zh-TW·ja·en 으로 옮긴다. v1 문항은 v1 번역(judge/data/<lang>.json)을 그대로 재사용하고,
// 새 문장만 v1 과 같은 프롬프트·검사(judge/translate.mjs)로 Haiku 가 번역한다. 개발비(운영 비용 아님). 라벨은 그대로.
// 사용: node judge/v2/translate.mjs zh-TW ja en
import fs from 'node:fs';
import path from 'node:path';
import * as model from '../../index.js';

const HERE = import.meta.dirname;
const V1 = path.join(HERE, '..', 'data');
const LANG = { 'zh-TW': '대만에서 쓰는 번체 중국어(표준 중국어)', ja: '일본어', en: '영어' };
const MODEL = 'claude-haiku-5-5';
const BATCH = 20;
const SCRIPT = {
  'zh-TW': (v) => !/[가-힣]/.test(v) && /[一-鿿]/.test(v) && !/[぀-ヿ]/.test(v),
  ja: (v) => !/[가-힣]/.test(v) && /[぀-ヿ一-鿿]/.test(v),
  en: (v) => !/[가-힣一-鿿぀-ヿ]/.test(v) && /[A-Za-z]/.test(v),
};
const stringsOf = (x) => [x.user, x.prev?.user, x.prev?.assistant, ...(x.items ?? [])];

const ko = JSON.parse(fs.readFileSync(path.join(HERE, 'data', 'ko.json'), 'utf8'));
const v1ko = JSON.parse(fs.readFileSync(path.join(V1, 'ko.json'), 'utf8'));

let krw = 0;
const report = {};
for (const lang of process.argv.slice(2)) {
  // v1 번역 재사용: 같은 위치의 문항끼리 문자열을 짝짓는다
  const v1tr = JSON.parse(fs.readFileSync(path.join(V1, `${lang}.json`), 'utf8'));
  const map = new Map();
  for (const task of Object.keys(v1ko)) v1ko[task].forEach((x, i) => {
    const a = stringsOf(x), b = stringsOf(v1tr[task][i]);
    a.forEach((s, k) => { if (s && b[k] && SCRIPT[lang](b[k])) map.set(s, b[k]); });
  });
  const reused = map.size;
  const all = new Set();
  for (const task of Object.values(ko)) for (const x of task) for (const s of stringsOf(x)) if (s) all.add(s);
  let todo = [...all].filter((s) => !map.has(s));
  const fresh = todo.length;
  for (let round = 0; round < 4 && todo.length; round++) {
    const failed = [];
    const size = Math.max(1, Math.floor(BATCH / 4 ** round));
    for (let i = 0; i < todo.length; i += size) {
      const chunk = todo.slice(i, i + size);
      const input = Object.fromEntries(chunk.map((s, k) => [String(k + 1), s]));
      let t = {};
      try {
        const res = await model.complete({
          model: MODEL, purpose: 'judge_v2_translate', max_tokens: 6000, response_format: 'json',
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
  report[lang] = { strings: all.size, reused_v1: reused, translated: fresh - todo.length, failed: todo.length, failed_samples: todo.slice(0, 5) };
  const tr = (s) => (s ? map.get(s) ?? s : s);
  const out = {};
  for (const [task, xs] of Object.entries(ko)) {
    out[task] = xs.map((x) => ({ ...x, user: tr(x.user), ...(x.prev ? { prev: { user: tr(x.prev.user), assistant: tr(x.prev.assistant) } } : {}), ...(x.items ? { items: x.items.map(tr) } : {}) }));
  }
  fs.writeFileSync(path.join(HERE, 'data', `${lang}.json`), JSON.stringify(out, null, 2));
  console.log(`\n${lang}:`, JSON.stringify(report[lang]));
}
report.cost_krw = krw;
fs.writeFileSync(path.join(HERE, 'data', 'translate-report.json'), JSON.stringify(report, null, 2));
console.log(`번역 비용 ${krw.toFixed(1)}원`);
