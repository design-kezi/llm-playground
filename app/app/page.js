'use client';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

const api = (url, body, method) =>
  fetch(url, body === undefined && !method ? undefined : { method: method ?? 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) })
    .then(async (r) => { const j = await r.json(); if (!r.ok) throw new Error(j.error); return j; });

// SSE 로 받기: 조각은 onDelta, 끝 이벤트({done,…})를 반환
async function streamPost(url, body, onDelta, signal, onSaved) {
  const r = await fetch(`${url}?stream=1`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}), signal });
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? `HTTP ${r.status}`);
  const reader = r.body.getReader(), dec = new TextDecoder();
  let buf = '', result = null;
  for (;;) {
    const { value, done } = await reader.read();
    buf += done ? dec.decode() : dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 2);
      if (!line.startsWith('data: ')) continue;
      const ev = JSON.parse(line.slice(6));
      if (ev.delta != null) onDelta(ev.delta);
      else if (ev.saved) onSaved?.();
      else if (ev.error) throw new Error(ev.error);
      else if (ev.done) result = ev;
    }
    if (done) break;
  }
  if (!result) throw new Error('응답이 중간에 끊겼어요');
  return result;
}

const won = (n) => `${n.toFixed(3)}원`;
const LANGS = { ko: '한국어', en: 'English', ja: '日本語', 'zh-TW': '繁體中文' };
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const mobile = () => window.innerWidth < 768;

// *지문* 은 제 줄의 기울임, 나머지는 대사. 빈 줄로 나뉜 덩어리는 문단으로
const narrated = (t) => t.split(/\n{2,}/).map((para, j) => (
  <p key={j}>{para.split(/(\*[^*]+\*)/).map((p, i) => /^\*[^*]+\*$/.test(p)
    ? <i key={i} className="narr">{p.slice(1, -1)}</i> : p.trim())}</p>
));

// 스트리밍 중 아직 닫히지 않은 *지문 도 지문으로 보이게
const closeStar = (t) => ((t.match(/\*/g)?.length ?? 0) % 2 ? (t.endsWith('*') ? t.slice(0, -1) : `${t}*`) : t);

// 사이드바 날짜 묶음(ChatGPT 와 같은 기준)
function groupOf(iso) {
  const d = new Date(iso), t = new Date(); t.setHours(0, 0, 0, 0);
  const days = Math.floor((t - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  return days <= 0 ? '오늘' : days === 1 ? '어제' : days < 7 ? '지난 7일' : days < 30 ? '지난 30일' : '이전';
}

const sv = (d, w = 20, sw = 1.6) => <svg width={w} height={w} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{d}</svg>;
const I = {
  sidebar: sv(<><rect x="2.5" y="3.5" width="15" height="13" rx="3" /><path d="M7.5 3.5v13" /></>),
  edit: sv(<><path d="M9 3.5H5.5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V11" /><path d="M14.2 2.8a1.7 1.7 0 0 1 2.4 2.4L10 11.8l-3 .7.7-3z" /></>),
  pencil: sv(<path d="M13.5 3.5a1.8 1.8 0 0 1 2.5 2.5L7 15l-3.5 1 1-3.5z" />, 18),
  chev: sv(<path d="m5 8 5 5 5-5" />, 16),
  up: sv(<path d="M10 16V4M4.5 9.5 10 4l5.5 5.5" />, 20, 2),
  stop: <svg width="14" height="14" viewBox="0 0 14 14"><rect width="14" height="14" rx="2.5" fill="currentColor" /></svg>,
  down: sv(<path d="M10 4v12M4.5 10.5 10 16l5.5-5.5" />, 18, 1.8),
  copy: sv(<><rect x="6.5" y="6.5" width="10" height="10" rx="2" /><path d="M13.5 6.5V5a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 5v7A1.5 1.5 0 0 0 5 13.5h1.5" /></>, 18),
  check: sv(<path d="m4.5 10.5 3.5 3.5 7.5-8" />, 18, 1.8),
  tick: sv(<path d="m4.5 10.5 3.5 3.5 7.5-8" />, 18, 2),
  regen: sv(<><path d="M16 10a6 6 0 1 1-1.8-4.3" /><path d="M16 3.5v3h-3" /></>, 18),
  prev: sv(<path d="m12 5-5 5 5 5" />, 16, 1.8),
  next: sv(<path d="m8 5 5 5-5 5" />, 16, 1.8),
  dots: <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor"><circle cx="4.5" cy="10" r="1.5" /><circle cx="10" cy="10" r="1.5" /><circle cx="15.5" cy="10" r="1.5" /></svg>,
  report: sv(<><rect x="3.5" y="2.5" width="13" height="15" rx="2" /><path d="M7 13.5v-3M10 13.5v-6M13 13.5v-4.5" /></>, 20),
  trash: sv(<><path d="M3.5 5.5h13M8 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M5 5.5l.8 10.6a1.5 1.5 0 0 0 1.5 1.4h5.4a1.5 1.5 0 0 0 1.5-1.4L15 5.5" /></>, 18),
};

export default function Page() {
  const [userName, setUserName] = useState(null); // null = 아직 로드 전
  const [language, setLanguage] = useState('ko');
  const [characters, setCharacters] = useState([]);
  const [charId, setCharId] = useState('');
  const [convs, setConvs] = useState([]);
  const [conv, setConv] = useState(null); // {conversation_id, character_id, ended_at}
  const [msgs, setMsgs] = useState([]);
  const pending = useRef({}); // 캐릭터별(기억 창이 사용자·캐릭터 단위) 앞 요청이 기억 정리까지 끝날 때까지
  const seq = useRef({}); // 같은 줄의 요청 번호 — 뒤 요청이 줄 서 있으면 앞 요청은 화면을 다시 읽지 않는다
  const queued = (c) => pending.current[c.character_id]; // 종료·버전 전환도 이 줄 뒤에 선다
  const curId = useRef(null); // 지금 화면의 대화
  useEffect(() => { curId.current = conv?.conversation_id ?? null; }, [conv]);
  const [busy, setBusy] = useState(false); // 응답 생성 중(첫 조각 전 + 스트리밍 중)
  const [report, setReport] = useState(null);
  const [ending, setEnding] = useState(false);
  const [sidebar, setSidebar] = useState(true);
  const [menu, setMenu] = useState(null); // 'picker' | 'profile' | {conv}
  const [renaming, setRenaming] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [atBottom, setAtBottom] = useState(true);
  const threadRef = useRef(null);
  const stick = useRef(true);
  const inputRef = useRef(null);
  const convsRef = useRef([]);
  const abortRef = useRef(null);

  useEffect(() => {
    setUserName(store.get('lite.user') ?? '');
    setLanguage(store.get('lite.lang') ?? 'ko');
    if (mobile()) setSidebar(false);
    api('/api/characters').then((cs) => {
      setCharacters(cs);
      const saved = store.get('lite.char');
      setCharId(cs.some((c) => c.id === saved) ? saved : cs[0]?.id ?? '');
    });
    const onPop = () => openFromPath();
    // Ctrl/Cmd+Shift+O = 새 채팅 (ChatGPT 단축키)
    const onKey = (e) => { if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'o') { e.preventDefault(); newChat(); } };
    window.addEventListener('popstate', onPop);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('keydown', onKey); };
  }, []);

  const refreshConvs = useCallback(() => {
    if (!userName) return Promise.resolve([]);
    return api(`/api/conversations?user=${encodeURIComponent(userName)}`).then((l) => { setConvs(l); convsRef.current = l; return l; });
  }, [userName]);

  // 주소(/c/:id) 로 들어오면 그 대화를 연다
  const openFromPath = useCallback(async (list) => {
    const m = location.pathname.match(/^\/c\/(\d+)/);
    if (!m) { setConv(null); setMsgs([]); return; }
    const c = (list ?? convsRef.current).find((x) => x.conversation_id === Number(m[1]));
    if (!c) { history.replaceState(null, '', '/'); setConv(null); setMsgs([]); return; }
    await openConv(c, false);
  }, []);

  useEffect(() => { if (userName) refreshConvs().then((l) => openFromPath(l)); }, [userName]);

  const scrollToBottom = (smooth) => {
    const el = threadRef.current; if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  };
  const onScroll = () => {
    const el = threadRef.current;
    const b = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    stick.current = b; setAtBottom(b);
  };
  useLayoutEffect(() => { if (stick.current) scrollToBottom(false); }, [msgs, busy]);

  const character = characters.find((c) => c.id === (conv?.character_id ?? charId));
  const load = async (id) => {
    const rows = await api(`/api/conversations/${id}/messages`);
    setMsgs(rows.map((r) => ({ id: r.id, role: r.role, text: r.text, cost: r.cost_krw, turn_no: r.turn_no, editable: r.editable, versions: r.versions })));
  };

  async function openConv(c, push = true) {
    abortRef.current?.abort();
    setMenu(null); setReport(null);
    if (push) history.pushState(null, '', `/c/${c.conversation_id}`);
    if (mobile()) setSidebar(false);
    setConv(c); setMsgs([]); setBusy(false);
    stick.current = true;
    await load(c.conversation_id);
  }

  function newChat(id) {
    abortRef.current?.abort();
    setMenu(null); setReport(null); setConv(null); setMsgs([]); setBusy(false);
    if (id) { setCharId(id); store.set('lite.char', id); }
    history.pushState(null, '', '/');
    if (mobile()) setSidebar(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  // 답 하나 받기(보내기·수정·다시 생성 공통). 조각이 오는 대로 마지막 assistant 메시지에 붙인다.
  async function stream(url, body, c) {
    const id = c.conversation_id, key = c.character_id, my = (seq.current[key] = (seq.current[key] ?? 0) + 1);
    await pending.current[key]; // 같은 캐릭터의 앞 턴 기억 정리가 끝난 뒤에 보낸다
    const ctl = new AbortController(); abortRef.current = ctl;
    stick.current = true; setBusy(true);
    let release; const whole = new Promise((r) => { release = r; }); pending.current[key] = whole;
    // 답이 저장되면 입력을 바로 푼다(GPT처럼). 서버의 기억 정리는 뒤에서 이어진다
    const onSaved = () => { if (abortRef.current !== ctl) return; abortRef.current = null; setMsgs((l) => l.map((m) => (m.live ? { ...m, live: false } : m))); setBusy(false); };
    let started = false;
    const onDelta = (d) => setMsgs((l) => {
      if (!started) { started = true; return [...l, { role: 'assistant', text: d, live: true }]; }
      const last = l.at(-1);
      return [...l.slice(0, -1), { ...last, text: last.text + d }];
    });
    try {
      await streamPost(url, body, onDelta, ctl.signal, onSaved);
      if (curId.current === id && seq.current[key] === my) await load(id); // 다른 대화로 옮겼거나 다음 요청이 줄 서 있으면 화면을 덮지 않는다. 턴 번호·비용·수정 가능 여부를 서버 값으로 맞춘다
      refreshConvs();
    } catch (e) {
      if (ctl.signal.aborted) {
        // 중지: 서버가 본 데까지 저장을 끝내면 그 값으로 맞춘다
        setMsgs((l) => l.map((m) => (m.live ? { ...m, live: false, stopped: true } : m)));
        for (let i = 0; i < 40 && abortRef.current === ctl; i++) {
          await new Promise((r) => setTimeout(r, 750));
          const rows = await api(`/api/conversations/${c.conversation_id}/messages`).catch(() => null);
          if (rows?.at(-1)?.role === 'assistant') { if (abortRef.current === ctl) await load(c.conversation_id); break; }
        }
      } else {
        setMsgs((l) => [...l.map((m) => ({ ...m, live: false })), { role: 'error', text: e.message }]);
      }
    }
    if (abortRef.current === ctl) { abortRef.current = null; setBusy(false); }
    release(); if (pending.current[key] === whole) delete pending.current[key];
  }

  async function send(text) {
    setMsgs((l) => [...l.filter((m) => m.role !== 'error'), { role: 'user', text }]);
    stick.current = true; setBusy(true);
    let c = conv;
    if (!c) {
      try {
        const r = await api('/api/conversations', { user_name: userName, character_id: charId, language });
        c = { conversation_id: r.conversation_id, character_id: r.character_id, ended_at: null };
        setConv(c);
        history.pushState(null, '', `/c/${c.conversation_id}`);
      } catch (e) { setMsgs((l) => [...l, { role: 'error', text: e.message }]); setBusy(false); return; }
    }
    await stream(`/api/conversations/${c.conversation_id}/messages`, { text }, c);
  }
  // index 의 답(없으면 마지막 턴)을 다시 생성: 그 답부터 뒤는 화면에서 내리고(서버에서는 접힘) 새 답을 받는다
  async function regenerate(index) {
    const target = index != null ? msgs[index] : null;
    setMsgs((l) => {
      const clean = l.filter((m) => m.role !== 'error');
      if (target) return clean.slice(0, clean.indexOf(target));
      return clean.at(-1)?.role === 'assistant' ? clean.slice(0, -1) : clean;
    });
    await stream(`/api/conversations/${conv.conversation_id}/regenerate`, target ? { turn_no: target.turn_no } : {}, conv);
  }
  async function edit(index, text) {
    const target = msgs[index];
    setMsgs((l) => [...l.slice(0, index), { role: 'user', text }]);
    await stream(`/api/conversations/${conv.conversation_id}/edit`, { turn_no: target.turn_no, text }, conv);
  }

  async function switchTo(id) {
    await queued(conv);
    await api(`/api/conversations/${conv.conversation_id}/switch`, { message_id: id }).catch((e) => setMsgs((l) => [...l, { role: 'error', text: e.message }]));
    await load(conv.conversation_id);
  }

  async function end() {
    setEnding(true);
    await queued(conv); // 접기 정리가 도는 중에 끝 정리(flush·consolidate)가 겹치지 않게
    try {
      const r = await api(`/api/conversations/${conv.conversation_id}/end`, {});
      setReport(r); setConv((c) => ({ ...c, ended_at: new Date().toISOString() }));
      setMsgs((l) => l.map((m) => ({ ...m, editable: false })));
      refreshConvs();
    } catch (e) { setMsgs((l) => [...l, { role: 'error', text: e.message }]); }
    setEnding(false);
  }
  const showReport = async () => setReport(await api(`/api/conversations/${conv.conversation_id}/report`));

  async function rename(c, title) {
    setRenaming(null);
    if (title.trim() && title.trim() !== c.title) { await api(`/api/conversations/${c.conversation_id}`, { title }, 'PATCH'); refreshConvs(); }
  }
  async function remove(c) {
    setDeleting(null);
    await api(`/api/conversations/${c.conversation_id}`, undefined, 'DELETE');
    if (conv?.conversation_id === c.conversation_id) newChat();
    refreshConvs();
  }

  if (userName === null) return null;
  if (!userName) return <NameModal onSubmit={(n) => { store.set('lite.user', n); setUserName(n); }} />;

  const groups = [];
  for (const c of convs) {
    const g = groupOf(c.started_at);
    if (groups.at(-1)?.g !== g) groups.push({ g, items: [] });
    groups.at(-1).items.push(c);
  }
  const charName = (id) => characters.find((c) => c.id === id)?.name ?? id;
  const empty = msgs.length === 0 && !busy;
  const waiting = busy && !msgs.at(-1)?.live; // 첫 조각 전
  const lastAi = msgs.findLastIndex((m) => m.role === 'assistant');

  return (
    <div className="app" onClick={() => setMenu(null)}>
      {sidebar && <div className="backdrop" onClick={() => setSidebar(false)} />}
      <aside className={`sidebar${sidebar ? '' : ' closed'}`}>
        <div className="sb-top">
          <button className="icon-btn" title="사이드바 닫기" onClick={() => setSidebar(false)}>{I.sidebar}</button>
          <button className="icon-btn" title="새 채팅 (Ctrl+Shift+O)" onClick={() => newChat()}>{I.edit}</button>
        </div>
        <div className="sb-scroll">
          <button className="sb-item" onClick={() => newChat()}>{I.edit}<span className="t">새 채팅</span></button>
          <a className="sb-item" href="/report">{I.report}<span className="t">과제 리포트</span></a>
          {groups.map(({ g, items }) => (
            <div key={g}>
              <div className="sb-group">{g}</div>
              {items.map((c) => {
                const open = menu?.conv === c.conversation_id;
                if (renaming === c.conversation_id) {
                  return (
                    <div key={c.conversation_id} className="sb-item active">
                      <input className="rename" autoFocus defaultValue={c.title ?? ''}
                        onFocus={(e) => e.target.select()}
                        onBlur={(e) => rename(c, e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setRenaming(null); }} />
                    </div>
                  );
                }
                return (
                  <div key={c.conversation_id} className={`sb-item${conv?.conversation_id === c.conversation_id ? ' active' : ''}${open ? ' open' : ''}`}
                    role="button" tabIndex={0} onClick={() => openConv(c)}>
                    <span className="t">{c.title ?? '새 채팅'}</span>
                    <span className="ch">{charName(c.character_id)}</span>
                    <button className="more" title="옵션" onClick={(e) => { e.stopPropagation(); setMenu(open ? null : { conv: c.conversation_id }); }}>{I.dots}</button>
                    {open && (
                      <div className="menu" style={{ top: 36, right: 0, minWidth: 180 }} onClick={(e) => e.stopPropagation()}>
                        <button className="menu-item" onClick={() => { setMenu(null); setRenaming(c.conversation_id); }}>{I.pencil}이름 바꾸기</button>
                        <button className="menu-item danger" onClick={() => { setMenu(null); setDeleting(c); }}>{I.trash}삭제</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="sb-bottom" onClick={(e) => e.stopPropagation()}>
          <button className="sb-item" style={{ height: 48 }} onClick={() => setMenu(menu === 'profile' ? null : 'profile')}>
            <span className="avatar">{userName.slice(0, 1).toUpperCase()}</span><span className="t">{userName}</span>
          </button>
          {menu === 'profile' && (
            <div className="menu" style={{ bottom: 60, left: 8, minWidth: 244 }}>
              <div className="menu-label">응답 언어</div>
              {Object.entries(LANGS).map(([k, v]) => (
                <button key={k} className="menu-item" onClick={() => { setLanguage(k); store.set('lite.lang', k); setMenu(null); }}>
                  <span className="grow">{v}</span>{language === k && I.tick}
                </button>
              ))}
              <hr />
              <button className="menu-item" onClick={() => { store.set('lite.user', ''); setUserName(''); setConvs([]); newChat(); }}>다른 이름으로 시작</button>
            </div>
          )}
        </div>
      </aside>

      <main className="main">
        <header className="header">
          {!sidebar && <button className="icon-btn" title="사이드바 열기" onClick={() => setSidebar(true)}>{I.sidebar}</button>}
          {!sidebar && <button className="icon-btn" title="새 채팅" onClick={() => newChat()}>{I.edit}</button>}
          <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
            <button className="picker" onClick={() => setMenu(menu === 'picker' ? null : 'picker')}>
              {character?.name ?? ''}<span className="chev">{I.chev}</span>
            </button>
            {menu === 'picker' && (
              <div className="menu" style={{ top: 44, left: 0 }}>
                <div className="menu-label">캐릭터</div>
                {characters.map((c) => (
                  <button key={c.id} className="menu-item" onClick={() => (conv || c.id !== charId ? newChat(c.id) : setMenu(null))}>
                    <span className="grow"><div>{c.name}</div><div className="sub">{c.tagline}</div></span>
                    {character?.id === c.id && I.tick}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="spacer" />
          {conv && !conv.ended_at && <button className="pill-btn" disabled={ending || busy} onClick={end}>{ending ? '정리 중…' : '대화 종료'}</button>}
          {conv?.ended_at && <button className="pill-btn" onClick={showReport}>비용 리포트</button>}
        </header>

        {empty ? (
          <div className="empty">
            <div className="col" style={{ width: '100%' }}>
              <h1>{character ? `${character.name}에게 말을 걸어 보세요` : ''}</h1>
              <Composer inputRef={inputRef} onSend={send} busy={!charId} />
            </div>
          </div>
        ) : (
          <>
            <div className="thread" ref={threadRef} onScroll={onScroll}>
              <div className="col msgs">
                {msgs.map((m, i) => (
                  <Message key={i} m={m} last={i === lastAi} busy={busy || !!conv?.ended_at}
                    canRegen={m.role === 'assistant' && m.editable}
                    onTick={() => stick.current && scrollToBottom(false)}
                    onRegen={() => regenerate(i)}
                    onEdit={(t) => edit(i, t)}
                    onSwitch={switchTo}
                    onRetry={conv && !conv.ended_at ? () => regenerate() : null} />
                ))}
                {waiting && <div className="thinking" />}
              </div>
            </div>
            <div className="composer-wrap">
              <div className="col">
                {!atBottom && <button className="to-bottom" onClick={() => scrollToBottom(true)}>{I.down}</button>}
                {conv?.ended_at ? (
                  <div className="ended-bar">종료된 대화입니다. <button onClick={() => newChat(conv.character_id)}>새 채팅 시작</button></div>
                ) : (
                  <Composer inputRef={inputRef} onSend={send} busy={busy} onStop={() => abortRef.current?.abort()} />
                )}
                <div className="disclaimer">캐릭터의 답변은 AI가 생성합니다.</div>
              </div>
            </div>
          </>
        )}
      </main>

      {report && <ReportModal r={report} onClose={() => setReport(null)} />}
      {deleting && (
        <div className="modal-bg" onClick={() => setDeleting(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>채팅을 삭제하시겠어요?</h2>
            <p>이 작업으로 <b>{deleting.title ?? '새 채팅'}</b>이(가) 목록에서 삭제됩니다. 캐릭터가 기억한 내용은 남아요.</p>
            <div className="modal-actions">
              <button className="pill-btn" onClick={() => setDeleting(null)}>취소</button>
              <button className="pill-btn red" onClick={() => remove(deleting)}>삭제</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Composer({ inputRef, onSend, busy, onStop }) {
  const [text, setText] = useState('');
  const resize = () => { const el = inputRef.current; if (!el) return; el.style.height = 'auto'; el.style.height = `${Math.min(el.scrollHeight, 208)}px`; };
  useLayoutEffect(resize, [text]);
  useEffect(() => { if (!busy && !mobile()) inputRef.current?.focus(); }, [busy]);
  const can = text.trim() && !busy;
  const submit = () => { if (!can) return; onSend(text.trim()); setText(''); };
  return (
    <form className="composer" onClick={() => inputRef.current?.focus()} onSubmit={(e) => { e.preventDefault(); submit(); }}>
      <textarea ref={inputRef} rows={1} value={text} placeholder="메시지 입력" autoFocus
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter 전송, Shift+Enter 줄바꿈, 한글 조합 중 Enter 는 무시
          if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && e.keyCode !== 229) { e.preventDefault(); submit(); }
        }} />
      {busy && onStop ? (
        <button type="button" className="send" title="중지" onClick={onStop}>{I.stop}</button>
      ) : (
        <button type="submit" className="send" title="보내기" disabled={!can}>{I.up}</button>
      )}
    </form>
  );
}

// 스트리밍 조각은 ChatGPT 처럼 부드럽게 흘려 보여 준다
function Message({ m, last, busy, canRegen, onTick, onRegen, onEdit, onSwitch, onRetry }) {
  const [n, setN] = useState(m.live ? 0 : m.text.length);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const len = m.text.length;
  useEffect(() => {
    if (!m.live) { setN(len); return; }
    if (n >= len) return;
    const t = setTimeout(() => setN((x) => Math.min(x + Math.max(1, Math.ceil((len - x) / 12)), len)), 16);
    return () => clearTimeout(t);
  }, [n, len, m.live]);
  useEffect(() => { if (m.role === 'assistant') onTick(); }, [n]);

  if (m.role === 'error') {
    return <div className="error-box">응답을 받지 못했어요. ({m.text}) {onRetry && <button onClick={onRetry}>다시 시도</button>}</div>;
  }
  const copy = () => { navigator.clipboard?.writeText(m.text); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  // ‹ 1/2 › 버전 넘기기
  const vs = m.versions ?? [], vi = vs.indexOf(m.id);
  const pager = vs.length > 1 && (
    <span className="pager">
      <button className="icon-btn" title="이전 버전" disabled={busy || !m.editable || vi <= 0} onClick={() => onSwitch(vs[vi - 1])}>{I.prev}</button>
      <span>{vi + 1}/{vs.length}</span>
      <button className="icon-btn" title="다음 버전" disabled={busy || !m.editable || vi >= vs.length - 1} onClick={() => onSwitch(vs[vi + 1])}>{I.next}</button>
    </span>
  );
  if (m.role === 'user') {
    if (editing) {
      return (
        <div className="edit-box">
          <textarea autoFocus rows={1} value={draft} onChange={(e) => setDraft(e.target.value)}
            ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px`; } }}
            onKeyDown={(e) => { if (e.key === 'Escape') setEditing(false); }} />
          <div className="edit-actions">
            <button className="pill-btn" onClick={() => setEditing(false)}>취소</button>
            <button className="pill-btn dark" disabled={!draft.trim() || draft.trim() === m.text} onClick={() => { setEditing(false); onEdit(draft.trim()); }}>보내기</button>
          </div>
        </div>
      );
    }
    return (
      <div className="row-user">
        <div className="bubble">{m.text}</div>
        <div className={`actions${pager ? ' show' : ''}`}>
          {pager}
          <button className="icon-btn" title="복사" onClick={copy}>{copied ? I.check : I.copy}</button>
          {m.editable && !busy && <button className="icon-btn" title="메시지 수정" onClick={() => { setDraft(m.text); setEditing(true); }}>{I.pencil}</button>}
        </div>
      </div>
    );
  }
  const done = !m.live || n >= len;
  return (
    <div className="row-ai">
      <div className="prose">{narrated(closeStar(m.text.slice(0, n)))}{m.live && !done && <span className="caret" />}</div>
      {done && !m.live && (
        <div className={`actions${last || pager ? ' show' : ''}`}>
          {pager}
          <button className="icon-btn" title="복사" onClick={copy}>{copied ? I.check : I.copy}</button>
          {canRegen && !busy && <button className="icon-btn" title="다시 생성" onClick={onRegen}>{I.regen}</button>}
          {m.cost != null && <span className="cost">이번 턴 {won(m.cost)}</span>}
          {m.stopped && <span className="cost">중지됨</span>}
        </div>
      )}
    </div>
  );
}

function NameModal({ onSubmit }) {
  const [v, setV] = useState('');
  const ref = useRef(null);
  useEffect(() => { requestAnimationFrame(() => ref.current?.focus()); }, []);
  return (
    <div className="modal-bg">
      <form className="modal" onSubmit={(e) => { e.preventDefault(); if (v.trim()) onSubmit(v.trim()); }}>
        <h2>이름을 알려 주세요</h2>
        <p>이름이 곧 계정이에요. 같은 이름으로 다시 오면 캐릭터가 지난 대화를 기억해요.</p>
        <input ref={ref} autoFocus placeholder="이름" value={v} onChange={(e) => setV(e.target.value)} />
        <button className="primary" disabled={!v.trim()}>계속</button>
      </form>
    </div>
  );
}

function ReportModal({ r, onClose }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>비용 리포트</h2>
        <p>{r.pricing?.estimated ? `추정치: ${r.pricing.source}` : '이 대화에서 쓴 AI 비용이에요.'}</p>
        <table className="report">
          <tbody>
            <tr className="big"><td>턴당 평균</td><td>{won(r.avg_krw_per_turn)}</td></tr>
            <tr><td>완료 턴</td><td>{r.turns}</td></tr>
            <tr><td>합계</td><td>{won(r.total_krw)}</td></tr>
            <tr><td>보낸 쪽 (입력)</td><td>{won(r.input_krw)} · {r.tokens.input + r.tokens.cache_read + r.tokens.cache_write} 토큰</td></tr>
            <tr className="sub"><td>└ 캐시 읽기</td><td>{r.tokens.cache_read} 토큰</td></tr>
            <tr><td>받은 쪽 (출력)</td><td>{won(r.output_krw)} · {r.tokens.output} 토큰</td></tr>
            {Object.entries(r.by_tag_krw).map(([k, v]) => <tr key={k} className="sub"><td>└ {k}</td><td>{won(v)}</td></tr>)}
            {r.max_turn && <tr><td>가장 비싼 턴</td><td>{r.max_turn.turn_no}번째 · {won(r.max_turn.krw)}</td></tr>}
            <tr><td>실패 호출</td><td>{r.failed_calls}</td></tr>
          </tbody>
        </table>
        <button className="primary" onClick={onClose}>닫기</button>
      </div>
    </div>
  );
}
