// 설계 도식. C4 모델 기준: 그림 1 = 컨테이너 수준(무엇이 무엇을 부르나), 그림 2 = 동적(시퀀스) 다이어그램(한 턴).
// 규칙(C4 체크리스트): 그림마다 제목·범례, 모든 화살표에 라벨, 색은 두 가지 뜻만(파랑 = 돈이 나가는 AI 호출, 회색 = 내부).
// HTML 로 그려 화면 폭이 좁아도 글자 크기가 그대로이고, 좁으면 세로로 쌓인다. 긴 설명은 그림 아래 번호 목록.
import D from './data.json';

const V = D.app_config;
const Fig = ({ n, t, cap, legend, children, notes }) => <figure className="dg">
  <figcaption><b>그림 {n}. {t}</b>{cap && <span>{cap}</span>}</figcaption>
  {legend && <ul className="dg-legend">{legend.map(([k, l]) => <li key={l}><i className={`dg-lg-${k}`} />{l}</li>)}</ul>}
  <div className="dg-body">{children}</div>
  {notes && <ol className="dg-notes">{notes.map((x, i) => <li key={i}>{x}</li>)}</ol>}
</figure>;
const Node = ({ t, s, k = 'app', children }) => <div className={`dg-node dg-${k}`}><div className="t">{t}</div>{s && <div className="s">{s}</div>}{children}</div>;
// 세로 화살표. money = 돈이 나가는 호출
const Down = ({ l, money, up }) => <div className={`dg-down ${money ? 'money' : ''} ${up ? 'up' : ''}`}><span>{l}</span></div>;

// 그림 1. 컨테이너도
export function Containers() {
  return <Fig n={1} t="구성 요소와 호출 관계" cap="C4 모델의 컨테이너 수준. 점선 안은 서버 한 프로세스이고, 밖으로 나가는 호출은 DeepSeek API뿐이다."
    legend={[['app', '우리 코드'], ['ext', '외부 서비스'], ['money', '돈이 나가는 AI 호출'], ['flow', '내부 호출']]}>
    <Node t="사용자" s="브라우저 채팅 화면 또는 curl" k="ext" />
    <Down l="메시지 보내기 · 답을 글자 단위로 받음" />
    <div className="dg-bound"><div className="dg-bound-l">서버 한 프로세스 · Next.js</div>
      <div className="dg-row2">
        <Node t="채팅앱" s="최근 12턴 창 관리 · 프롬프트 조립 · 턴 비용 기록" />
        <div className="dg-side"><span>매 턴 기억 읽기</span><span>6턴마다 대화 넘기기</span></div>
        <Node t="기억 레이어" s="기억 항목 추출 · 정정 · 검색">
          <div className="dg-inner"><b>로컬 임베딩</b> bge-m3 · CPU · 한 번에 약 10ms · API 비용 0</div>
        </Node>
      </div>
      <div className="dg-row2 dg-split"><Down l="대화 응답 요청" /><Down l="기억 추출 요청" /></div>
      <Node t="모델 레이어" s="재시도 · 피크/비피크 단가 · 모든 호출을 장부에 기록" />
      <div className="dg-store"><Node t="SQLite 파일 하나" s="대화 원문 · 기억 항목과 임베딩 · 호출 장부(턴 비용의 근거)" k="db" /></div>
    </div>
    <Down l={<><b>₩</b> 대화 응답 · 매 턴 1회 · 추론 켬<br /><b>₩</b> 기억 추출 · 6턴마다 2회 · 추론 끔</>} money />
    <Node t="DeepSeek API" s="deepseek-flash · 외부" k="ext" />
  </Fig>;
}

// 그림 2. 한 턴 시퀀스. 생명선 5개, 메시지는 번호 순서. a/b = 보내는 쪽/받는 쪽 열 번호
const LANES = ['사용자', '채팅앱', '기억 레이어', '모델 레이어', 'DeepSeek'];
const SEQ = [
  { n: 1, a: 0, b: 1, l: '메시지' },
  { n: 2, a: 1, b: 1, l: '앞 정리 대기' },
  { n: 3, a: 1, b: 2, l: '보충 요청' },
  { n: 4, a: 2, b: 2, l: '질문 임베딩' },
  { n: 5, a: 2, b: 1, l: '보충 ≤3줄', ret: true },
  { n: 6, a: 1, b: 3, l: '프롬프트' },
  { n: 7, a: 3, b: 4, l: '응답 생성 ₩', money: true },
  { n: 8, a: 4, b: 1, l: '답 글자', ret: true },
  { n: 9, a: 1, b: 0, l: '답 스트리밍', ret: true },
  { n: 10, a: 1, b: 1, l: '답 저장' },
  { div: '응답 끝. 사용자는 다음 말을 칠 수 있다. 아래는 답이 나간 뒤 백그라운드, 창이 12턴 찼을 때만' },
  { n: 11, a: 1, b: 2, l: '앞 6턴', bg: true },
  { n: 12, a: 2, b: 3, l: '추출 요청', bg: true },
  { n: 13, a: 3, b: 4, l: '추출 ×2 ₩', money: true, bg: true },
  { n: 14, a: 2, b: 2, l: '저장·정정', bg: true },
  { n: 15, a: 2, b: 1, l: '새 기억 블록', ret: true, bg: true },
];
export function Sequence() {
  const N = LANES.length, c = (i) => `${((i + 0.5) / N) * 100}%`;
  return <Fig n={2} t="한 턴의 순서" cap="1~10은 사용자가 답을 기다리는 구간, 11~15는 답이 나간 뒤 6턴마다 도는 기억 정리다. 모든 AI 호출은 모델 레이어를 거치고 장부에 남는다."
    legend={[['money', '돈이 나가는 AI 호출'], ['flow', '요청'], ['ret', '돌려받음'], ['bg', '백그라운드']]}
    notes={[
      '사용자가 메시지를 보낸다.',
      '앞 턴의 기억 정리가 아직 돌고 있으면 끝날 때까지 기다린다. 사용자가 아주 빨리 다음 말을 보내면 여기서 지연이 생긴다.',
      '채팅앱은 정리 때 만들어 둔 기억 블록을 그대로 쓰고(첫 턴만 새로 만든다), 블록에 없는 기억 중 이번 말과 관련된 것을 기억 레이어에 묻는다.',
      '이번 말을 서버 안 임베딩 모델로 벡터로 바꾼다. AI API 호출이 아니다.',
      '뜻이 가까운 기억 최대 3줄(유사도 0.45 이상). 값이 바뀐 기억이면 최신 값을 돌려준다. 되묻기나 시점 표현이 있으면 그 캐릭터와의 원문 발췌 최대 3개를 더한다.',
      '고정 앞부분 → 기억 블록 → 최근 대화 → 이번 말 순서로 쌓아 모델 레이어에 넘긴다(그림 3). 보충 기억과 답 언어 지시는 이번 말 뒤에만 붙이고 이력에 남기지 않아 캐시를 깨지 않는다.',
      'DeepSeek Flash 추론 켬으로 답을 만든다. 오류면 최대 2회 다시 시도하되, 글자가 이미 나갔으면 다시 시도하지 않는다. 모든 시도를 장부에 기록한다.',
      '답이 글자 단위로 돌아온다. 답이 비면 같은 입력으로 1회 다시 부른다(두 호출 모두 비용에 포함).',
      '채팅앱이 받은 글자를 바로 화면으로 흘려보낸다.',
      '답을 저장하면 입력창이 열린다.',
      '최근 대화가 12턴이 되면 가장 오래된 6턴을 기억 레이어로 넘긴다.',
      '기억 레이어가 비슷한 기존 항목을 임베딩으로 찾아 6턴과 함께 모델 레이어에 넘긴다.',
      '6턴을 3턴씩 나눠 두 번 추출한다(DeepSeek Flash 추론 끔, JSON). 같은 대상이면 새로 만들지 않고 고치게 한다.',
      '새 항목을 저장하고 임베딩한다. 바뀐 값은 옛 항목을 지우지 않고 ‘대체됨’으로 남긴다. 추출이 실패해도 창은 넘어가 그 6턴은 기억에 남지 않는다(측정에서 실패 0건).',
      '새 기억 블록을 만들어 저장한다. 다음 턴부터 이 블록을 쓴다.',
    ]}>
    <div className="sq" style={{ '--n': N }}>
      <div className="sq-head">{LANES.map((l, i) => <div key={l} className={i === 4 ? 'ext' : ''}>{l}</div>)}</div>
      <div className="sq-body">
        {LANES.map((l, i) => <i key={l} className="sq-life" style={{ left: c(i) }} />)}
        {SEQ.map((m, i) => m.div ? <div key={i} className="sq-div"><span>{m.div}</span></div>
          : m.a === m.b ? <div key={i} className={`sq-m self ${m.bg ? 'bg' : ''}`}><div className="loop" style={{ left: c(m.a) }}><em>{m.n}</em>{m.l}</div></div>
          : <div key={i} className={`sq-m ${m.ret ? 'ret' : ''} ${m.money ? 'money' : ''} ${m.bg ? 'bg' : ''} ${m.b < m.a ? 'rev' : ''}`}>
            <div className="ar" style={{ left: c(Math.min(m.a, m.b)), width: `${(Math.abs(m.b - m.a) / N) * 100}%` }}><span><em>{m.n}</em>{m.l}</span></div>
          </div>)}
      </div>
    </div>
  </Fig>;
}

// 그림 3. 프롬프트 쌓기
export function PromptStack() {
  return <Fig n={3} t="한 번의 대화 호출에 보내는 것" cap="앞에서부터 이전 호출과 같은 부분은 캐시 단가로 읽힌다(입력 정가의 1/50, 비피크 단가의 1/25). 그래서 바뀌는 것을 뒤에 둔다."
    legend={[['cache', '캐시로 읽힘'], ['fresh', '매 턴 정가']]}>
    <div className="ps">
      <div className="ps-l cache"><b>캐릭터 시트 · 공통 규칙 · 말투 예시</b><span>대화 내내 같음 · 약 1,700토큰</span></div>
      <div className="ps-l cache"><b>기억 블록</b><span>6턴마다 바뀜 · 최대 {V.memory_budget_tokens.toLocaleString()}토큰</span></div>
      <div className="ps-l cache"><b>최근 대화 6~12턴</b><span>뒤에 붙기만 함</span></div>
      <div className="ps-cut">여기까지 이전 호출과 같으면 캐시</div>
      <div className="ps-l fresh"><b>이번 사용자 말 + 보충 기억 + 답 언어 지시 한 줄{V.date === 'gate' ? ' (+ 시간 표현이 있으면 오늘 날짜)' : ''}</b><span>매 턴 새로 · 이력에 남기지 않음</span></div>
    </div>
  </Fig>;
}

// 그림 4. 기억 쓰기·읽기 두 경로
const Path = ({ title, tag, steps }) => <div className="mp-lane"><div className="mp-h"><b>{title}</b><span>{tag}</span></div>
  <ol>{steps.map((s, i) => <li key={i} className={s.money ? 'money' : ''}>{s.t}{s.s && <small>{s.s}</small>}</li>)}</ol></div>;
export function MemoryPaths() {
  return <Fig n={4} t="기억을 쓰는 길과 읽는 길" cap="쓰기는 6턴마다 답이 나간 뒤 백그라운드에서 AI 2회, 읽기는 매 턴 AI 없이 한다."
    legend={[['money', '돈이 나가는 AI 호출'], ['app', 'AI 없이 코드로']]}>
    <div className="mp">
      <Path title="쓰기" tag="6턴마다 · AI 2회" steps={[
        { t: '창에서 밀려난 6턴', s: '최근 12턴이 차면 가장 오래된 6턴' },
        { t: '비슷한 기존 항목 찾기', s: '임베딩으로 최대 25개' },
        { t: '추출 3턴씩 2번', s: 'DeepSeek Flash · JSON', money: true },
        { t: '추가 · 같은 대상이면 고침', s: '바뀐 값은 옛 항목을 ‘대체됨’으로' },
        { t: '새 항목 임베딩 → 새 기억 블록' },
      ]} />
      <div className="mp-arrow">저장<i>→</i></div>
      <div className="mp-store"><b>기억 저장소</b>
        <ul><li>기억 항목: 사실·선호는 모든 캐릭터 공유, 약속·사건은 그 캐릭터만</li><li>항목마다 출처(몇 번째 대화의 몇 턴)</li><li>사용자 원문 전부와 임베딩</li><li>대화마다 요약 1개</li></ul></div>
      <div className="mp-arrow">꺼냄<i>→</i></div>
      <Path title="읽기" tag="매 턴 · AI 0회" steps={[
        { t: `고정 블록 그대로`, s: `최대 ${V.memory_budget_tokens.toLocaleString()}토큰 · 이름·열린 약속 → 안전 → 정정 → 중요도 순` },
        { t: '이번 말 임베딩', s: '서버 CPU · 약 10ms' },
        { t: '블록 밖 기억 최대 3줄', s: '보관·대체된 항목까지 검색 · 유사도 0.45 이상' },
        { t: '되묻기·시점 표현이면 원문 발췌', s: '그 캐릭터와의 대화에서만 · 최대 3개' },
        { t: '이번 사용자 말 뒤에 붙임' },
      ]} />
    </div>
  </Fig>;
}

// 그림 5. 검증 파이프라인
export function Pipeline() {
  const S = [
    ['고정 대본', '사용자 말·문항·정답 키워드를 미리 씀', '우리가 씀'],
    ['앱 API로 실행', '데모와 같은 코드에 대본을 그대로 보냄', '실제 모델 출력'],
    ['장부 대조', '앱 기록과 제공사 사용량을 대화마다 맞춤', '비용 · 기계 측정'],
    ['블라인드 판정', '구성 이름을 가리고 섞어서 매김', '기억·품질 · Opus 판정'],
    ['집계', '결과 파일에서 리포트 숫자를 자동 생성', 'report-data.mjs'],
  ];
  return <Fig n={5} t="검증 흐름" cap="모든 조건에 같은 사용자 말을 보내고, 숫자는 결과 파일에서 자동으로 뽑는다.">
    <ol className="pl">{S.map(([t, s, o]) => <li key={t}><b>{t}</b><span>{s}</span><em>{o}</em></li>)}</ol>
  </Fig>;
}
