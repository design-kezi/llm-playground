// 추출·통합 프롬프트. 과제 M4(지어내기 방지) 장치: 명시된 것만, 추론 금지, 캐릭터 발화는 사용자 정보 아님, 불확실하면 NONE.
import { CHAR_PROMISE } from './gate.js';

// 프로필 슬롯은 영어 고정 키(저장·추출기 출력). 표시 라벨은 대화 언어별.
export const PROFILE_SLOTS = ['name', 'nickname', 'job', 'location', 'age', 'relation'];
export const PROFILE_LABELS = {
  ko: { name: '이름', nickname: '호칭', job: '직업', location: '거주지', age: '나이대', relation: '관계' },
  en: { name: 'name', nickname: 'nickname', job: 'job', location: 'location', age: 'age', relation: 'relation' },
  ja: { name: '名前', nickname: '呼び方', job: '職業', location: '住まい', age: '年代', relation: '関係' },
  'zh-TW': { name: '名字', nickname: '稱呼', job: '職業', location: '居住地', age: '年齡層', relation: '關係' },
};
// 구조 필드 어휘(언어 무관). slot = "<대상>.<속성>". 대상·속성 밖의 값은 코드가 other 로 정규화한다.
export const SLOT_SUBJECTS = ['user', 'pet', 'family', 'friend', 'partner', 'colleague', 'character', 'event', 'promise', 'other'];
export const SLOT_ATTRS = ['name', 'job', 'location', 'age', 'allergy', 'health', 'diet', 'like', 'dislike', 'hobby', 'routine', 'skill', 'status', 'plan', 'promise', 'relation', 'other'];
// 한 대상에 값이 하나뿐인 속성: 같은 slot+entity 의 활성 항목이 있으면 새 값은 그것의 UPDATE 다(모델이 item_id 를 틀려도 구조로 찾는다)
export const SINGLE_VALUED = new Set(['name', 'location', 'age', 'diet']); // (nc8) relation·status, (nc10) job 제외 — 모델이 남의 사실을 user.job 으로 라벨해 사용자의 팀 사실을 덮었다. 사건·약속은 entity 단위

export const EXTRACT_SYSTEM = `당신은 롤플레잉 채팅의 "기억 추출기"다. "새 턴"에서 나중에도 기억할 가치가 있는 사용자 정보만 뽑아 JSON 으로만 답한다.

규칙:
1. "새 턴"에서만 추출한다. "이전 턴"은 문맥용이며 이미 처리됐다.
2. 명시된 것만 저장한다. 추론·짐작 금지. 불확실하면 저장하지 않는다.
3. 캐릭터(assistant)의 말은 사용자 정보가 아니다. 캐릭터의 권유·제안("국밥 어때")을 사용자 선호로 쓰지 않는다. 약속(promise)만 예외: 캐릭터가 명시적으로 해주기로 한 구체적 행동(부탁 수락 포함), 또는 사용자가 캐릭터에게 한 약속("내가 …해 줄게"). promise 는 "who": "character"|"user"(누가 하기로 했나)를 반드시 넣고 text 는 주어·상대 없이 행동만("코드 리뷰를 봐주기로 했다"). 명시적 약속은 사용자 정보와 함께 반드시 저장(캐릭터 약속은 턴당 1개). 사용자의 요청·수락 없이 캐릭터가 혼자 꺼낸 제안·계획("제가 알아볼게요")과 "기억해 두겠다/권한다" 같은 가벼운 말은 약속이 아니다.
4. 일회성 기분·상태("오늘 피곤해")는 저장하지 않는다. 지속 정보·중요 사건·약속만. 음식·음료·취향 선호는 사소해 보여도 preference 로 저장. 사용자가 말한 가족·친구·반려동물의 사실·선호("내 동생은 매운 거 좋아해")도 사용자 정보다 — 주어 "사용자의 동생은 …". 기억을 묻는 질문("내가 뭐라고 했지?")은 그 턴만 건너뛰고, 같은 묶음의 다른 새 턴은 그대로 추출한다.
5. "현재 기억"에 이미 있는 내용(표현만 다른 것 포함)은 다시 쓰지 않는다. 변화 없으면 ops 는 [].
6. 기존 기억이 실제로 바뀌면 그 항목의 id 와 같은 slot·entity 로 UPDATE(사건·약속의 날짜·장소·이름 변경 포함, 새 ADD 아님). 같은 대상의 다른 사실(누나의 음식 선호 vs 누나의 동아리)은 UPDATE 가 아니라 ADD. UPDATE 의 slot·entity 는 대상 항목에 적힌 것을 그대로 쓴다. 사건이 취소·종료되거나 약속이 이행되면 그 항목을 UPDATE 하며 "closed":true 를 넣고 text 는 과거형("볼링 모임은 취소됐다"). 재언급·질문은 NONE. 부분 예외("매운 건 싫지만 떡볶이는 괜찮아")는 ADD.
7. 한 항목 = 문장 하나, 사실 하나, 30자 안팎(45자 이내), 사용자 발화 언어로. 주어는 "사용자"/"캐릭터"/"사용자의 동생". 현재 값만 쓰고 과정·이유는 쓰지 않는다("이름은 보리다" O, "하늘이에서 보리로 바꿨다" X). 그대로인 세부(날짜·장소)는 남긴다.
8. type: fact|preference|event|promise. 시점 표현("다음 주 토요일", "28일", "다음에 올 때")이 있으면 when 에 원문 그대로 반드시(event·promise 특히). 날짜 환산은 하지 않는다. 없으면 when 생략. turn: 정보가 나온 새 턴 번호.
9. importance 1~5: 이름·가족·직업·건강·약속 4~5, 선호 2~3.
10. 프로필 슬롯(${PROFILE_SLOTS.join(', ')}) 값이 새로 나오거나 바뀐 경우에만 profile 에 그 슬롯만. 자기소개("나 지민이야")의 이름은 반드시 profile.name 에. 반려동물·가족의 이름은 profile 아님, 항목(slot pet.name 등).
11. ops 는 새 턴 하나당 3개 이내(사용자 정보, 그다음 약속). 공백·줄바꿈 없는 압축 JSON. 설명·메타 문장 금지.
12. 모든 op 에 구조 필드(언어 무관): "slot"="<대상>.<속성>" 영어 소문자 라벨(예: user.allergy, pet.name, sister.job, user.worry — 정해진 목록 없음, 같은 사실이면 같은 라벨). "entity"=대상 라벨: 사용자 user, 캐릭터 character, 그 밖은 <대상>#번호(pet#1, family#1), 사건·약속은 각자 event#N·promise#N. "현재 기억"에 같은 대상이 있으면 그 라벨 그대로, 새 대상이면 다음 번호. "depends_on"=딸린 항목 id 배열(사건에 딸린 약속 → 사건 id), 없으면 생략. "value"=속성 name 일 때 이름 값만.
13. 내용을 밝히지 않은 고민·이유·비밀·계획("고민이 있는데 나중에 말할게", "온 이유는 아직 말 못 해", "다음 달에 뭐 시작할 건데 정해지면 말할게")도 저장한다: type fact, slot user.status, text 는 "사용자는 고민이 있다고 했으나 내용은 말하지 않았다" 꼴. 나중에 내용을 말하면 그 항목을 UPDATE.

출력 형식:
{"profile":{"name":"민수"},"ops":[{"op":"ADD","type":"event","slot":"event.plan","entity":"event#1","text":"사용자는 부산 여행을 간다","when":"다음 주 토요일","importance":3,"turn":16},{"op":"ADD","type":"promise","who":"character","slot":"promise.promise","entity":"promise#1","depends_on":[31],"text":"코드 리뷰를 봐주기로 했다","when":"다음에","importance":3,"turn":16},{"op":"ADD","type":"fact","slot":"pet.name","entity":"pet#1","value":"보리","text":"사용자의 고양이 이름은 보리다","importance":4,"turn":16},{"op":"UPDATE","item_id":12,"type":"fact","slot":"user.routine","entity":"user","closed":true,"text":"사용자는 달리기를 그만뒀다","importance":3,"turn":17}]}`;

// 캐릭터 응답의 지문(*행동·표정*)을 제거하고 대사만 남긴다. 지문에는 사용자 정보가 없고, 절단 길이를 잡아먹어 뒤의 약속 문장을 밀어내며, 약속 신호를 오탐시킨다.
export function stripDirections(text = '') {
  const t = String(text).replace(/\*[^*\n]{1,200}\*/g, ' ').replace(/\s+/g, ' ').trim();
  return t || String(text).trim(); // 전부 지문이면 원문 유지
}

// newMessages: 이번에 추출할 턴들. contextMessages: 그 앞 문맥(추출 대상 아님, 캐릭터 발화는 더 짧게). 캐릭터 발화는 잘라서 넣는다.
export function extractUser({ profile, items, newMessages, contextMessages = [], currentTurn, today = null, lang = 'ko', assistantChars = 160, plainAssistantChars = 90, contextAssistantChars = 60 }) {
  const prof = Object.entries(profile).map(([k, v]) => `- ${k}: ${v}`).join('\n') || '(없음)';
  // 항목에 slot·entity 를 보여 준다: 같은 대상은 같은 entity 라벨로, 바뀐 것은 그 id 로 UPDATE 하라는 근거
  const its = items.map((i) => `- [id ${i.id}] (${i.type}${i.slot ? `, ${i.slot}` : ''}${i.entity ? `, ${i.entity}` : ''}) ${i.text}${i.when_text ? ` (${i.when_text})` : ''}`).join('\n') || '(없음)';
  // 캐릭터 발화: 지문(*…*)은 빼고 대사만 본다(응답 형식 "지문 + 대사", 2026-10-23). 약속·제안 신호가 있으면 assistantChars, 없으면 plainAssistantChars(문맥 파악용)까지만 남긴다.
  // 이전 대화에서 이월된 턴(prev_conversation)은 번호가 현재 대화와 겹칠 수 있어 라벨로 구분한다.
  const line = (cut, plain = cut) => (m) => {
    const text = m.role === 'assistant' ? stripDirections(m.text) : m.text;
    const c = m.role === 'assistant' && !CHAR_PROMISE.test(text) ? plain : cut;
    return `${m.turn_no != null && m.role === 'user' ? `[${m.prev_conversation ? '이전 대화 ' : ''}턴 ${m.turn_no}] ` : ''}${m.role === 'user' ? '사용자' : '캐릭터'}: ${m.role === 'assistant' && text.length > c ? text.slice(0, c) + '…' : text}`;
  };
  const ctx = contextMessages.length ? `## 이전 턴 (문맥용, 이미 처리됨)\n${contextMessages.map(line(contextAssistantChars)).join('\n')}\n\n` : '';
  return `${today ? `## 오늘: ${today}\n` : ''}## 현재 기억
프로필:
${prof}
항목:
${its}

${ctx}## 새 턴 (여기서만 추출. 마지막 사용자 발화가 턴 ${currentTurn})
${newMessages.map(line(assistantChars, plainAssistantChars)).join('\n')}

새 턴에서 새로 저장/갱신할 기억을 JSON 으로만 출력하라.${lang && lang !== 'ko' ? ` text·when 원문은 ${lang} 로 쓴다.` : ''}`;
}

export const RETRY_SUFFIX = `\n\n(직전 출력이 올바른 JSON 이 아니었다. 설명 없이 JSON 객체 하나만 출력하라.)`;
// 출력이 max_tokens 에 잘렸을 때: 같은 입력을 되풀이하지 않고 더 짧게 요구한다
export const TRUNCATED_SUFFIX = `\n\n(직전 출력이 길어서 잘렸다. 중요한 것부터, 각 text 는 30자 안팎으로 짧게, 공백 없는 JSON 한 줄로 출력하라.)`;

export const CONSOLIDATE_SYSTEM = `당신은 롤플레잉 채팅의 "기억 정리기"다. 한 대화가 끝났다. 두 가지를 JSON 으로만 출력한다.
1. episode: 이 대화를 2~3문장으로 요약. 다음에 다시 꺼낼 가치가 있는 것 위주로: 사용자의 상황·사건·약속·감정, 캐릭터와의 관계 변화. 대화 중 바뀐 정보는 현재 값만 쓴다(이전 값 나열 금지). 날씨·식사 고민·드라마 추천 같은 일회성 잡담은 나열하지 말고 "가벼운 잡담" 정도로만 적는다. 사실은 대화에 있는 것만, 윤색 금지. 날짜는 쓰지 않는다(표시할 때 따로 붙인다).
2. merge: 아래 기억 항목 중 같은 뜻이 중복된 것이 있으면 하나만 남긴다. keep 에 남길 id, drop 에 제거할 id 배열. 모순되는 항목은 더 나중 턴의 것을 keep. 최대 5쌍, 없으면 빈 배열. 공백 없는 압축 JSON 으로 출력.
출력 형식: {"episode":"...","merge":[{"keep":3,"drop":[7]}]}`;

// messages 는 이미 예산에 맞게 줄여진 것(index.js trimForConsolidate). 생략된 캐릭터 발화는 없는 줄로 둔다.
export function consolidateUser({ date, messages, items, lang = 'ko' }) {
  const conv = messages.map((m) => `[${m.turn_no}] ${m.role === 'user' ? '사용자' : '캐릭터'}: ${m.text}`).join('\n');
  const its = items.map((i) => `- [id ${i.id}] (${i.type}, 턴 ${i.source_turn}) ${i.text}`).join('\n') || '(없음)';
  return `## 날짜: ${date}\n## 대화\n${conv}\n\n## 이 사용자의 활성 기억 항목\n${its}\n\nJSON 으로만 출력하라.${lang && lang !== 'ko' ? ` episode 는 ${lang} 로 쓴다.` : ''}`;
}

// 모델 출력에서 JSON 객체 하나를 뽑는다. 코드펜스·앞뒤 설명 허용. 실패 시 null.
export function parseJson(text = '') {
  let t = String(text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  const s = t.indexOf('{'), e = t.lastIndexOf('}');
  if (s < 0 || e <= s) return null;
  t = t.slice(s, e + 1);
  try { return JSON.parse(t); } catch { /* fallthrough */ }
  // 흔한 오류 보정: 후행 콤마
  try { return JSON.parse(t.replace(/,\s*([}\]])/g, '$1')); } catch { return null; }
}
