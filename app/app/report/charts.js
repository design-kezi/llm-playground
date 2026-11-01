// 리포트 차트. 규칙: 막대는 0 기준, 강조형(최종만 파랑·나머지 회색), 값은 직접 라벨, 기준선은 실선 + 축 위 라벨.
// 글자는 HTML 로 그려 화면 폭과 상관없이 크기가 같고, SVG 는 선·점만 그린다(viewBox 축소로 글자가 작아지지 않게).

const pct = (v, lo, hi) => `${Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))}%`;

// 숫자 카드. tag = 실측/추정 배지(ui.js Tag), note = 한 줄 부연
export function Kpis({ items }) {
  return <div className="ch-kpis">{items.map((k) => <div key={k.label} className={`ch-kpi ${k.tone ?? ''}`}>
    <div className="v">{k.value}</div><div className="l">{k.label}</div>{k.note && <div className="s">{k.note}</div>}
  </div>)}</div>;
}

// 판정: 아이콘 + 글자(색만으로 구분하지 않음)
const VERDICT = { pass: ['✓', '충족'], fail: ['✗', '미달'], self: ['◐', '자체 판정'], none: ['–', '측정 안 함'] };
export const Verdict = ({ k, t }) => <span className={`ch-vd ch-vd-${k}`}><b aria-hidden>{VERDICT[k][0]}</b>{t ?? VERDICT[k][1]}</span>;

// 가로 막대. rows: { label, value, hl, muted, note }, ref: { v, label }
export function Bars({ rows, max, fmt, limit: ref, unit }) {
  const hi = max ?? Math.max(...rows.map((r) => r.value), ref?.v ?? 0) * 1.1;
  return <div className="ch-bars">
    <div className="ch-bars-axis"><span /><div>{ref && <div className="ch-bars-reflab" style={{ left: pct(ref.v, 0, hi) }}>{ref.label}</div>}</div></div>
    {rows.map((r) => <div key={r.label} className={`ch-bar ${r.hl ? 'hl' : ''} ${r.muted ? 'mu' : ''}`}>
      <div className="l">{r.label}</div>
      <div className="tr">
        <i style={{ width: pct(r.value, 0, hi) }} />
        {ref && <b style={{ left: pct(ref.v, 0, hi) }} />}
        <span style={{ left: pct(r.value, 0, hi) }}>{fmt(r.value)}{r.note && <em>{r.note}</em>}</span>
      </div>
    </div>)}
    {unit && <div className="ch-unit">{unit}</div>}
  </div>;
}

// 누적 막대 한 줄(구성). parts: { label, value, tone } tone = a(강조) | b | c | d
export function Stack({ parts, fmt }) {
  const tot = parts.reduce((s, p) => s + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  return <div className="ch-stack">
    <div className="bar">{shown.map((p) => <span key={p.label} className={`t-${p.tone}`} style={{ width: `${(p.value / tot) * 100}%` }} />)}</div>
    <ul>{parts.map((p) => <li key={p.label}><i className={`t-${p.tone}`} />{p.label} <b>{fmt(p.value)}</b> <span>{tot ? Math.round((p.value / tot) * 100) : 0}%</span></li>)}</ul>
  </div>;
}

// 점 그림(리커트 1~5 같은 0 기준이 아닌 척도). rows: { label, points: [{ v, k: 'a'|'b'|'c', title }] }
export function Dots({ rows, lo, hi, ticks, fmt = (v) => v.toFixed(2), keys }) {
  return <div className="ch-dots">
    {keys && <ul className="ch-key">{keys.map((k) => <li key={k.k}><i className={`d-${k.k}`} />{k.label}</li>)}</ul>}
    <div className="ch-dots-axis"><span />{<div className="ax">{ticks.map((t) => <em key={t} style={{ left: pct(t, lo, hi) }}>{t}</em>)}</div>}</div>
    {rows.map((r) => {
      const vs = r.points.map((p) => p.v), a = Math.min(...vs), b = Math.max(...vs);
      return <div key={r.label} className="ch-dot">
        <div className="l">{r.label}</div>
        <div className="tr">
          {ticks.map((t) => <s key={t} style={{ left: pct(t, lo, hi) }} />)}
          {r.points.length > 1 && <u style={{ left: pct(a, lo, hi), width: `calc(${pct(b, lo, hi)} - ${pct(a, lo, hi)})` }} />}
          {r.points.map((p) => <i key={p.k} className={`d-${p.k}`} style={{ left: pct(p.v, lo, hi) }} title={p.title} />)}
        </div>
        <div className="v">{r.points.map((p) => <span key={p.k} className={`d-${p.k}`}>{fmt(p.v)}</span>)}</div>
      </div>;
    })}
  </div>;
}

// 턴별 꺾은선. data: [{ x, y, y2? }] y = 평균, y2 = 최댓값(옅게). ref = 기준선
export function Line({ data, ymax, limit: ref, xlabel, ylabel, fmt }) {
  const W = 1000, H = 300, xs = data.map((d) => d.x), x0 = Math.min(...xs), x1 = Math.max(...xs);
  const X = (x) => ((x - x0) / (x1 - x0)) * W, Y = (y) => H - (Math.min(y, ymax) / ymax) * H;
  const path = (k) => data.map((d, i) => `${i ? 'L' : 'M'}${X(d.x).toFixed(1)},${Y(d[k]).toFixed(1)}`).join('');
  const yt = [0, ymax / 2, ymax];
  return <div className="ch-line">
    <div className="ch-line-y">{yt.slice().reverse().map((t) => <span key={t}>{fmt(t)}</span>)}</div>
    <div className="ch-line-plot">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={ylabel}>
        {yt.map((t) => <line key={t} x1="0" x2={W} y1={Y(t)} y2={Y(t)} className="grid" vectorEffect="non-scaling-stroke" />)}
        {data[0].y2 != null && <path d={path('y2')} className="l2" vectorEffect="non-scaling-stroke" />}
        <path d={path('y')} className="l1" vectorEffect="non-scaling-stroke" />
        {ref && <line x1="0" x2={W} y1={Y(ref.v)} y2={Y(ref.v)} className="ref" vectorEffect="non-scaling-stroke" />}
      </svg>
      {ref && <div className="reflab" style={{ bottom: `${(ref.v / ymax) * 100}%` }}>{ref.label}</div>}
      <div className="ch-line-x"><span>{x0}</span><span>{xlabel}</span><span>{x1}</span></div>
    </div>
  </div>;
}
