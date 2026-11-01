// 시점 표현 → 절대 날짜(YYYY-MM-DD) 결정적 환산. 모델의 날짜 산술은 5회 중 2회 틀렸다(scripts/extract-repeat.mjs, 2026-10-23).
// 추출기는 when 을 원문으로 쓰고, 여기서 환산해 "YYYY-MM-DD (원문)" 로 저장한다. 환산 불가면 원문 그대로.
// 한국어만. 주는 월요일 시작. 다국어는 lang 별 표를 추가하는 지점.
const WD = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };
const KNUM = { 하루: 1, 이틀: 2, 사흘: 3, 나흘: 4, 닷새: 5, 엿새: 6, 이레: 7, 일주일: 7, 보름: 15, 한: 1, 두: 2, 세: 3, 네: 4 };

function parseYmd(s) { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s ?? ''); return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null; }
function ymd(d) { return d.toISOString().slice(0, 10); }
function addDays(d, n) { return new Date(d.getTime() + n * 86400000); }
function mondayOf(d) { const dow = (d.getUTCDay() + 6) % 7; return addDays(d, -dow); } // 월=0

export function resolveWhen(raw, today) {
  const base = parseYmd(today);
  if (!raw || !base) return null;
  // 이미 "YYYY-MM-DD (원문)" 형태면 원문으로 다시 환산(모델 환산 오류 교정), 원문이 없으면 그대로 신뢰
  const pre = /^(\d{4}-\d{2}-\d{2})(?:~\d{4}-\d{2}-\d{2})?\s*(?:\((.*)\))?\s*$/.exec(raw.trim());
  if (pre) { const r = pre[2] ? resolveWhen(pre[2], today) : null; return r ?? pre[1]; }
  const t = raw.replace(/\s+/g, ' ').trim();
  let m;
  if (/^오늘/.test(t)) return ymd(base);
  if (/^내일/.test(t)) return ymd(addDays(base, 1));
  if (/^모레/.test(t)) return ymd(addDays(base, 2));
  if (/^어제/.test(t)) return ymd(addDays(base, -1));
  if (/^그제|^그저께/.test(t)) return ymd(addDays(base, -2));
  if ((m = /^(하루|이틀|사흘|나흘|닷새|엿새|이레|일주일|보름)\s*(뒤|후|전|만에)/.exec(t))) { const n = KNUM[m[1]]; return ymd(addDays(base, m[2] === '전' ? -n : n)); }
  if ((m = /^(\d+)\s*일\s*(뒤|후|전|만에)/.exec(t))) { const n = +m[1]; return ymd(addDays(base, m[2] === '전' ? -n : n)); }
  if ((m = /^(\d+|[가-힣]+)\s*주\s*(뒤|후|전)/.exec(t))) { const n = /^\d+$/.test(m[1]) ? +m[1] : KNUM[m[1]]; if (n) return ymd(addDays(base, (m[2] === '전' ? -n : n) * 7)); }
  if ((m = /^(지난|이번|다음|다다음)\s*주\s*([일월화수목금토])요일/.exec(t))) {
    const off = { 지난: -1, 이번: 0, 다음: 1, 다다음: 2 }[m[1]];
    const mon = addDays(mondayOf(base), off * 7); const wd = WD[m[2]]; return ymd(addDays(mon, (wd + 6) % 7));
  }
  if ((m = /^(지난|이번|다음)\s*주말/.exec(t))) { const off = { 지난: -1, 이번: 0, 다음: 1 }[m[1]]; return ymd(addDays(mondayOf(base), off * 7 + 5)); }
  if ((m = /^(지난|이번|이|다음)\s*달\s*(\d{1,2})\s*일/.exec(t))) { const off = { 지난: -1, 이번: 0, 이: 0, 다음: 1 }[m[1]]; const d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + off, +m[2])); return d.getUTCDate() === +m[2] ? ymd(d) : null; }
  if ((m = /^(\d{1,2})\s*월\s*(\d{1,2})\s*일/.exec(t))) { let d = new Date(Date.UTC(base.getUTCFullYear(), +m[1] - 1, +m[2])); if (d < addDays(base, -180)) d = new Date(Date.UTC(base.getUTCFullYear() + 1, +m[1] - 1, +m[2])); return ymd(d); }
  if ((m = /^(\d{1,2})\s*일(?![가-힣])/.exec(t)) && +m[1] >= 1 && +m[1] <= 31) { // 맨 앞 "28일": 이번 달, 이미 지났으면 다음 달
    let d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), +m[1])); if (d < base) d = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, +m[1])); return ymd(d);
  }
  if ((m = /^(지난|이번|다음|다다음)?\s*([일월화수목금토])요일/.exec(t))) { // 수식어 없는 "토요일" = 오늘 포함 가장 가까운 다음 요일
    const wd = WD[m[2]];
    if (m[1] === '지난') return ymd(addDays(base, -(((base.getUTCDay() - wd) + 6) % 7 + 1)));
    return ymd(addDays(base, ((wd - base.getUTCDay()) + 7) % 7));
  }
  return null;
}

// 저장 형식: 환산되면 "YYYY-MM-DD (원문)", 아니면 원문. 원문이 이미 "YYYY-MM-DD (원문)" 이면 원문 부분만 괄호에 남긴다.
export function formatWhen(raw, today) {
  if (raw == null || !String(raw).trim()) return null;
  const s = String(raw).trim();
  const pre = /^(\d{4}-\d{2}-\d{2})(?:~\d{4}-\d{2}-\d{2})?\s*(?:\((.*)\))?\s*$/.exec(s);
  const orig = pre ? (pre[2]?.trim() || null) : s;
  const d = resolveWhen(s, today);
  if (!d) return orig ?? s;
  return orig && orig !== d ? `${d} (${orig})` : d;
}

// v2 보충 검색용: 질문의 시점 표현에서 날짜 범위 [from, to](YYYY-MM-DD, 포함)를 뽑는다. 없으면 null. today = 'YYYY-MM-DD'.
// 지원: 지난달/저번 달/전달, 이번 달, 지난주/저번 주, N일 전, N주 전, N달 전/N개월 전, 작년, M월 (초|중순|말)?, 어제/그제, 올해 M월. 표현이 하나도 없으면 null.
export function dateRangeFromQuery(text = '', today) {
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const T = new Date(today + 'T00:00:00Z');
  const ymd = (d) => d.toISOString().slice(0, 10);
  const shift = (d, days) => new Date(d.getTime() + days * 86400000);
  const monthRange = (y, m, part) => { // m: 1~12
    const first = new Date(Date.UTC(y, m - 1, 1)), last = new Date(Date.UTC(y, m, 0));
    if (part === '초') return [ymd(first), ymd(new Date(Date.UTC(y, m - 1, 10)))];
    if (part === '중순') return [ymd(new Date(Date.UTC(y, m - 1, 11))), ymd(new Date(Date.UTC(y, m - 1, 20)))];
    if (part === '말') return [ymd(new Date(Date.UTC(y, m - 1, 21))), ymd(last)];
    return [ymd(first), ymd(last)];
  };
  let m;
  if (/(지난\s*달|저번\s*달|전달)/.test(text)) { const y = T.getUTCMonth() === 0 ? T.getUTCFullYear() - 1 : T.getUTCFullYear(), mo = T.getUTCMonth() === 0 ? 12 : T.getUTCMonth(); const part = /(초|중순|말)/.exec(text.slice(text.search(/(지난\s*달|저번\s*달|전달)/)))?.[1]; return monthRange(y, mo, part); }
  if (/이번\s*달/.test(text)) { const part = /이번\s*달\s*(초|중순|말)/.exec(text)?.[1]; return monthRange(T.getUTCFullYear(), T.getUTCMonth() + 1, part); }
  if (/(지난\s*주|저번\s*주)/.test(text)) { const dow = T.getUTCDay(); const thisMon = shift(T, -((dow + 6) % 7)); return [ymd(shift(thisMon, -7)), ymd(shift(thisMon, -1))]; }
  if ((m = /(\d+)\s*일\s*전/.exec(text))) { const d = shift(T, -Number(m[1])); return [ymd(shift(d, -3)), ymd(shift(d, 3))]; }
  if ((m = /(\d+)\s*주\s*전/.exec(text))) { const d = shift(T, -7 * Number(m[1])); return [ymd(shift(d, -7)), ymd(shift(d, 7))]; }
  if ((m = /(\d+)\s*(달|개월)\s*전/.exec(text))) { const n = Number(m[1]); const y = T.getUTCFullYear(), mo = T.getUTCMonth() + 1 - n; const yy = y + Math.floor((mo - 1) / 12), mm = ((mo - 1) % 12 + 12) % 12 + 1; return monthRange(yy, mm); }
  if (/작년/.test(text)) { const y = T.getUTCFullYear() - 1; return [`${y}-01-01`, `${y}-12-31`]; }
  if (/(어제|그제|엊그제)/.test(text)) return [ymd(shift(T, -3)), ymd(shift(T, -1))];
  if ((m = /(\d{1,2})\s*월\s*(초|중순|말)?/.exec(text))) { const mo = Number(m[1]); if (mo >= 1 && mo <= 12) { let y = T.getUTCFullYear(); if (mo > T.getUTCMonth() + 1) y -= 1; return monthRange(y, mo, m[2]); } }
  return null;
}
