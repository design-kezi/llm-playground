// AI 호출 없는 휴리스틱. (1) 추출할 가치가 있는 턴인가 (2) 사용자가 "기억"을 요구하는가 (deep search 신호)
const FIRST_PERSON = /(^|[\s,.!?])(나는|난|내가|제가|저는|전|나도|나\s|내\s|우리|저도)/;
const INFO = /(좋아해|좋아하|싫어해|싫어하|싫은|좋은|즐겨|즐기|취미|취향|선호|관심|팬이|마셔|마시|안\s*마|못\s*마|먹어|먹는|자주|매일|항상|절대|제일|가장|하고\s*있|하려고|준비|목표|꿈이|키우|배우|다니|직장|회사|학교|학생|대학|전공|살아|살고|사는|고향|나이|살이야|생일|가족|할머니|할아버지|생신|엄마|아빠|동생|형|누나|언니|오빠|친구|여자친구|남자친구|강아지|고양이|키우|이름은|이라고\s*불러|라고\s*불러|알레르기|못\s*먹|안\s*먹|채식|최근에|다니|다녀|일해|일하|근무|이사|결혼|연애|헤어|졸업|입학|합격|불합격|면접|시험|발표|프로젝트|출장|여행|병원|아파|다쳤|수술|기념일)/;
// 시간어 단독은 잡담에서도 흔해(오늘 날씨…) 1인칭과 함께일 때만 신호로 본다
const TIME = /(요즘|주말에|어제|오늘|내일|다음\s*주|이번\s*주|지난\s*(주|달|번)|이번\s*달|다음\s*달)/;
// 캐릭터에게 던지는 질문("너 노래 좋아해?")은 사용자 정보가 아니다
const ASK_CHAR = /(^|\s)(너|너는|넌|네가|니가|너도|너한테|너랑)\s.*\?\s*$/;
// 시간어 + 일정 동사 = 예정된 사건("다음 주 토요일에 시골 내려가") — 1인칭이 생략되는 한국어 특성
const EVENT_VERB = /(내려가|올라가|가야|갈\s*거|가기로|떠나|출발|도착|만나|시작|끝나|있어서|이라서|라서|예정|해야\s*해|해야\s*돼|하러\s*가|보러\s*가|있는\s*날|기로\s*했)/;
const CORRECTION = /(아니\b|아니야|아니라|아닌데|아니고|사실은|사실\s|실은|이제는|이제\s|이젠|바뀌었|바꿨|달라졌|더\s*이상|그만|말고|잘못|틀렸|정정|다시\s*말하|고쳐|그게\s*아니)/;
// 캐릭터(assistant) 발화의 약속·제안 신호. 추출 입력에서 이 줄은 길게(약속 추출용), 나머지는 짧게 넣는다.
export const CHAR_PROMISE = /(줄게|줄래|줄까|드릴게|드릴까|[할볼둘놓]게|할\s*테니|줄\s*테니|하기로|기로\s*하|약속|해\s*?줄|해\s*?드릴|같이|[가보]자[!.~ㅋ\s]|자!)/;
const PROMISE = /(약속|하기로|할게|할께|해줄게|해\s*줄게|기다려|알려줄게|알려\s*줄게|말해줄게|다음에|나중에|꼭\s|잊지\s*마|기억해\s*줘|기억해줘|기억해\s*둬|잊지말고|~?까지\s|시에\s*만나|보자\b|만나자|같이\s*가|데이트)/;

// scanCount: 묶음 끝에서부터 볼 사용자 발화 수. 1=마지막 발화만(매 턴 호출), Infinity=전부(stair 정리 묶음 등).
// 중간: 마지막 추출 이후 지나간 턴만 본다(이미 추출한 턴을 다시 세어 불필요한 추출을 만들지 않기 위해).
export function updateGate(messages, policy, { scanAll = false, scanCount } = {}) {
  const users = messages.filter((m) => m.role === 'user').map((m) => (m.text ?? '').trim());
  const n = scanAll ? users.length : Math.max(1, Math.min(users.length, scanCount ?? 1));
  const targets = users.slice(-n);
  const reasons = new Set();
  let anyLong = false;
  for (const text of targets) {
    if (text.length < policy.minUserChars) continue;
    anyLong = true;
    if (CORRECTION.test(text)) reasons.add('correction');
    if (PROMISE.test(text)) reasons.add('promise');
    const fp = FIRST_PERSON.test(text);
    if (fp && (INFO.test(text) || TIME.test(text))) reasons.add('first_person_info');
    else if (!fp && ASK_CHAR.test(text)) continue; // 캐릭터에게 묻는 말
    else if (INFO.test(text) && text.length >= 20) reasons.add('info');
    else if (TIME.test(text) && EVENT_VERB.test(text)) reasons.add('event');
  }
  if (!anyLong) return { pass: false, reasons: ['short'] };
  return { pass: reasons.size > 0, reasons: [...reasons] };
}

// 사용자가 과거 기억을 요구/의심하는 신호 → 원문 로그 깊은 검색
const MISS = /((다고|라고|기로)\s*(했|말했|얘기했)|했었(지|어|나|는지)|기억\s*(안|못|나|해|하)|전에\s*(말|얘기|이야기)했|말했잖|말했었|얘기했잖|이야기했잖|말한\s*거|얘기한\s*거|알지\?|알아\?|알고\s*있지|까먹|잊었어\?|잊어버렸|내가\s*뭐라|뭐였|뭐라고\s*했|누구라고|어디라고|언제라고|무슨\s*(일|얘기)\s*있었|지난번|저번에|그때\s|예전에)/;
export function missSignal(text = '') {
  return MISS.test(text);
}

// 질의를 키워드 토큰으로 (한국어 조사 일부 제거, 2글자 이상)
const PARTICLES = /(은|는|이|가|을|를|에|에서|으로|로|와|과|도|만|의|한테|에게|께|부터|까지|이야|야|지|요|죠|네|다|어|아|고|서|면|니|나|든|라고|라는|이라고|이라는|했어|했지|였어|이었어)$/;
export function keywords(text = '') {
  const toks = text.replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
  const out = new Set();
  for (let t of toks) {
    if (/^[\p{L}\p{N}]+$/u.test(t)) {
      const stripped = t.replace(PARTICLES, '');
      if (stripped.length >= 2) out.add(stripped);
      if (t.length >= 2) out.add(t);
    }
  }
  return [...out];
}
