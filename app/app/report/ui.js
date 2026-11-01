// 리포트 공통 부품. 읽는 순서 기준(docs/50 2026-11-01 시각화 리뷰): 결론 먼저(Tldr) → 핵심 그림·숫자 → 자세한 표는 접기(More).
export const won = (x, d = 3) => (x == null ? '–' : `${x.toFixed(d)}원`);
export const pc = (x) => (x == null ? '–' : `${x.toFixed(1)}%`);
export const pv = (p) => (p < 0.001 ? '<0.001' : p < 0.01 ? p.toFixed(3) : p.toFixed(2));
export const wl = (v) => (v ? `${v.win ?? v.better}:${v.loss ?? v.worse}${v.p != null ? ` (p ${pv(v.p)})` : ''}` : '기준');

export const Tag = ({ k }) => <span className={`rp-tag rp-${k}`}>{{ m: '실측', e: '추정', u: '미검증' }[k]}</span>;
export const Table = ({ head, rows, num }) => (
  <div className="rp-tw"><table className="rp-t">
    <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className={r.hl ? 'hl' : ''}>{(r.cells ?? r).map((c, j) => <td key={j} className={num && j > 0 ? 'n' : ''}>{c}</td>)}</tr>)}</tbody>
  </table></div>
);
export const Stat = ({ v, l, s, t, good }) => <div className={`rp-stat ${good ? 'good' : ''}`}><div className="v">{v}</div><div className="l">{l} {t && <Tag k={t} />}</div>{s && <div className="s">{s}</div>}</div>;
export const Sec = ({ t, sub, children }) => <section className="rp-sec"><h2>{t}</h2>{sub && <p className="rp-sub">{sub}</p>}{children}</section>;
// 탭 맨 위 결론 상자: 처음 보는 사람이 여기만 읽어도 탭의 결론을 알게
export const Tldr = ({ children }) => <div className="rp-tldr"><div className="k">한눈에</div>{children}</div>;
// 자세한 근거는 접어 둔다(펼치면 그대로 보임, 인쇄용 전체 보기에서는 펼친 채로)
export const More = ({ t, children, open }) => <details className="rp-more" open={open}><summary>{t}</summary><div className="b">{children}</div></details>;

// 가로 막대: 조건 비교. hl = 제안 구성, dim = 비교용(대조군), line = 기준선(예: 1원), r.mark = 막대 위 눈금(예: 피크 단가).
// 값 라벨은 막대 끝에 바로 붙인다(범례 없이 읽히게). r.tag = 막대 옆 짧은 설명(예: "비교용").
export function HBars({ rows, max, fmt, line, mark, unit }) {
  const m = max ?? Math.max(...rows.map((r) => Math.max(r.v, r.mark ?? 0)), line?.v ?? 0) * 1.08;
  const x = (v) => `${Math.min(100, (v / m) * 100)}%`;
  return <div className="rp-hb">
    {unit && <div className="rp-hb-unit">{unit}</div>}
    {rows.map((r) => <div key={r.l} className={`rp-hb-r ${r.hl ? 'hl' : ''} ${r.dim ? 'dim' : ''}`}>
      <div className="l">{r.l}</div>
      <div className="tr">
        <i style={{ width: x(r.v) }} />
        {line && <b className="ref" style={{ left: x(line.v) }} />}
        {r.mark != null && <u className="mk" style={{ left: x(r.mark) }} title={mark} />}
        <span className="v" style={{ left: `calc(${x(Math.max(r.v, r.mark ?? 0))} + 6px)` }}>{fmt(r.v)}{r.tag && <em> {r.tag}</em>}</span>
      </div>
    </div>)}
    {(line || mark) && <div className="rp-hb-key">{line && <span><b className="ref" />{line.l}</span>}{mark && <span><u className="mk" />{mark}</span>}</div>}
  </div>;
}

// "[실측]" 같은 글 표기를 배지로
export const tagText = (c) => (typeof c !== 'string' ? c : c.split(/(\[실측\]|\[추정\]|\[미검증\])/).map((part, i) => ({ '[실측]': <Tag key={i} k="m" />, '[추정]': <Tag key={i} k="e" />, '[미검증]': <Tag key={i} k="u" /> }[part] ?? part)));
export const Badges = () => <p className="rp-badges"><Tag k="m" /> 실제로 돌려서 잰 값 <Tag k="e" /> 잰 값·공개 가격으로 계산한 값 <Tag k="u" /> 아직 확인 안 한 가설</p>;

// 비율 막대(한 줄): 비용 구성 등
export function Split({ parts, fmt = won }) {
  const tot = parts.reduce((a, p) => a + p.v, 0);
  return <div><div className="rp-bar">{parts.map((p) => <span key={p.l} style={{ width: `${(p.v / tot) * 100}%`, background: p.c }} title={p.l} />)}</div>
    <div className="rp-legend">{parts.map((p) => <span key={p.l}><i style={{ background: p.c }} />{p.l} {fmt(p.v)} ({Math.round((p.v / tot) * 100)}%)</span>)}</div></div>;
}
