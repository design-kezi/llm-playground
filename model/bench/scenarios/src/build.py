#!/usr/bin/env python3 -I
"""쌓인 기억 대본(300턴, 대화 5개) 빌더. 내용 파일(<char>.py 의 CONTENT 리스트)을 읽어 model/bench/scenarios/<char>-long-300.json 을 만든다.
- 턴 번호·세션 범위를 자동으로 매기고, 확인 질문의 근거(src 라벨 → plant/update 턴 번호)를 풀어 쓴다.
- 구조 검사: 라벨 중복, 근거 라벨 없음, 근거가 질문 뒤, 세션 수·턴 수.
사용: python3 -I build.py baekho [out_dir]
"""
import importlib.util, json, sys, os, collections

def load(name):
    p = os.path.join(os.path.dirname(os.path.abspath(__file__)), f'{name}.py')
    spec = importlib.util.spec_from_file_location(name, p); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
    return m

def build(name, out_dir):
    m = load(name)
    turns, sessions, label2turn = [], [], {}
    cur = None; n = 0; errs = []
    for e in m.CONTENT:
        if 'session' in e:
            if cur: cur['turns'][1] = n
            cur = {'clock_date': e['session']['clock_date'], 'turns': [n + 1, None]}
            if e['session'].get('character_id'): cur['character_id'] = e['session']['character_id']
            sessions.append(cur); continue
        n += 1
        t = {'turn': n, 'session': len(sessions), 'kind': e['k'], 'user': e['u']}
        if e.get('id'):
            if e['id'] in label2turn: errs.append(f"라벨 중복 {e['id']} ({label2turn[e['id']]}·{n})")
            label2turn[e['id']] = n
        if e['k'] == 'probe':
            t.update({'type': e['type'], 'scope': e.get('scope', 'far'), 'difficulty': e.get('difficulty', 'hard'),
                      'expect': e.get('expect', []), 'stale': e.get('stale', []), 'forbidden': e.get('forbidden', [])})
            t['_src'] = e.get('src', [])
            for k in ('judge_hint', 'gap', 'leak_ok', 'expect_all', 'forbidden_regex', 'note'):
                if k in e: t[k] = e[k]
            if 'requires_promise' in e: t['_rp'] = e['requires_promise']
        turns.append(t)
    if cur: cur['turns'][1] = n
    for t in turns:
        if t['kind'] != 'probe': continue
        src = []
        for lab in t.pop('_src'):
            if lab not in label2turn: errs.append(f"{t['turn']}: 근거 라벨 없음 {lab}"); continue
            if label2turn[lab] >= t['turn']: errs.append(f"{t['turn']}: 근거 {lab} 가 질문 뒤({label2turn[lab]})")
            src.append(label2turn[lab])
        t['source_turns'] = sorted(src)
        if '_rp' in t:
            rp = t.pop('_rp'); t['requires_promise_turn'] = label2turn.get(rp)
            if t['requires_promise_turn'] is None: errs.append(f"{t['turn']}: 약속 라벨 없음 {rp}")
        # 간격·범위는 빌더가 계산해 적는다: 마지막 근거 → 질문. ≤11 recent(창 안 원문), 12~30 near(접힌 직후), 그 밖 far. cross_* 는 내용 파일 표기 유지.
        if src:
            g = t['turn'] - max(src); t['gap'] = g
            if not str(t.get('scope', '')).startswith('cross'): t['scope'] = 'recent' if g <= 11 else 'near' if g <= 30 else 'far'
            if t['scope'] == 'recent': t['difficulty'] = 'normal'
    kinds = collections.Counter(t['kind'] for t in turns)
    types = collections.Counter(t['type'] for t in turns if t['kind'] == 'probe')
    scopes = collections.Counter(t['scope'] for t in turns if t['kind'] == 'probe')
    sc = {'id': f'{name}-long-300', 'character_id': name, 'title': m.TITLE, 'purpose': m.PURPOSE,
          'clock_date': sessions[0]['clock_date'], 'clock_note': m.CLOCK_NOTE, 'sessions': sessions,
          'segments': {f's{i+1}': s['turns'] for i, s in enumerate(sessions)}, 'labels': label2turn, 'turns': turns}
    print(f"{sc['id']}: {n}턴, 세션 {len(sessions)} {[s['turns'] for s in sessions]}, kinds {dict(kinds)}")
    print('probe types', dict(types)); print('probe scopes', dict(scopes))
    if errs:
        print('문제:', *errs, sep='\n- '); sys.exit(1)
    os.makedirs(out_dir, exist_ok=True)
    out = os.path.join(out_dir, f"{sc['id']}.json")
    json.dump(sc, open(out, 'w'), ensure_ascii=False, indent=1)
    print('wrote', out)

if __name__ == '__main__':
    build(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'))
