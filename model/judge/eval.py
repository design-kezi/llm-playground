"""판단 모델 오프라인 평가: 언어별 데이터(data/<lang>.json)로 save / recall / target 판단을 돌린다.
사용: USE_TF=0 .venv/bin/python eval.py [--models laya,gliner,gliclass] [--langs ko,zh-TW,ja,en]
출력: out/preds-<model>-<lang>.json (문항별 점수) — 지표 계산은 report.mjs
점수 의미: save/recall 은 '예'일 확률(0~1), target 은 고른 항목 번호 또는 'none'.
"""
import argparse, json, os, time
os.environ.setdefault("USE_TF", "0")

HERE = os.path.dirname(os.path.abspath(__file__))

# 질문은 영어로 둔다(모델들이 영어 지시에 더 강함). 입력 문장만 언어별로 바뀐다.
SAVE_Q = "Does the user's latest message state a new personal fact, preference, plan, change, promise, or cancellation about the user (or their family/pets) that should be remembered later? Questions, hypotheticals, small talk, and repeating something already said do not count."
RECALL_Q = "To answer the user's latest message well, does the assistant need information the user shared earlier in past conversations (their preferences, plans, facts, promises)? Answer no if the message is small talk, a new statement, a general question, or only refers to what was just said in the previous turn."
TARGET_Q = "Which existing memory item does the user's latest message change, update, or cancel? Choose 'none' if it is about someone else or does not change any item."


# 설명형 라벨(제로샷 분류기 정석 사용법): 두 클래스를 문장으로 설명한다. 첫 번째가 '예'.
DESC = {
    "save": ["the user tells something new about themselves, their family or pets: a fact, preference, habit, plan, change, promise, or cancellation",
             "the user asks a question, makes small talk, reacts, imagines a hypothetical, or repeats something already said"],
    "recall": ["the user asks about or depends on something they told before: their past statements, preferences, plans, or promises",
               "the user makes small talk, shares something new, asks a general question, or asks about what was just said"],
}


def state_of(x):
    s = {"latest_user_message": x["user"]}
    if x.get("prev"):
        s["previous_user_message"] = x["prev"]["user"]
        s["previous_assistant_reply"] = x["prev"]["assistant"]
    return s


class Laya:
    name = "laya"

    def __init__(self):
        import laya
        self.agent = laya.load("convaiinnovations/laya-multilingual")

    def binary(self, x, q):
        r = self.agent.predict(state_of(x), {"q": {"type": "choice", "instructions": q, "criteria": {"yes": "yes", "no": "no"}}})
        return r["answers"]["q"]["probabilities"]["yes"]

    def target(self, x):
        crit = {str(i): t for i, t in enumerate(x["items"])}
        crit["none"] = "none of the items is changed"
        st = {"latest_user_message": x["user"]}
        r = self.agent.predict(st, {"q": {"type": "choice", "instructions": TARGET_Q, "criteria": crit}})
        c = r["answers"]["q"]["choice"]
        return c if c == "none" else int(c)


class Gliner:
    name = "gliner"

    def __init__(self):
        from gliner2 import AutoExtractor
        self.m = AutoExtractor.from_pretrained("fastino/GLiNER2.5-multi-Decide")

    def _text(self, x):
        t = x["user"]
        if x.get("prev"):
            t = f"[previous] user: {x['prev']['user']} / assistant: {x['prev']['assistant']}\n[latest] user: {t}"
        return t

    def binary(self, x, q):
        labels = {"yes": q, "no": "no, " + q[0].lower() + q[1:]}
        r = self.m.classify_text(self._text(x), {"answer": ["yes", "no"]}, include_confidence=True) if False else None
        # 라벨 설명 형식: 지원 여부가 버전마다 달라 짧은 라벨 두 개로 판단
        lab = ["yes: " + q, "no"]
        r = self.m.classify_text(self._text(x), {"answer": lab}, include_confidence=True)
        a = r["answer"]
        if isinstance(a, dict):
            label, conf = a.get("label"), a.get("confidence", 1.0)
        else:
            label, conf = a, 1.0
        p = conf if str(label).startswith("yes") else 1 - conf
        return float(p)

    def target(self, x):
        labs = [f"{i}: {t}" for i, t in enumerate(x["items"])] + ["none: no item changes"]
        r = self.m.classify_text(x["user"], {"item": labs})
        a = r["item"]
        a = a.get("label") if isinstance(a, dict) else a
        k = str(a).split(":")[0]
        return "none" if k == "none" else int(k)


class Gliclass:
    name = "gliclass"

    def __init__(self):
        from gliclass import GLiClassModel, ZeroShotClassificationPipeline
        from transformers import AutoTokenizer
        mid = "knowledgator/gliclass-multilang-mini"
        m = GLiClassModel.from_pretrained(mid)
        tok = AutoTokenizer.from_pretrained(mid)
        self.p = ZeroShotClassificationPipeline(m, tok, classification_type="single-label", device="cpu", progress_bar=False) if "progress_bar" in ZeroShotClassificationPipeline.__init__.__code__.co_varnames else ZeroShotClassificationPipeline(m, tok, classification_type="single-label", device="cpu")

    def _text(self, x):
        t = x["user"]
        if x.get("prev"):
            t = f"Previous: {x['prev']['user']} / {x['prev']['assistant']}\nLatest: {t}"
        return t

    def _scores(self, text, labels):
        r = self.p(text, labels, threshold=0.0)[0]
        return {a["label"]: a["score"] for a in r}

    def binary(self, x, q):
        yes, no = "yes: " + q, "no"
        s = self._scores(self._text(x), [yes, no])
        a, b = s.get(yes, 0.0), s.get(no, 0.0)
        return a / (a + b) if a + b else 0.5

    def target(self, x):
        labs = [f"{i}: {t}" for i, t in enumerate(x["items"])] + ["none: no item changes"]
        s = self._scores(x["user"], labs)
        best = max(labs, key=lambda l: s.get(l, 0.0))
        k = best.split(":")[0]
        return "none" if k == "none" else int(k)


class LayaDesc(Laya):
    name = "laya_desc"

    def binary(self, x, q):
        task = "save" if q is SAVE_Q else "recall"
        yes, no = DESC[task]
        r = self.agent.predict(state_of(x), {"q": {"type": "choice", "instructions": "Which best describes the latest user message?", "criteria": {"yes": yes, "no": no}}})
        return r["answers"]["q"]["probabilities"]["yes"]


class GlinerDesc(Gliner):
    name = "gliner_desc"

    def binary(self, x, q):
        task = "save" if q is SAVE_Q else "recall"
        yes, no = DESC[task]
        r = self.m.classify_text(x["user"], {"kind": [yes, no]}, include_confidence=True)
        a = r["kind"]
        label, conf = (a.get("label"), a.get("confidence", 1.0)) if isinstance(a, dict) else (a, 1.0)
        return float(conf if label == yes else 1 - conf)


class GliclassDesc(Gliclass):
    name = "gliclass_desc"

    def binary(self, x, q):
        task = "save" if q is SAVE_Q else "recall"
        yes, no = DESC[task]
        sc = self._scores(x["user"], [yes, no])
        a, b = sc.get(yes, 0.0), sc.get(no, 0.0)
        return a / (a + b) if a + b else 0.5


MODELS = {"laya": Laya, "gliner": Gliner, "gliclass": Gliclass, "laya_desc": LayaDesc, "gliner_desc": GlinerDesc, "gliclass_desc": GliclassDesc}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", default="laya,gliner,gliclass")
    ap.add_argument("--langs", default="ko,zh-TW,ja,en")
    a = ap.parse_args()
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    for mname in a.models.split(","):
        t0 = time.time()
        m = MODELS[mname]()
        print(f"[{mname}] load {time.time() - t0:.1f}s", flush=True)
        for lang in a.langs.split(","):
            data = json.load(open(os.path.join(HERE, "data", f"{lang}.json"), encoding="utf-8"))
            preds, lat = [], []
            for task, fn in (("save", lambda x: m.binary(x, SAVE_Q)), ("recall", lambda x: m.binary(x, RECALL_Q)), ("target", m.target)) if not mname.endswith("_desc") else (("save", lambda x: m.binary(x, SAVE_Q)), ("recall", lambda x: m.binary(x, RECALL_Q))):
                for x in data[task]:
                    t = time.time()
                    try:
                        p = fn(x)
                        err = None
                    except Exception as e:  # 한 문항 실패가 전체를 멈추지 않게
                        p, err = None, str(e)[:200]
                    lat.append((time.time() - t) * 1000)
                    preds.append({"task": task, "id": x["id"], "label": x["label"], "pred": p, "src": x["src"], "error": err})
            if mname.endswith("_desc"):  # 수정 대상 판단은 원본과 같으니 다시 돌리지 않는다
                preds = [p for p in preds if p["task"] != "target"]
            out = {"model": mname, "lang": lang, "latency_ms_median": sorted(lat)[len(lat) // 2], "preds": preds}
            json.dump(out, open(os.path.join(HERE, "out", f"preds-{mname}-{lang}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
            errs = sum(1 for p in preds if p["error"])
            print(f"[{mname}] {lang} done, median {out['latency_ms_median']:.0f}ms, errors {errs}", flush=True)


if __name__ == "__main__":
    main()
