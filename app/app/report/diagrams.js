// 구조도 탭: 모델·API·장단기 기억·프롬프트·캐릭터 유지. 그림은 HTML 상자로 그려 휴대폰 폭에서는 세로로 접힌다.
// 도식 규칙(C4 체크리스트): 그림마다 무엇을 보여 주는지 한 줄, 색 범례 하나, 화살표에 이름, 한 그림에 한 가지 수준만.
// 숫자는 data.json(벤치 결과·앱 설정에서 생성)에서 온다. 클래스는 dg- 접두어만 쓴다(채팅 화면 .app 등과 겹치지 않게).
import D from './data.json';

const V = D.app_config;
const KIND = { ext: ['외부 API', '#9d9d9d'], app: ['우리 코드', '#4c9a96'], mem: ['기억', '#f58518'], db: ['저장소', '#b279a2'], fix: ['고정(캐시)', '#4c78a8'], now: ['매 턴 새로', '#e45756'], win: ['최근 대화', '#54a24b'] };

const Box = ({ t, s, k = 'app', children }) => <div className={`dg-box dg-k-${k}`}><div className="dg-t">{t}</div>{s && <div className="dg-s">{s}</div>}{children}</div>;
const Arrow = ({ l, down }) => <div className={`dg-ar ${down ? 'dg-down' : ''}`}><span>{l}</span></div>;
const Row = ({ children }) => <div className="dg-row">{children}</div>;
const Legend = ({ ks }) => <div className="dg-legend">{ks.map((k) => <span key={k}><i style={{ background: KIND[k][1] }} />{KIND[k][0]}</span>)}</div>;
const Fig = ({ n, t, cap, ks, children }) => <figure className="dg"><figcaption><b>그림 {n}. {t}</b><span>{cap}</span></figcaption>{ks && <Legend ks={ks} />}{children}</figure>;

// 모델별 역할: 기본값(model/index.js)에서 온다. 같은 모델이 두 역할이면 한 상자에 같이 적는다.
// 임베딩은 기억 v2 부터 서버 안 로컬 모델(bge-m3 int8, API 호출 아님)이라 외부 API 상자에서 뺀다.
const M = D.model_config ?? { response: 'deepseek-flash', extract: 'deepseek-flash' };
const ROLES = [[M.response, '대화 응답', '매 턴 1회 · 추론 켬 · 스트리밍'], [M.extract, '기억 추출·정리', '6턴마다 2회 · 추론 끔 · JSON']];
const ROLE = Object.fromEntries([...new Set(ROLES.map((r) => r[0]))].map((m) => { const rs = ROLES.filter((r) => r[0] === m); return [m, [rs.map((r) => r[1]).join(' + '), rs.map((r) => r[2]).join(' / ')]]; }));

export function Architecture() {
  return <Fig n={1} t="전체 구조 — 무엇이 어떤 모델을 부르나" cap="AI 호출은 모델 레이어 한 곳에서만 나가고, 모든 호출(실패 포함)의 비용이 장부에 남는다. 세 레이어는 같은 SQLite 파일 하나에 기록한다." ks={['app', 'mem', 'db', 'ext']}>
    <Row>
      <Box t="채팅 화면" s="브라우저" k="ext" />
      <Arrow l="메시지" />
      <Box t="채팅앱" s="대화 창 · 프롬프트 조립 · 턴 비용" k="app" />
      <Arrow l="기억 읽기·쓰기" />
      <Box t="기억 레이어" s="항목 · 프로필 · 대화 요약 · 로컬 임베딩(bge-m3, 서버 CPU)" k="mem" />
    </Row>
    <Arrow l="AI 요청(대화는 채팅앱, 추출·검색은 기억 레이어에서)" down />
    <Row>
      <Box t="모델 레이어" s="재시도 · 단가(피크/비피크) · 비용 계산 · 호출 장부" k="app" />
      <Arrow l="API 호출" />
      <div className="dg-col">
        {D.pricing.models.filter((m) => ROLE[m.model]).map((m) => <Box key={m.model} t={`${ROLE[m.model]?.[0] ?? m.model} — ${m.model}`} k="ext"><div className="dg-p">{ROLE[m.model]?.[1]}</div></Box>)}
      </div>
    </Row>
    <div className="dg-store"><Box t="SQLite 파일 하나" s="대화 원문 · 기억 항목 · 호출 장부(턴 비용의 근거). 위 세 레이어가 모두 여기에 쓴다." k="db" /></div>
  </Fig>;
}

export function TurnFlow() {
  const S = ({ n, t, d, ai, bg }) => <div className={`dg-step ${bg ? 'dg-bgstep' : ''}`}><div className="dg-n">{n}</div><div><b>{t}</b><div className="dg-s">{d}</div></div><div className="dg-ai">{ai}</div></div>;
  return <Fig n={2} t="한 턴의 흐름 — 사용자가 기다리는 구간은 ①~④" cap="오른쪽 칸은 그 단계의 AI 호출 횟수. 점선 단계(⑤⑥)는 답이 나간 뒤 백그라운드에서 돌아 사용자가 기다리지 않는다." >
    <div className="dg-steps">
      <S n="①" t="최근 대화·기억 블록 읽기" d="정리 때 만들어 둔 블록을 그대로 쓴다(바이트가 같아야 캐시가 맞음)" ai="AI 호출 0회" />
      <S n="②" t="관련 기억 보충 · 이번 턴 지시 한 줄" d={`이번 말을 로컬 임베딩으로 바꿔(약 10ms) 블록에 없는 기억 중 뜻이 가까운 것 최대 3줄, 되묻기·시점 표현이면 그 캐릭터와의 원문 발췌 최대 3개${V.date === 'gate' ? ' · 시간 표현이 있으면 오늘 날짜(서울)' : ''}${V.follow === 'on' ? ' · 답 언어와 질문 연속 끊기(코드가 정함)' : ''}`} ai="AI 호출 0회" />
      <S n="③" t="대화 모델 호출" d="DeepSeek Flash · 답이 바로 화면에 흘러나온다" ai="AI 호출 1회" />
      <S n="④" t="답 저장 → 응답 끝" d="사용자는 바로 다음 말을 칠 수 있다" ai="" />
      <S n="⑤" t="(6턴마다) 기억 정리" d={`창이 ${V.stair_max}턴이면 앞 ${V.stair_max - V.recent_turns}턴에서 사실·약속·수정을 뽑아 저장(새 항목은 로컬 임베딩으로 색인) → 새 블록`} ai="AI 호출 2회" bg />
      <S n="⑥" t="(대화 종료 때) 요약" d="남은 대화 정리 + 중복 병합 + 대화 요약 1개" ai="AI 호출 1~3회" bg />
    </div>
  </Fig>;
}

export function PromptLayers() {
  return <Fig n={3} t="프롬프트를 쌓는 순서 — 안 바뀌는 것을 앞에" cap="앞부분이 이전 호출과 같으면 캐시 단가(정가의 1/50)로 읽힌다. 300턴 기억 측정(기억 v2)에서 대화 호출 입력의 약 78%가 캐시였다." ks={['fix', 'mem', 'win', 'now']}>
    <div className="dg-stack">
      <div className="dg-layer dg-k-fix"><b>캐릭터 시트 + 공통 규칙 + 말투 예시</b><span>대화 내내 같음 · 약 1,700토큰</span></div>
      <div className="dg-layer dg-k-mem"><b>기억 블록</b><span>6턴마다 바뀜 · 최대 {V.memory_budget_tokens}토큰</span></div>
      <div className="dg-layer dg-k-win"><b>최근 대화 6~12턴</b><span>뒤에 붙이기만 함</span></div>
      <div className="dg-layer dg-k-now"><b>이번 사용자 말 (+ 관련 기억 보충{V.date === 'gate' ? ' + 시간 표현이 있으면 오늘 날짜' : ''}{V.follow === 'on' ? ' + 답 언어 줄' : ''})</b><span>매 턴 새로 · 정가 · 이력에 안 남겨 앞부분 캐시를 깨지 않는다</span></div>
    </div>
  </Fig>;
}

export function MemoryModel() {
  return <Fig n={4} t="단기·장기 기억 — 원문은 최근 것만 보내고, 나머지는 찾아서 넣는다" cap="오래된 대화는 출처가 붙은 짧은 항목으로 남기고, 항목과 사용자 원문 전부를 로컬 임베딩으로 색인한다. 매 턴 고정 블록(캐시) + 이번 말과 뜻이 가까운 기억 보충으로 넣어, 입력 길이가 대화 길이와 상관없이 상한 안에 있다." ks={['win', 'mem', 'db']}>
    <Row>
      <Box t="단기: 최근 대화 원문" s={`${V.recent_turns}~${V.stair_max}턴. 차면 앞 ${V.stair_max - V.recent_turns}턴을 접는다`} k="win" />
      <Arrow l="접을 때 추출(AI)" />
      <Box t="장기: 기억 항목" s="사실 · 선호 · 사건 · 약속" k="mem"><ul><li>사실·선호는 모든 캐릭터가 공유, 약속·사건은 그 캐릭터만</li><li>출처 턴을 붙여 지어내기를 막는다</li><li>바뀐 값은 옛 항목을 <i>대체됨</i>으로 남기고 현재 값만 쓴다</li></ul></Box>
    </Row>
    <Row>
      <Box t="프로필" s="이름·사는 곳·직업 등 한 값짜리" k="mem" />
      <Box t="대화 요약" s="대화가 끝날 때 1개 · 캐릭터별" k="mem" />
      <Box t="사용자 원문 전부" s="버리지 않고 색인 · 되묻기·시점 표현 때 발췌" k="db" />
    </Row>
    <Arrow l="매 턴 읽기(AI 호출 0회)" down />
    <Row>
      <Box t="고정 블록" s={`최대 ${V.memory_budget_tokens}토큰 · 캐시`} k="mem"><ul><li>이름·열린 약속 → 안전 → 정정 → 중요도 4+ 순으로 채우고, 남으면 중요도·최근순</li></ul></Box>
      <Box t="질문 보충" s="이번 사용자 말 뒤 · 턴마다 바뀜" k="mem"><ul><li>블록에 없는 항목(보관·대체 포함) 중 이번 말과 유사도 0.45 이상 상위 3개</li><li>대체된 항목이 걸리면 최신 값을 “(이전: …)”과 함께</li></ul></Box>
    </Row>
  </Fig>;
}

export function CharacterKeep() {
  return <Fig n={5} t="캐릭터 유지 — 지시 3겹 + 측정" cap="말투·성격은 고정 지시로, 답 언어와 질문 연속은 코드가 매 턴 한 줄로 정하고(AI 호출 없음), 결과는 블라인드 판정으로 확인한다." ks={['fix', 'now', 'ext']}>
    <Row>
      <Box t="캐릭터 시트" s="성격·말투·세계관 + 예시 대사" k="fix" />
      <Box t="공통 규칙" s="모든 캐릭터 공통" k="fix"><ul><li>“AI냐”에도 캐릭터 유지</li><li>사용자 행동·감정을 대신 쓰지 않기</li><li>없는 과거는 지어내지 않기</li></ul></Box>
      <Box t="매 턴 한 줄" s="코드가 정한 답 언어 + 직전 답이 물음표로 끝났으면 “이번 답은 질문 없이”" k="now" />
    </Row>
    <Arrow l="확인" down />
    <Row>
      <Box t="블라인드 품질 판정" s="말투·성격 유지, 맥락, 이어 가기, 사용자 결정 존중" k="ext" />
    </Row>
  </Fig>;
}
