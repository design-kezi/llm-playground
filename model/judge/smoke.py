import os, time
os.environ["USE_TF"] = "0"
texts = ["수영은 그만뒀어. 대신 클라이밍 시작했어", "내가 요즘 무슨 운동 한다고 했지?", "오늘 날씨 좋다"]
q = {"new_info": {"type": "noul", "instructions": "Does the user state a new personal fact, a change, a plan, or a cancellation about themselves?"}}
import laya
t=time.time(); agent = laya.load("convaiinnovations/laya-multilingual"); print("laya load", round(time.time()-t,1))
for x in texts:
    t=time.time(); r = agent.predict({"message": x}, q); print("laya", x, r["answers"]["new_info"], round((time.time()-t)*1000), "ms")
from gliner2 import AutoExtractor
t=time.time(); g = AutoExtractor.from_pretrained("fastino/GLiNER2.5-multi-Decide"); print("gliner load", round(time.time()-t,1))
for x in texts:
    t=time.time(); r = g.classify_text(x, {"kind": ["shares new personal info", "asks about the past", "small talk"]}); print("gliner", x, r, round((time.time()-t)*1000), "ms")
from gliclass import GLiClassModel, ZeroShotClassificationPipeline
from transformers import AutoTokenizer
t=time.time(); m = GLiClassModel.from_pretrained("knowledgator/gliclass-multilang-mini"); tok = AutoTokenizer.from_pretrained("knowledgator/gliclass-multilang-mini")
p = ZeroShotClassificationPipeline(m, tok, classification_type='single-label', device='cpu'); print("gliclass load", round(time.time()-t,1))
for x in texts:
    t=time.time(); r = p(x, ["shares new personal info", "asks about the past", "small talk"], threshold=0.0)[0]; print("gliclass", x, [(a["label"], round(a["score"],2)) for a in r][:3], round((time.time()-t)*1000), "ms")
