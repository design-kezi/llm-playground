// 과제 리포트 본문. 탭마다 같은 틀: 결론 한 문장 → 숫자 카드 → 근거 그림 → 표 → 접힌 세부.
// 숫자는 data.json(model/bench/report-data.mjs 가 벤치 결과에서 생성)에서만 읽는다. 측정 출처는 테스트 탭 '측정 목록'과 같은 이름(Src)으로 단다.
// 설계 근거: docs/71-report-redesign.md(조사·계획·리뷰 반영).
import D from './data.json';
import { Containers, Sequence, PromptStack, MemoryPaths, Pipeline } from './diagrams.js';
import { Kpis, Verdict, Bars, Stack, Dots, Line } from './charts.js';
import { won, pc, Tag, Src, Table, Head, Sec, More, Note, Legend, tagText } from './ui.js';

export const TABS = [['overview', '요약'], ['arch', '설계 구조'], ['cost', '비용'], ['memory', '장기 기억'], ['test', '테스트 및 검증'], ['next', '한계/다음'], ['run', '직접 실행']];
export const ALIAS = { design: 'cost', select: 'arch', qa: 'next', cases: 'memory', repro: 'test', api: 'run' };

// ---- 데이터 ----
const lt = Object.fromEntries(D.lt.map((r) => [r.cond, r]));
const FIN = D.final;
const FC = FIN.final_cond;
const L120 = FIN.lt120;
const M3 = FIN.mem300;
const FL = FIN.follow;
const F = lt[FC]; // 최종 120턴 전체 레코드
const FM = L120.memory[FC], PM = L120.memory['v2-dsx']; // 최종 120턴 기억(같은 판정 묶음에서 개선판과 비교)
const Q = L120.quality; // 품질 판정용 120턴(최종과 대화 코드 같음, 기억 블록만 800토큰)
const HP = D.hard_probe?.[FIN.final_prefix];
const CHAR = D.char_names ?? {};
const DT = D.date_test && Object.fromEntries(D.date_test.map((r) => [r.k, r]));
const who = (sc) => CHAR[sc.replace(/-120$/, '')] ?? sc.replace(/-120$/, '');
const DMN = { 'haiku-off': 'Claude Haiku 5.5 끔', 'haiku-on': 'Claude Haiku 5.5 켬', 'luna-off': 'GPT-6 Luna 끔', 'luna-on': 'GPT-6 Luna 켬', 'deepseek-off': 'DeepSeek Flash 끔', 'deepseek-on': 'DeepSeek Flash 켬', 'gemma26-off': 'Gemma 4 26B 끔' };
const EMB_CPU = 0.0014; // 임베딩 CPU 환산(docs/21 §9.3 계산값)

const TYPE = {
  fact: '사실', pref: '선호', implicit: '돌려 묻기(제약 반영)', combine: '두 사실 조합', event: '사건·일정', user_promise: '사용자 약속', char_promise: '캐릭터 약속',
  relative_time: '상대 날짜', update: '값 수정', partial_update: '일부 수정', multi_update: '여러 번 수정', retract: '취소', distractor: '비슷한 정보 함정',
  abstain: '말한 적 없는 것', half_said: '말하다 만 것',
};
const LABEL = { correct: '정답', partial: '부분', unknown: '모름', stale: '옛 값', wrong: '틀림', fabricated: '지어냄' };
const REQ = [
  { k: 'r1', t: '사용자 정보·선호를 다른 주제가 이어진 뒤에도 기억', short: '정보·선호 기억', types: ['fact', 'pref', 'implicit', 'combine'], rule: '정답이면 성공. 돌려 묻기는 제약을 지키면 성공' },
  { k: 'r2', t: '캐릭터와의 사건·약속을 이후 대화에 반영', short: '사건·약속 반영', types: ['event', 'user_promise', 'char_promise', 'relative_time'], rule: '날짜·요일까지 맞아야 성공. 다른 캐릭터와의 약속은 모르는 게 정답' },
  { k: 'r3', t: '수정된 정보를 옛 정보 대신 반영', short: '수정 반영(함정 포함)', types: ['update', 'partial_update', 'multi_update', 'retract', 'distractor'], rule: '옛 값을 지금 값처럼 말하면 실패' },
  { k: 'r4', t: '대화에 없던 정보를 지어내지 않음', short: '지어내지 않기', types: ['abstain', 'half_said'], rule: '“말한 적 없다·모른다”가 정답. 지어내면 감점 2배' },
];
const acc = (bt, types) => { let c = 0, n = 0; for (const t of types) if (bt[t]) { c += bt[t].correct; n += bt[t].n; } return n ? (c / n) * 100 : null; };
const MB = { mb0: '기억 v1', mb1: '기억 v2 첫 판', mb2: '기억 v2 최종' };
const QK = [['character', '캐릭터 유지'], ['context', '맥락'], ['engagement', '이어 가기'], ['user_agency', '사용자 결정 존중'], ['overall', '전반']];
const COST = L120.cost[FC];
const m2 = M3.mb2, m0 = M3.mb0;
const leakN = (r) => (r.cross_char_promise.leak ?? 0) + (r.cross_char_promise.correct ?? 0) + (r.cross_char_promise.fabricated ?? 0);

// 측정 이름(Src 꼬리표와 측정 목록이 같은 이름을 쓴다)
const S = { pick: '모델 고르기 120턴', v2: '개선판 120턴', fin: '최종 120턴', q: '품질 판정용 120턴', m300: '300턴 기억', fol: '대화 따르기' };

// ================= 요약 =================
function Overview() {
  const tabs = [
    ['arch', '설계 구조', '대화는 DeepSeek Flash 하나(후보 중 기억 1위·비용 최저). 최근 12턴만 원문으로 보내고, 기억은 AI 없이 임베딩으로 찾는다. AI 비용은 응답과 6턴마다 정리에만 든다.', '구성도 · 한 턴 시퀀스 · 결정 표'],
    ['cost', '비용', `120턴 평균 ${won(COST.measured)}, 피크 단가면 ${won(COST.peak)}. 1원을 넘는 턴은 모두 기억 정리가 같이 돈 턴이다.`, `대화 응답 ${Math.round((F.by_tag.response / (F.by_tag.response + F.by_tag.extract + F.by_tag.consolidate)) * 100)}% · 기억 추출 ${Math.round((F.by_tag.extract / (F.by_tag.response + F.by_tag.extract + F.by_tag.consolidate)) * 100)}%`],
    ['memory', '장기 기억', `300턴 시험에서 기억 정답률 ${pc(m0.correct_pct)} → ${pc(m2.correct_pct)}. 오래된 정보와 바뀐 정보에서 가장 크게 나아졌다. 다른 캐릭터와의 약속 누출은 기준 0건에 못 미쳤다(2/16).`, `100턴 이상 지난 정보 ${pc(m2.far_pct)} · 정정 문항 ${pc(m2.update_pct)}`],
    ['test', '테스트 및 검증', `롤플레잉 품질은 캐릭터 유지 ${Q[FC].character.toFixed(2)}, 이어 가기 ${Q[FC].engagement.toFixed(2)}(1~5). 대화 따르기는 미리 정한 기준 6개를 모두 넘었다. 판정은 Opus 블라인드, 사람 판정은 없다.`, '같은 대본 · 블라인드 판정 · 측정 6가지'],
    ['next', '한계/다음', '사용자가 계속 대화하고 싶어 하는지는 아직 모른다. 다음은 사람 판정과 소규모 A/B다.', '확인한 것과 하지 않은 것 표'],
    ['run', '직접 실행', 'API 키 없이 curl만으로 여러 턴 대화와 장기 기억을 확인할 수 있다. 실제 요청과 응답 예시가 있다.', '화면 사용법 · curl 6단계 · API 목록'],
  ];
  return <>
    <Head t={`1턴 평균 ${won(COST.measured)}, 300턴 시험에서 기억 정답률 ${pc(m2.correct_pct, 0)}`}>
      대화는 DeepSeek Flash 하나로 한다. 대화 원문은 최근 12턴까지만 보내고, 그보다 오래된 대화는 짧은 기억 항목으로 바꿔 매 턴 필요한 것만 찾아 넣는다. 비용은 120턴 대화, 기억은 대화 5번을 이은 300턴 시험에서 쟀다.
    </Head>
    <Kpis items={[
      { value: won(COST.measured), label: '턴당 평균 AI 비용', note: `비피크 시간 실측 · 피크 단가면 ${won(COST.peak)}`, tone: 'hl' },
      { value: won(F.max_turn, 2), label: '가장 비싼 한 턴', note: `120턴 중 ${F.over1_per_run}턴이 1원 초과. 모두 기억 정리가 같이 돈 턴` },
      { value: pc(m2.correct_pct), label: '300턴 기억 정답률', note: `${m2.n}문항 · 지어낸 답 ${m2.counts.fabricated ?? 0}건 · 그때 턴당 ${won(M3.cost.mb2.measured)}` },
      { value: pc(FL.follow.direct.pct), label: '사용자 말에 먼저 답함', note: '사용자가 쓴 언어로 답함 100%' },
    ]} />
    <Note>가격은 2026-10-22 공개 가격표, 1,400원/$ 고정, 무료 크레딧 미적용. 측정은 모두 실제 API 호출이다. 숫자마다 어느 측정에서 나왔는지는 <a href="#test">테스트 및 검증 탭의 측정 목록</a>에 있다.</Note>

    <Sec t="과제 요구별 결과" sub="기억과 품질은 Opus가 판정한 값이라 ‘자체 판정’으로 표시했다.">
      <Table head={['과제 요구', '우리가 정한 기준', '결과', '판정', '근거']} rows={[
        ['1턴 평균 AI 비용 1원 이하', '평가 대화 전체 AI 비용 ÷ 완료 턴. 120턴 대본 × 캐릭터 4 × 2회', <>{won(COST.measured)} <Src>{S.fin}</Src><br />피크 단가 {won(COST.peak)} <Tag k="e" /></>, <Verdict k="pass" />, '비용'],
        ['초반·중반·후반 비용과 최대 턴', '1~40 · 41~80 · 81~120턴 평균, 8런 중 가장 비싼 턴', `${F.phases.map((x) => x.toFixed(3)).join(' · ')}원 / 최대 ${won(F.max_turn, 2)}`, <Verdict k="pass" t="제시" />, '비용'],
        ['기본 롤플레잉 4가지', '같은 장면을 Opus가 블라인드로 1~5점', <>캐릭터 {Q[FC].character.toFixed(2)} · 맥락 {Q[FC].context.toFixed(2)} · 이어 가기 {Q[FC].engagement.toFixed(2)} · 결정 존중 {Q[FC].user_agency.toFixed(2)} <Src>{S.q}</Src><br /><small>최종 직전 판(기억 블록 800토큰)의 판정</small></>, <Verdict k="self" />, '테스트'],
        ...REQ.map((r) => [`장기 기억: ${r.t}`, r.rule, <>120턴 {pc(acc(FM.by_type, r.types))} · 300턴 {pc(acc(m2.by_type, r.types))}{r.k === 'r4' && <><br /><small>함정 문항 기준. 다른 문항에서 지어낸 답 120턴 {FM.counts.fabricated ?? 0}건 · 300턴 {m2.counts.fabricated ?? 0}건</small></>}</>, <Verdict k="self" />, '장기 기억']),
        ['장기 기억: 다른 캐릭터와의 약속은 모름(직접 정한 범위)', '300턴에서 누출 0건(재측정 전에 정한 기준)', <>누출 {m2.cross_char_promise.leak ?? 0}/{leakN(m2)}건. 원인을 고친 뒤 {M3.mb3_leak.forbidden_keyword_hits}/{M3.mb3_leak.items}건(블라인드 아님)</>, <Verdict k="fail" />, '장기 기억'],
        ['사용자가 계속 대화하고 싶은 모드', '실제 사용자의 세션당 턴 수·재방문', '측정하지 않음', <Verdict k="none" />, '한계/다음'],
      ]} />
      <Legend />
    </Sec>

    <Sec t="탭별 요약">
      <div className="rp-tabsum">{tabs.map(([k, t, s, n]) => <a key={k} href={`#${k}`}><b>{t}</b><span>{s}</span><em>{n}</em></a>)}</div>
    </Sec>
  </>;
}

// ================= 설계 구조 =================
function Arch({ print }) {
  const dmq = Object.fromEntries(D.dm.map((r) => [r.cond, r.q_opus.toFixed(2)])), hkq = dmq['haiku-off'], dsq = dmq['deepseek-on'];
  const pick = lt['deepseek-on'], hk = lt['haiku-off'], hn = lt['haiku-on'], full = lt['ctl-full-memoff'], six = lt['ctl-slide6-memoff'], gem = lt['v2-gemma'], v2 = lt['v2-dsx'];
  return <>
    <Head t="돈이 나가는 AI 호출은 두 곳뿐: 대화 응답과 6턴마다 기억 정리">
      최근 12턴은 원문으로 보내고, 그보다 오래된 대화는 기억 항목으로 바꾼다. 기억을 찾는 일은 서버 안 작은 임베딩 모델이 해서 AI 비용이 들지 않는다. 바뀌지 않는 앞부분을 고정해 캐시 단가로 읽는다. 대화 따르기는 사용자 말에 먼저 답하고 사용자가 쓴 언어로 답하게 하는 규칙 묶음이다.
    </Head>
    <Containers />
    <Sequence />
    <PromptStack />

    <Sec t="핵심 설계 결정과 버린 대안" sub="과제 질문 1 ‘왜 이 방식을 골랐고 무엇을 포기했나’의 답. 회색 꼬리표는 그 숫자를 잰 측정 이름이다.">
      <Table head={['결정', '고른 것', '버린 대안', '근거']} rows={[
        ['대화 모델', 'DeepSeek Flash, 추론 켬', 'Claude Haiku 5.5 끔·켬 등 7개', <>120턴 기억 {pc(pick.mem_pct)} vs {pc(hk.mem_pct)}·{pc(hn.mem_pct)}, 턴당 {won(pick.cost.measured)} vs {won(hk.cost.measured)}·{won(hn.cost.measured)} <Src>{S.pick}</Src>. 포기한 것: 40턴 품질 판정은 Haiku 끔이 높았다({hkq} vs {dsq})</>],
        ['대화 창', '최근 12턴은 원문, 차면 앞 6턴을 기억으로', '대화 전체 전송 / 최근 6턴만', <>120턴까지는 전체 전송이 낫다: 기억 {pc(full.mem_pct)}, 턴당 {won(full.cost.measured)}, 최대 턴 {won(full.max_turn, 2)}. 버린 이유는 입력이 턴마다 커져 구간 비용이 {full.phases.map((x) => x.toFixed(2)).join('→')}원으로 계속 오르기 때문이고, 120턴보다 긴 대화는 재지 않았다. 6턴만 보내면 기억 {pc(six.mem_pct)} <Src>{S.pick}</Src></>],
        ['기억 읽기', 'AI 없이: 고정 블록 + 임베딩으로 찾은 보충', '매 턴 AI로 검색·요약', '읽기 비용 0원, 응답 전 지연 약 10ms(임베딩)'],
        ['기억 쓰기', '6턴마다 묶어서, 답이 나간 뒤', '매 턴 추출', <>추출은 턴당 {won(F.by_tag.extract)}(비용의 {Math.round((F.by_tag.extract / F.cost.measured) * 100)}%) <Src>{S.fin}</Src>. 매 턴 추출과 직접 비교한 측정은 없다</>],
        ['추출 모델', 'DeepSeek Flash, 추론 끔', 'Gemma 4 31B(11개 모델 추출 비교 1위)', <>120턴 기억 {pc(v2.mem2_pct)} vs {pc(gem.mem2_pct)}, 턴당 {won(v2.cost.measured)} vs {won(gem.cost.measured)}, 1원 넘은 턴 {v2.over1_per_run} vs {gem.over1_per_run} <Src>{S.v2}</Src></>],
        ['기억 검색', '임베딩으로 뜻을 찾고, 보관·대체된 항목도 후보', '글자 겹침으로 찾기(기억 v1)', <>300턴 정답률 {pc(m0.correct_pct)} → {pc(m2.correct_pct)}, 턴당 {won(M3.cost.mb0.measured)} → {won(M3.cost.mb2.measured)} <Src>{S.m300}</Src></>],
        ['임베딩 위치', '서버 안 bge-m3(CPU)', 'Gemini 임베딩 API', <>API 비용 0, CPU를 돈으로 환산하면 턴당 약 {EMB_CPU}원 <Tag k="e" />. 상주 메모리 약 2.2GB는 서버 운영비</>],
        ['기억 범위', '사실·선호는 공유, 약속·사건은 캐릭터별', '사용자 하나에 모두 공유', <>다른 캐릭터와의 약속 누출 {m0.cross_char_promise.leak ?? 0}/{leakN(m0)} → {m2.cross_char_promise.leak ?? 0}/{leakN(m2)} <Src>{S.m300}</Src>. 원문 발췌 경로를 고친 뒤 {M3.mb3_leak.forbidden_keyword_hits}/{M3.mb3_leak.items}(블라인드 아님)</>],
        ['대화 따르기', '먼저 답하기 + 코드가 답 언어 지정 + 질문 연속 끊기', '프롬프트 규칙만', <>직접 응답 {pc(FL.cur.direct.pct)} → {pc(FL.follow.direct.pct)}, 언어 일치 65.6 → 100% <Src>{S.fol}</Src>. 질문 연속을 막아 ‘답 뒤에 이어 말하기 쉬움’은 {pc(FL.follow.cont.pct)}(막기 전 시험 83.8%, 따르기 끔 {pc(FL.cur.cont.pct)})</>],
        ['캐시 경계', '바뀌는 것은 맨 뒤, 이번 턴에만 쓰는 지시는 이력에 남기지 않음', '모든 것을 한 블록에', <>대화 호출 입력의 약 78%가 캐시 <Src>{S.m300}</Src></>],
        ...(DT ? [['오늘 날짜', '시간 표현이 있는 턴에만 날짜 한 줄', '날짜 안 넣기 / 매 턴 넣기', `날짜 질문 정답 ${DT.off.correct} → ${DT.gate.correct}/40, 비용 변화 없음. 매 턴 넣으면 묻지 않은 날짜를 말함`]] : []),
      ]} />
    </Sec>

    <Sec t="어떻게 여기까지 왔나" sub="세 번에 걸쳐 바꿨다. 기억 점수는 같은 판정 묶음 안에서만 비교한다. 같은 답도 묶음이 다르면 1~4%p 다르게 나왔다.">
      <Table head={['단계', '바꾼 것', '턴당 비용', '120턴 기억 점수']} rows={[
        ['1차', '대화 모델을 DeepSeek Flash 추론 켬으로. 기억 블록 1,000토큰', won(pick.cost.measured), <>{pc(pick.mem_pct)} (A) · {pc(pick.mem2_pct)} (B)</>],
        ['개선판', '기억 블록 2,000토큰, 넘친 기억 보충, 대사 2~4문장, 추출도 DeepSeek', won(v2.cost.measured), <>{pc(v2.mem2_pct)} (B) · {pc(PM.score_pct)} (C)</>],
        { hl: true, cells: ['최종', '기억 v2(임베딩 검색·캐릭터별 범위) + 대화 따르기', won(COST.measured), <>{pc(FM.score_pct)} (C)</>] },
      ]} />
      <Note>A = 모델 고르기 120턴, B = 개선판 120턴, C = 최종 120턴의 판정 묶음. 비교는 같은 글자끼리만 한다.</Note>
      <More t="모델 고르기 세부: 40턴 7개 조건 비교와 뺀 이유">
        <Table num head={['조건', '기억 점수', '해로운 답', '품질(Opus)', '턴당 비용', '최악 비용']}
          rows={D.dm.map((r) => ({ hl: r.cond === 'deepseek-on', cells: [DMN[r.cond] ?? r.cond, pc(r.mem_pct), r.harmful, r.q_opus.toFixed(2), won(r.cost.measured), won(r.cost.worst)] }))} />
        <Table head={['뺀 조건', '이유']} rows={[
          ['GPT-6 Luna 끔·켬', '품질이 낮음(캐릭터를 깨고 AI임을 인정), 제공사 UTC 날짜로 한국 자정~9시에 날짜가 하루 어긋남'],
          ['Gemma 4 26B', '기억 점수·해로운 답 최하위. 자체 호스팅할 크기의 오픈 모델을 그대로 쓰면 부족하다는 근거'],
          ['DeepSeek 추론 끔', '추론 켬보다 기억이 낮고 최악 비용 1.37원'],
          ['Haiku 추론 켬', '더 비싸고 기억은 끔과 같으며 120턴에서 반복·모순이 가장 많음'],
        ]} />
      </More>
    </Sec>

    <Sec t="직접 정한 것과 가정" sub="과제가 정하지 않은 부분을 이렇게 정했다.">
      <Table head={['항목', '이렇게 정했다', '가정이 바뀌면']} rows={[
        ['1턴', '사용자 메시지 하나 + 캐릭터 답 하나 완료. 실패한 턴은 완료 턴에서 빼되 비용은 합계에 넣는다', '–'],
        ['평가 대화', '120턴 고정 대본 × 캐릭터 4 × 2회. 장기 기억은 대화 5번을 이은 300턴 대본으로 따로 쟀다', '300턴보다 긴 대화는 재지 않았다'],
        ['장기 기억', '최근 12턴 창 밖의 정보를 묻는 문항. 정답 +2 · 부분 +1 · 모름 0 · 옛 값·틀림 −1 · 지어냄 −2', '창 크기가 바뀌면 ‘창 밖’ 기준도 바뀐다'],
        ['가격', '2026-10-22 공개 가격표, 무료 크레딧 미적용, 1,400원/$ 고정', '환율 1,500원이면 약 7% 오른다'],
        ['시간대', '측정은 DeepSeek 비피크 시간(정가의 절반)', `평일 KST 10–13시·15–19시에 몰리면 ${won(COST.peak)}`],
        ['언어', '기억·비용·품질은 한국어 대화로만. 대화 따르기 대본에 영어·일본어 턴을 넣어 답 언어만 확인', '다른 언어의 기억 동작은 재지 않았다'],
        ['사용자 구분', '입력한 이름 = 사용자. 같은 이름이면 기억을 이어 받는다', '–'],
      ]} />
    </Sec>

    {D.prompts?.characters && <Prompts print={print} />}
  </>;
}

// 실제 프롬프트: 네 캐릭터가 같은 공통 규칙을 쓰므로 공통 규칙은 한 번만, 캐릭터마다 다른 시트·말투 예시는 접어서
function Prompts({ print }) {
  const ps = Object.entries(D.prompts.characters);
  const rules = ps.map(([, t]) => t.slice(t.indexOf('규칙:')));
  let n = 0; while (rules.every((r) => r[n] === rules[0][n]) && n < rules[0].length) n++;
  n = rules[0].lastIndexOf('\n', n);
  const common = rules[0].slice(0, n);
  return <Sec t="실제 프롬프트" sub="대화 호출마다 맨 앞에 보내는 고정 부분이다. 캐릭터 시트 → 공통 규칙 → 말투 예시 순서이고, 공통 규칙은 네 캐릭터가 같다.">
    {ps.map(([k, t], i) => { const r = t.indexOf('규칙:'); return <More key={k} open={i === 0 && !print} t={`${CHAR[k] ?? k} 시트와 말투 예시`}><pre className="rp-code">{t.slice(0, r).trim()}{'\n\n(공통 규칙)\n\n'}{t.slice(r + n).trim()}</pre></More>; })}
    <More t={`공통 규칙 · ${common.length.toLocaleString()}자`}><pre className="rp-code">{common}</pre></More>
  </Sec>;
}

// ================= 직접 실행 =================
function Run() {
  const base = typeof window === 'undefined' ? 'https://<데모 주소>' : window.location.origin;
  const code = `BASE=${base}
AUTH='아이디:비밀번호'   # 데모 주소 접속 계정(제출 메시지로 따로 전달). 로컬 실행이면 -u 옵션을 빼도 된다

# 1) 대화 시작. user_name 이 같으면 이전 대화의 기억을 이어 받는다
curl -s -u $AUTH -X POST $BASE/api/conversations -H 'content-type: application/json' \\
  -d '{"user_name":"tester","character_id":"baekho"}'
# → {"conversation_id":123, ...}   캐릭터: baekho · naruto · backend · sejong

# 2) 메시지 보내기 (턴마다 반복)
curl -s -u $AUTH -X POST $BASE/api/conversations/123/messages -H 'content-type: application/json' \\
  -d '{"text":"나 우유 마시면 배 아파서 두유만 마셔."}'

# 3) 대화 끝내기 (남은 대화를 기억으로 정리하고 대화 요약을 만든다)
curl -s -u $AUTH -X POST $BASE/api/conversations/123/end

# 4) 저장된 기억 보기 (출처 턴·대체 이력 포함)
curl -s -u $AUTH "$BASE/api/memory?user=tester&character=baekho&include_superseded=1"

# 5) 새 대화를 시작해 기억을 묻는다 (1번처럼 시작 → 새 conversation_id)
curl -s -u $AUTH -X POST $BASE/api/conversations/124/messages -H 'content-type: application/json' \\
  -d '{"text":"내가 뭐 못 마신다고 했지?"}'

# 6) 대화 비용 (턴당 평균·구간·가장 비싼 턴)
curl -s -u $AUTH $BASE/api/conversations/123/report`;
  return <>
    <Head t="API 키 없이 curl만으로 대화와 장기 기억을 확인할 수 있다">
      모델 API 키는 서버에만 있고 요청에는 넣지 않는다. 데모 주소에는 접속 계정만 걸려 있다. 2026-11-01 데모 서버에서 아래 순서를 키 없이 그대로 실행해 확인했다.
    </Head>

    <Sec t="화면으로 쓰기">
      <ol>
        <li>데모 주소에 접속해 왼쪽 메뉴의 <b>새 채팅</b>을 누른다.</li>
        <li>이름을 넣고 캐릭터를 고른다. 같은 이름으로 다시 들어오면 이전 대화의 기억을 이어 받는다.</li>
        <li>대화한다. 대화 메뉴의 <b>리포트</b>에서 턴별 비용을 본다.</li>
      </ol>
    </Sec>

    <Sec t="curl로 쓰기" sub="1~6을 순서대로 실행한다. 대화 번호(123, 124)는 1번 응답의 conversation_id로 바꾼다.">
      <pre className="rp-code">{code}</pre>
      <Note>답을 글자 단위로 받으려면 메시지 주소 끝에 <code>?stream=1</code>을 붙인다(SSE). 기억은 대화 중 6턴마다, 그리고 대화를 끝낼 때 정리되므로 짧게 확인할 때는 3번(끝내기)을 꼭 실행한다.</Note>
    </Sec>

    <Sec t="실제 요청과 응답" sub="2026-11-01 데모 서버에서 위 순서로 실행한 결과. 응답은 길어서 앞부분만 옮겼다.">
      <Table head={['단계', '요청', '응답']} rows={[
        ['1 대화 시작', <code key="1">POST /api/conversations</code>, <code key="1r">{'{"conversation_id":1211,"character_id":"baekho","language":"ko"}'}</code>],
        ['2 메시지', '“나 우유 마시면 배 아파서 두유만 마셔.”', '*우유병을 들다가 눈이 휘둥그레진다.* 뭐어?! 우유를 못 마셔?! 이 천재 강백호는 하루에 우유만 세 통씩 마신다고! 그거 키 크는 데 딱인데... 두유는 맛이 어떠냐? (이 턴 0.218원)'],
        ['3 끝내기', <code key="3">POST …/1211/end</code>, '대화 1턴, 호출 4회, 합계 0.339원(응답 + 기억 추출 + 요약)'],
        ['4 기억 보기', <code key="4">GET /api/memory</code>, '“사용자는 우유를 마시면 배가 아파 두유만 마신다” · 선호 · 출처 대화 1211의 1턴'],
        ['5 새 대화에서 묻기', '“내가 뭐 못 마신다고 했지?”', '*팔짱을 끼고 고개를 끄덕인다.* 당연히 알지, 천재니까! 우유 마시면 배 아프다며, 그래서 두유만 마신다고 했잖아. 그거 맞지?'],
      ]} />
    </Sec>

    <Sec t="API 목록">
      <Table head={['요청', '하는 일']} rows={[
        [<code key="a">GET /api/characters</code>, '캐릭터 목록'],
        [<code key="b">POST /api/conversations</code>, '대화 시작(user_name, character_id, 선택: language)'],
        [<code key="c">GET /api/conversations?user=이름</code>, '그 사용자의 대화 목록'],
        [<code key="d">POST /api/conversations/:id/messages</code>, '메시지 보내기(text). ?stream=1 이면 글자 단위'],
        [<code key="e">GET /api/conversations/:id/messages</code>, '대화 기록'],
        [<code key="f">POST /api/conversations/:id/end</code>, '대화 끝내기(기억 정리 + 요약)'],
        [<code key="g">GET /api/conversations/:id/report</code>, '대화 비용(턴당 평균·구간·가장 비싼 턴·호출 종류별)'],
        [<code key="h">GET /api/memory?user=이름&character=캐릭터</code>, '저장된 기억. include_superseded=1 이면 대체된 옛 값까지'],
      ]} />
      <Note>API 키 등 비밀값은 저장소에 올리지 않는 .env 파일에만 있고, 키 이름만 적은 .env.example을 둔다. 실행 기록과 대본으로 평가를 다시 돌리는 방법은 테스트 및 검증 탭의 ‘직접 재현하려면’에 있다.</Note>
    </Sec>
  </>;
}

// ================= 비용 =================
function Cost() {
  const tg = F.by_tag, tot = tg.response + tg.extract + (tg.consolidate ?? 0);
  const rows = [['haiku-off'], ['haiku-on'], ['deepseek-on'], ['v2-gemma'], ['v2-dsx'], [FC], ['ctl-full-memoff'], ['ctl-slide6-memoff']].map(([c]) => c).filter((c) => lt[c]);
  const NM = { 'haiku-off': 'Haiku 5.5 끔', 'haiku-on': 'Haiku 5.5 켬', 'deepseek-on': '1차 DeepSeek 켬', 'v2-gemma': '개선판 · 추출 Gemma', 'v2-dsx': '개선판 · 추출 DeepSeek', [FC]: '최종', 'ctl-full-memoff': '대조군 · 대화 전체 전송', 'ctl-slide6-memoff': '대조군 · 최근 6턴만' };
  const tc = L120.turn_cost;
  return <>
    <Head t={`120턴 평균 ${won(COST.measured)}. 1원을 넘는 턴은 기억 정리가 같이 돈 턴`}>
      평가 대화 8개(120턴 × 캐릭터 4 × 2회, 960턴)의 모든 AI 호출을 합해 완료 턴으로 나눴다. 기억 추출, 대화 종료 정리, 재시도, 실패한 호출이 모두 들어 있다.
    </Head>
    <Kpis items={[
      { value: won(COST.measured), label: '턴당 평균', note: '비피크 시간 실측', tone: 'hl' },
      { value: won(COST.peak), label: '피크 단가로 다시 계산', note: '같은 토큰에 평일 낮 정가 적용' },
      { value: won(F.max_turn, 2), label: '가장 비싼 한 턴', note: `1원 넘은 턴 런당 ${F.over1_per_run}개, 모두 기억 정리 턴` },
      { value: won(F.total_krw / F.runs, 1), label: '120턴 대화 1개', note: `8개 합계 ${won(F.total_krw, 1)}` },
    ]} />

    {tc && <Sec t="6턴마다 튀는 곳이 기억 정리 턴이다" sub={`최종 구성 8런의 턴별 비용. 진한 선 = 평균, 옅은 선 = 8런 중 가장 비싼 값. 정리 턴(12, 18, 24 …턴)마다 추출 비용이 붙어 튄다. 대화를 끝낼 때의 호출(남은 대화 추출 + 요약, 런당 평균 ${won(L120.consolidate_per_run.mean, 2)})은 특정 턴에 속하지 않아 그림에는 없고, 턴당 평균에는 턴 수로 나눠 들어 있다.`}>
      <Line data={tc.map((d) => ({ x: d.turn, y: d.mean, y2: d.max }))} ymax={1.4} limit={{ v: 1, label: '1원' }} xlabel="턴" ylabel="턴별 AI 비용" fmt={(v) => `${v.toFixed(1)}원`} />
    </Sec>}

    <Sec t="구간별 비용과 가장 비싼 턴">
      <Table num head={['', '초반 1~40턴', '중반 41~80턴', '후반 81~120턴', '가장 비싼 턴', '1원 넘은 턴/런']} rows={[
        { hl: true, cells: ['최종', ...F.phases.map((x) => won(x)), won(F.max_turn, 2), F.over1_per_run] },
      ]} />
      <Note>대화 원문은 12턴 상한이라 늘지 않는다. 그래도 후반이 초반보다 비싸며, 그 이유는 따로 나눠 재지 않았다. 1원을 넘은 턴은 모두 기억 추출이 같이 돈 턴이다(실행 기록에서 확인). 정리 턴이 모두 1원을 넘지는 않는다.</Note>
    </Sec>

    <Sec t={`한 턴 비용의 ${Math.round((tg.response / tot) * 100)}%가 대화 응답이다`} sub="최종 구성 120턴의 호출 종류별 턴당 비용. 대화를 끝낼 때 남은 대화를 추출하는 비용은 ‘기억 추출’에 들어 있다.">
      <Stack fmt={(v) => won(v)} parts={[
        { label: '대화 응답', value: tg.response, tone: 'a' },
        { label: '기억 추출', value: tg.extract, tone: 'b' },
        { label: '대화 끝 요약', value: tg.consolidate ?? 0, tone: 'c' },
        { label: '임베딩(서버 안, API 비용 0)', value: tg.embed ?? 0, tone: 'd' },
      ]} />
    </Sec>

    <Sec t="다른 구성과 비교" sub="같은 120턴 대본 4개 × 2회. 비용은 판정이 없는 기계 측정이라 측정이 달라도 비교할 수 있다. 대조군은 기억을 끈 비교용이다.">
      <Bars rows={rows.map((c) => ({ label: NM[c], value: lt[c].cost.measured, hl: c === FC, muted: c.startsWith('ctl'), note: c === 'ctl-full-memoff' ? ' 길수록 오름' : undefined }))} max={1.1} fmt={(v) => won(v)} limit={{ v: 1, label: '1원 기준' }} />
      <More t="구성별 전체 비용 표">
        <Table num head={['구성', '대화 수', '완료 턴', '전체 AI 비용', '턴당', '초·중·후반', '최대 턴', '피크 단가', '캐시 0 + 피크']}
          rows={rows.map((c) => { const r = lt[c]; return { hl: c === FC, cells: [NM[c], r.runs, r.turns, won(r.total_krw, 1), won(r.cost.measured), r.phases.map((x) => x.toFixed(2)).join(' · '), won(r.max_turn, 2), won(r.cost.peak), won(r.cost.worst)] }; })} />
      </More>
    </Sec>

    <Sec t="계산 방법과 가격 기준">
      <p>턴 비용 = 그 턴의 모든 AI 호출(대화 응답, 기억 추출, 재시도, 실패한 시도)의 (캐시 안 된 입력 × 입력가 + 캐시 읽기 × 캐시가 + 출력 × 출력가) × 환율. 대화 종료 정리는 그 대화의 턴 수로 나눠 넣었다. 앱 DB의 호출 기록과 제공사 사용량을 대화마다 대조했고 모두 일치했다.</p>
      <Table head={['모델', '입력', '캐시 읽기', '출력', '출처']} rows={D.pricing.models.filter((m) => m.input != null).map((m) => [
        m.model, `$${m.input}${m.offpeak ? ` · 비피크 $${m.offpeak.input}` : ''}`, m.cached != null ? `$${m.cached}` : '–', `$${m.output}${m.offpeak ? ` · 비피크 $${m.offpeak.output}` : ''}`,
        <a key={m.model} href={m.source} target="_blank" rel="noreferrer">가격표</a>])} />
      <Note>단가는 100만 토큰당 USD. 기준일 {D.pricing.as_of}, 환율 {D.pricing.fx.toLocaleString()}원/$ 고정. DeepSeek은 평일 KST 10–13시·15–19시가 피크(정가)이고 그 밖은 절반이다.</Note>
    </Sec>

    <Sec t="자체 호스팅: 대화 모델은 API, 임베딩만 서버 안에서">
      <ul>
        <li>기억 검색용 임베딩(bge-m3, 파일 0.57GB)은 서버 CPU에서 돈다. 한 번에 걸리는 시간은 약 10ms지만 턴마다 여러 번(질문, 새 항목, 요약) 돌고 CPU 코어를 여러 개 써서, CPU 사용 시간으로는 턴당 약 220ms다. 여기에 2 vCPU 서버 단가(월 $24, vCPU 1초 0.0065원)를 곱하면 턴당 약 {EMB_CPU}원이다 <Tag k="e" />. 1원의 0.14%라 평균에는 넣지 않았다. 넣어도 {won(COST.measured)} → {won(COST.measured + EMB_CPU)}이다.</li>
        <li>모델을 메모리에 올려 두는 비용(서버 메모리 0.1 → 2.3GB <Tag k="m" />)은 AI 비용이 아니라 서버 운영비로 본다.</li>
        <li>대화 모델은 자체 호스팅하지 않는다. 자체 호스팅할 크기의 오픈 모델 하나(Gemma 4 26B)를 그대로 쓴 조건은 40턴 비교에서 기억·해로운 답 최하위였다 <Tag k="m" />. GPU 1장(시간당 $2~4, <a href="https://intuitionlabs.ai/articles/h100-rental-prices-cloud-comparison" target="_blank" rel="noreferrer">가격 비교</a>)이 API보다 싸려면 시간당 약 1만 턴이 꾸준히 들어와야 한다 <Tag k="e" />. GPU 처리량은 재지 않았다.</li>
      </ul>
    </Sec>

    <Sec t="AI 외 운영비는 턴당 약 0.11원으로 따로 본다" sub="1원 기준과 별도. 하루 1만 턴(월 30만 턴), 지금 구조(Next.js 서버 1대 + SQLite) 그대로라는 가정.">
      <Table head={['항목', '가정', '월 비용', '턴당']} rows={[
        ['앱 서버', '2 vCPU · 4GB 1대(임베딩 모델 상주 포함), AWS Lightsail 월 $24', '약 33,600원', <>약 0.11원 <Tag k="e" /></>],
        ['DB·저장소', '턴당 기록 약 5KB → 월 약 1.5GB, 서버 디스크 안', '서버에 포함', '–'],
        ['백업', '하루 1회 DB 파일을 객체 저장소로', '수백 원', '–'],
      ]} />
      <Note>서버 가격 출처: <a href="https://aws.amazon.com/lightsail/pricing/" target="_blank" rel="noreferrer">AWS Lightsail 가격표</a>(2026-10-31 조회).</Note>
    </Sec>

    <Sec t="1원보다 얼마나 더 낮출 수 있나는 재지 못했다">
      <p>기억 블록 크기, 대화 창 크기, 출력 길이를 하나씩 줄여 보는 측정을 계획했지만 최종 구성이 늦게 정해져 하지 못했다 <Tag k="u" />. 위 구성으로 보면 줄일 여지는 대화 응답({won(tg.response)})과 기억 추출({won(tg.extract)})에 있다. 기억을 끄고 최근 6턴만 보내면 {won(lt['ctl-slide6-memoff'].cost.measured)}이지만 기억 점수가 {pc(lt['ctl-slide6-memoff'].mem_pct)}로 떨어진다.</p>
    </Sec>
  </>;
}

// ================= 장기 기억 =================
function Memory() {
  return <>
    <Head t={`300턴 시험에서 기억 정답률 ${pc(m0.correct_pct)} → ${pc(m2.correct_pct)}`}>
      오래된 대화를 출처가 붙은 기억 항목으로 바꾸고, 항목과 사용자 원문을 모두 임베딩으로 색인한다. 매 턴 고정 블록에 더해 이번 말과 뜻이 가까운 기억을 찾아 넣는다. 사용자 사실은 모든 캐릭터가 공유하고, 약속과 사건은 그 캐릭터만 안다. 이 구조를 기억 v2, 글자 겹침으로 찾던 이전 구조를 기억 v1이라 부른다.
    </Head>
    <Kpis items={[
      { value: pc(m2.correct_pct), label: '300턴 기억 정답률', note: `대화 5번 · ${m2.n}문항 · 기억 v1 ${pc(m0.correct_pct)}`, tone: 'hl' },
      { value: pc(m2.far_pct), label: '100턴 이상 지난 정보', note: `기억 v1 ${pc(m0.far_pct)}` },
      { value: pc(m2.update_pct), label: '정정 문항 정답률', note: `값 수정·여러 번·일부·취소 · 기억 v1 ${pc(m0.update_pct)}` },
      { value: `${m2.counts.fabricated ?? 0}건`, label: '지어낸 답', note: `${m2.n}문항 중` },
    ]} />
    <Note>기억 처리 비용은 턴당 추출 {won(F.by_tag.extract)} + 대화 종료 정리 {won(F.by_tag.consolidate ?? 0)} + 임베딩 0원(서버 안)이고, 비용 탭의 턴당 평균 {won(COST.measured)}에 모두 들어 있다. <Src>{S.fin}</Src></Note>
    <MemoryPaths />

    <Sec t={`과제의 기억 요구 4가지 중 ${REQ.filter((r) => acc(m2.by_type, r.types) > acc(m0.by_type, r.types)).length}가지가 나아졌다`} sub="300턴 대본 4개 × 2회, 같은 대화 설정에서 기억만 바꿨다. Opus가 세 구성을 섞어 블라인드로 판정했다.">
      <Dots lo={0} hi={100} ticks={[0, 25, 50, 75, 100]} fmt={(v) => pc(v)} keys={[{ k: 'a', label: '기억 v1' }, { k: 'c', label: '최종(기억 v2)' }]}
        rows={[...REQ.map((r) => ({ label: r.short, points: [{ k: 'a', v: acc(m0.by_type, r.types) }, { k: 'c', v: acc(m2.by_type, r.types) }] })),
          { label: '100턴 이상 지난 정보', points: [{ k: 'a', v: m0.far_pct }, { k: 'c', v: m2.far_pct }] },
          { label: '전체 정답률', points: [{ k: 'a', v: m0.correct_pct }, { k: 'c', v: m2.correct_pct }] }]} />
      <Note>지어내지 않기는 둘 다 함정 문항을 모두 통과했다. 다만 다른 문항에서 지어낸 답은 기억 v1 {m0.counts.fabricated ?? 0}건, 최종 {m2.counts.fabricated ?? 0}건이다.</Note>
      <More t="300턴 세부: 기억 v2 첫 판과 결함 수정">
        <Table num head={['', ...Object.values(MB)]} rows={[
          ['100턴 이상 지난 정보', ...Object.keys(MB).map((k) => pc(M3[k].far_pct))],
          ['정정 문항(값 수정·여러 번·일부·취소)', ...Object.keys(MB).map((k) => pc(M3[k].update_pct))],
          ['가까운 정보', ...Object.keys(MB).map((k) => pc(M3[k].near_pct))],
          ['전체 정답률', ...Object.keys(MB).map((k) => pc(M3[k].correct_pct))],
          ['다른 캐릭터와의 약속 누출', ...Object.keys(MB).map((k) => `${M3[k].cross_char_promise.leak ?? 0}/${leakN(M3[k])}`)],
          ['지어낸 답', ...Object.keys(MB).map((k) => M3[k].counts.fabricated ?? 0)],
          ['턴당 AI 비용', ...Object.keys(MB).map((k) => won(M3.cost[k].measured))],
        ]} />
        <ul className="rp-note">
          <li>기억 v1은 오래돼 보관된 항목을 다시 찾지 않았고, 질문이 대체된 옛 항목과만 닮으면 최신 값을 못 찾았다. v2는 보관·대체 항목까지 검색해 최신 값을 잇는다.</li>
          <li>v2 첫 판은 수정 반영이 오히려 떨어졌다. 같은 대상인지 판단이 어긋나 옛 값과 새 값이 둘 다 남는 경로였다. 실패한 답을 기록에서 하나씩 추적해 결함 5건을 고친 것이 최종이다.</li>
          <li>기억 v1·v2 첫 판과 최종은 판정 묶음이 다르다. 같은 문항을 다시 판정했을 때 일치율은 95.6%였다.</li>
        </ul>
      </More>
    </Sec>

    <Sec t={`120턴에서도 요구별로 ${pc(Math.min(...REQ.map((r) => acc(FM.by_type, r.types))), 0)} 이상`} sub="최종 120턴. 개선판(기억 v1, 대화 따르기 끔)과 같은 판정 묶음에 섞어 매겼다. 값은 정답률이다(설계 구조 탭 이력 표의 ‘기억 점수’는 부분 정답·감점을 넣은 가중 점수라 다르다).">
      <Dots lo={0} hi={100} ticks={[0, 25, 50, 75, 100]} fmt={(v) => pc(v)} keys={[{ k: 'a', label: '개선판' }, { k: 'c', label: '최종' }]}
        rows={[...REQ.map((r) => ({ label: r.short, points: [{ k: 'a', v: acc(PM.by_type, r.types) }, { k: 'c', v: acc(FM.by_type, r.types) }] })),
          { label: '전체 정답률', points: [{ k: 'a', v: PM.correct_pct }, { k: 'c', v: FM.correct_pct }] }]} />
      <Note>가장 약한 유형은 돌려 묻기다({FM.by_type.implicit.correct}/{FM.by_type.implicit.n}). “루프탑 바 갈래?”에 고소공포증을 떠올려야 하는 문항으로, 질문과 기억이 뜻으로 이어지지 않아 검색에 잘 안 걸린다.</Note>
      <More t="120턴 유형별 표">
        <Table num head={['유형(문항 수)', '개선판', '최종']} rows={[
          ...Object.keys(TYPE).filter((t) => FM.by_type[t]).map((t) => [`${TYPE[t]} (${FM.by_type[t].n})`, PM.by_type[t]?.correct ?? '–', FM.by_type[t].correct]),
          ['옛 값을 말한 답', PM.counts.stale ?? 0, FM.counts.stale ?? 0],
          ['지어낸 답', PM.counts.fabricated ?? 0, FM.counts.fabricated ?? 0],
        ]} />
      </More>
    </Sec>

    <Sec t="통과 기준" sub="300턴은 재측정 전에 적어 둔 기준(docs/21 §9.8)이고, 기준점은 같은 대화 설정의 기억 v1이다.">
      <Table head={['기준', '결과', '판정']} rows={[
        ['100턴 이상 지난 정보: 기억 v1보다 3%p 넘게 떨어지지 않기', `${pc(m0.far_pct)} → ${pc(m2.far_pct)}`, <Verdict k={m2.far_pct >= m0.far_pct - 3 ? 'pass' : 'fail'} />],
        ['정정 문항: 기억 v1보다 3%p 넘게 떨어지지 않기', `${pc(m0.update_pct)} → ${pc(m2.update_pct)}`, <Verdict k={m2.update_pct >= m0.update_pct - 3 ? 'pass' : 'fail'} />],
        ['다른 캐릭터와의 약속 누출 0', `${m2.cross_char_promise.leak ?? 0}/${leakN(m2)}건`, <Verdict k={(m2.cross_char_promise.leak ?? 0) === 0 ? 'pass' : 'fail'} />],
        ['지어낸 답 5% 이하', `${m2.counts.fabricated ?? 0}/${m2.n} = ${pc((100 * (m2.counts.fabricated ?? 0)) / m2.n)}`, <Verdict k="pass" />],
        ['턴당 비용 1원 이하', won(M3.cost.mb2.measured), <Verdict k="pass" />],
      ]} />
      <Note>누출 2건은 다른 캐릭터와의 대화에서 사용자 발화를 원문 발췌로 끌어온 경로였다. 발췌를 지금 캐릭터와의 대화로 제한한 뒤 같은 300턴 대본에서 {M3.mb3_leak.items}문항 중 누출 {M3.mb3_leak.forbidden_keyword_hits}건이었다. 이 확인은 금지 낱말 검사와 원문 읽기로 했고 블라인드 판정은 아니다.</Note>
      {HP?.[FC] && <Note>120턴은 실측 전 설계 문서에 적어 둔 제안 기준(정보를 말한 지 21턴 이상 지난 문항 정답 70% 이상, 지어냄 5% 이하)에 사후로 대 보면 {pc(HP[FC].correct_pct)}, 지어냄 {HP[FC].fabricated}/{HP[FC].n}이다.</Note>}
    </Sec>

    <Sec t="무엇을 기억하나" sub="추출 규칙(memory/prompts.js)과 코드(memory/index.js · policy.js)에 적힌 그대로.">
      <Table head={['', '내용']} rows={[
        ['저장한다', '사용자 정보(이름·직업·사는 곳), 사소해 보여도 음식·음료 같은 선호, 사용자가 말한 가족·반려동물의 사실, 중요한 사건(시점은 코드가 날짜로 바꿈), 누가 하기로 했는지 분명한 약속, 내용을 밝히지 않은 고민(“말하지 않았다”는 사실만)'],
        ['저장하지 않는다', '“오늘 피곤해” 같은 일회성 상태, 캐릭터의 권유, 짐작한 정보, 이미 있는 내용, 기억을 묻는 질문'],
        ['한 항목', '문장 하나에 사실 하나, 45자 이내, 중요도 1~5, 출처(몇 번째 대화의 몇 턴), 임베딩'],
        ['범위', '사실·선호는 사용자 공유, 약속·사건·대화 요약은 그 캐릭터만'],
        ['상한', '사용자당 활성 항목 80개. 넘으면 오래 안 쓴 것부터 보관하고, 보관 항목도 검색 대상이라 다시 불리면 되살린다'],
        ['값이 바뀌면', '옛 항목을 지우지 않고 ‘대체됨’으로 둔다. 블록에는 지금 값만 넣는다'],
      ]} />
    </Sec>

    <Sec t="문항은 최근 대화만 읽어서는 풀 수 없게 만들었다">
      <Table head={['대본', '길이', '보는 것']} rows={[
        ['120턴', `12턴 장면 ${D.script_120.scenes.length}개를 이어 붙임 × 캐릭터 4`, `초반 정보를 최대 100턴 뒤에 묻는다. 대본당 문항 ${D.script_120.kinds.probe}개, 모두 13턴 이상 뒤`],
        ['300턴', '대화 5번(넷째는 다른 캐릭터) × 캐릭터 4', '100~250턴 뒤 되묻기, 두 번 바뀐 값, 보관 뒤 되살리기, 돌려 묻기, 다른 캐릭터와의 약속. 대본당 문항 57개'],
      ]} />
      <Note>각 정보는 한 번만 말한다. 정답 낱말이 최근 12턴이나 다른 사용자 말에 나오면 대본 점검 스크립트가 실패시킨다. 300턴에는 비교용으로 최근 대화 안의 문항도 들어 있다.</Note>
    </Sec>

    <Sec t="실제 사례" sub="최종 120턴의 실제 답을 요구별로 성공 2개, 실패 1개씩 골랐다. 정답 키워드는 대본에 미리 적은 기대 응답이고, 답은 모델 출력 그대로다. 판정은 물은 정보를 맞혔는지만 보므로, 성공 사례에도 대본에 없는 말을 덧붙이거나(예: 강백호 ‘귤 농사’) 다른 언어 글자가 섞인 답이 있다.">
      <Cases />
    </Sec>
  </>;
}

const srcTurn = (e) => (e.gap != null ? e.turn - e.gap : null);
function Cases() {
  return <>{D.examples.map((g) => (
    <More key={g.req} t={g.req} open={g.req.startsWith('①')}>
      {[...g.success.map((e) => ['성공', e]), ...g.failure.map((e) => ['실패', e])].map(([kind, e], i) => {
        const s = srcTurn(e), keys = [...(e.expect ?? []), ...(e.stale ?? [])].filter((k) => k.length >= 2);
        const keep = (c) => (s != null && c.startsWith(`${s}:`)) || keys.some((k) => c.includes(k));
        const src = e.context.filter(keep);
        return <div key={i} className={`rp-case ${kind === '성공' ? 'ok' : 'ng'}`}>
          <div className="h"><b>{kind}</b> · {who(e.scenario)} · {TYPE[e.type]} · {e.turn}턴에 물음</div>
          {!!src.length && <div className="ctx"><span>앞서 한 말</span>{src.map((c, j) => <div key={j}>{c}</div>)}</div>}
          <div><span>질문</span>{e.question}</div>
          <div className="a"><span>실제 답</span>{e.reply}</div>
          <div><span>판정</span><b>{LABEL[e.label]}</b>. {e.why}</div>
          <div className="exp"><span>정답 키워드</span>{e.expect?.join(' / ') || '–'}{e.stale?.length ? ` · 옛 값: ${e.stale.join(' / ')}` : ''}</div>
        </div>;
      })}
      {!g.failure.length && <Note>이 요구는 실패 사례가 없다.</Note>}
    </More>
  ))}</>;
}

// ================= 테스트 및 검증 =================
function Test() {
  const dx = D.dialogue_examples;
  return <>
    <Head t="고정 대본을 앱 API로 그대로 보내고, 답은 Opus가 구성을 가린 채 채점했다">
      모든 구성에 같은 사용자 말을 보냈다. 비용은 호출 장부에서 기계로 쟀고, 기억과 품질은 Opus가 어느 구성의 답인지 모르는 상태로 매겼다. 사람 판정은 없다.
    </Head>
    <Pipeline />

    <Sec t="대화 길이와 사례 수를 정한 기준">
      <ul>
        <li>120턴과 캐릭터 4개는 직접 정했다. 왜 100이나 200이 아니라 120인지 따로 적은 근거는 기록에 없다.</li>
        <li>구조상 이유: 대화 창이 최대 12턴이라 문항은 13턴 이상 떨어져야 최근 대화만으로 못 푼다. 그래서 12턴 장면 10개를 이어 붙여 초반 정보를 최대 100턴 뒤에 묻는다. 캐릭터 4개는 앱에 있는 캐릭터 전부이고, 네 캐릭터 모두 같은 턴에 같은 역할의 문항을 둬 같은 축으로 비교한다.</li>
        <li>300턴은 기억이 많이 쌓였을 때(보관 상한 80개를 넘을 때)를 보려고 기억 재설계와 함께 만들었다. 대본마다 2회 돌려 같은 대본의 흔들림을 본다.</li>
      </ul>
    </Sec>

    <Sec t="측정 목록" sub="이 리포트의 숫자는 아래 여섯 측정에서 나온다. 숫자 옆 회색 꼬리표가 이 이름이다.">
      <Table head={['측정', '대본과 규모', '비교한 구성', '판정', '쓰는 곳']} rows={[
        [<Src>{S.pick}</Src>, '120턴 × 캐릭터 4 × 2회', '대화 모델 후보 3 + 기억 끈 대조군 2', '기억·품질 Opus, 묶음 A', '설계 구조(모델 선정), 비용 비교'],
        [<Src>{S.v2}</Src>, '같은 대본', '개선판 2 + 1차 다시 판정', '기억·품질 Opus, 묶음 B', '설계 구조(추출 모델·이력)'],
        [<Src>{S.fin}</Src>, '같은 대본, 8런 960턴', '최종 구성', '기억 Opus, 묶음 C(개선판과 섞음)', '요약, 비용, 120턴 기억'],
        [<Src>{S.q}</Src>, '같은 대본, 8런', '최종 직전 판(대화 코드 같음, 기억 블록만 800토큰)', '품질 Opus(1차·개선판과 섞음)', '품질 점수, 대화 예제'],
        [<Src>{S.m300}</Src>, '300턴 × 캐릭터 4 × 2회, 구성당 2,400턴', '기억 v1 / v2 첫 판 / v2 최종', '기억 Opus(섞음)', '장기 기억'],
        [<Src>{S.fol}</Src>, '12·20·8턴 대본 × 캐릭터 4 × 2회, 구성당 320턴', '대화 따르기 끔 / 켬', 'Opus 예·아니오', '대화 따르기'],
      ]} />
      <Note>최종 120턴에서는 품질 판정을 따로 하지 않았다. 품질 점수는 대화 코드가 같은 ‘품질 판정용 120턴’의 값이다. 이 측정은 기억 블록이 800토큰이라 기억이 관련된 장면에서는 최종과 다를 수 있다.</Note>
    </Sec>

    <Sec t="롤플레잉 품질: 이어 가기가 가장 크게 올랐다" sub="120턴 기록에서 같은 장면 80개를 뽑아 세 구성의 답을 한 묶음에 섞어 1~5점으로 매겼다.">
      <Dots lo={1} hi={5} ticks={[1, 2, 3, 4, 5]} keys={[{ k: 'a', label: '1차' }, { k: 'b', label: '개선판' }, { k: 'c', label: '최종' }]}
        rows={QK.map(([k, l]) => ({ label: l, points: [{ k: 'a', v: Q['deepseek-on'][k] }, { k: 'b', v: Q['v2-dsx'][k] }, { k: 'c', v: Q[FC][k] }] }))} />
      <Note>최종은 개선판보다 이어 가기({Q['v2-dsx'].engagement.toFixed(2)} → {Q[FC].engagement.toFixed(2)})가 오르고 맥락({Q['v2-dsx'].context.toFixed(2)} → {Q[FC].context.toFixed(2)})은 내려갔다. <Src>{S.q}</Src></Note>
      <More t="채점 기준표(1~5점)">
        <Table head={['항목', '보는 것']} rows={[
          ['캐릭터 유지', '설정·말투·세계 유지. 메타 발언은 낮게'],
          ['맥락', '직전 말과 상황에 맞음, 모순 없음'],
          ['이어 가기', '대화를 자연스럽게 이어 감, 짧은 말에도 반응, 새 주제를 받음'],
          ['사용자 결정 존중', '사용자의 감정·행동·생각을 단정하지 않음. 요청받은 제안은 괜찮음'],
          ['전반', '계속 대화하고 싶은 쪽'],
          ['점수', '5 흠 없음 · 4 사소한 흠 1개 · 3 눈에 띄는 흠 · 2 여러 번 크게 어긋남 · 1 축 실패(예: AI라고 인정). 길이는 기준이 아니다'],
        ]} />
        <Note>기준표 원문: model/bench/out/opus-qlt1-work/rubric.md</Note>
      </More>
    </Sec>

    <Sec t="대화 따르기: 미리 정한 기준을 모두 넘었다" sub="데모에서 ‘영어로 말해 줘’를 무시하고 단답으로 끝나는 대화가 보여 그 상황만 보는 대본을 따로 만들었다. 기준은 돌리기 전에 정했다(docs/50).">
      <Table head={['', '따르기 끔', '최종(켬)', '미리 정한 기준', '판정']} rows={[
        ['사용자 말에 직접 답함', pc(FL.cur.direct.pct), pc(FL.follow.direct.pct), '끔보다 높게', <Verdict k="pass" />],
        ['사용자가 쓴 언어로 답함(다른 언어 턴 96개)', '65.6%', '100%', '90% 이상', <Verdict k="pass" />],
        ['답 뒤에 이어 말하기 쉬움', pc(FL.cur.cont.pct), pc(FL.follow.cont.pct), '끔보다 높게', <Verdict k="pass" />],
        ['질문이 부담스러움', pc(FL.cur.qpress.pct), pc(FL.follow.qpress.pct), '5% 이하', <Verdict k="pass" />],
        ['사용자에게 묻는 문장 2개 이상', pc(FL.cur.nq2.pct), pc(FL.follow.nq2.pct), '끔 + 5%p 이하', <Verdict k="pass" />],
        ['캐릭터 이탈', FL.cur.break.yes, FL.follow.break.yes, '끔 이하', <Verdict k="pass" />],
      ]} />
      <Note>바꾼 것: 사용자 말에 먼저 답하고 사용자 화제를 잇는다. 답 언어는 코드가 정해 “(이번 답 언어: …)” 한 줄로 알린다. 직전 답이 물음표로 끝났으면 이번 답은 질문 없이 끝내게 한다. 질문을 막지 않던 시험에서는 이어 말하기 쉬움이 83.8%였지만 질문이 부담스러운 답이 14.4%라 지금처럼 바꿨다.</Note>
    </Sec>

    {dx?.scenes?.length && <Sec t="실제 대화 예제" sub="사용자 말은 우리가 쓴 고정 대본, 캐릭터 답은 모델 출력 그대로다. 고른 규칙(미리 정함): 캐릭터마다 13~24턴 장면 하나 + 전반 점수 최고·최저 장면 하나씩.">
      {dx.scenes.map((sc, i) => <More key={i} open={i === 0} t={`${{ rule: '규칙', best: '최고점', worst: '최저점' }[sc.pick] ?? sc.pick} · ${who(sc.scenario)} · ${sc.situation ?? sc.segment} · 전반 ${sc.scores.overall}점`}>
        {sc.judge_note && <Note>판정 메모: {sc.judge_note}</Note>}
        {sc.turns.map((t) => <div key={t.turn} className="rp-turn"><em>{t.turn}턴</em><div className="u"><span>대본</span>{t.user}</div><div className="c"><span>모델 출력</span>{t.assistant}</div></div>)}
      </More>)}
      <Note>{dx.cond === FC ? '품질 판정용 120턴(최종과 대화 코드 같음, 기억 블록만 800토큰)의 기록이다. 장면 점수가 있어야 해서 이 측정에서 골랐다.' : '개선판 기록이다.'}</Note>
    </Sec>}

    <Sec t="직접 재현하려면">
      <Table head={['무엇', '위치']} rows={[
        ['시험 대본(사용자 말·문항·정답 키워드)', <code key="a">model/bench/scenarios/*.json</code>],
        ['실행기(앱 API로 대본을 보내고 장부 대조)', <code key="b">model/bench/run.mjs</code>],
        ['키워드 채점', <code key="c">model/bench/score.js</code>],
        ['블라인드 판정 묶음 만들기', <code key="d">model/bench/pair-blind.mjs</code>],
        ['사전 등록과 결과 기록', <code key="e">docs/50-decision-log.md</code>, ],
        ['리포트 숫자 생성', <code key="f">model/bench/report-data.mjs</code>],
      ]} />
    </Sec>
  </>;
}

// ================= 한계/다음 =================
function Next() {
  return <>
    <Head t="확인한 것은 비용·기억·규칙 준수까지. 재미는 아직 모른다">
      모든 품질 수치는 고정 대본에 대한 AI 판정이다. 사용자가 계속 대화하고 싶어 하는지는 실제 사용자로 확인해야 한다.
    </Head>
    <Sec t="확인한 것과 확인하지 않은 것">
      <Table head={['', '내용', '근거 또는 확인 방법']} rows={[
        [<Tag key="1" k="m" />, `턴당 평균 ${won(COST.measured)}, 1원 넘은 턴 런당 ${F.over1_per_run}개`, '120턴 8런, 앱 기록과 제공사 장부 대조'],
        [<Tag key="2" k="m" />, `300턴 기억 정답률 ${pc(m2.correct_pct)}, 지어낸 답 ${m2.counts.fabricated ?? 0}건`, 'Opus 블라인드 판정, 함정 문항 포함'],
        [<Tag key="3" k="m" />, `사용자 말에 먼저 답함 ${pc(FL.follow.direct.pct)}, 사용자 언어로 답함 100%`, '대화 따르기 대본 320턴, Opus 블라인드'],
        [<Tag key="4" k="e" />, `피크 단가 ${won(COST.peak)}, 캐시가 하나도 안 맞으면 ${won(COST.worst)}`, '기록된 토큰을 피크·정가로 다시 계산. 피크 시간에 직접 돌리지는 않았다'],
        [<Tag key="5" k="e" />, `임베딩 CPU 비용 턴당 약 ${EMB_CPU}원`, '기록된 임베딩 시간 × CPU 비율 × 서버 단가'],
        [<Tag key="6" k="u" />, '실제 사용자가 계속 대화하고 싶어 한다', '소규모 A/B: 세션당 턴 수, 다음 날 재방문율'],
        [<Tag key="7" k="u" />, 'AI 판정이 사람 판단과 같다', '사람 블라인드 판정으로 맞춰 보기'],
        [<Tag key="8" k="u" />, '300턴보다 긴 대화, 수십 번의 재방문, 한국어 외 언어의 기억', '같은 방식의 긴 대본·다국어 대본'],
        [<Tag key="9" k="u" />, '1원보다 더 낮출 수 있는 정도', '기억 블록·창 크기·출력 길이를 하나씩 줄여 보기'],
      ]} />
    </Sec>

    <Sec t="비용을 낮추면서 지킨 것과 양보한 것 (과제 질문 2)">
      <div className="rp-two">
        <div><h4>지킨 것</h4><ul>
          <li>턴당 {won(COST.measured)}, 피크 단가로도 {won(COST.peak)}</li>
          <li>300턴에서 지어낸 답 {m2.counts.fabricated ?? 0}/{m2.n}, 수정 반영 {pc(m2.update_pct)}</li>
          <li>캐릭터 유지 {Q[FC].character.toFixed(2)}, 사용자 결정 존중 {Q[FC].user_agency.toFixed(2)} (1~5)</li>
          <li>사용자가 쓴 언어로 답하기 100%</li>
        </ul></div>
        <div><h4>양보한 것</h4><ul>
          <li>대화 원문을 모두 보내는 방식보다 기억이 약하다(모델 고르기 120턴 {pc(lt['ctl-full-memoff'].mem_pct)}). 대신 비용에 상한이 있다</li>
          <li>돌려 묻는 문항 {FM.by_type.implicit.correct}/{FM.by_type.implicit.n}</li>
          <li>턴당 비용이 개선판보다 {won(L120.cost['v2-dsx'].measured)} → {won(COST.measured)}로 올랐다</li>
          <li>맥락 점수 {Q['v2-dsx'].context.toFixed(2)} → {Q[FC].context.toFixed(2)}. 질문 연속을 막아 ‘답 뒤에 이어 말하기 쉬움’은 막기 전 시험(83.8%)보다 낮은 {pc(FL.follow.cont.pct)}</li>
        </ul></div>
      </div>
    </Sec>

    <Sec t="대화가 길어지거나 쓰는 방식이 달라지면 생기는 문제 (과제 질문 3)">
      <ul>
        <li>기억이 많아지면 블록에 다 못 들어간다. 300턴이면 2,000토큰 블록에서도 항목 34~43개가 빠지고 <Tag k="e" />, 이 항목들은 이번 말과 뜻이 가까울 때만 보충으로 들어온다. 돌려 묻는 질문은 놓칠 수 있다.</li>
        <li>활성 항목 상한 80개라 보관과 되살리기가 오간다(300턴 8런 합 보관 495, 되살리기 264 <Tag k="m" />). 수천 턴은 재지 않았다.</li>
        <li>대화 사이 공백이 길면 캐시가 비어 최악 {won(COST.worst)} <Tag k="e" />. 평일 낮에 몰리면 DeepSeek 피크 단가(비피크의 2배)가 적용된다.</li>
        <li>임베딩 모델이 서버 프로세스마다 약 2.2GB를 차지한다 <Tag k="m" />. 서버를 늘리면 대수만큼 든다.</li>
        <li>사용자가 아주 빠르게 연달아 보내면, 앞 턴의 기억 정리가 끝날 때까지 다음 답이 기다린다.</li>
        <li>답 언어는 따라가지만, 되묻기와 시간 표현 감지는 한국어 규칙이라 다른 언어의 기억 동작은 재지 않았다 <Tag k="u" />.</li>
      </ul>
    </Sec>

    <Sec t="사용자가 계속 대화하고 싶어 하는지 가장 먼저 확인할 실험 (과제 질문 4)">
      <ol>
        <li>신규 사용자를 무작위로 두 설정에 나누는 소규모 A/B. 주 지표는 세션당 턴 수와 다음 날 재방문율, 보조 지표는 대화를 그만둔 턴 직전의 답과 좋아요·싫어요.</li>
        <li>“이거 말했잖아” 신고 버튼으로 실제 대화에서 기억이 틀리는 빈도를 잰다.</li>
        <li>그 전에 비용 없이: Opus가 판정한 장면 일부를 사람이 블라인드로 다시 매겨 AI 판정이 사람과 얼마나 맞는지 본다.</li>
      </ol>
    </Sec>

    <Sec t="이번 검증의 한계">
      <ul>
        <li>시험 문항과 정답 기준은 우리가 만들었다. 120턴 판정의 이어 가기 점수는 높았지만 실제 데모에서는 영어 요청을 무시하고 단답으로 끝나는 대화가 보였다. 대화 따르기 대본은 그래서 만들었다.</li>
        <li>판정은 Opus 하나이고 사람 판정은 없다. 기억 판정은 물은 정보를 맞혔는지만 봐서, 정답 처리된 답에도 대본에 없는 말을 덧붙이거나 다른 언어 글자가 섞인 경우가 있다.</li>
        <li>대사 길이 규칙(2~4문장)은 개선판에서 기억 블록 변경과 함께 바꿔 효과를 따로 재지 않았다.</li>
        <li>같은 대본의 실패 기록을 보고 고치고 같은 대본으로 다시 쟀다(개선판 설정, 기억 v2 결함 수정). 효과가 부풀려졌을 수 있다.</li>
        <li>기억 v2 첫 설계에서 블록을 800토큰으로 줄였다가 120턴에서 돌려 묻기가 37/40 → 18/40으로 떨어져 2,000토큰으로 되돌렸다.</li>
        <li>최종 구성은 대사가 더 길다(평균 {F.reply_len}자, 개선판 {lt['v2-dsx'].reply_len}자). 판정이 긴 답을 편들 수 있는데, 길이를 통제한 분석은 개선판 때만 했다.</li>
        <li>기억 추출이 API 오류나 형식 오류로 실패해도 대화 창은 다음으로 넘어가, 그 6턴은 기억에 남지 않는다(코드 확인, 측정에서 추출 실패는 0건).</li>
        <li>다른 캐릭터와의 약속 누출 0건(마지막 수정 뒤)은 블라인드 판정이 아니다.</li>
        <li>측정은 DeepSeek 비피크 시간에 돌았다. 피크 비용은 기록된 토큰으로 다시 계산한 값이다.</li>
      </ul>
    </Sec>
  </>;
}

export const VIEWS = { overview: Overview, arch: Arch, cost: Cost, memory: Memory, test: Test, next: Next, run: Run };
