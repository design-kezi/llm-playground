"""직접 학습 기준선: 다국어 임베딩(multilingual-e5-small) + 로지스틱 회귀. 우리 라벨로 학습한다.
두 가지로 잰다.
  cv     : 같은 언어 안에서 5겹 교차검증(학습·평가 데이터가 겹치지 않음)
  ko2x   : 한국어로만 학습 → 다른 언어로 평가(번역 데이터를 학습에 안 쓸 때)
출력: out/preds-e5lr_cv-<lang>.json, out/preds-e5lr_ko2x-<lang>.json (확률)
"""
import json, os, time
import numpy as np
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import StratifiedKFold
from sentence_transformers import SentenceTransformer

HERE = os.path.dirname(os.path.abspath(__file__))
LANGS = ["ko", "zh-TW", "ja", "en"]
m = SentenceTransformer("intfloat/multilingual-e5-small", device="cpu")


def text(x):
    t = "query: " + x["user"]
    if x.get("prev"):
        t += " [이전] " + x["prev"]["user"]
    return t


data = {l: json.load(open(os.path.join(HERE, "data", f"{l}.json"), encoding="utf-8")) for l in LANGS}
emb = {}
t0 = time.time()
for l in LANGS:
    for task in ("save", "recall"):
        emb[(l, task)] = m.encode([text(x) for x in data[l][task]], batch_size=32, normalize_embeddings=True)
n = sum(len(data[l][t]) for l in LANGS for t in ("save", "recall"))
lat = (time.time() - t0) * 1000 / n
print(f"encode {n} texts, {lat:.1f} ms/text")

for mode in ("cv", "ko2x"):
    for l in LANGS:
        preds = []
        for task in ("save", "recall"):
            xs = data[l][task]
            y = np.array([x["label"] for x in xs])
            X = emb[(l, task)]
            p = np.zeros(len(xs))
            if mode == "cv":
                for tr, te in StratifiedKFold(5, shuffle=True, random_state=0).split(X, y):
                    clf = LogisticRegression(max_iter=2000, C=2.0, class_weight="balanced").fit(X[tr], y[tr])
                    p[te] = clf.predict_proba(X[te])[:, 1]
            else:
                yk = np.array([x["label"] for x in data["ko"][task]])
                Xk = emb[("ko", task)]
                if l == "ko":  # 한국어 자체 평가는 교차검증으로(학습 데이터로 평가하지 않게)
                    for tr, te in StratifiedKFold(5, shuffle=True, random_state=0).split(Xk, yk):
                        p[te] = LogisticRegression(max_iter=2000, C=2.0, class_weight="balanced").fit(Xk[tr], yk[tr]).predict_proba(Xk[te])[:, 1]
                else:
                    p = LogisticRegression(max_iter=2000, C=2.0, class_weight="balanced").fit(Xk, yk).predict_proba(X)[:, 1]
            preds += [{"task": task, "id": x["id"], "label": x["label"], "pred": float(p[i]), "src": x["src"], "error": None} for i, x in enumerate(xs)]
        json.dump({"model": f"e5lr_{mode}", "lang": l, "latency_ms_median": lat, "preds": preds},
                  open(os.path.join(HERE, "out", f"preds-e5lr_{mode}-{l}.json"), "w", encoding="utf-8"), ensure_ascii=False)
        print(mode, l, "done")
