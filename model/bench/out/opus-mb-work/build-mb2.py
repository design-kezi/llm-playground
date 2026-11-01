# mb2 블라인드 묶음: mb2 문항 전부 + mb0·mb1 문항 일부(가림용, 다시 매겨 판정 회차 간 일치율도 본다). 조건은 KEY 에만.
import json,random,subprocess,sys
B='/Users/kezi/ws/llm-playground/model/bench'
for r in (1,2):
    subprocess.run(['node','opus-blind-build.mjs','--rep',str(r),'--prefix','CD'[r-1],'--seed',f'2026111{r}','--dir',f'out/opus-mb2-r{r}','--run-prefix','(?:mb0|mb1|mb2)','--cond-by-prefix','1'],cwd=B,check=True)
    d=f'{B}/out/opus-mb2-r{r}'; items=json.load(open(f'{d}/blind-memory.json')); key=json.load(open(f'{d}/blind-memory-KEY.json'))
    rnd=random.Random(20261111+r); keep=set()
    for c in ('mb0','mb1'):
        ids=[k['id'] for k in key if k['cond']==c]; keep|=set(rnd.sample(ids,57))
    keep|={k['id'] for k in key if k['cond']=='mb2'}
    items=[x for x in items if x['id'] in keep]; key=[k for k in key if k['id'] in keep]
    json.dump(items,open(f'{d}/blind-memory.json','w'),ensure_ascii=False,indent=1); json.dump(key,open(f'{d}/blind-memory-KEY.json','w'),ensure_ascii=False,indent=1)
    h=len(items)//3+1
    for i in range(3): json.dump(items[i*h:(i+1)*h],open(f'{d}/part{i}.json','w'),ensure_ascii=False,indent=1)
    print(r,len(items),[len(items[i*h:(i+1)*h]) for i in range(3)])
