// 과제 리포트 탭 내용(page.js 탭 화면, all/page.js 전체 보기가 같이 쓴다). 숫자는 data.json(model/bench/report-data.mjs 가 벤치 결과에서 생성)에서만 읽는다.
// 읽는 순서(docs/50 2026-11-01 시각화 리뷰): 탭마다 ① 한눈에(결론) ② 핵심 그림·숫자 ③ 자세한 표·근거는 접기.
import D from './data.json';
import { Architecture, TurnFlow, PromptLayers, MemoryModel, CharacterKeep } from './diagrams.js';
import { won, pc, wl, Tag, Table, Stat, Sec, Tldr, More, HBars, Split, tagText, Badges } from './ui.js';

export const TABS = [
  ['overview', '요약'],
  ['arch', '설계 구조'],
  ['cost', '비용'],
  ['memory', '장기 기억'],
  ['test', '테스트 및 검증'],
  ['next', '한계/다음'],
];
// 예전 탭 주소(#design 등)로 들어와도 옮겨 간 탭을 연다
export const ALIAS = { design: 'cost', select: 'arch', qa: 'arch', cases: 'memory', repro: 'arch', api: 'arch' };
const NAME = {
  'deepseek-on': 'DeepSeek Flash 추론 켬', 'deepseek-off': 'DeepSeek Flash 추론 끔', 'haiku-off': 'Claude Haiku 5.5 추론 끔', 'haiku-on': 'Claude Haiku 5.5 추론 켬',
  'luna-off': 'GPT-6 Luna 추론 끔', 'luna-on': 'GPT-6 Luna 추론 켬', 'gemma26-off': 'Gemma 4 26B 추론 끔',
  'v2-gemma': '개선판 (추출 Gemma)', 'v2-dsx': '개선판 (추출 DeepSeek)', 'v2-dsx-follow': '최종 (기억 v2 + 대화 따르기)',
  'ctl-full-memoff': '대조군: 대화 전체 전송', 'ctl-slide6-memoff': '대조군: 최근 6턴만',
};
const TYPE = {
  fact: '사실', pref: '선호', implicit: '암묵 적용(제약 반영)', combine: '두 사실 조합', event: '사건·일정', user_promise: '사용자 약속', char_promise: '캐릭터 약속',
  relative_time: '상대 날짜 계산', update: '값 수정', partial_update: '일부 수정', multi_update: '여러 번 수정', retract: '취소·철회', distractor: '헷갈리는 비슷한 정보',
  abstain: '말한 적 없는 것(함정)', half_said: '말하다 만 것(함정)',
};
const LABEL = { correct: '정답', partial: '부분', unknown: '모름', stale: '옛 값', wrong: '틀림', fabricated: '지어냄' };
const BLOCK = { in_block: '기억 블록에 있었음', dropped: '예산 때문에 블록에서 빠짐', not_in_block: '블록에 없음', not_stored: '저장 안 됨' };
const lt = Object.fromEntries(D.lt.map((r) => [r.cond, r]));
const ADOPT = D.adopted ?? 'deepseek-on';
const DS = lt[ADOPT];
const BASE = lt['deepseek-on'];
const isNew = ADOPT !== 'deepseek-on';
const PICK1 = 'deepseek-on'; // 1단계(lt1 120턴)에서 고른 대화 모델. lt1 표·그림은 이것을 강조한다
const CANDS = ['haiku-off', 'haiku-on', 'deepseek-on']; // 1차 120턴(lt1) 후보 — 기억·품질 점수는 lt1 판정 회차
const V2S = ['deepseek-on', 'v2-gemma', 'v2-dsx'].filter((c) => lt[c]?.mem2_pct != null); // 재측정(lt2): 같은 판정 회차에서 deepseek-on 을 다시 판정
const COSTC = [...CANDS, 'v2-gemma', 'v2-dsx', 'v2-dsx-follow'].filter((c) => lt[c]);
const hb = (cs, f) => cs.filter((c) => lt[c]).map((c) => ({ l: NAME[c], v: f(lt[c]), hl: c === PICK1, dim: c.startsWith('ctl'), tag: c.startsWith('ctl') ? '비교용·기억 끔' : undefined }));
const CHAR = D.char_names ?? {};
const DT = D.date_test && Object.fromEntries(D.date_test.map((r) => [r.k, r])); // 오늘 날짜 넣기 시험(docs/50 2026-11-01)
// 최종 구성(기억 v2 + 대화 따르기) 결과: data.json final(과제메인 생성). 300턴 = 기억 v1(mb0) → v2(mb1) → v2 결함 수정(mb2), 대화 설정 동일.
const FIN = D.final;
const FC = FIN?.final_cond ?? 'v2-dsx-follow';
const M3 = FIN?.mem300;
const L120 = FIN?.lt120;
// 120턴 품질: 최종(lt8)은 품질 판정을 생략하고 대화 코드가 같은 lt7 판정값을 쓴다(과제메인). 비교 구성 값은 final.lt120.quality 에 있을 때만.
const QF = { ...(L120?.quality ?? {}), ...(lt[FC]?.quality?.mean ? { [FC]: lt[FC].quality.mean } : {}) };
const QNOTE = '최종 구성의 품질은 대화 코드가 같은 앞선 측정(lt7, 기억 블록만 800토큰)의 판정값이다 — 최종 측정(lt8)에서는 품질 판정을 생략했다.';
const MB = [['mb0', '기억 v1'], ['mb1', '기억 v2'], ['mb2', '기억 v2 + 결함 수정(최종)']];
const sumN = (bt, ks) => ks.reduce((s, k) => s + (bt?.[k]?.n ?? 0), 0);
const who = (sc) => CHAR[sc.replace(/-120$/, '')] ?? sc.replace(/-120$/, '');

// 개선판 재측정(lt2): 같은 판정 회차 안에서만 비교한다(회차가 다르면 같은 런도 점수가 약 3%p 다르게 나옴)
function Remeasure({ full }) {
  if (!V2S.length) return null;
  const R = Object.fromEntries(V2S.map((c) => [c, lt[c]]));
  const b = R['deepseek-on'];
  return <>
    <div className="rp-cols">
      <div><b>장기 기억 점수</b><HBars rows={V2S.map((c) => ({ l: c === 'deepseek-on' ? '개선 전' : NAME[c], v: R[c].mem2_pct, hl: c === ADOPT }))} max={100} fmt={(v) => `${v.toFixed(1)}%`} /></div>
      <div><b>대화 품질 전반(1~5)</b><HBars rows={V2S.map((c) => ({ l: c === 'deepseek-on' ? '개선 전' : NAME[c], v: R[c].quality2.mean.overall, hl: c === ADOPT }))} max={5} fmt={(v) => v.toFixed(2)} /></div>
    </div>
    <div className="rp-cols">
      <div><b>턴당 AI 비용</b><HBars rows={V2S.map((c) => ({ l: c === 'deepseek-on' ? '개선 전' : NAME[c], v: R[c].cost.measured, hl: c === ADOPT }))} max={1.1} fmt={(v) => won(v)} line={{ v: 1, l: '1원 기준' }} /></div>
      <div><b>1원을 넘은 턴(런당)</b><HBars rows={V2S.map((c) => ({ l: c === 'deepseek-on' ? '개선 전' : NAME[c], v: R[c].over1_per_run, hl: c === ADOPT }))} max={22} fmt={(v) => `${v}턴 / 120`} /></div>
    </div>
    {full && <>
      <Table num head={['', '개선 전', ...V2S.slice(1).map((c) => NAME[c])]} rows={[
        ['기억: 개선 전 대비 같은 문항 나음:못함', '기준', ...V2S.slice(1).map((c) => wl(R[c].mem2_vs))],
        ['정답·부분·모름·옛값·틀림·지어냄', ...V2S.map((c) => ['correct', 'partial', 'unknown', 'stale', 'wrong', 'fabricated'].map((k) => R[c].counts2[k]).join(' · '))],
        ['품질: 개선 전 대비 같은 장면 높음:낮음', '기준', ...V2S.slice(1).map((c) => wl(R[c].quality2.vs?.overall))],
        ['이어 가기(1~5)', ...V2S.map((c) => R[c].quality2.mean.engagement.toFixed(2))],
        ['대사 평균 길이', ...V2S.map((c) => `${R[c].reply_len}자`)],
        ['가장 비싼 턴', ...V2S.map((c) => won(R[c].max_turn, 2))],
        ['평일 피크 단가 / 최악', ...V2S.map((c) => `${won(R[c].cost.peak)} / ${won(R[c].cost.worst)}`)],
      ]} />
      <ul className="rp-note">
        <li>개선 전 = 1차 120턴의 DeepSeek Flash 추론 켬 8런을 <b>같은 판정 회차에서 다시 채점</b>한 값(1차 판정 {pc(b.mem_pct)} → 이번 {pc(b.mem2_pct)}, 판정 회차 차이).</li>
        <li>길이 효과: 개선판 대사가 길어(63 → {R['v2-dsx']?.reply_len}자) 판정이 긴 답을 편들 수 있다. 길이를 통제한 회귀에서도 전반 점수 차이가 남았다(추출 DeepSeek {D.lt2_length?.[0]}, 추출 Gemma {D.lt2_length?.[1]}).</li>
        <li>약해진 곳: 값이 바뀐 정보에서 <b>옛 값을 말한 답</b>이 늘었다(개선 전 {b.counts2.stale} → {V2S.slice(1).map((c) => `${R[c].counts2.stale}`).join(' · ')}). 블록이 커져 옛 맥락 항목이 같이 들어가는 것으로 보이며 원인은 확인 중이다 <Tag k="u" />.</li>
      </ul>
    </>}
  </>;
}

function Overview() {
  const FCOST = L120?.cost?.[FC], FR = lt[FC]; // FR = 최종 구성의 120턴 전체 레코드(과제메인이 넣으면 구간·최대 턴까지)
  const m2 = M3?.mb2, m0 = M3?.mb0, FM = L120?.memory?.[FC], PM = L120?.memory?.['v2-dsx'], FQ = QF[FC], PQ = QF['v2-dsx'];
  const FL = FIN?.follow;
  return <>
    <Tldr><ul>
      <li><b>무엇</b>: 1턴 평균 AI 비용 1원 이하로 동작하는 캐릭터 채팅. 대화는 API 모델 하나, 오래된 대화는 원문 대신 작은 <b>기억 항목</b>으로 넘기고, 필요한 기억은 서버 안 임베딩으로 찾아 넣는다.</li>
      {FCOST && <li><b>비용</b>: 120턴 대화에서 턴당 <b>{won(FCOST.measured)}</b>(평일 낮 피크 단가로 다시 계산하면 {won(FCOST.peak)}) <Tag k="m" />.</li>}
      {m2 && <li><b>장기 기억</b>: 300턴 대화에서 정답률 <b>{pc(m2.correct_pct)}</b> — 100턴 넘게 떨어진 정보 {pc(m2.far_pct)}, 바뀐 정보 반영 {pc(m2.update_pct)}, 지어낸 기억 {m2.counts.fabricated ?? 0}/{m2.n} <Tag k="m" />.</li>}
      {FL && <li><b>대화</b>: 사용자 말에 먼저 답한 비율 {pc(FL.cur.direct.pct)} → <b>{pc(FL.follow.direct.pct)}</b>, 사용자가 쓴 언어로 답한 비율 65.6% → <b>100%</b> (대화 따르기 대본, Opus 블라인드) <Tag k="m" />.</li>}
      <li><b>세 단계로 정했다</b>: ① 대화 모델 고르기(DeepSeek Flash 추론 켬) → ② 기억 블록을 키우고 답을 조금 길게 한 개선판 → ③ <b>최종</b>: 기억을 임베딩 검색·캐릭터별 범위로 다시 설계(기억 v2) + 사용자 말에 먼저 답하고 사용자 언어로 답하게(대화 따르기).</li>
      {FM && PM && <li><b>양보한 것</b>: 120턴 기억 점수는 ②의 개선판보다 낮다({pc(PM.score_pct)} → {pc(FM.score_pct)}, 돌려 묻는 문항). 대화 원문을 전부 보내는 방식보다도 기억이 약하지만, 비용에 상한이 있다.</li>}
      <li><b>어떻게 확인했나</b>: 같은 고정 대본을 넣고 답을 Opus 가 블라인드로 채점했다(→ 테스트 및 검증). 사람 판정과 실제 사용자 실험은 하지 않았다.</li>
    </ul><Badges /></Tldr>
    <div className="rp-stats">
      {FCOST && <Stat good v={won(FCOST.measured)} l="턴당 평균 AI 비용" t="m" s={`120턴 대본 8런 · 1원의 ${Math.round(FCOST.measured * 100)}% · 평일 피크 단가 ${won(FCOST.peak)}`} />}
      {FR && <Stat v={won(FR.max_turn, 2)} l="가장 비싼 한 턴" t="m" s={`1원을 넘은 턴은 120턴 중 ${FR.over1_per_run}턴(기억 정리 턴). 과제 기준은 평균`} />}
      {m2 && <Stat good v={pc(m2.correct_pct)} l="300턴 장기 기억 정답률" t="m" s={`블라인드 채점 · 문항 ${m2.n}개 · 기억 v1 ${pc(m0.correct_pct)}`} />}
      {m2 && <Stat good v={`${m2.counts.fabricated ?? 0}건`} l="지어낸 기억(300턴)" t="m" s="말한 적 없는 것을 묻는 함정 문항 포함" />}
    </div>
    <Sec t="① 대화 모델 고르기: DeepSeek Flash 추론 켬이 기억·비용 1위" sub="120턴 대본 4개 × 2회, 같은 기억 구조(v1)에서 대화 모델만 바꿨다. 파란 막대 = 고른 대화 모델, 회색 = 기억을 끈 비교용 구성(채택 후보 아님).">
      <div className="rp-cols">
        <div><b>장기 기억 점수</b><HBars rows={hb([...CANDS, 'ctl-full-memoff', 'ctl-slide6-memoff'], (r) => r.mem_pct)} max={100} fmt={(v) => `${v.toFixed(1)}%`} /></div>
        <div><b>턴당 AI 비용</b> <span className="rp-note">(실측 평균)</span><HBars rows={[...CANDS, 'ctl-full-memoff', 'ctl-slide6-memoff'].filter((c) => lt[c]).map((c) => ({ l: NAME[c], v: lt[c].cost.measured, hl: c === PICK1, dim: c.startsWith('ctl'), tag: c === 'ctl-full-memoff' ? '길수록 오름' : undefined }))} max={1.1} fmt={(v) => won(v)} line={{ v: 1, l: '1원 기준' }} /></div>
      </div>
      <p className="rp-note"><b>왜 “대화 전체 전송”을 고르지 않았나</b>: 기억은 가장 좋지만 보내는 대화가 턴마다 길어져 비용이 구간마다 {lt['ctl-full-memoff'].phases.map((x) => x.toFixed(2)).join(' → ')}원으로 오르고, 캐시가 안 맞으면 {won(lt['ctl-full-memoff'].cost.worst)}이다. 제안 구성은 대화 길이와 상관없이 입력에 상한이 있다.</p>
    </Sec>
    {V2S.length > 0 && <Sec t="② 개선판: 기억 블록을 키우고 답을 조금 길게" sub="같은 120턴 대본, 같은 판정 회차. 기억 블록 2000토큰 + 넘친 기억은 이번 말과 겹칠 때 보충 + 대사 2~4문장 + 기억 정리를 응답 뒤로. 추출 모델만 다른 두 가지.">
      <Remeasure />
    </Sec>}
    {FM && <Sec t="③ 최종: 기억 v2 + 대화 따르기" sub="②의 개선판(추출 DeepSeek)과 최종을 같은 120턴 대본·같은 Opus 판정 회차로 비교. 300턴은 같은 대화 설정에서 기억 v1 과 비교.">
      <Table num head={['', '② 개선판', '③ 최종']} rows={[
        ['120턴 턴당 AI 비용', won(L120.cost['v2-dsx'].measured), won(FCOST.measured)],
        ['120턴 기억 점수', pc(PM.score_pct), pc(FM.score_pct)],
        ['120턴 품질 전반 / 이어 가기 (1~5)', `${PQ.overall.toFixed(2)} / ${PQ.engagement.toFixed(2)}`, `${FQ.overall.toFixed(2)} / ${FQ.engagement.toFixed(2)}`],
        ['300턴 장기 기억 정답률 (기억 v1 → v2)', pc(m0.correct_pct), pc(m2.correct_pct)],
        ['300턴 먼 기억 / 정정 반영', `${pc(m0.far_pct)} / ${pc(m0.update_pct)}`, `${pc(m2.far_pct)} / ${pc(m2.update_pct)}`],
      ]} />
      <p className="rp-note">비용 증가 중 기억 v2 몫은 대화 설정을 같게 둔 300턴 측정에서 턴당 {won(M3.cost.mb0.measured)} → {won(M3.cost.mb2.measured)}이다 — 추출 때 보여 주는 기존 항목이 늘고, 매 턴 보충이 사용자 말 뒤에 붙어 캐시가 안 되는 입력이 늘었다 <Tag k="m" />. 나머지 증가(대화 따르기 규칙 등)는 따로 나눠 재지 않았다. 300턴의 ‘기억 v1’ 열은 대화 설정이 최종과 같고, 120턴 ② 개선판과는 다르다.</p>
    </Sec>}
    <Sec t="제안 구성">
      <Table head={['구성 요소', '선택', '이유']} rows={[
        ['대화 모델', 'DeepSeek Flash, 추론 켬(답하기 전 생각 단계 사용)', '후보 중 기억 1위·비용 최저·지어냄 최소(①)'],
        ['기억 추출 모델', 'DeepSeek Flash, 추론 끔', '캐시 할인으로 추출 비용이 크게 줄고 기억 점수 유지(②)'],
        ['대화 창', `계단식 ${D.app_config.stair_max}/${D.app_config.recent_turns}턴 — 최근 대화를 ${D.app_config.stair_max}턴까지 원문으로 보내다가, 차면 앞 ${D.app_config.stair_max - D.app_config.recent_turns}턴을 기억으로 접는다`, '보내는 입력 길이에 상한. 접기 사이에는 앞부분이 그대로라 캐시(같은 입력 재사용 할인)가 맞는다'],
        ['기억 넣기', `고정 블록 최대 ${D.app_config.memory_budget_tokens}토큰(캐시) + 이번 말과 뜻이 가까운 기억 최대 3줄 보충 + 되묻기 때 원문 발췌`, '읽을 때 AI 호출 0회. 검색은 서버 안 로컬 임베딩(bge-m3)'],
        ['기억 범위', '사용자 사실·선호는 모든 캐릭터 공유, 약속·사건·대화 요약은 캐릭터별', '다른 캐릭터와 한 약속을 아는 척하지 않게'],
        ...(D.app_config.reply_style === 'v2' ? [['대사 규칙', '대사 2~4문장 + 캐릭터 자신의 반응 하나 이상', '개선 전 답이 짧아(평균 63자) 대화를 이어 가는 힘이 약했다(②)']] : []),
        ...(D.app_config.follow === 'on' && FL ? [['대화 따르기', '사용자 말에 먼저 답하고 사용자 화제를 잇는다. 답 언어는 코드가 정해 한 줄로 알리고, 직전 답이 물음표로 끝났으면 이번 답은 질문 없이', `직접 응답 ${pc(FL.cur.direct.pct)} → ${pc(FL.follow.direct.pct)}, 언어 일치 65.6 → 100%, 질문이 부담스러운 답 ${pc(FL.follow.qpress.pct)} (테스트 및 검증 탭)`]] : []),
        ...(D.app_config.date === 'gate' && DT ? [['오늘 날짜', '사용자 말에 시간 표현(오늘·내일·요일·며칠·N일 등)이 있는 턴에만 이번 말 끝에 날짜 한 줄. AI 호출 0회', `넣지 않으면 날짜 질문 40개 중 정답 ${DT.off.correct}·틀린 날짜 ${DT.off.wrong} → 정답 ${DT.gate.correct}·틀린 날짜 ${DT.gate.wrong}, 턴당 비용 그대로(날짜 질문 12턴 대본 × 캐릭터 4 × 2회)`]] : []),
      ]} />
    </Sec>
  </>;
}

function Arch({ print }) {
  return <>
    <Tldr><ul>
      <li><b>구조</b>: 대화는 API 모델 하나(DeepSeek Flash). 최근 {D.app_config.stair_max}턴은 원문으로 보내고, 그 밖은 기억 항목으로 넘긴다. 바뀌지 않는 앞부분을 고정해 캐시 단가로 읽는다.</li>
      <li><b>왜</b>: 대화 길이와 상관없이 보내는 입력에 상한을 두려고. 포기한 대안은 대화 전체 전송·요약만·원문 검색만·대화 모델 자체 호스팅.</li>
      <li><b>모델</b>: 대화 7개 조건과 추출 11개 모델을 같은 대본으로 비교해 골랐다.</li>
      <li><b>직접 실행</b>: 맨 아래 curl 예시.</li>
    </ul></Tldr>
    <Architecture />
    <TurnFlow />
    <PromptLayers />
    {D.prompts?.characters && <Sec t="실제 프롬프트 원문 — 고정 앞부분" sub="앱이 실제로 보내는 system 앞부분 전체(캐릭터 시트 + 공통 규칙 + 말투 예시, 기본 설정·한국어). 대화 내내 같아서 캐시 단가로 읽힌다. 매 턴 그 뒤에 기억 블록 → 최근 대화 → 이번 사용자 말(+필요할 때 보충 기억·오늘 날짜)이 붙는다(그림 3).">
      {Object.entries(D.prompts.characters).map(([k, t]) => <More key={k} t={`${CHAR[k] ?? k} — ${t.length.toLocaleString()}자`}><pre className="rp-code">{t}</pre></More>)}
    </Sec>}
    <CharacterKeep />
    <Sec t="왜 이 방식을 선택했고, 어떤 대안을 포기했나? (과제 질문 1)">
      <p>비용 상한이 있는 구조가 필요했다. 대화 창을 12턴으로 자르면 입력이 더 늘지 않고, 그 밖의 정보는 출처가 붙은 작은 기억 항목으로 넘긴다. 기억을 찾는 일은 서버 안 작은 임베딩 모델(CPU)로 하고 AI 호출을 쓰지 않아, 기억에 드는 AI 비용은 6턴마다 한 번 하는 정리와 대화 끝 요약뿐이다.</p>
      <Table head={['포기한 대안', '이유']} rows={[
        ['대화 전체 전송', <>120턴 기억은 가장 좋았지만({pc(lt['ctl-full-memoff'].mem_pct)}) 턴 수에 따라 비용이 계속 오르고, 캐시가 안 맞으면 {won(lt['ctl-full-memoff'].cost.worst)} <Tag k="m" /></>],
        ['롤링 요약만', '수정된 정보가 요약에 섞여 옛 값이 남기 쉽고, 요약이 내용을 윤색한다'],
        ['원문 검색만(RAG)', '옛 발화도 같이 걸려 수정 반영에 약하다 → 현재 값인 기억 항목을 먼저 찾고, 원문은 되묻기·시점 표현이 있을 때만 그 캐릭터와의 대화에서 발췌한다'],
        ['대화 모델 자체 호스팅', <>트래픽이 적으면 GPU 가 놀아 API 보다 비싸고, 오픈 모델을 그대로 쓰면 품질 최하위(Gemma 26B) <Tag k="m" />. 임베딩만 작은 모델이라 서버 CPU 에서 돌린다</>],
      ]} />
    </Sec>
    <Sec t="직접 정한 것과 가정 — 가정이 바뀌면" sub="과제가 정하지 않았거나 모호한 부분을 이렇게 정했다. 오른쪽은 그 가정이 달라질 때 결과가 어떻게 되는지(아는 만큼만).">
      <Table head={['항목', '이렇게 정했다', '가정이 바뀌면']} rows={[
        ['1턴', '사용자 메시지 하나 + 캐릭터 답 하나가 완료된 단위(과제 정의 그대로). 실패해서 답이 없는 턴은 완료 턴에서 빼되 그 비용은 합계에 넣는다', '–'],
        ['턴당 평균', '평가 대화 전체 AI 비용 ÷ 완료 턴. 대화 종료 정리 비용도 포함', '–'],
        ['평가 대화', `120턴 고정 대본 × 캐릭터 ${Object.keys(CHAR).length || 4} × 2회(사용자 결정). 사용자 말은 모든 조건에 똑같이 보낸다`, '120턴보다 긴 대화는 재지 않았다 <미검증>'],
        ['장기 기억', `원문에서 최소 ${D.script_120.gap_min}턴 뒤(12턴 대화 창 밖)에 묻는 정보. 정답 +2 · 부분 +1 · 모름 0 · 옛 값 −1 · 틀림 −1 · 지어냄 −2`, '창 크기를 바꾸면 ‘창 밖’의 기준도 바뀐다'],
        ['가격 기준', `기준일 ${D.pricing.as_of}, 공개 가격표 정가, 무료 크레딧·프로모션 미적용`, '가격이 오르내리면 턴당 비용도 같은 비율로 바뀐다'],
        ['환율', `${D.pricing.fx.toLocaleString()}원/$ 고정(사용자 결정)`, '환율에 비례(예: 1,500원이면 약 7% 오름)'],
        ['DeepSeek 시간대', '120턴 시험은 비피크 시간(정가의 절반)에 돌았다. 피크 비용은 기록된 토큰으로 다시 계산해 함께 적는다', `평일 낮(KST 10–13·15–19시)에 몰리면 ${won(DS.cost.peak)}`],
        ['캐시', '바뀌지 않는 앞부분이 캐시 단가로 읽힌다고 본다(실측: 대화 입력의 약 89%)', `캐시가 하나도 안 맞으면 피크 기준 ${won(DS.cost.worst)}`],
        ['언어', '한국어로만 쟀다', '다른 언어는 재지 않았다 <미검증>'],
        ['사용자 구분', '입력한 이름 = 사용자(로그인 없음). 같은 이름이면 같은 사람으로 보고 기억을 이어 간다', '–'],
      ].map((r) => r.map((c) => (typeof c === 'string' ? tagText(c.replace('<미검증>', '[미검증]')) : c)))} />
    </Sec>
    <Sec t="모델 선정">
      <Select />
    </Sec>
    <Sec t="직접 실행 — API와 curl">
      <Api />
    </Sec>
  </>;
}

// 비용 탭: 한 턴 비용이 쓰이는 곳 · 원가를 줄인 장치 · 대화 전체 전송 가정
function CostWhere() {
  const tg = DS.by_tag;
  return <>
    <Sec t="한 턴 비용이 쓰이는 곳">
      <Split parts={[{ l: '대화 응답', v: tg.response, c: '#4c78a8' }, { l: '기억 추출', v: tg.extract, c: '#f58518' }, { l: '종료 정리', v: tg.consolidate ?? 0, c: '#54a24b' }, { l: '임베딩', v: tg.embed ?? 0, c: '#b279a2' }]} />
    </Sec>
    <Sec t="원가를 줄인 장치">
      <div className="rp-cards">
        <div className="rp-card"><b>계단식 대화 창</b><span>최근 6~12턴만 보낸다. 창이 차면 앞 6턴을 기억으로 접는다 → 입력 길이 상한</span></div>
        <div className="rp-card"><b>프롬프트 캐시</b><span>안 바뀌는 것을 앞에 고정 → 대화 호출 입력의 약 78%를 정가의 1/50로 읽음(300턴 기억 v2 측정) <Tag k="m" /></span></div>
        <div className="rp-card"><b>읽기는 AI 없이</b><span>기억 블록은 DB에서 골라 붙이기만 → 검색·요약 호출 0회</span></div>
        <div className="rp-card"><b>쓰기는 6턴마다 묶어서</b><span>매 턴이 아니라 창을 접을 때만 추출(3턴씩 2회) → 턴당 0.33회</span></div>
        <div className="rp-card"><b>기억 검색은 서버 CPU 로</b><span>로컬 임베딩(bge-m3) — API 비용 0, CPU 사용량을 환산하면 턴당 약 0.0014원 <Tag k="e" /></span></div>
        <div className="rp-card"><b>모델을 역할별로 실측해 고름</b><span>대화 7개 조건, 추출 11개 모델을 같은 대본으로 비교</span></div>
      </div>
    </Sec>
    <More t="설계 때 가정과 실측이 달랐던 것: 대화 전체 전송">
      <p>설계 단계에서는 “대화 전체 전송은 100턴이면 턴당 약 6원”으로 보고 버렸다 <Tag k="e" />. 실제 120턴은 캐시 덕분에 턴당 {won(lt['ctl-full-memoff'].cost.measured)}였고 기억 점수도 {pc(lt['ctl-full-memoff'].mem_pct)}로 가장 높았다 <Tag k="m" />. 다만 구간 비용이 {lt['ctl-full-memoff'].phases.map((x) => x.toFixed(2)).join(' → ')}원으로 계속 오르고, 캐시가 하나도 안 맞으면 {won(lt['ctl-full-memoff'].cost.worst)}이 된다. 그래서 상한이 있는 구조를 유지하고, 120턴 기억을 개선하는 근거로 썼다.</p>
    </More>
  </>;
}

function Cost() {
  const rows = [...COSTC, 'ctl-full-memoff', 'ctl-slide6-memoff'].filter((c) => lt[c]);
  return <>
    <Tldr><ul>
      <li>제안 구성은 턴당 <b>{won(DS.cost.measured)}</b>(비피크 실측). 평일 낮 피크 단가로 다시 계산해도 <b>{won(DS.cost.peak)}</b>, 캐시가 하나도 안 맞는 최악은 {won(DS.cost.worst)}.</li>
      <li>1원을 넘는 턴은 런마다 {DS.over1_per_run}턴(기억 정리 턴), 가장 비싼 턴 {won(DS.max_turn, 2)}. 과제 기준은 <b>턴당 평균</b>이다.</li>
      <li>한 턴 비용의 대부분은 대화 응답과 기억 추출이다. 줄인 방법: 대화 창 상한 · 프롬프트 캐시 · 읽기는 AI 없이 · 기억 정리는 6턴마다 묶어서.</li>
      <li>AI 외 운영비(서버)는 하루 1만 턴 기준 턴당 약 0.11원 <Tag k="e" /> — 1원 기준과 별도. 자체 호스팅은 쓰지 않는다(아래 이유).</li>
    </ul></Tldr>
    <Sec t="조건별 턴당 비용" sub="120턴 대본 4개 × 2회(조건당 960턴). 막대 = 실측 평균(DeepSeek 비피크 시간), 주황 눈금 = 같은 토큰을 평일 낮 피크 단가로 다시 계산한 값.">
      <HBars rows={rows.map((c) => ({ l: NAME[c], v: lt[c].cost.measured, mark: lt[c].cost.peak, hl: c === ADOPT, dim: c.startsWith('ctl'), tag: c.startsWith('ctl') ? '비교용' : undefined }))} max={1.1} fmt={(v) => won(v)} line={{ v: 1, l: '1원 기준' }} mark="평일 피크 단가로 계산" />
    </Sec>
    <Sec t="평가 대화 전체 비용" sub="평가 대화 = 120턴 고정 대본 × 캐릭터 4 × 2회 = 조건마다 대화 8개. 전체 AI 비용 = 그 대화들의 모든 호출(대화·기억 추출·종료 정리·임베딩·재시도·실패) 합계, 턴당 = 전체 ÷ 완료 턴.">
      <Table num head={['조건', '대화 수', '완료 턴', '전체 AI 비용', '대화 1개(120턴) 평균', '턴당 평균']}
        rows={rows.map((c) => { const r = lt[c]; return { hl: c === ADOPT, cells: [NAME[c], r.runs, r.turns.toLocaleString(), won(r.total_krw, 1), won(r.total_krw / r.runs, 1), won(r.total_krw / r.turns)] }; })} />
      <p className="rp-note">모두 <Tag k="m" /> — 앱 DB 호출 기록과 제공사 원본 사용량 장부를 대화마다 대조했다(모두 일치).</p>
    </Sec>
    <CostWhere />
    <Sec t="구간별 비용과 가장 비싼 턴 (초반 1~40 · 중반 41~80 · 후반 81~120턴)" sub="120턴 대본 4개 × 2회의 평균. 구간 값 = 그 구간 턴들의 턴당 평균, 최대 턴 = 8런 중 가장 비싼 한 턴.">
      <Table num head={['조건', '턴당 평균', '초반 1~40턴', '중반 41~80턴', '후반 81~120턴', '최대 턴', '1원 넘은 턴/런', '피크 단가', '캐시 0 + 피크']}
        rows={rows.map((c) => { const r = lt[c]; return { hl: c === ADOPT, cells: [NAME[c], won(r.cost.measured), ...r.phases.map((x) => won(x)), won(r.max_turn, 2), r.over1_per_run, won(r.cost.peak), won(r.cost.worst)] }; })} />
      <p className="rp-note">모두 <Tag k="m" />(피크·최악은 기록된 토큰으로 다시 계산한 <Tag k="e" />). 1원을 넘는 턴은 기억 정리(추출)가 같이 도는 턴이다.</p>
    </Sec>
    <Sec t="1원보다 얼마나 더 낮출 수 있나 — 비용 손잡이를 하나씩 줄이기" sub={D.cost_curve?.length ? '현재 기본값에서 한 가지만 바꾸고 같은 120턴 대본 4개 × 2회로 쟀다. 기억 점수는 키워드 자동 채점(블라인드 채점이 아니라 위 장기 기억 점수와 직접 비교하지 않는다).' : undefined}>
      {D.cost_curve?.length ? <>
        <Table num head={['바꾼 것', '값', '런', '턴당 비용(비피크)', '피크 단가', '키워드 기억 점수', '최대 턴']}
          rows={D.cost_curve.map((r) => ({ hl: r.baseline, cells: [r.knob, String(r.value), r.runs, won(r.cost_offpeak), won(r.cost_peak), pc(r.mem_kw_pct), won(r.max_turn, 2)] }))} />
        <p className="rp-note">모두 <Tag k="m" />(피크 단가는 기록된 토큰으로 다시 계산한 <Tag k="e" />).</p>
      </> : <p><b>측정하지 않았다</b> <Tag k="u" />. 기억 블록 예산·대화 창 크기·출력 한도를 하나씩 줄여 보는 측정을 계획했지만, 기억 구조를 다시 설계하느라 최종 구성이 늦게 정해져 시간 안에 재지 못했다. 지금 말할 수 있는 것은 위 조건별 비교뿐이다(기억을 끈 ‘최근 6턴만’ {won(lt['ctl-slide6-memoff'].cost.measured)} — 기억 점수 {pc(lt['ctl-slide6-memoff'].mem_pct)}).</p>}
    </Sec>
    <Sec t="자체 호스팅: 대화 모델은 API, 임베딩만 서버 안에서">
      <ul>
        <li><b>임베딩</b>: 기억 검색용 임베딩(bge-m3 int8, 파일 0.57GB)은 서버 CPU 에서 돌린다. 턴당 CPU 약 220ms(기록된 임베딩 시간 × 실측 CPU/벽시계 비율로 계산) × 2 vCPU 서버(월 $24) 단가 1 vCPU초 0.0065원 ≈ <b>턴당 0.0014원</b> <Tag k="e" />. 설계 때 가정한 100ms(0.0007원)보다 컸지만 1원의 0.14%라 턴당 평균에는 넣지 않았다. 모델을 메모리에 올려 두는 것(서버 RSS 0.1 → 2.3GB, 실측 <Tag k="m" />)은 AI 비용이 아니라 서버 운영비로 보고, 아래 4GB 서버 1대 안에 들어간다.</li>
        <li><b>품질</b> <Tag k="m" />: 자체 호스팅할 만한 크기의 오픈 모델(Gemma 4 26B)을 그대로 쓴 조건이 40턴 비교에서 기억 점수·해로운 답 최하위였다.</li>
        <li><b>비용</b> <Tag k="e" />: GPU 대여료는 쓰든 안 쓰든 시간 단위로 나간다. H100 1장 시간당 약 $2~4(<a href="https://intuitionlabs.ai/articles/h100-rental-prices-cloud-comparison" target="_blank" rel="noreferrer">가격 비교</a>) ≈ 4,500원을 지금 턴당 {won(DS.cost.measured)}로 나누면 <b>시간당 약 1만 턴</b>이 꾸준히 들어와야 API와 같아진다. 그보다 적으면 API가 싸다.</li>
        <li><b>재지 않은 것</b> <Tag k="u" />: 그 GPU 한 장이 이 대화를 시간당 몇 턴 처리하는지는 측정하지 않았다. 그래서 위 손익분기는 처리량이 충분하다는 가정 위의 계산이다.</li>
      </ul>
    </Sec>
    <More t="가격 기준과 계산 방법">
      <p>기준일 {D.pricing.as_of} · 환율 {D.pricing.fx.toLocaleString()}원/$ 고정 · 무료 크레딧 미적용 · 단가는 USD / 100만 토큰.</p>
      <Table head={['모델', '제공사', '입력', '캐시 읽기', '출력', '출처']} rows={D.pricing.models.map((m) => [
        m.model, m.provider, `$${m.input}${m.offpeak ? ` (비피크 $${m.offpeak.input})` : ''}`, m.cached != null ? `$${m.cached}` : '–', m.output ? `$${m.output}${m.offpeak ? ` (비피크 $${m.offpeak.output})` : ''}` : '–',
        <a key={m.model} href={m.source} target="_blank" rel="noreferrer">가격표</a>])} />
      <p>턴 비용 = 그 턴의 모든 AI 호출(대화 · 기억 추출 · 임베딩 · 재시도 · 실패한 시도)의 (캐시 안 된 입력 × 입력가 + 캐시 읽기 × 캐시가 + 출력 × 출력가) × 환율. 대화 종료 정리 비용은 그 대화 턴 수로 나눠 넣었다. 앱 DB 호출 기록과 제공사 원본 사용량 장부를 런마다 대조했다(모두 일치) <Tag k="m" />. DeepSeek 은 평일 KST 10–13시·15–19시가 피크(정가), 그 밖은 절반.</p>
    </More>
    <More t="AI 외 운영비 추정 (1원 기준과 별도)">
      <Table head={['항목', '가정', '월 비용', '턴당']} rows={[
        ['앱 서버', '클라우드 소형 서버 1대(2 vCPU · 4GB, 임베딩 모델 상주 약 2.3GB 포함), 예: AWS Lightsail 월 $24', '약 33,600원', '약 0.11원'],
        ['DB·저장소', '1턴당 기록 약 5KB → 월 약 1.5GB, 서버 디스크 안', '0원(위에 포함)', '–'],
        ['백업', '하루 1회 DB 파일을 객체 저장소로', '수백 원', '–'],
      ]} />
      <p className="rp-note">가정: 하루 1만 턴(월 30만 턴), 지금 구조(Next.js 서버 1대 + SQLite) 그대로 <Tag k="e" />. 서버 가격 출처: <a href="https://aws.amazon.com/lightsail/pricing/" target="_blank" rel="noreferrer">AWS Lightsail 가격표</a>(2026-10-31 조회).</p>
    </More>
  </>;
}

// 품질 표: 같은 판정 회차 안의 조건만 한 표에 둔다
const QK = [['overall', '전반'], ['character', '캐릭터 유지'], ['context', '맥락'], ['engagement', '이어 가기'], ['user_agency', '사용자 결정 존중']];
function QualityTable({ title, cs, get, pick, base }) {
  const best = (k) => Math.max(...cs.map((c) => get(lt[c])[k]));
  return <><b>{title}</b><Table num head={['대화 모델', ...QK.map(([, l]) => l), '대사 평균 길이']}
    rows={cs.map((c) => { const q = get(lt[c]); return { hl: c === pick, cells: [base && c === 'deepseek-on' ? '개선 전' : NAME[c], ...QK.map(([k]) => (q[k] === best(k) ? <b key={k} className="rp-best">{q[k].toFixed(2)}</b> : q[k].toFixed(2))), `${lt[c].reply_len}자`] }; })} /></>;
}

function Test() {
  const lo = lt['ctl-slide6-memoff'], hi = lt['ctl-full-memoff'];
  const Q = QF, FL = FIN?.follow;
  return <>
    <Tldr><ul>
      {Q && <li><b>품질(120턴, 1~5)</b>: 최종 구성 전반 <b>{Q[FC].overall.toFixed(2)}</b> · 이어 가기 <b>{Q[FC].engagement.toFixed(2)}</b> · 캐릭터 유지 {Q[FC].character.toFixed(2)} · 맥락 {Q[FC].context.toFixed(2)} · 사용자 결정 존중 {Q[FC].user_agency.toFixed(2)} <Tag k="m" />. ② 개선판보다 이어 가기는 올랐고({Q['v2-dsx'].engagement.toFixed(2)}) 맥락은 내려갔다({Q['v2-dsx'].context.toFixed(2)}).</li>}
      {FL && <li><b>대화 따르기</b>: 사용자 말에 먼저 답함 {pc(FL.cur.direct.pct)} → <b>{pc(FL.follow.direct.pct)}</b>, 사용자 언어로 답함 65.6% → <b>100%</b>, 이어 말하기 쉬움 {pc(FL.cur.cont.pct)} → {pc(FL.follow.cont.pct)}, 질문이 부담스러운 답 {pc(FL.follow.qpress.pct)} — 미리 정한 기준 모두 통과 <Tag k="m" />.</li>}
      <li><b>믿을 수 있나</b>: 기억을 끄면 {pc(lo.mem_pct)}, 대화 전체를 보내면 {pc(hi.mem_pct)} — 대본은 기억 없이는 못 풀고, 정보가 있으면 풀린다. 채점은 어느 구성의 답인지 모르게(블라인드) Opus 가 했다. 사람 판정은 없다.</li>
    </ul><Badges /></Tldr>
    <p className="rp-flowline"><b>검증 방법</b>: ① 사전 등록(돌리기 전에 조건·채점 규칙을 결정 기록 문서에 적고 바꾸지 않음) → ② 고정 대본(모든 모델에 같은 사용자 말) → ③ 블라인드 채점 → ④ 비교할 구성의 답을 한 판정 회차에 섞어 매김(회차가 다르면 같은 답도 점수가 1~4%p 흔들려서) → ⑤ 대본마다 2회 반복 + 기억 끈 비교용 구성. 문항은 정보를 말하고 <b>최소 {D.script_120.gap_min}턴 뒤</b>(대화 창 밖)에 묻는다.</p>
    <Sec t="대화 길이와 캐릭터 수를 정한 기준">
      <ul>
        <li><b>120턴 · 캐릭터 4개는 사용자가 정했다</b>(docs/50 2026-10-31). 왜 100이나 200이 아니라 120인지, 왜 4개인지 따로 적은 근거는 <b>기록에 없다</b>.</li>
        <li>기록에 있는 구조상 이유: 대화 창이 최대 12턴이라 문항은 원문에서 <b>13턴 이상</b> 떨어져야 최근 대화만으로 못 푼다 → 12턴 장면 10개로 이어 붙여 초반 정보를 최대 100턴 뒤에 묻는다. 캐릭터 4개는 앱에 있는 캐릭터 전부이고, 네 캐릭터 모두 같은 턴에 같은 역할을 둬 같은 축으로 비교한다.</li>
      </ul>
    </Sec>
    <Sec t="롤플레잉 채점 기준 (1~5점)" sub="Opus 블라인드 묶음 판정 기준표(model/bench/out/opus-qlt1-work/rubric.md) 그대로. 같은 장면의 조건별 답을 무작위 이름·순서로 한 묶음에 보여 주고 매긴다.">
      <Table head={['항목', '보는 것']} rows={[
        ['캐릭터 유지', '설정·말투·세계 유지. 메타 발언은 낮게'],
        ['맥락', '직전 말·상황에 맞음, 모순 없음'],
        ['이어 가기', '대화를 자연스럽게 이어 감, 짧은 말에 반응, 새 주제를 받음'],
        ['사용자 결정 존중', '사용자의 감정·행동·생각을 단정하거나 대신 정하지 않음(요청받은 제안은 괜찮고 단정만 감점)'],
        ['전반', '계속 대화하고 싶은 쪽'],
        ['점수', '5 = 흠 없음 · 4 = 사소한 흠 1개 · 3 = 눈에 띄는 흠 · 2 = 여러 번 크게 어긋남 · 1 = 축 실패(예: AI 라고 인정). 길이는 기준 아님'],
      ]} />
    </Sec>
    <Sec t="롤플레잉 품질 (12턴 장면 80개, 1~5점)" sub="Opus 블라인드 판정. 과제의 롤플레잉 요구 4가지 → 캐릭터 유지(성격·말투·설정) · 맥락(말과 상황에 맞는 반응) · 이어 가기(맞장구에 머물지 않음) · 사용자 결정 존중(행동·감정을 대신 정하지 않음). 판정 회차가 다르면 같은 런도 점수가 달라서 회차별로 따로 보인다.">
      {Q && <Table num head={['구성', ...QK.map(([, l]) => l)]} rows={[['deepseek-on', '① 고른 대화 모델(개선 전)'], ['v2-dsx', '② 개선판'], [FC, '③ 최종']].filter(([k]) => Q[k]).map(([k, l]) => ({ hl: k === FC, cells: [l, ...QK.map(([q]) => Q[k][q].toFixed(2))] }))} />}
      <p className="rp-note">세 구성의 120턴 기록에서 같은 장면 80개를 뽑아 한 판정 회차에 섞어 매겼다(구성 이름은 가림).</p>
      <More t="① 대화 모델 고를 때의 품질 (판정 회차 1)">
        <QualityTable title="1단계 후보 비교" cs={CANDS.filter((c) => lt[c].quality)} get={(r) => r.quality.mean} pick={PICK1} />
      </More>
      <p className="rp-note">AI 판정이라 사람 판정과 다를 수 있다 <Tag k="u" />.</p>
    </Sec>
    {FL && <Sec t="대화 따르기 — 사용자 말에 먼저 답하나, 사용자 언어로 답하나" sub="120턴 판정의 이어 가기 점수는 높았지만 실제 데모에서 영어로 말해 달라는 요청을 무시하고 단답으로 끝나는 대화가 보여, 그 상황만 보는 대본을 따로 만들었다. 대본 3종(12턴 화제 전환·다른 언어 4턴 포함 / 20턴 상황 / 8턴 마무리) × 캐릭터 4 × 2회 = 구성마다 320턴, Opus 블라인드 예/아니오 판정. 기준은 돌리기 전에 정했다(docs/50).">
      <Table num head={['', '따르기 끔', '최종(따르기 켬)', '미리 정한 기준']} rows={[
        ['사용자 말에 직접 답함', pc(FL.cur.direct.pct), pc(FL.follow.direct.pct), '끔보다 높게'],
        ['└ 화제 전환·다른 언어 대본만', pc(FL.cur.direct_follow12.pct), pc(FL.follow.direct_follow12.pct), '–'],
        ['사용자가 쓴 언어로 답함(다른 언어 턴 96개)', '65.6%', '100%', '90% 이상'],
        ['이 답 뒤에 이어 말하기 쉬움', pc(FL.cur.cont.pct), pc(FL.follow.cont.pct), '끔보다 높게'],
        ['질문이 부담스러움(되묻기 반복·질문 여러 개)', pc(FL.cur.qpress.pct), pc(FL.follow.qpress.pct), '5% 이하'],
        ['사용자에게 묻는 문장 2개 이상', pc(FL.cur.nq2.pct), pc(FL.follow.nq2.pct), '끔 + 5%p 이하'],
        ['캐릭터 이탈', FL.cur.break.yes, FL.follow.break.yes, '끔 이하'],
      ]} />
      <ul className="rp-note">
        <li>바꾼 것(따르기 켬일 때만, AI 호출 추가 없음): 사용자 말에 먼저 답하고 사용자 화제를 잇는다 · 답 언어는 코드가 사용자 말에서 정해 “(이번 답 언어: …)” 한 줄로 알린다 · 직전 답이 물음표로 끝났으면 “이번 답은 질문 없이”를 붙인다 · 입버릇은 가끔만 · 끝내려는 말에는 붙잡지 않고 짧게 인사.</li>
        <li>규칙을 고쳐 가며 6차까지 쟀다. 질문을 끝에 두게 하자 질문이 부담스러운 답이 14.4%까지 늘었고, 프롬프트 문장(“질문은 한 답에 하나만”)으로는 줄지 않아 코드가 매 턴 붙이는 한 줄로 막았다. 대가로 이어 말하기 쉬움은 질문을 막지 않던 회차(83.8%)보다 낮다.</li>
      </ul>
    </Sec>}
    {D.dialogue_examples?.scenes?.length && <Sec t="실제 대화 예제 — 채택 구성의 120턴 기록 원문" sub="사용자 말은 우리가 미리 쓴 고정 대본, 캐릭터 답은 실제 모델 출력 그대로(지문 포함, 고치지 않음). 점수는 그 장면의 Opus 블라인드 판정. 고른 규칙(미리 정함): 캐릭터마다 장면 2(13~24턴)·1회차 하나씩 + 판정된 모든 장면 중 전반 점수 최고·최저 하나씩.">
      {D.dialogue_examples.scenes.map((sc, i) => <More key={i} open={i === 0} t={`${{ rule: '규칙', best: '최고점', worst: '최저점' }[sc.pick] ?? sc.pick} · ${who(sc.scenario)} · ${sc.situation ?? sc.segment} · ${sc.rep}회차 — 전반 ${sc.scores.overall} · 캐릭터 ${sc.scores.character} · 맥락 ${sc.scores.context} · 이어 가기 ${sc.scores.engagement} · 결정 존중 ${sc.scores.user_agency}`}>
        {sc.judge_note && <p className="rp-note">판정 메모: {sc.judge_note}</p>}
        {sc.turns.map((t) => <div key={t.turn} className="rp-case ok"><div className="h">{t.turn}턴</div><div className="q"><span>사용자(대본)</span>{t.user}</div><div className="a"><span>캐릭터(실제 출력)</span>{t.assistant}</div></div>)}
      </More>)}
      <p className="rp-note">{D.dialogue_examples.cond === FC ? '최종 구성의 120턴 기록이다' : <>② 개선판의 120턴 기록이다 — 최종 구성 기록으로는 바꾸지 못했다 <Tag k="u" /></>}.</p>
    </Sec>}
    <Sec t="직접 재현하려면">
      <Table head={['무엇', '위치']} rows={[
        ['시험 대본(사용자 말·문항·정답 키워드)', <code key="a">model/bench/scenarios/*.json</code>],
        ['실행기(앱 API로 대본을 그대로 보냄, 비용 장부 대조)', <code key="b">model/bench/run.mjs</code>],
        ['키워드 채점', <code key="c">model/bench/score.js</code>],
        ['품질 블라인드 묶음 판정', <><code>model/bench/pair-blind.mjs</code></>],
        ['채점 기준표', <code key="d">model/bench/out/opus-qlt1-work/rubric.md</code>],
        ['사전 등록·결과 기록', <code key="e">docs/50-decision-log.md</code>],
        ['리포트 숫자 생성', <code key="f">model/bench/report-data.mjs</code>],
      ]} />
      <p className="rp-note">API로 직접 대화하며 기억을 확인하는 방법은 설계 구조 탭 맨 아래에 있다.</p>
    </Sec>
    <More t="검증 중 발견해서 고친 것 (결과 공개 전)">
      <ul>
        <li>채점 에이전트 하나가 원문 확인 도구를 잘못 써서 ‘지어냄’ 3개를 매김 → 조건 이름을 가린 채 원문 확인 후 규칙대로 정정, 원래 라벨 기록.</li>
        <li>“모른다면서 틀린 값을 짐작”을 묶음마다 다르게 매김 → 규칙을 하나로 정하고 ‘틀림’ 53개 전체를 새 채점자가 다시 판정(9개 바뀜).</li>
        <li>정답 키워드 ‘5일’이 ‘25일’에도 걸리는 문제 등을 실행 전에 고쳤다.</li>
      </ul>
    </More>
  </>;
}


// 장기 기억 탭: 방식(그림·설계 의도) → 과제 요구 4가지와 기준 → 결과 → 실제 사례
const REQ = [
  ['① 사용자 정보·선호를 다른 주제 뒤에도', ['fact', 'pref', 'implicit', 'combine'], '정답이면 성공. 암묵 적용은 제약을 지키면 성공'],
  ['② 사건·약속 반영', ['event', 'user_promise', 'char_promise', 'relative_time'], '날짜·요일을 틀리면 실패. 다른 캐릭터와의 약속은 모르는 게 정답'],
  ['③ 수정 반영', ['update', 'partial_update', 'multi_update', 'retract', 'distractor'], '옛 값을 현재처럼 말하면 감점'],
  ['④ 지어내지 않기', ['abstain', 'half_said'], '“말한 적 없다/모른다”가 정답, 지어내면 −2'],
];

function Memory() {
  const lo = lt['ctl-slide6-memoff'], hi = lt['ctl-full-memoff'];
  const m2 = M3?.mb2, m0 = M3?.mb0;
  const F = L120?.memory?.[FC], P = L120?.memory?.['v2-dsx'];
  return <>
    <Tldr><ul>
      <li><b>방식</b>: 최근 {D.app_config.stair_max}턴은 원문으로 보내고, 그 밖은 6턴마다 <b>출처가 붙은 기억 항목</b>(사실·선호·약속·사건)으로 뽑는다. 항목과 사용자 원문 전부를 서버 안 로컬 임베딩(bge-m3)으로 색인해, 매 턴 <b>고정 블록</b>(최대 {D.app_config.memory_budget_tokens}토큰, 캐시) + <b>이번 말과 뜻이 가까운 기억 보충</b>을 넣는다. 읽을 때 AI 호출 0회.</li>
      {m2 && <li><b>300턴 결과</b>: 장기 기억 정답률 기억 v1 {pc(m0.correct_pct)} → 최종 <b>{pc(m2.correct_pct)}</b>. 100턴 넘게 떨어진 먼 기억 {pc(m0.far_pct)} → <b>{pc(m2.far_pct)}</b>, 정정 반영 {pc(m0.update_pct)} → <b>{pc(m2.update_pct)}</b>, 지어냄 {m2.counts.fabricated ?? 0}/{m2.n} <Tag k="m" />.</li>}
      {F && <li><b>120턴 결과</b>: 최종 구성 {pc(F.score_pct)}로, 이전 채택 구성(기억 v1){P ? ` ${pc(P.score_pct)}` : ''}보다 낮다. 돌려 묻는 문항에서 떨어졌다(아래 결과 2) <Tag k="m" />.</li>}
      <li><b>캐릭터별 기억</b>: 사용자 사실·선호는 모든 캐릭터가 공유하고, 약속·사건·대화 요약은 그 캐릭터와의 것만 쓴다.</li>
    </ul><Badges /></Tldr>
    <MemoryModel />
    <Sec t="무엇을 기억 항목으로 저장하나" sub="추출 규칙(memory/prompts.js)과 코드(memory/index.js · policy.js)에 적힌 그대로.">
      <Table head={['', '내용']} rows={[
        ['저장한다', '사용자 정보(이름·직업·거주지 등), 선호(음식·음료처럼 사소해 보여도), 사용자가 말한 가족·친구·반려동물의 사실, 중요한 사건(시점은 코드가 날짜로 환산), 명시적 약속(누가 하기로 했는지 포함), 내용을 밝히지 않은 고민·비밀(“말 안 했다”는 사실만)'],
        ['저장하지 않는다', '일회성 기분·상태(“오늘 피곤해”), 캐릭터의 권유·제안, 짐작한 정보(“불확실하면 저장하지 않는다”), 이미 있는 내용, 기억을 묻는 질문 턴'],
        ['한 항목', '문장 하나·사실 하나, 45자 이내, 중요도 1~5, 출처(대화·턴) 필수, 대상 라벨(예: user.diet, pet#1), 임베딩'],
        ['범위', '사실·선호 = 사용자 공유, 약속·사건·대화 요약 = 그 캐릭터만'],
        ['상한', '사용자당 활성 항목 80개(넘으면 오래 안 쓴 것부터 보관 — 보관 항목도 검색 대상으로 남아 다시 불리면 되살린다), 추출 모델에게 보여 주는 기존 항목 25개'],
      ]} />
    </Sec>
    <Sec t="어떻게 꺼내고, 어떻게 고치나" sub="memory/index.js · policy.js 의 현재 값.">
      <Table head={['언제', '무엇을', 'AI 호출']} rows={[
        ['매 턴 — 고정 블록', `이름·열린 약속 → 안전 사실 → 정정된 값 → 중요도 4 이상 순으로 ${D.app_config.memory_budget_tokens}토큰까지, 남으면 중요도·최근순. 기억이 안 바뀐 동안 바이트가 같아 캐시 단가로 읽힌다`, '0회'],
        ['매 턴 — 질문 보충', '이번 말을 임베딩(로컬, 약 10ms)해 블록에 없는 항목(보관·대체 포함) 중 유사도 0.45 이상 상위 3개를 사용자 말 뒤에 붙인다. 대체된 항목이 걸리면 최신 값을 “(이전: …)”과 함께. 시점 표현이 있으면 그 날짜 범위를 먼저 본다', '0회'],
        ['되묻기·시점 표현이 있을 때', '그 캐릭터와 나눈 사용자 원문에서 뜻이 가까운 발화 최대 3개를 발췌(이미 항목이 된 턴은 제외)', '0회'],
        ['6턴마다(답이 나간 뒤)', '창에서 밀려나는 6턴에서 새 사실·약속·수정을 뽑는다. 추출 모델에게는 새 턴과 뜻이 가까운 기존 항목을 보여 주고, 같은 대상의 같은 속성이면 그 항목을 고치게 한다', '2회'],
        ['값이 바뀌면', '옛 항목을 지우지 않고 ‘대체됨’으로 두고 새 항목을 잇는다. 블록에는 현재 값만', '—'],
        ['대화가 끝날 때', '남은 대화 정리 + 뜻이 같은 항목 병합(유사도 0.80 이상) + 대화 요약 1개', '1~3회'],
      ]} />
    </Sec>
    <Sec t="설계 의도">
      <ul>
        <li><b>들은 말은 버리지 않는다</b> — 사용자 원문은 전부 색인해 두고, 항목은 그 색인이자 현재 값이다. 오래돼 보관된 항목도 검색에서 다시 찾는다.</li>
        <li><b>검색은 후보를 고르고, 판단은 대화 모델이 한다</b> — 매 턴 AI 호출을 더하지 않으려고 검색은 임베딩 유사도로만 한다.</li>
        <li><b>지어내지 않기를 구조로 막는다</b> — 모든 항목에 출처(몇 번째 대화의 몇 턴)를 남기고, “기억과 이번 대화에 없는 과거는 모른다고 할 것”을 고정 규칙에 둔다.</li>
        <li><b>캐시를 깨지 않는다</b> — 블록은 기억이 안 바뀐 동안 그대로 두고, 턴마다 바뀌는 보충은 사용자 말 뒤에만 붙인다.</li>
      </ul>
    </Sec>
    <Sec t="과제의 기억 요구 4가지 → 문항 유형과 ‘충분하다’의 기준">
      <Table head={['과제 요구', '문항 유형', '120턴 문항 수', '300턴 문항 수(8런)', '“충분하다”의 기준']} rows={REQ.map(([r, ks, c]) => [r, ks.map((t) => TYPE[t]).join(' · '), ks.reduce((s, t) => s + (D.type_counts[t] ?? 0), 0), m2 ? sumN(m2.by_type, ks) : '–', c])} />
    </Sec>
    <Sec t="얼마나 오래, 그리고 ‘바로 앞 메시지만으로는 못 푸는’ 장치">
      <Table head={['대본', '길이', '보는 것']} rows={[
        ['장면 기반 120턴', `장면 ${D.script_120.scenes.length}개 × 12턴 × 캐릭터 4`, '이어지는 긴 대화에서 초반 정보를 최대 100턴 뒤에 묻는다'],
        ['장기 기억 300턴', '300턴 × 캐릭터 4, 대화 5번(넷째 대화는 다른 캐릭터)', '100~250턴 뒤 되묻기, 두 번 바뀐 값, 보관 뒤 되살리기, 돌려 묻기, 시점만 있는 질문, 다른 캐릭터와의 약속'],
        ['기억 대본(모델 고를 때)', '40턴 × 캐릭터 4', '사실·선호·약속·수정·함정 문항, 비용 구간'],
      ]} />
      <ul>
        <li>120턴 문항 간격: 13~19턴 {D.script_120.gap_buckets['13-19']} · 20~39턴 {D.script_120.gap_buckets['20-39']} · 40~89턴 {D.script_120.gap_buckets['40-89']} · 90턴 이상 {D.script_120.gap_buckets['90+']}개(대본당 문항 {D.script_120.kinds.probe}개). 300턴은 대본당 문항 57개, 정보를 말한 턴과의 간격 최대 266턴.</li>
        <li>각 사실은 한 번만 말하고, 정답 낱말이 최근 12턴이나 다른 사용자 말에 나오면 대본 점검 스크립트가 실패시킨다. 최근 12턴만 보내므로 문항은 모두 창 밖 정보를 묻는다.</li>
      </ul>
    </Sec>
    {m2 && <Sec t="통과 기준 — 미리 정한 값" sub="300턴 재측정 전에 적어 둔 기준(docs/21 §9.8). 기준점은 기억 v1(같은 대화 설정, 같은 대본).">
      <Table head={['기준', '최종(기억 v2 + 수정)', '판정']} rows={[
        ['먼 기억 정답률: 기억 v1 대비 −3%p 이내', `${pc(m0.far_pct)} → ${pc(m2.far_pct)}`, m2.far_pct >= m0.far_pct - 3 ? '통과' : '미달'],
        ['정정 반영 정답률: 기억 v1 대비 −3%p 이내', `${pc(m0.update_pct)} → ${pc(m2.update_pct)}`, m2.update_pct >= m0.update_pct - 3 ? '통과' : '미달'],
        ['다른 캐릭터와의 약속 누출 0', `누출 ${m2.cross_char_promise.leak ?? 0} / ${(m2.cross_char_promise.leak ?? 0) + (m2.cross_char_promise.correct ?? 0) + (m2.cross_char_promise.fabricated ?? 0)}문항`, (m2.cross_char_promise.leak ?? 0) === 0 ? '통과' : '미달'],
        ['지어냄 5% 이하', `${m2.counts.fabricated ?? 0}/${m2.n} = ${pc(100 * (m2.counts.fabricated ?? 0) / m2.n)}`, '통과'],
        ['턴당 비용 1원 이하', won(M3.cost.mb2.measured), M3.cost.mb2.measured <= 1 ? '통과' : '미달'],
      ]} />
      {M3.mb3_leak && <p className="rp-note">누출 2건은 다른 캐릭터와의 대화에서 사용자 발화를 원문 발췌로 끌어온 경로였다. 발췌를 지금 캐릭터와의 대화로 제한한 뒤 같은 300턴 대본에서 {M3.mb3_leak.items}문항 중 누출 {M3.mb3_leak.forbidden_keyword_hits}건 — 금지 낱말 검사와 원문 읽기로 확인했고 블라인드 판정은 아니다 <Tag k="m" />.</p>}
    </Sec>}
    {m2 && <Sec t="결과 1 — 300턴 장기 기억 (기억 v1 → v2 → 결함 수정)" sub="300턴 대본 4개 × 2회, 대화 설정은 셋 다 같다. Opus 블라인드 판정(세 조건을 섞어 가림).">
      <Table num head={['', ...MB.map(([, l]) => l)]} rows={[
        ['먼 기억(100턴 이상 뒤) 정답률', ...MB.map(([k]) => pc(M3[k].far_pct))],
        ['정정 반영 정답률', ...MB.map(([k]) => pc(M3[k].update_pct))],
        ['가까운 기억 정답률', ...MB.map(([k]) => pc(M3[k].near_pct))],
        ['전체 정답률', ...MB.map(([k]) => pc(M3[k].correct_pct))],
        ['기억 점수(정답 +2 … 지어냄 −2)', ...MB.map(([k]) => pc(M3[k].score_pct))],
        ['다른 캐릭터와의 약속: 누출', ...MB.map(([k]) => M3[k].cross_char_promise.leak ?? 0)],
        ['지어냄', ...MB.map(([k]) => M3[k].counts.fabricated ?? 0)],
        ['턴당 AI 비용', ...MB.map(([k]) => won(M3.cost[k].measured))],
      ]} />
      <ul className="rp-note">
        <li>v1 의 약점: 오래돼 보관된 항목은 어디서도 다시 찾지 않았고, 대체된 옛 항목과만 닮은 질문(“2주 어디 간다고 했지?” → 이미 취소됨)은 최신 값을 못 찾았다. v2 는 보관·대체 항목도 검색해 최신 값을 잇는다.</li>
        <li>기억 v2 첫 판(mb1)은 정정이 오히려 떨어졌다(자유 라벨에서 같은 대상 판정이 어긋나 옛 값과 새 값이 둘 다 남음). 실패 경로를 기록에서 찾아 5건을 고친 것이 최종이다.</li>
        <li>{M3.note}</li>
      </ul>
    </Sec>}
    {F && <Sec t="결과 2 — 120턴: 최종 구성 vs 이전 채택 구성" sub="같은 120턴 대본 4개 × 2회, 같은 Opus 블라인드 판정 회차에 섞어 매겼다. 이전 채택 = 기억 v1 + 대화 따르기 끔.">
      <Table num head={['', '이전 채택', '최종']} rows={[
        ['기억 점수', pc(P.score_pct), pc(F.score_pct)],
        ['정답률', pc(P.correct_pct), pc(F.correct_pct)],
        ['정답·부분·모름·옛값·틀림·지어냄', ...[P, F].map((r) => ['correct', 'partial', 'unknown', 'stale', 'wrong', 'fabricated'].map((k) => r.counts[k] ?? 0).join(' · '))],
        ['해로운 답(옛 값·틀림·지어냄)', P.harmful, F.harmful],
        ...Object.keys(TYPE).filter((t) => F.by_type[t]).map((t) => [`${TYPE[t]} (${F.by_type[t].n})`, `${P.by_type[t]?.correct ?? '–'}`, `${F.by_type[t].correct}`]),
      ]} />
      <ul className="rp-note">
        <li>나아진 곳: 값 수정({P.by_type.update?.correct} → {F.by_type.update?.correct}/{F.by_type.update?.n}), 옛 값 답 {P.counts.stale ?? 0} → {F.counts.stale ?? 0}건.</li>
        <li>떨어진 곳: 암묵 적용({P.by_type.implicit?.correct} → {F.by_type.implicit?.correct}/{F.by_type.implicit?.n}) — “루프탑 바 갈래?”에 고소공포증을 떠올려야 하는 문항이다. 기억 v2 를 처음 설계할 때 고정 블록을 800토큰으로 줄였더니 120턴에서 넘쳐 제약·선호 항목이 빠졌고, 질문과 뜻으로는 이어지지 않아 보충으로도 못 돌아왔다. 블록을 2000토큰으로 되돌린 판을 다시 재는 중이다.</li>
        {L120.memory_excl_implicit && <li>암묵 적용 문항을 빼면 {pc(L120.memory_excl_implicit['v2-dsx'].score_pct)} vs {pc(L120.memory_excl_implicit[FC].score_pct)} — <b>결과를 본 뒤에 정한 제외</b>라 참고로만 적는다.</li>}
      </ul>
    </Sec>}
    <More t="모델을 고를 때(기억 v1)의 120턴 기억 점수">
      <HBars rows={hb([...CANDS, 'ctl-full-memoff', 'ctl-slide6-memoff'], (r) => r.mem_pct)} max={100} fmt={(v) => `${v.toFixed(1)}%`} />
      <p className="rp-note">같은 기억 구조에서 대화 모델만 바꿔 쟀다. 기억을 끄고 최근 6턴만 보내면 {pc(lo.mem_pct)}, 대화 전체를 보내면 {pc(hi.mem_pct)}.</p>
    </More>
    <Sec t="실제 사례 — 요구별 성공·실패 답 원문">
      <Cases />
    </Sec>
  </>;
}

// 문항이 묻는 원문 턴 줄만 보이고, 나머지 앞선 말은 접는다
const srcTurn = (e) => (e.gap != null ? e.turn - e.gap : null);
function Cases() {
  return <>
    <p className="rp-note">120턴 시험에서 {D.examples_cond === FC ? '최종 구성' : <>② 개선판(최종 구성 기록으로는 바꾸지 못함 <Tag k="u" />)</>}의 <b>실제 답 원문</b>을 과제 기억 요구별로 성공 2개·실패 1개씩 골랐다. 초록 = 성공, 빨강 = 실패. 정답 키워드는 대본에 미리 적은 것(기대 응답)이고, 답은 실제 모델 출력, 판정은 블라인드 채점 결과 그대로다.</p>
    {D.examples.map((g) => (
      <div key={g.req} className="rp-sub2"><h3>{g.req}</h3>
        {[...g.success.map((e) => ['성공', e]), ...g.failure.map((e) => ['실패', e])].map(([kind, e], i) => {
          const s = srcTurn(e), keys = [...(e.expect ?? []), ...(e.stale ?? [])].filter((k) => k.length >= 2);
          const keep = (c) => c.startsWith(`${s}:`) || keys.some((k) => c.includes(k)); // 원문 턴 + 정답·옛 값이 나온 말(수정 이력)
          const src = e.context.filter(keep), rest = e.context.filter((c) => !keep(c));
          return <div key={i} className={`rp-case ${kind === '성공' ? 'ok' : 'ng'}`}>
            <div className="h"><b>{kind}</b> · 캐릭터 {who(e.scenario)} · {TYPE[e.type]} · {e.turn}턴에 물음, 원문은 {e.gap}턴 전 · {BLOCK[e.block] ?? e.block}</div>
            {!!src.length && <div className="ctx"><span>사용자가 앞서 한 말</span>{src.map((c, j) => <div key={j} className="rp-ctxsrc">{c}</div>)}</div>}
            <div className="q"><span>질문</span>{e.question}</div>
            <div className="a"><span>실제 답</span>{e.reply}</div>
            <div className="j"><span>판정</span><b>{LABEL[e.label]}</b> — {e.why}</div>
            <More t={`채점 기준${rest.length ? `과 다른 앞선 말 ${rest.length}개` : ''}`}>
              <div className="exp">정답 키워드: {e.expect?.join(' / ') || '–'}{e.stale?.length ? ` · 옛 값: ${e.stale.join(' / ')}` : ''}{e.hint ? ` · ${e.hint}` : ''}</div>
              {rest.map((c, j) => <div key={j} className="rp-note">{c}</div>)}
            </More>
          </div>;
        })}
        {!g.failure.length && <p className="rp-note">이 유형은 실패 사례가 없다(함정 문항 모두 통과).</p>}
      </div>
    ))}
  </>;
}

function Select() {
  return <>
    <ul>
      <li>7개 조건(40턴) → 후보 3개(120턴) → <b>DeepSeek Flash 추론 켬</b>{isNew ? <> → 같은 대화 모델로 기억 구조 개선판 2개를 재측정 → 개선판(추출 DeepSeek) → 기억 v2 + 대화 따르기를 더한 <b>최종</b></> : ''}.</li>
      <li>대화 모델을 고른 이유: 두 시험 모두 <b>기억 1위·지어냄 최소·비용 최저</b>. 감수한 것: 이어 가기가 약함(짧은 답){isNew ? ' → 개선판에서 대사 길이 규칙으로 고쳤다' : ''}.</li>
      {isNew && <li>개선판 중 추출 DeepSeek 을 고른 이유: 같은 판정 회차에서 기억·품질 모두 가장 높고, 턴당 비용·1원 넘는 턴·지연 꼬리가 가장 작다(요약 탭 ②).</li>}
    </ul>
    <div className="rp-funnel">
      <div><b>7</b>40턴 비교<br /><span className="rp-note">모델 4종 × 추론 켬/끔</span></div><i>→</i>
      <div><b>3</b>120턴 시험<br /><span className="rp-note">Haiku 끔·켬, DeepSeek 켬 (+ 비교용 기억 끔 구성 2)</span></div><i>→</i>
      <div className={isNew ? '' : 'hl'}><b>1</b>DeepSeek Flash 추론 켬<br /><span className="rp-note">기억·비용 1위</span></div>
      {lt['v2-dsx'] && <><i>→</i><div><b>1</b>개선판 (추출 DeepSeek)<br /><span className="rp-note">개선판 2개 중 기억·품질·비용 1위</span></div></>}
      {lt[FC] && <><i>→</i><div className="hl"><b>최종</b>기억 v2 + 대화 따르기<br /><span className="rp-note">임베딩 검색·캐릭터별 기억</span></div></>}
    </div>
    <p className="rp-flowline"><b>기억 추출 모델</b>도 따로 골랐다: 11개 모델 × 4개 언어 추출 비교 → Gemma 4 31B 1위(93.7점){lt['v2-dsx'] ? ` → 120턴 재측정에서 DeepSeek Flash 와 비교${isNew ? ' → 기억 점수가 같거나 높고 비용이 낮아 DeepSeek Flash(추론 끔)로 바꿈' : ''}` : ''}.</p>
    <Sec t="뺀 조건과 이유">
      <Table head={['뺀 조건', '이유']} rows={[
        ['GPT-6 Luna (끔·켬)', '두 판정 모두 품질이 낮음(캐릭터를 깨고 AI 임을 인정), 제공사 UTC 날짜로 한국 자정~9시에 날짜가 하루 어긋남'],
        ['Gemma 4 26B', '기억 점수·해로운 답 최하위 — 자체 호스팅 크기의 오픈 모델을 그대로 쓰면 부족하다는 근거'],
        ['DeepSeek 추론 끔', '추론 켬보다 기억이 낮고, 최악 비용 1.37원'],
        ['Haiku 추론 켬', '더 비싸고 기억은 기준과 같으며, 120턴에서 반복·모순이 가장 많음'],
        ['Haiku 추론 끔', '이어 가기는 낫지만 기억(64.3%)과 비용에서 밀림'],
      ]} />
    </Sec>
    <More t="1단계 40턴 비교 전체 표">
      <Table num head={['조건', '기억 점수', '해로운 답', '기억: 기준 대비', '품질 Opus', '턴당 비용', '최악 비용']}
        rows={D.dm.map((r) => ({ hl: r.cond === 'deepseek-on', cells: [NAME[r.cond], pc(r.mem_pct), r.harmful, wl(r.mem_vs_base), r.q_opus.toFixed(2), won(r.cost.measured), won(r.cost.worst)] }))} />
      <p className="rp-note">기준 = Claude Haiku 5.5 추론 끔(처음 개발에 쓰던 모델).</p>
    </More>
    <More t="2단계 120턴 전체 표">
      <Table num head={['조건', '기억 점수', '해로운 답', '품질 Opus', '턴당 비용', '피크 단가']}
        rows={CANDS.map((c) => { const r = lt[c]; return { hl: c === PICK1, cells: [NAME[c], pc(r.mem_pct), r.harmful, r.quality ? r.quality.mean.overall.toFixed(2) : '–', won(r.cost.measured), won(r.cost.peak)] }; })} />
    </More>
  </>;
}

function QA234() {
  const C = L120?.cost?.[FC], CP = L120?.cost?.['v2-dsx'], Q = QF, F = L120?.memory?.[FC], P = L120?.memory?.['v2-dsx'], m2 = M3?.mb2, FL = FIN?.follow;
  return <>
    <Sec t="비용을 낮추면서 지킨 것과 양보한 것 (과제 질문 2)">
      <div className="rp-cols">
        <div className="rp-card"><b>지킨 것</b><ul>
          {C && <li>턴당 {won(C.measured)}, 평일 낮 피크 단가로도 {won(C.peak)} <Tag k="m" /></li>}
          {m2 && <li>300턴 지어낸 기억 {m2.counts.fabricated ?? 0}/{m2.n}, 바뀐 정보 반영 {pc(m2.update_pct)}, 100턴 넘게 떨어진 정보 {pc(m2.far_pct)} <Tag k="m" /></li>}
          {Q && <li>캐릭터 유지 {Q[FC].character.toFixed(2)} · 사용자 결정 존중 {Q[FC].user_agency.toFixed(2)} (1~5) <Tag k="m" /></li>}
          {FL && <li>사용자가 쓴 언어로 답하기 100%, 사용자 말에 먼저 답하기 {pc(FL.follow.direct.pct)} <Tag k="m" /></li>}
        </ul></div>
        <div className="rp-card"><b>양보한 것</b><ul>
          {F && P && <li>120턴 기억 점수 {pc(P.score_pct)} → {pc(F.score_pct)} — 돌려 묻는 문항(“루프탑 바 갈래?”에 고소공포증 떠올리기) {P.by_type.implicit.correct} → {F.by_type.implicit.correct}/{F.by_type.implicit.n} <Tag k="m" /></li>}
          {C && CP && <li>턴당 비용 {won(CP.measured)} → {won(C.measured)}(② 개선판 대비) <Tag k="m" /></li>}
          {Q && <li>맥락 점수 {Q['v2-dsx'].context.toFixed(2)} → {Q[FC].context.toFixed(2)} <Tag k="m" /></li>}
          {FL && <li>이어 말하기 쉬움 {pc(FL.follow.cont.pct)} — 질문 연속을 막지 않던 회차(83.8%)보다 낮다 <Tag k="m" /></li>}
          <li>대화 원문을 전부 보내는 방식보다 기억이 약하다(① 단계 120턴 {pc(lt['ctl-full-memoff'].mem_pct)}) — 대신 비용에 상한이 있다 <Tag k="m" /></li>
        </ul></div>
      </div>
    </Sec>
    <Sec t="대화가 더 길어지거나 사용 패턴이 달라지면 어디서 문제가 생기나? (과제 질문 3)">
      <ul>
        <li><b>기억 블록 포화</b> — 300턴에서는 {D.app_config.memory_budget_tokens}토큰 블록에도 항목 30~40개가 못 들어가 보충(뜻이 가까운 상위 3개)으로만 들어온다. 질문과 뜻으로 이어지지 않는 제약(고소공포증 ↔ 루프탑 바)은 놓친다 <Tag k="m" />.</li>
        <li><b>정보가 많은 사용자</b> — 활성 항목 상한 80개라 보관과 되살리기가 오간다(300턴 8런 합 보관 495 · 되살리기 264). 수천 턴 규모는 재지 않았다 <Tag k="u" />.</li>
        {C && <li><b>캐시 만료</b> — 대화 사이 공백이 길면 캐시가 비어 최악 {won(C.worst)} <Tag k="e" />.</li>}
        <li><b>평일 낮 사용 집중</b> — DeepSeek 피크 단가는 비피크의 2배 <Tag k="e" />.</li>
        <li><b>서버 메모리</b> — 임베딩 모델이 서버 프로세스마다 약 2.2GB 를 차지한다(실측 RSS) <Tag k="m" />. 서버를 늘리면 대수만큼 든다.</li>
        <li><b>한국어 외 언어</b> — 답 언어는 따라가지만(100%), 되묻기 신호·시간 표현 감지는 한국어 규칙이라 다른 언어의 기억 동작은 재지 않았다 <Tag k="u" />.</li>
      </ul>
    </Sec>
    <Sec t="사용자가 계속 대화하고 싶어 하는지, 가장 먼저 무엇을 확인하나? (과제 질문 4)">
      <ol>
        <li><b>소규모 A/B</b>: 신규 사용자를 무작위로 두 설정에 배정. 주 지표는 <b>세션당 턴 수와 다음 날 재방문율</b>, 보조 지표는 대화를 그만둔 턴 직전 답, 👍/👎.</li>
        <li><b>기억 실패 신고 버튼</b>(“이거 말했잖아”)으로 실제 대화에서 기억이 틀린 빈도를 잰다.</li>
        <li>그 전에 0원으로: Opus 가 판정한 장면 일부를 사람이 블라인드로 다시 매겨 AI 판정이 사람과 얼마나 맞는지 본다.</li>
      </ol>
    </Sec>
  </>;
}

function Next() {
  const C = L120?.cost?.[FC], FR = lt[FC], Q = QF, m2 = M3?.mb2, FL = FIN?.follow;
  return <>
    <Tldr><ul>
      <li>남은 약점: <b>질문과 뜻으로 이어지지 않는 기억</b>(120턴 돌려 묻는 문항), <b>맥락 점수 하락</b>, 사람 판정이 없는 품질 평가.</li>
      <li><b>사용자가 계속 대화하고 싶어 하는지는 아직 증명하지 못했다.</b> 모든 품질 수치는 고정 대본에 대한 AI 판정이고, 실제 사용자 실험은 하지 않았다.</li>
    </ul></Tldr>
    <Sec t="확인한 것과 확인하지 않은 것" sub="확인한 것 = 이 리포트의 시험에서 실제로 잰 값. 확인하지 않은 것 = 아직 재지 않아 가설로 남은 것.">
      <Table head={['', '내용', '근거 / 확인 방법']} rows={[
        ...(C ? [[<Tag key="m1" k="m" />, `120턴 대화 턴당 평균 ${won(C.measured)}${FR ? `, 1원 넘은 턴 런당 ${FR.over1_per_run}턴` : ''}`, '120턴 대본 4개 × 2회, 앱 DB와 제공사 장부 대조(비용 탭)']] : []),
        ...(m2 ? [[<Tag key="m2" k="m" />, `300턴 장기 기억 정답률 ${pc(m2.correct_pct)}, 지어낸 기억 ${m2.counts.fabricated ?? 0}건`, 'Opus 블라인드 채점, 함정 문항 포함(장기 기억 탭)']] : []),
        ...(Q ? [[<Tag key="m3" k="m" />, `AI 판정 품질 전반 ${Q[FC].overall.toFixed(2)} / 5`, 'Opus 블라인드 판정(테스트 및 검증 탭)']] : []),
        ...(FL ? [[<Tag key="m4" k="m" />, `사용자 말에 먼저 답하기 ${pc(FL.follow.direct.pct)}, 사용자 언어로 답하기 100%`, '대화 따르기 대본 320턴, Opus 블라인드']] : []),
        ...(C ? [[<Tag key="e1" k="e" />, `평일 낮 피크 단가 ${won(C.peak)}, 캐시가 하나도 안 맞을 때 ${won(C.worst)}`, '기록된 토큰을 피크·정가로 다시 계산. 피크 시간에 직접 돌리지는 않았다']] : []),
        [<Tag key="e2" k="e" />, '임베딩 CPU 비용 턴당 약 0.0014원', '기록된 임베딩 시간 × 실측 CPU 비율 × 서버 단가(비용 탭)'],
        [<Tag key="u1" k="u" />, '실제 사용자가 계속 대화하고 싶어 한다', '측정 안 함 → 소규모 A/B: 세션당 턴 수·다음 날 재방문율(아래 과제 질문 4)'],
        [<Tag key="u2" k="u" />, 'AI 판정이 사람 판단과 같다', '측정 안 함 → 사람 블라인드 판정으로 맞춰 보기'],
        [<Tag key="u3" k="u" />, '300턴보다 긴 대화, 수십 번의 재방문, 한국어 외 언어의 기억', '측정 안 함 → 같은 방식의 긴 대본·다국어 대본'],
        [<Tag key="u4" k="u" />, '비용을 더 낮출 수 있는 정도', '측정 안 함 → 기억 블록·창 크기·출력 한도를 하나씩 줄여 보기(비용 탭)'],
        [<Tag key="u5" k="u" />, '사람이 입력하는 간격에서의 지연', '벤치는 턴 사이 대기 없이 보냄 → 실제 입력 간격으로 다시 재기'],
      ]} />
    </Sec>
    <QA234 />
    <Sec t="이번 검증의 한계">
      <ul>
        <li><b>시험 문항과 정답 기준은 우리가 만들었다</b> — 사용자 체감과 어긋날 수 있다. 예: 120턴 판정의 이어 가기 점수는 4.30 으로 높았지만 실제 데모에서는 영어로 말해 달라는 요청을 무시하고 단답으로 끝나는 대화가 보였고, 그래서 대화 따르기 대본을 따로 만들었다.</li>
        <li><b>판정은 Opus 하나다.</b> 사람 판정은 없다.</li>
        <li><b>기억 v2 의 시행착오</b> — 처음 설계에서 고정 블록을 800토큰으로 줄였다가 120턴에서 돌려 묻는 문항이 떨어졌고(37 → 18/40), 2000토큰으로 되돌렸다.</li>
        <li><b>같은 대본을 보고 고치고 같은 대본으로 다시 쟀다</b> — 개선판의 설정과 기억 v2 의 결함 수정 7건은 120턴·300턴 실패 기록을 보고 정했고, 재측정도 같은 대본이다. 효과가 부풀려졌을 수 있다.</li>
        {L120?.memory_excl_implicit && <li>120턴 ‘암묵 적용 제외’ 점수는 결과를 본 뒤에 정한 제외다.</li>}
        {M3?.mb3_leak && <li>다른 캐릭터 약속 누출 0건(마지막 수정 뒤)은 금지 낱말 검사와 원문 읽기로 확인했고 블라인드 판정이 아니다.</li>}
        <li>비용 낮추기 측정(1원보다 얼마나 더 낮출 수 있나)은 시간 안에 하지 못했다.</li>
        <li>고정 대본이라 실제 사용자처럼 반응하지 않는다. 한국어, 캐릭터 4개, 300턴까지만 확인했다.</li>
        {DT && <li>오늘 날짜는 사용자 말의 시간 표현을 글자 규칙으로 찾을 때만 넣는다. 시간 낱말이 없는 말(예: “그날 기억나?”)에는 날짜가 붙지 않고, 한국어 외 표현은 재지 않았다.</li>}
        <li>시험은 DeepSeek 비피크 시간에 돌았다. 피크 비용은 기록된 토큰으로 다시 계산한 값이다.</li>
      </ul>
    </Sec>
  </>;
}

function Api() {
  const base = typeof window === 'undefined' ? 'https://<데모 주소>' : window.location.origin;
  const code = `BASE=${base}
# 1) 대화 시작 (user_name 이 같으면 이전 대화의 기억을 이어 받는다)
curl -s -X POST $BASE/api/conversations -H 'content-type: application/json' \\
  -d '{"user_name":"tester","character_id":"baekho"}'
# → {"conversation_id":123, ...}   캐릭터: baekho · naruto · backend · sejong

# 2) 메시지 보내기 (턴마다 반복)
curl -s -X POST $BASE/api/conversations/123/messages -H 'content-type: application/json' \\
  -d '{"text":"나 우유 마시면 배 아파서 두유만 마셔."}'

# 3) 저장된 기억 (출처 턴·대체 이력 포함, 약속·사건은 캐릭터별)
curl -s "$BASE/api/memory?user=tester&character=baekho&include_superseded=1&include_log=1"

# 4) 대화 비용 리포트 (평균·구간·최대 턴)
curl -s $BASE/api/conversations/123/report

# 5) 대화 종료 (기억 정리 + 대화 요약)
curl -s -X POST $BASE/api/conversations/123/end`;
  return <>
    <p>화면에서는 왼쪽 메뉴 <b>새 채팅</b>으로 대화하고, 대화 메뉴의 <b>리포트</b>로 턴별 비용을 본다. 아래는 같은 일을 curl 로 하는 방법이다.</p>
    <pre className="rp-code">{code}</pre>
    <p className="rp-note">장기 기억 확인 예: 정보를 하나 말한 뒤 다른 얘기를 13턴 이상 하고 “내가 뭐 못 마신다고 했지?”라고 묻는다. 정보를 바꿔 말하고 다시 묻거나, 말한 적 없는 것을 물어 지어내지 않는지 본다. 제출물에는 API 키 등 비밀값을 넣지 않았다(키는 저장소에 올리지 않는 <code>.env</code> 에만 있고, 키 이름만 적은 <code>.env.example</code> 을 둔다). 재현 자료: 대본 <code>model/bench/scenarios/*.json</code>, 실행기 <code>model/bench/run.mjs</code>, 결정 기록 <code>docs/50-decision-log.md</code>.</p>
  </>;
}

export const VIEWS = { overview: Overview, arch: Arch, cost: Cost, memory: Memory, test: Test, next: Next };
