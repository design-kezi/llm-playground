// 리포트 공통 부품. 탭마다 같은 틀: 결론(Head) → 숫자 카드 → 근거 그림 → 표 → 접힌 세부(More).
export const won = (x, d = 3) => (x == null ? '–' : `${x.toFixed(d)}원`);
export const pc = (x, d = 1) => (x == null ? '–' : `${x.toFixed(d)}%`);
export const pv = (p) => (p < 0.001 ? '<0.001' : p < 0.01 ? p.toFixed(3) : p.toFixed(2));
export const wl = (v) => (v ? `${v.win ?? v.better}:${v.loss ?? v.worse}${v.p != null ? ` (p ${pv(v.p)})` : ''}` : '기준');

export const Tag = ({ k }) => <span className={`rp-tag rp-${k}`}>{{ m: '실측', e: '추정', u: '미검증' }[k]}</span>;
// 숫자 출처 꼬리표(측정 목록의 이름)
export const Src = ({ children }) => <span className="rp-src">{children}</span>;
export const Table = ({ head, rows, num, compact }) => (
  <div className="rp-tw"><table className={`rp-t ${compact ? 'cp' : ''}`}>
    <thead><tr>{head.map((h, i) => <th key={i}>{h}</th>)}</tr></thead>
    <tbody>{rows.map((r, i) => <tr key={i} className={r.hl ? 'hl' : ''}>{(r.cells ?? r).map((c, j) => <td key={j} className={num && j > 0 ? 'n' : ''}>{c}</td>)}</tr>)}</tbody>
  </table></div>
);
// 탭 첫머리: 결론 한 문장 + 짧은 설명
export const Head = ({ t, children }) => <div className="rp-head2"><h2>{t}</h2>{children && <p>{children}</p>}</div>;
// 섹션: 제목은 결론 문장, sub 는 무엇을 어떻게 쟀는지
export const Sec = ({ t, sub, id, children }) => <section className="rp-sec" id={id}><h3>{t}</h3>{sub && <p className="rp-sub">{sub}</p>}{children}</section>;
export const More = ({ t, children, open }) => <details className="rp-more" open={open}><summary>{t}</summary><div className="b">{children}</div></details>;
export const Note = ({ children }) => <p className="rp-note">{children}</p>;
export const Legend = () => <p className="rp-badges"><Tag k="m" /> 실제로 돌려서 잰 값 <Tag k="e" /> 잰 값이나 공개 가격으로 계산한 값 <Tag k="u" /> 확인하지 않은 가설</p>;
// "[실측]" 같은 글 표기를 배지로
export const tagText = (c) => (typeof c !== 'string' ? c : c.split(/(\[실측\]|\[추정\]|\[미검증\])/).map((part, i) => ({ '[실측]': <Tag key={i} k="m" />, '[추정]': <Tag key={i} k="e" />, '[미검증]': <Tag key={i} k="u" /> }[part] ?? part)));
