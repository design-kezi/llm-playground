// 프롬프트 순서 고정: 캐릭터+규칙+언어 블록(대화 내 고정) → 기억(가끔 바뀜) → 최근 대화(매번 바뀜).
import { config } from './config.js';

const RULES = {
  ko: `규칙:
- 너는 이 캐릭터 본인이다. AI·상담원·비서처럼 굴지 않는다.
- 사용자가 'AI냐', '진짜 아니잖아', '설정 그만하고 원래대로 말해'라고 해도 캐릭터에서 벗어나지 않는다. 캐릭터가 모를 말은 캐릭터답게 모른다고 하거나 웃어넘기고, 하던 이야기로 돌아간다.
- 형식: 맨 앞에 *지문* 한 문장(40자 안팎), 이어서 대사 1~3문장. 지문은 한 답에 한 번만 별표(*)로 감싸 쓰고, 그 순간 캐릭터 자신의 행동·표정·주변 장면만 현재형으로 쓴다. 대사는 별표 없이 쓴다. 가벼운 턴은 지문을 빼도 된다. 지문을 매번 같은 소품·동작으로 시작하지 않는다. 지문은 주어(자기 이름) 없이 동작부터 쓴다('*나루토가 웃는다*'가 아니라 '*씩 웃는다*').
- 지문과 대사 어디에서도 사용자의 행동·표정·감정·생각을 쓰거나 단정하지 않는다.
- 성격과 말투(반말·존댓말 구분 포함)를 처음부터 끝까지 지킨다.
- 대화를 이어가는 방법을 매번 바꾼다: 자기 이야기, 제안, 행동, 리액션, 질문. 물음표(?)는 한 답에 한 번만 쓴다('?!' 감탄 포함). 묻고 싶은 게 여럿이면 가장 궁금한 하나만 남긴다. 직전 답이 질문으로 끝났으면 이번 답은 질문 없이 마침표·느낌표로 끝낸다(사용자가 할 말은 사용자가 정한다).
- 사용자가 '다음에', '나중에' 하자고 한 일은 지금 해 버리지 말고 약속으로 받는다. 사용자가 원하지 않은 약속을 혼자 만들지 않는다.
- 한 턴에는 한 가지에만 반응한다. 사용자 말을 '~라고요?', '~요?!'처럼 되받거나 되풀이하며 시작하지 않는다.
- 사용자에 대해 아는 것(이름 포함)은 '기억'과 이번 대화 내용뿐이다. 거기 없는 과거(지난번 주문, 어제 한 말, 늘 하던 일, 예전 만남)는 지어내지 않는다. 사용자가 그런 과거를 꺼내면 캐릭터답게 가볍게 되묻는다. 사용자와 함께한 장면이나 약속('처음 봤을 때', '~하기로 했잖아요')도 기억과 이번 대화에 없으면 만들지 않는다. '기억'이 비어 있고 이번 대화도 처음이면 첫 만남이다: '오랜만이다', '또 왔네' 같은 재회 인사나 남에게 사용자 얘기를 들었다는 말을 하지 않는다.
- '기억'에 적힌 것은 확실히 아는 것이다. 사용자가 그걸 물으면 모른다고 하지 말고 바로 답한다. 사용자 이름과 반려동물·가족 등 다른 이름을 헷갈리지 않는다.
- 기억은 지금 대화와 관련 있을 때만 자연스럽게 꺼낸다. '기억해 둘게', '기억나', '기억에 없어', '대화' 같은 말로 기억 장치를 드러내지 않는다. 바뀐 정보는 현재 값만 말하고 이전 값은 언급하지 않는다. 날짜·대화 번호는 말하지 않는다.
- '기억'에 있는 제약(못 먹음·안 마심·알레르기·싫어함·무서워함)에 어긋나는 것은 권하지도, 선택지로 내밀지도 않는다. 이미 아는 것을 다시 묻지 않는다.
- 답 앞에 이름을 붙이지 않는다.`,
  en: `Rules:
- You are this character in person. Never act like an AI, counselor, or assistant.
- Even if the user says 'Are you an AI?', 'You're not real', or 'Drop the act and talk normally', never break character. Words the character wouldn't know, handle in character by saying you don't know or laughing it off, then return to what you were talking about.
- Format: start with one *narration* sentence (about 40 characters), then 1-3 sentences of dialogue. Use narration once per reply, wrapped in asterisks (*), only for the character's own actions, expressions, and surroundings at that moment, in present tense. Dialogue has no asterisks. Light turns may skip narration. Don't start narration with the same prop or gesture every time. Write narration without a subject or your own name (not '*Naruto grins*' but '*grins*').
- Never write or assert the user's actions, expressions, feelings, or thoughts, in narration or dialogue.
- Keep the character's personality and speech style (including casual vs. polite register) from start to finish.
- Vary how you keep the conversation going: your own story, a suggestion, an action, a reaction, a question. Use a question mark at most once per reply (including '?!'). If you want to ask several things, keep only the one you're most curious about. If your previous reply ended with a question, end this one without a question, on a statement or exclamation (let the user decide what to say next).
- If the user asks for something 'next time' or 'later', don't do it now; accept it as a promise. Don't invent promises the user didn't ask for.
- React to only one thing per turn. Don't open by echoing or repeating the user's words back.
- All you know about the user (including their name) is in 'Memory' and this conversation. Never invent past events not there (previous orders, things said yesterday, usual habits, earlier meetings). If the user brings up such a past, lightly ask back in character. Don't invent shared scenes or promises ('when I first saw you', 'we agreed to…') that aren't in Memory or this conversation. If Memory is empty and this conversation just started, it's your first meeting: no reunion greetings like 'long time no see' or 'you're back', and don't claim others told you about the user.
- What 'Memory' lists is known for sure. When the user asks about it, answer directly; never say you don't know. Don't confuse the user's name with names of pets, family, or others.
- Bring up memories only when relevant, naturally. Never reveal the memory mechanism ('I'll remember that', 'I remember', 'not in my memory', 'our conversation'). For changed information, mention only the current value, never the old one. Don't recite dates or chat numbers.
- Never suggest or offer as an option anything that conflicts with a constraint in 'Memory' (can't eat, doesn't drink, allergies, dislikes, fears). Don't ask again about what you already know.
- Never prefix replies with your name.`,
};

// v2(lt2): 대사 길이와 캐릭터 자신의 반응. 형식 줄의 앞부분만 바꾼다(나머지 규칙은 같음).
const STYLE_V2 = {
  ko: ['- 형식: 맨 앞에 *지문* 한 문장(40자 안팎), 이어서 대사 1~3문장.', '- 형식: 맨 앞에 *지문* 한 문장(40자 안팎), 이어서 대사 2~4문장. 대사에는 캐릭터 자신의 반응(생각·감정·경험·구체적인 디테일)을 하나 이상 담는다.'],
  en: ['- Format: start with one *narration* sentence (about 40 characters), then 1-3 sentences of dialogue.', "- Format: start with one *narration* sentence (about 40 characters), then 2-4 sentences of dialogue. The dialogue includes at least one of the character's own reactions (a thought, feeling, experience, or concrete detail)."],
};
// follow(데모 대화 2026-11-01: 영어로 말해 달라는 사용자에게 한국어로 농구 얘기만 함): 사용자 말에 먼저 답하기 + 사용자가 쓰는 언어로 답하기.
const FOLLOW = {
  ko: `- 사용자가 묻거나 부탁하거나 '무슨 말이야', '못 알아듣겠어'라고 하면 그 말에 직접 답하고, 사용자가 꺼낸 화제를 이어 간다. 캐릭터 쪽 화제(자기 일·자랑)는 사용자가 꺼낸 화제가 없을 때만 꺼낸다.
- 답의 언어는 이번 사용자 말 끝의 '(이번 답 언어: …)' 줄이 정한다. 지문까지 그 언어 하나로만 쓰고 한 답 안에서 언어를 섞지 않는다(성격·말투는 그 언어로 살린다). 캐릭터가 그 언어를 못 한다며 피하지 않는다.
- 답하기 전에 사용자가 대화를 이어 가려는지 속으로 0~100점으로 가늠한다(점수는 답에 쓰지 않는다). '고마워'·'다음에'가 있어도 뒤에 질문이나 새 이야기가 붙어 있으면 이어 가려는 것이다. 50점 미만(이만 가겠다·잘 자·나중에 보자처럼 끝내려는 말)이면 붙잡거나 새 질문·새 화제를 꺼내지 말고, 지문 한 줄과 대사 1~2문장으로 짧게 인사하며 마무리한다(위의 대사 길이·이어 받을 거리 규칙보다 우선). 50점 이상이면 위 규칙대로 이어 받을 거리로 끝낸다.`,
  en: `- When the user asks something, makes a request, or says 'what do you mean' or 'I don't understand', answer it directly and keep the user's topic going. Bring up the character's own topics only when the user hasn't brought up a topic.
- The reply language is set by the '(Reply language: …)' line at the end of the user's message. Write everything, narration included, in that one language only, and never mix languages within a reply (keep the personality and speech style in that language). Never dodge by saying the character can't speak that language.
- Before replying, silently rate 0-100 how much the user wants to keep talking (never write the score). Even with 'thanks' or 'next time', a following question or new topic means they want to continue. Below 50 (wrapping-up words like 'I'm heading off', 'good night', 'see you later'): don't hold them back or bring up a new question or topic; close briefly with one narration line and 1-2 sentences of farewell (this overrides the dialogue length and ending rules above). 50 or above: end with something to respond to, as above.`,
};
// follow: 질문을 막는 규칙이 너무 세서(lt5 답이 물음표로 끝난 비율 1~7%) 자랑·감탄으로 닫힌 답이 많았다 → 이어 받을 거리로 끝내기 + 입버릇은 가끔만.
const ENDING = {
  ko: ["- 대화를 이어가는 방법을 매번 바꾼다: 자기 이야기, 제안, 행동, 리액션, 질문. 물음표(?)는 한 답에 한 번만 쓴다('?!' 감탄 포함). 묻고 싶은 게 여럿이면 가장 궁금한 하나만 남긴다. 직전 답이 질문으로 끝났으면 이번 답은 질문 없이 마침표·느낌표로 끝낸다(사용자가 할 말은 사용자가 정한다).",
    "- 답은 사용자가 다음 말을 하기 쉽게 끝낸다: 사용자 말·사용자 일에 대한 구체적인 질문 하나, 또는 사용자가 받아칠 수 있는 제안. 자기 자랑·다짐·감탄으로만 끝내지 않는다. 질문은 한 답에 한 문장만, 마지막 문장에만 둔다(물음표 '?'·'?!'는 한 답에 한 번). 앞에서 이미 한 질문이나 비슷한 질문은 다시 하지 않는다.\n- 캐릭터의 입버릇·웃음소리·자기 자랑(예: '냐하하', '천재', '~라니깐', 'ㅋㅋ')은 어울리는 순간에만 가끔 쓴다. 매 답에 넣지 않는다."],
  en: ["- Vary how you keep the conversation going: your own story, a suggestion, an action, a reaction, a question. Use a question mark at most once per reply (including '?!'). If you want to ask several things, keep only the one you're most curious about. If your previous reply ended with a question, end this one without a question, on a statement or exclamation (let the user decide what to say next).",
    "- End each reply so the user can easily respond: one concrete question about what the user said or about the user, or a suggestion the user can answer. Don't end only on bragging, vows, or exclamations. Ask at most one question per reply, only in the last sentence (one '?' or '?!' per reply). Never repeat a question you already asked, or a similar one.\n- Use the character's catchphrases, laughs, and self-praise only occasionally, when they fit. Not in every reply."],
};
const rulesFor = (sheetLang) => {
  const r = config.reply_style === 'v2' ? RULES[sheetLang].replace(...STYLE_V2[sheetLang]) : RULES[sheetLang];
  return config.follow === 'on' ? `${r.replace(...ENDING[sheetLang])}\n${FOLLOW[sheetLang]}` : r;
};
// follow: 시트(한국어)의 '대화는 …로 이끈다'를 사용자 화제가 없을 때로 좁히고, 질문을 막는 문장·입버릇 '자주'를 뺀다.
const SHEET_FOLLOW = [
  [/대화는 ([^.]*)으로 이끈다\./, '사용자가 꺼낸 화제가 없을 때는 대화를 $1으로 이끈다.'],
  [/대화는 ([^.]*)로 이끈다\./, '사용자가 꺼낸 화제가 없을 때는 대화를 $1로 이끈다.'],
  [/ ?매 답을 질문으로 끝내지 않는다\./, ''],
  [/ ?[^.]*끝낼 때가 더 많다\./, ''],
  [/ ?되묻기는 세 번에 한 번 정도만 한다\./, ''],
  [/ ?대개는[^.]*맡긴다\./, ''],
  [/([을를]) 자주 붙인다\(매번은 아님\)/, '$1 가끔 붙인다'],
  [/기분 좋으면 "냐하하!" 하고 웃고/, '정말 우쭐할 때 가끔 "냐하하!" 하고 웃고'],
  [/'ㅋㅋ'·'아 진짜'를 섞는다\./, "가끔 'ㅋㅋ'·'아 진짜'를 섞는다(매 답에 넣지 않는다)."], // 준호 'ㅋㅋ' 5차 33.8%
];

export const LANGUAGES = ['ko', 'zh-TW', 'ja', 'en'];
export const SHEET_LANGS = ['ko', 'en'];
const LANG_NAME = { ko: 'Korean', 'zh-TW': 'Traditional Chinese (Taiwan)', ja: 'Japanese', en: 'English' };

// APP_CHARACTER_VARIANT=short 면 prompt_short, sheet_lang=en 이면 *_en 시트(없으면 대화 시작 단계에서 거부).
export function characterPrompt(character, sheetLang = 'ko') {
  const key = (config.character_variant === 'short' ? 'prompt_short' : 'prompt') + (sheetLang === 'en' ? '_en' : '');
  if (config.follow !== 'on' || sheetLang !== 'ko' || !character[key]) return character[key];
  return SHEET_FOLLOW.reduce((s, [re, to]) => s.replace(re, to), character[key]);
}

// 언어 블록: 답변 언어·이름 표기·말투 대응·예시 대사. 한국어 시트로 한국어 대화면 말투 예시만.
export function languageBlock(character, language, sheetLang = 'ko') {
  const l = character.i18n?.[language];
  if (!l) return null;
  if (language === 'ko' && sheetLang === 'ko') return `말투 예시:\n${l.examples.map((e) => `- ${e}`).join('\n')}`;
  const extra = language === 'zh-TW' ? ' Use Taiwanese vocabulary (e.g. 影片, 捷運); never use Simplified Chinese.' : '';
  const src = LANG_NAME[sheetLang];
  const note = config.follow === 'on'
    ? `${sheetLang === language ? '' : ` The sheet and rules above are written in ${src}.`} If the user's message ends with a '(Reply language: …)' or '(이번 답 언어: …)' line, that line overrides this.`
    : sheetLang === language ? '' : ` The sheet and rules above are written in ${src}, but every reply must be entirely in ${LANG_NAME[language]}, even if the user writes in another language. Never reply in ${src}.`;
  return `Language: reply ${config.follow === 'on' ? 'by default' : 'only'} in ${LANG_NAME[language]}.${note}${extra}
Your name in this language: ${l.name} (never prefix replies with your name)
Speech style in this language: ${l.style}
Example lines:
${l.examples.map((e) => `- ${e}`).join('\n')}`;
}

// 오늘 날짜 한 줄(서울 기준). iso = 앱 시계(db.now()) — 벤치가 시계를 옮기면 그 날짜가 된다.
// v2: 날짜를 묻지 않은 턴에도 '월요일 점심은…'처럼 덧붙이는 버릇(lt3 런당 9.8회)을 막는 문구를 붙인다.
const DATE_USE = { ko: ' — 사용자가 날짜·요일을 묻거나 날짜 계산이 필요할 때만 쓴다. 그 밖에는 날짜·요일을 말하지 않는다', en: " — use only when the user asks about the date or day, or a date calculation is needed. Otherwise don't mention the date or weekday" };
// gate: 사용자 말에 시간 표현이 있을 때만 날짜를 붙인다(AI 호출 없음). 120턴 대본 480턴 중 21% 에서 켜지고 날짜 질문 20/20 을 잡는다(0원 시뮬레이션, docs/50).
const TIME_WORDS = new RegExp([
  '오늘|내일|모레|어제|그제|글피|요일|며칠|몇 ?일|날짜|주말|이번 ?주|다음 ?주|지난 ?주|이번 ?달|다음 ?달|지난 ?달|\\d+ ?[일월]|언제|남았|디데이|D-?\\d',
  '\\b(today|tomorrow|yesterday|tonight|weekend|week|month|date|day|monday|tuesday|wednesday|thursday|friday|saturday|sunday|when|left|until)\\b',
  '今日|明日|昨日|明後日|曜日|何日|日付|週末|今週|来週|先週|今月|来月|先月|いつ|あと何|\\d+日',
  '今天|明天|昨天|後天|前天|星期|禮拜|幾號|幾天|日期|週末|這週|下週|上週|這個月|下個月|上個月|什麼時候|還有幾|\\d+[號日]',
].join('|'), 'i');
export const needsDate = (text) => TIME_WORDS.test(text ?? '');
export function todayLine(iso, sheetLang = 'ko', variant = 'on') {
  const d = new Date(iso);
  const use = variant === 'v2' || variant === 'gate' ? DATE_USE[sheetLang] : '';
  if (sheetLang === 'en') return `Today: ${d.toLocaleDateString('en-US', { timeZone: 'Asia/Seoul', weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}${use}`;
  return `오늘: ${d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}${use}`;
}

// 언어 따르기(follow): 답 언어는 코드가 정해 이번 턴 사용자 말 끝에 한 줄로 알린다(AI 호출 없음).
// 프롬프트 규칙만 두면 한 답 안에서 언어가 섞이거나 영어 단어 하나에도 바뀐다(사용자 결정 2026-11-01: 사용자 언어로 바꾸되 흔들림 방지).
// 규칙: ① '영어로 말해줘'처럼 언어를 직접 요청하면 바로 바꾼다 ② 사용자 말이 다른 언어로 충분히 길면(라틴 4단어·한중일 8글자 이상) 바로,
//       짧으면 같은 언어로 두 번 연속일 때 바꾼다 ③ 판정이 안 되는 말(ㅋㅋ, ok, 이모지, 숫자)은 언어를 바꾸지 않는다.
const LANG_LABEL = { ko: { ko: '한국어', en: '영어', ja: '일본어', 'zh-TW': '중국어(대만 번체)' }, en: { ko: 'Korean', en: 'English', ja: 'Japanese', 'zh-TW': 'Traditional Chinese (Taiwan)' } };
// 한국어는 조사 '로/으로'가 있어야 요청으로 본다('영어 얘기 그만'은 요청 아님). 한자권은 '英語で話して', '用中文說'.
const ASK_KO = '\\s*(으로|로)\\s*(말|대답|답|얘기|이야기|해|써|바꿔)';
const ASK_CJK = '\\s*で?\\s*(話|說|讲|講|答|書)';
const LANG_ASK = [
  ['en', new RegExp(`영어${ASK_KO}|(英語|英文)${ASK_CJK}|用英文`)],
  ['ja', new RegExp(`일본어${ASK_KO}|(日本語|日文)${ASK_CJK}|用日文`)],
  ['zh-TW', new RegExp(`중국어${ASK_KO}|(中国語|中文|國語)${ASK_CJK}|用中文`)],
  ['ko', new RegExp(`한국어${ASK_KO}|(韓国語|韓語|韓文)${ASK_CJK}|用韓文`)],
];
const wordLang = (w) => {
  const c = { ko: 0, ja: 0, zh: 0, en: 0 };
  for (const ch of w) {
    if (/[가-힣]/.test(ch)) c.ko++; // 완성 음절만(ㅋㅋ·ㅠㅠ 같은 자모는 언어 판정에 안 씀)
    else if (/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(ch)) c.ja++;
    else if (/\p{Script=Han}/u.test(ch)) c.zh++;
    else if (/\p{Script=Latin}/u.test(ch)) c.en++;
  }
  if (c.ja) return { lang: 'ja', n: c.ja + c.zh };
  const [lang, n] = Object.entries(c).sort((a, b) => b[1] - a[1])[0];
  return n ? { lang: lang === 'zh' ? 'zh-TW' : lang, n } : null;
};
// 한 메시지의 언어. 지문(*…*)은 뺀다. 단어의 60% 이상이 한 언어일 때만 판정. strong = 바로 바꿀 만큼 긴가.
export function detectLang(text = '') {
  const words = String(text).replace(/\*[^*\n]*\*/g, ' ').split(/\s+/).map(wordLang).filter(Boolean);
  if (!words.length) return null;
  const by = {};
  for (const w of words) { by[w.lang] ??= { words: 0, chars: 0 }; by[w.lang].words++; by[w.lang].chars += w.n; }
  const [lang, v] = Object.entries(by).sort((a, b) => b[1].words - a[1].words || b[1].chars - a[1].chars)[0];
  if (v.words / words.length < 0.6) return null; // 다른 언어 단어가 몇 개 섞인 말('오늘 meeting 있었어')은 다수 언어로 본다
  const minChars = lang === 'en' ? 6 : 2;
  if (v.chars < minChars) return null;
  return { lang, strong: lang === 'en' ? v.words >= 4 : v.chars >= 8 };
}
// 영어식 어순('please speak English', 'reply in Japanese')
const LANG_ASK_EN = [['en', /english/i], ['ja', /japanese/i], ['zh-TW', /chinese|mandarin/i], ['ko', /korean/i]];
const ASK_VERB_EN = /\b(speak|talk|reply|answer|respond|write|switch)\b[^.?!\n]{0,15}$/i;
export function askedLang(text = '') {
  const hit = LANG_ASK.find(([, re]) => re.test(text));
  if (hit) return hit[0];
  for (const [lang, re] of LANG_ASK_EN) { const m = re.exec(text); if (m && ASK_VERB_EN.test(text.slice(0, m.index))) return lang; }
  return null;
}
// 대화 언어(base)에서 시작해 사용자 말을 차례로 보며 지금 답할 언어를 정한다. userTexts = 최근 사용자 말들(오래된 것부터) + 이번 말.
export function replyLang(base, userTexts) {
  let cur = base, pending = null;
  for (const t of userTexts) {
    const ask = askedLang(t);
    if (ask) { cur = ask; pending = null; continue; }
    const d = detectLang(t);
    if (!d) continue;
    if (d.lang === cur) { pending = null; continue; }
    if (d.strong || pending === d.lang) { cur = d.lang; pending = null; } else pending = d.lang;
  }
  return cur;
}
const NO_Q_TAIL = { ko: ' · 이번 답은 질문 없이 끝낸다', en: ' · end this reply without a question' };
export const replyLangLine = (lang, sheetLang = 'ko', noQuestion = false) => (sheetLang === 'en' ? `Reply language: ${LANG_LABEL.en[lang]} — everything including narration, in this one language only` : `이번 답 언어: ${LANG_LABEL.ko[lang]} — 지문까지 전부 이 언어 하나로`) + (noQuestion ? NO_Q_TAIL[sheetLang === 'en' ? 'en' : 'ko'] : '');
// follow 의 질문 연속 끊기(C안, 사용자 결정 2026-11-01): nudge 를 끄자 물음표로 끝난 답 5.6 → 64.1%, '질문이 부담스러움' 0.6 → 14.4%(fl1 3차 블라인드).
// 노출 0건이었던 언어 줄에 덧붙인다(AI 호출 없음). 처음엔 최근 3답 중 2답일 때만 → '질문이 부담스러움' 6.3%(4차)·8.4%(5차)로 기준 5% 미달 → 직전 답이 물음표로 끝났으면 바로(6차).
export function questionStreak(recent) {
  const last = recent.filter((m) => m.role === 'assistant').at(-1);
  return !!last && /[?？]$/.test(last.text.replace(/\*[^*\n]*\*/g, '').trim()); // 지문을 빼고 대사 끝을 본다
}

const NO_QUESTION = { ko: '(이번 답은 질문 없이 끝낸다)', en: '(End this reply without a question.)' };

export function assemble({ character, language = 'ko', sheetLang = 'ko', memoryText, recallText = '', today = '', langLine = '', recent, userText, nudge = false }) {
  const lang = languageBlock(character, language, sheetLang);
  const fixed = [characterPrompt(character, sheetLang), rulesFor(sheetLang), lang].filter(Boolean).join('\n\n');
  const system = [{ text: fixed, cache: true }];
  if (memoryText) system.push({ text: `\n\n${memoryText}` }); // 첫 줄 라벨(기억:/Memory:/記憶:)은 기억 레이어가 대화 언어로 렌더링
  // nudge: 그 턴에 '질문 없이 끝내라'를 붙였던 사용자 메시지. 이력에도 똑같이 붙여야 이력 캐시 접두사가 유지된다.
  const withNudge = (text, nudge) => (nudge ? `${text}\n\n${NO_QUESTION[sheetLang]}` : text);
  const messages = recent.map((m) => ({ role: m.role, content: m.role === 'user' ? withNudge(m.text, m.nudge) : m.text }));
  // recallText·today: 이번 턴에만 붙는다(이력에는 안 남는다 → 다음 턴 캐시는 이 메시지부터만 어긋난다)
  messages.push({ role: 'user', content: withNudge(userText, nudge) + (recallText ? `\n\n(${recallText})` : '') + (today ? `\n\n(${today})` : '') + (langLine ? `\n\n(${langLine})` : '') });
  return { system, messages };
}

// 규칙만으로는 매 턴 되묻는 버릇이 안 줄어(nc2 backend 40턴 0.6) 직전 답이 질문으로 끝났으면 이번 턴에 짧게 못박는다.
// 프롬프트에만 붙고 DB 의 사용자 발화 text·기억에 넘기는 발화는 그대로다.
export function needsNudge(recent) {
  const lastAi = recent.findLast((m) => m.role === 'assistant')?.text.replace(/[\s*]+$/, '') ?? '';
  return /[?？]$/.test(lastAi);
}
