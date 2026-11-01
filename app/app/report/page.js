'use client';
// 과제 제출 리포트(탭). 내용은 views.js, 숫자는 data.json(model/bench/report-data.mjs 가 벤치 결과에서 생성).
import { useEffect, useState } from 'react';
import { TABS, VIEWS, ALIAS } from './views.js';

export default function Report() {
  const [tab, setTab] = useState('overview');
  useEffect(() => {
    const pick = () => { const x = window.location.hash.slice(1); const k = ALIAS[x] ?? x; if (VIEWS[k]) setTab(k); };
    pick();
    const on = pick;
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = (k) => { setTab(k); window.history.replaceState(null, '', `#${k}`); window.scrollTo(0, 0); };
  const View = VIEWS[tab];
  return (
    <div className="rp">
      <header className="rp-head">
        <a href="/" className="rp-back">← 채팅으로</a>
        <h1>라이트 모드 — 1턴 1원 이하 롤플레잉 채팅 제안</h1>
        <select className="rp-tabsel" value={tab} onChange={(e) => (e.target.value === 'all' ? (window.location.href = '/report/all') : go(e.target.value))} aria-label="탭 고르기">
          {TABS.map(([k, l], i) => <option key={k} value={k}>{i + 1}. {l}</option>)}<option value="all">전체 보기·인쇄</option>
        </select>
        <nav className="rp-tabs">{TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}>{l}</button>)}<a className="rp-all" href="/report/all">전체 보기·인쇄</a></nav>
      </header>
      <main className="rp-body"><View /></main>
    </div>
  );
}
