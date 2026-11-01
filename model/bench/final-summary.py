# 최종 구성 결과를 리포트용 한 파일로 모은다(docs/50 2026-11-01 최종 측정). 0원 — 이미 있는 run.json·블라인드 라벨만 읽는다.
# 사용: python3 bench/final-summary.py [--final lt7|lt8] → out/final-summary.json (report-data.mjs 가 data.json 의 final 키로 넣는다)
import json, glob, collections, statistics as st, sys, os
B = os.path.dirname(os.path.abspath(__file__)); O = f'{B}/out'
FINAL = sys.argv[sys.argv.index('--final') + 1] if '--final' in sys.argv else 'lt7'
PTS = {'correct': 2, 'partial': 1, 'unknown': 0, 'stale': -1, 'wrong': -1, 'fabricated': -2}
UPD = {'update', 'multi_update', 'partial_update', 'retract'}
rd = lambda p: json.load(open(p))
cost = lambda pre: next((r for r in rd(f'{O}/cost-{pre}.json')['rows'] if r['cond'] == 'v2-dsx-follow' or pre == 'lt2' and r['cond'] == 'v2-dsx'), None)

def mem(rows):
    R = [x for x in rows if x.get('lab', x.get('label')) != 'na']
    lab = lambda x: x.get('lab', x.get('label'))
    k = collections.Counter(lab(x) for x in R); n = len(R)
    pts = sum(PTS.get(lab(x), 0) for x in R if lab(x) != 'leak'); mx = 2 * len([x for x in R if lab(x) != 'leak'])
    bt = collections.defaultdict(lambda: [0, 0])
    for x in R: bt[x['type']][1] += 1; bt[x['type']][0] += lab(x) == 'correct'
    return {'n': n, 'score_pct': round(100 * pts / mx, 1), 'correct_pct': round(100 * k['correct'] / n, 1), 'counts': dict(k),
            'harmful': k['stale'] + k['wrong'] + k['fabricated'], 'by_type': {t: {'correct': c, 'n': m} for t, (c, m) in sorted(bt.items())}}

out = {'final_cond': 'v2-dsx-follow', 'final_prefix': FINAL, 'note': '조건 v2-dsx-follow = 대화 따르기 6차 + 기억 v2. 기억·품질은 Opus 블라인드(같은 회차에 비교 조건과 섞음).'}
# 120턴 최종: 기억(이전 채택 lt2 v2-dsx 와 같은 회차), 품질(lt1 deepseek-on·lt2 v2-dsx 와 같은 묶음), 비용
L = rd(f'{O}/opus-{FINAL}-r1/labels-unblinded.json')
out['lt120'] = {'memory': {c: mem([x for x in L if x['cond'] == c]) for c in ('v2-dsx', 'v2-dsx-follow')},
                'memory_excl_implicit': {c: mem([x for x in L if x['cond'] == c and x['type'] != 'implicit']) for c in ('v2-dsx', 'v2-dsx-follow')},
                'cost': {'v2-dsx': cost('lt2'), 'v2-dsx-follow': cost(FINAL)}}
# 턴별 비용 곡선(최종 120턴 8런): 그 턴 번호에 기록된 모든 호출 합(응답·추출·임베딩), 대화 종료 정리(turn_no 0)는 따로
per = collections.defaultdict(list); end = []
for f in sorted(glob.glob(f'{O}/*-120-{FINAL}-v2-dsx-follow-r*/run.json')):
    r = rd(f)
    if r.get('valid', {}).get('ok') is False: continue
    t = collections.Counter()
    for c in r['calls']: t[c['turn_no']] += c.get('cost_krw') or 0
    for n in range(1, 121): per[n].append(t.get(n, 0.0))
    end.append(t.get(0, 0.0))
out['lt120']['turn_cost'] = [{'turn': n, 'mean': round(st.mean(v), 4), 'max': round(max(v), 4)} for n, v in sorted(per.items())]
out['lt120']['consolidate_per_run'] = {'mean': round(st.mean(end), 4), 'max': round(max(end), 4), 'runs': len(end)} if end else None
q = collections.defaultdict(lambda: collections.defaultdict(list)); AX = ['character', 'context', 'engagement', 'user_agency', 'overall']
QP = FINAL if os.path.exists(f'{O}/opus-q{FINAL}-r1/labels.tsv') else 'lt7'  # lt8 은 품질 판정 생략(대화 코드 같음) → lt7 회차 값
qd = f'{O}/opus-q{QP}-r1'
if os.path.exists(f'{qd}/labels.tsv') or os.path.exists(f'{O}/opus-q{QP}-r2/labels.tsv'):
    for r in (1, 2):
        d = f'{O}/opus-q{QP}-r{r}'
        if not os.path.exists(f'{d}/labels.tsv'): continue
        key = {g['id']: g for g in rd(f'{d}/groups-KEY.json')}
        for l in open(f'{d}/labels.tsv'):
            p = l.rstrip('\n').split('\t')
            if len(p) < 7: continue
            c = [v['cond'] for v in key[p[0]]['versions'] if v['v'] == p[1]][0]
            for a, s in zip(AX, p[2:7]): q[c][a].append(int(s))
    out['lt120']['quality_round'] = QP
    out['lt120']['quality'] = {c: {a: round(st.mean(v), 2) for a, v in d.items()} | {'n': len(d['overall'])} for c, d in q.items()}
# 300턴 기억 v1 → v2 → 수정(같은 대본·같은 대화 설정)
mb = rd(f'{O}/opus-mb-r1/labels-unblinded.json'); mb2 = rd(f'{O}/opus-mb2-r1/labels-unblinded.json')
SENS = {'B0316', 'B0323', 'B0325', 'B0330', 'B0333', 'B0352', 'B0370', 'B0396', 'B0399', 'B0404', 'B0431', 'B0435', 'B0447', 'B0451'}
for x in mb:
    if x['id'] in SENS and x['lab'] == 'partial': x['lab'] = 'correct'
def mbrow(rows):
    m = mem(rows); g = lambda f: [x for x in rows if f(x) and x['lab'] != 'na']
    rate = lambda xs: round(100 * sum(x['lab'] == 'correct' for x in xs) / len(xs), 1) if xs else None
    ccp = collections.Counter(x['lab'] for x in rows if x['scope'] == 'cross_char_promise')
    return m | {'far_pct': rate(g(lambda x: x['scope'] == 'far')), 'update_pct': rate(g(lambda x: x['type'] in UPD)),
                'near_pct': rate(g(lambda x: x['scope'] in ('near', 'recent'))), 'cross_char_promise': dict(ccp)}
out['mem300'] = {'mb0': mbrow([x for x in mb if x['cond'] == 'mb0']), 'mb1': mbrow([x for x in mb if x['cond'] == 'mb1']),
                 'mb2': mbrow([x for x in mb2 if x['cond'] == 'mb2']),
                 'cost': {p: next(r for r in rd(f'{O}/cost-{p}.json')['rows']) for p in ('mb0', 'mb1', 'mb2') if os.path.exists(f'{O}/cost-{p}.json')},
                 'note': 'mb0 = 기억 v1, mb1 = 기억 v2, mb2 = v2 결함 5건 수정. 대화 설정은 셋 다 v2-dsx-follow. mb0·mb1 은 1차 판정(덧붙임 14문항 correct 로 맞춘 값), mb2 는 2차 판정(같은 문항 재판정 일치율 95.6%).'}
if os.path.exists(f'{O}/mb3-leak.json'): out['mem300']['mb3_leak'] = rd(f'{O}/mb3-leak.json')
# 대화 따르기(fl1 6차): follow-compare.mjs 결과 표를 그대로
fk = {k['id']: k for k in rd(f'{O}/follow-blind/key.json')}
fl = [l.rstrip('\n').split('\t') for l in open(f'{O}/follow-blind/labels.tsv')]; fh = fl[0]; FL = [dict(zip(fh, r)) | fk[r[0]] for r in fl[1:] if r and r[0] in fk]
def frate(c, f, base=lambda x: True):
    xs = [x for x in FL if x['cond'] == c and base(x)]; return {'yes': sum(f(x) for x in xs), 'n': len(xs), 'pct': round(100 * sum(f(x) for x in xs) / len(xs), 1)}
md = open(f'{O}/follow-compare.md').read()
lang = [l for l in md.split('\n') if l.startswith('| 합계 |')][0]
out['follow'] = {'source': 'out/follow-compare.md (docs/50 follow 6차)', 'note': '현재 기본값(cur, 대화 따르기 끔) vs 수정판(6차) — follow-12·situ-20·close-8 대본, 각 320턴 Opus 블라인드',
    'language_row': lang, **{c: {'direct': frate(c, lambda x: x['direct'] == '예'), 'cont': frate(c, lambda x: x['cont'] == '예'), 'qpress': frate(c, lambda x: x['qpress'] == '예'),
        'nq2': frate(c, lambda x: int(x.get('nq') or 0) >= 2), 'break': frate(c, lambda x: x['brk'] == '예'),
        'direct_follow12': frate(c, lambda x: x['direct'] == '예', lambda x: x['scenario'].endswith('follow-12'))} for c in ('cur', 'follow')}}
json.dump(out, open(f'{O}/final-summary.json', 'w'), ensure_ascii=False, indent=1)
print(json.dumps({k: (v if k != 'lt120' else {kk: vv for kk, vv in v.items() if kk != 'memory'}) for k, v in out.items() if k in ('lt120',)}, ensure_ascii=False)[:1500])
