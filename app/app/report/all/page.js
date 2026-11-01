// 과제 리포트 전체 보기(모든 탭을 한 페이지에, 인쇄·PDF 저장용).
import { TABS, VIEWS } from '../views.js';
import ExpandAll from '../expand.js';

export const metadata = { title: '라이트 모드 리포트 — 전체' };
export default function All() {
  return (
    <div className="rp">
      <header className="rp-head rp-static">
        <a href="/report" className="rp-back">← 탭으로 보기</a>
        <h1>라이트 모드 — 1턴 1원 이하 롤플레잉 채팅 제안</h1>
      </header>
      <main className="rp-body">
        <ExpandAll />
        {TABS.map(([k, l]) => { const V = VIEWS[k]; return <div key={k} className="rp-part"><h1 className="rp-ptitle">{l}</h1><V print /></div>; })}
      </main>
    </div>
  );
}
