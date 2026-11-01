// 규칙 채점(0원): 비용 집계, 기억 확인 질문 1단계(키워드), 품질 규칙. (docs/30-bench-design.md §7·§8.1·§9)
// AI 판정이 필요한 문항은 needs_judge 로 남긴다(암묵 반영, 키워드로 안 갈리는 응답).

const POINTS = { correct: 2, partial: 1, unknown: 0, stale: -1, fabricated: -2 };
// "모른다/말 안 했다" 류. 함정 질문에서는 정답, 일반 질문에서는 '모름'.
const ABSTAIN = /모르|모름|기억에 없|기억이 없|기억하는 게 없|기억나는 게 없|기억이 안|기억 못|헷갈리네|헷갈려|기억 안|기억이 잘|기억나지 않|정보에 없|아는 게 없|아는 건 없|기억에 있는 건|기억하는 건 없|말해준 적|말해 준 적|주신 적|해 주신 적이 없|못 들은|못 들어봤|얘기해준 적|얘기해 준 적|안 들었|못 들어 봤|들어본 적|안 정하기억이 나지|말 안|말한 적|말씀 안|말씀하신 적|들은 적|얘기 안|얘기한 적|안 알려|알려준 적|알려주지|못 들었|처음 듣|비밀이라|비밀로|아직 말|안 했|안 하셨|않았|않으셨|들은 바가 없|듣지 못|들은 기억이 없|모르겠소|알지 못/;
const PROMISE = /(그럼요|물론이죠|물론이지|알겠어)(?![^.!?]*지금 바로)[^]{0,60}(다음|나중|꼭|언제든)|해\s?줄 수 있|그려\s?줄|그려\s?볼게|그려\s?보려고|노력할게|해\s?볼게|그릴게|그려\s?드릴|해\s?줄게|봐\s?줄게|봐\s?드릴|봐\s?줄 수|보여\s?줄게|보여\s?드릴|보여\s?줄 수|약속|다음에.{0,10}(그려|보여|봐|해)|꽂아\s?줄게|주리다|하리다|합시다|기꺼이|응하겠|물론이오|보는 건 가능|(다음|나중)[^.!?]{0,30}(보자|볼게|훑어볼게|보내)/;

import fs from 'node:fs';
import path from 'node:path';

const PRICES = JSON.parse(fs.readFileSync(path.join(import.meta.dirname, '..', 'pricing.json'), 'utf8'));

export function scoreRun(scenario, run) {
  return { cost: scoreCost(scenario, run), cold: scoreCold(scenario, run), memory: scoreMemory(scenario, run), quality: scoreQuality(scenario, run) };
}

// 캐시가 비어 있었다면의 비용(계산). 벤치는 턴 간격이 수 초이고 직전 런의 캐시도 이어 받아 실제보다 낙관적이다.
// 같은 접두사의 첫 호출이 읽은 캐시(cache_read)를 그 호출이 새로 썼다고 보고 다시 값을 매긴다:
//   Anthropic = 캐시 쓰기 단가, 그 밖(자동 캐시) = 정가. 같은 접두사의 두 번째 호출은 첫 호출이 쓴 캐시를 읽으므로 그대로 둔다.
//   접두사 = 같은 tag(응답/추출/…) 로 본다.
// first_conversation: 새 사용자의 첫 대화(런 전체에서 tag 별 첫 호출만 콜드).
// every_turn: 사용자가 매 턴 5분 넘게 쉬는 최악(턴마다 tag 별 첫 호출이 콜드).
function scoreCold(scenario, run) {
  const fx = PRICES.fx_krw_per_usd;
  const extra = (c) => {
    const spec = PRICES.models[c.model];
    if (!spec || !c.cache_read_tokens) return 0;
    const cached = spec.cached ?? spec.input;
    const write = spec.provider === 'anthropic' ? spec.cache_write ?? spec.input : spec.input;
    return (c.cache_read_tokens * (write - cached) / 1e6) * fx;
  };
  const seenRun = new Set();
  const firstConv = new Map(), everyTurn = new Map();
  let seenTurn = new Set(), curTurn = null;
  for (const c of run.calls) {
    if (c.turn_no !== curTurn) { curTurn = c.turn_no; seenTurn = new Set(); }
    const add = (m, v) => m.set(c.turn_no, (m.get(c.turn_no) ?? 0) + v);
    add(firstConv, c.cost_krw + (seenRun.has(c.tag) ? 0 : extra(c)));
    add(everyTurn, c.cost_krw + (seenTurn.has(c.tag) ? 0 : extra(c)));
    seenRun.add(c.tag); seenTurn.add(c.tag);
  }
  const summarize = (m) => {
    const n = scenario.turns.length;
    const turns = [...m].filter(([t]) => t !== 0);
    const total = turns.reduce((s, [, v]) => s + v, 0);
    const max = turns.reduce((a, [t, v]) => (v > a.krw ? { turn: t, krw: v } : a), { turn: null, krw: -1 });
    const segments = {};
    for (const [name, [a, b]] of Object.entries(scenario.segments ?? {})) {
      let s = 0;
      for (let i = a; i <= b; i++) s += m.get(i) ?? 0;
      segments[name] = s / (b - a + 1);
    }
    return { avg_krw: total / n, avg_with_end_krw: (total + (m.get(0) ?? 0)) / n, max, segments,
      per_turn: turns.map(([turn, krw]) => ({ turn, krw })) };
  };
  return { method: 'cache_read 를 접두사(tag)별 첫 호출에서 쓰기 단가로 재계산', first_conversation: summarize(firstConv), every_turn: summarize(everyTurn) };
}

function scoreCost(scenario, run) {
  const perTurn = new Map(scenario.turns.map((t) => [t.turn, { krw: 0, tags: {} }]));
  const byTag = {};
  let endKrw = 0, inTok = 0, readTok = 0, writeTok = 0, failed = 0;
  for (const c of run.calls) {
    byTag[c.tag] = (byTag[c.tag] ?? 0) + c.cost_krw;
    inTok += c.input_tokens ?? 0; readTok += c.cache_read_tokens ?? 0; writeTok += c.cache_write_tokens ?? 0;
    if (!c.ok) failed++;
    if (c.turn_no === 0) { endKrw += c.cost_krw; continue; }
    const t = perTurn.get(c.turn_no);
    if (!t) continue;
    t.krw += c.cost_krw;
    t.tags[c.tag] = (t.tags[c.tag] ?? 0) + c.cost_krw;
  }
  const n = scenario.turns.length;
  const total = [...perTurn.values()].reduce((s, t) => s + t.krw, 0);
  const segments = {};
  for (const [name, [a, b]] of Object.entries(scenario.segments ?? {})) {
    let s = 0;
    for (let i = a; i <= b; i++) s += perTurn.get(i)?.krw ?? 0;
    segments[name] = s / (b - a + 1);
  }
  let max = { turn: null, krw: -1, tags: {} };
  for (const [turn, t] of perTurn) if (t.krw > max.krw) max = { turn, krw: t.krw, tags: t.tags };
  return {
    avg_krw: total / n,
    avg_with_end_krw: (total + endKrw) / n,
    end_krw: endKrw,
    total_krw: total + endKrw,
    segments,
    max,
    by_tag: byTag,
    failed_calls: failed,
    cache_hit_rate: readTok / Math.max(1, inTok + readTok + writeTok),
    per_turn: [...perTurn].map(([turn, t]) => ({ turn, krw: t.krw, tags: t.tags })),
  };
}

function scoreMemory(scenario, run) {
  const reply = new Map(run.turns.map((t) => [t.turn, t.reply ?? '']));
  const items = run.memory?.items ?? [];
  const results = [];
  for (const p of scenario.turns.filter((t) => t.kind === 'probe')) {
    const text = reply.get(p.turn);
    const r = { turn: p.turn, type: p.type, difficulty: p.difficulty, user: p.user, reply: text, expect: p.expect ?? [], ...judge(p, text, reply) };
    // 원인 추적용: 원천 발화에서 나온 기억 항목
    r.source_items = items.filter((i) => p.source_turns?.includes(i.source?.turn_no)).map((i) => ({ id: i.id, text: i.text, status: i.status, turn: i.source?.turn_no }));
    if (p.judge_hint) r.judge_hint = p.judge_hint;
    results.push(r);
  }
  const counts = {};
  for (const r of results) counts[r.result] = (counts[r.result] ?? 0) + 1;
  const scored = results.filter((r) => r.points != null);
  const hard = scored.filter((r) => r.difficulty === 'hard');
  // 미채점(needs_judge)은 실패일 수 있다. 점수는 '채점된 문항 기준'과 '전체 문항 기준(미채점=0점)'을 같이 낸다.
  const eligible = results.filter((r) => r.result !== 'excluded' && r.result !== 'error');
  return {
    points: scored.reduce((s, r) => s + r.points, 0),
    max_points: scored.length * 2,
    probes: eligible.length,
    unscored: eligible.length - scored.length,
    max_points_all: eligible.length * 2,
    counts,
    hard_accuracy: hard.length ? hard.filter((r) => r.result === 'correct').length / hard.length : null,
    fabrication_rate: scored.length ? scored.filter((r) => r.result === 'fabricated').length / scored.length : null,
    results,
  };
}

function judge(p, text, reply) {
  if (!text) return { result: 'error', points: null };
  if (p.type === 'char_promise' && p.requires_promise_turn) {
    if (!PROMISE.test(reply.get(p.requires_promise_turn) ?? '')) return { result: 'excluded', points: null, why: `${p.requires_promise_turn}턴에 약속 없음` };
  }
  if (p.type === 'implicit') return { result: 'needs_judge', points: null };

  const has = (list) => (list ?? []).filter((k) => text.includes(k));
  if (p.type === 'abstain' || p.type === 'half_said') {
    const bad = has(p.forbidden);
    // 모른다고 하면서 후보를 되묻는 답("코숏이야, 아니면…?")은 키워드로 가릴 수 없어 AI 판정에 넘긴다
    if (bad.length && ABSTAIN.test(text)) return { result: 'needs_judge', points: null, hit: bad, why: '모름 표현 + 금지어(되묻기일 수 있음)' };
    if (bad.length || (p.forbidden_regex && new RegExp(p.forbidden_regex).test(text) && !ABSTAIN.test(text))) {
      return { result: 'fabricated', points: POINTS.fabricated, hit: bad };
    }
    if (ABSTAIN.test(text)) return { result: 'correct', points: 2 };
    return { result: 'needs_judge', points: null };
  }

  const hit = has(p.expect);
  const stale = has(p.stale);
  if (p.expect_all) {
    const groups = p.expect.length;
    if (hit.length === groups) return { result: 'correct', points: POINTS.correct, hit, ...(stale.length ? { also_stale: stale } : {}) };
    if (hit.length > 0 && !stale.length) return { result: 'partial', points: POINTS.partial, hit };
    if (stale.length) return { result: 'stale', points: POINTS.stale, hit: stale };
  } else if (hit.length && p.type === 'combine' && ABSTAIN.test(text)) {
    // 두 사람을 비교하는 문항: '동생'이라는 말만 나오고 "동생 얘기는 못 들었어"면 절반만 맞힌 것
    return { result: 'partial', points: POINTS.partial, hit, why: 'combine + 모름 표현' };
  } else if (hit.length) {
    return { result: 'correct', points: POINTS.correct, hit, ...(stale.length ? { also_stale: stale } : {}) }; // 새 값과 옛 값을 함께 말함 → AI 판정에서 재확인
  }
  // "축제 같이 가기로 한 적 있었나요? 기억에 없어요"처럼 옛 값을 되묻기만 하고 모른다고 하면 옛 정보가 아니라 '모름'
  if (stale.length && ABSTAIN.test(text)) return { result: 'unknown', points: POINTS.unknown, hit: stale, why: '옛 값 언급 + 모름 표현' };
  if (stale.length) return { result: 'stale', points: POINTS.stale, hit: stale };
  if (ABSTAIN.test(text)) return { result: 'unknown', points: POINTS.unknown };
  return { result: 'needs_judge', points: null };
}

// 캐릭터별 말투 기대: 반말 / 존댓말 / 섞음(검사 안 함)
// 캐릭터 → 기대 말투. 옛 캐릭터(legacy)는 지난 런 재채점용으로 남긴다
const SPEECH = { baekho: 'banmal', naruto: 'banmal', backend: 'banmal', sejong: 'haoche', yuna: 'banmal', sera: 'jondae', kang: null };
const USER_NAMES = /도윤|하린|민재|지수|지민|민준|레오|지호|소라|태오|서연/;
// 섞인 언어로 보지 않을 영단어: 시트에 있는 개발 용어(backend)
const LATIN_OK = /^(Java|java|Python|python|Spring|spring|Kafka|kafka|MySQL|mysql|Slack|slack|Netflix|Redis|redis|Docker|docker|commit|deploy|timeout|Timeout|consumer|Consumer|lag|PR|QA|API|DB)$/;

function scoreQuality(scenario, run) {
  const replies = run.turns.map((t) => ({ turn: t.turn, text: t.reply ?? '', ch: t.character_id ?? scenario.character_id })); // 세션별 캐릭터(run.mjs)
  const flags = { user_action: 0, repetition: 0, same_opening: 0, lang_mix: 0, meta_or_empty: 0, early_past_ref: 0, speech_mismatch: 0 };
  const examples = {};
  const flagTurns = {}; // 항목별 위반 턴 목록(한 턴이 여러 항목에 걸려도 턴 단위로 셀 수 있게)
  const note = (k, turn, text) => { flags[k]++; (flagTurns[k] ??= []).push(turn); (examples[k] ??= []).length < 3 && examples[k].push({ turn, text }); };
  let questions = 0, len = 0;

  replies.forEach(({ turn, text, ch }, i) => {
    const speech = SPEECH[ch];
    len += text.length;
    if (/[?？]/.test(text)) questions++;
    if (!text.trim() || /언어 ?모델|인공지능|\bAI\b|롤플레이|캐릭터 설정/.test(text)) note('meta_or_empty', turn, text);
    if (/[぀-ヿ一-鿿]/.test(text) || (text.match(/[A-Za-z]{4,}/g) ?? []).filter((w) => !LATIN_OK.test(w)).length) note('lang_mix', turn, text);
    // 사용자의 행동·감정을 서술/단정
    const who = new RegExp(`(너|넌|네가|당신|${USER_NAMES.source})(은|는|이|가)?\\s?[^?\\n]{0,15}(웃었|웃으며|웃는구나|끄덕|미소를|얼굴이 붉|설레는구나|설렜|당황했|기뻐하는|좋아하는구나|신났구나|피곤해 보|긴장했)`);
    // 지문(*...*)에서 사용자가 주어인 서술만 잡는다("*민준이 웃는다*"). "*민준을 본다*"처럼 캐릭터 행동의 대상이면 정상.
    const narrUser = (text.match(/\*[^*]+\*/g) ?? []).some((x) => new RegExp(`(${USER_NAMES.source})(이|가|은|는|의 (얼굴|표정|눈|볼))\s`).test(x));
    if (who.test(text.replace(/\*[^*]+\*/g, ' ')) || narrUser) note('user_action', turn, text);
    // 첫 대화 초반에 사용자와의 공동 과거나 사용자에 대한 사실을 아는 척(캐릭터 자신의 "어제" 경험담은 제외)
    if (turn <= 5 && (/지난번|저번에|또 왔|늘 먹던|항상 시키던|늘 마시던|늘 앉던|늘 시키던|자주 오던|오랜만/.test(text)
      || /어제[^.!?\n]{0,15}(너|네가|넌|당신|우리|같이|함께)|(너|네가|넌|당신|우리)[^.!?\n]{0,15}어제/.test(text))) note('early_past_ref', turn, text);
    if (i > 0) {
      const prev = replies[i - 1].text;
      if (jaccard(grams(prev), grams(text)) > 0.35) note('repetition', turn, text);
      // 첫머리 비교는 지문(*…*)을 뗀 대사로 한다(지문이 "*나루토가…"로 같게 시작해도 대사는 다를 수 있음)
      const open6 = (x) => x.replace(/^\s*\*[^*]*\*\s*/, '').slice(0, 6);
      if (open6(prev) && open6(prev) === open6(text)) note('same_opening', turn, text);
    }
    if (speech) {
      const sents = text.split(/(?<=[.!?~…])\s+|\n+/).map((s) => s.trim()).filter((s) => s.length > 3);
      // 하오체는 명사 뒤 '~요'("초고요", "정도요")가 정상이라 현대 해요체 어미만 센다
      const politeRe = speech === 'haoche' ? /(어요|아요|에요|예요|해요|세요|니다|죠|까요|네요|군요|지요)[.!?~…ㅋㅎ\s]*$/ : /(요|니다|세요|죠|까요)[.!?~…ㅋㅎ\s]*$/;
      const polite = sents.filter((s) => politeRe.test(s)).length;
      const ratio = sents.length ? polite / sents.length : 0;
      // haoche(세종): 하오체·하느니라체가 기본이라 현대 존댓말(요·니다)이 30% 넘게 섞이면 어긋남
      if ((speech === 'banmal' && ratio > 0.3) || (speech === 'jondae' && ratio < 0.5) || (speech === 'haoche' && ratio > 0.3)) note('speech_mismatch', turn, text);
    }
  });
  return { flags, flag_turns: flagTurns, examples, question_rate: questions / replies.length, avg_chars: len / replies.length, style: styleMetrics(run) };
}

// 말투가 정형화됐는지 보는 비율들(낮을수록 덜 기계적). 품질 평가용 흐름 대본에서 프롬프트 전후 비교에 쓴다.
//   ends_question: 마지막 문장이 질문으로 끝남 / multi_question: 한 턴에 질문 2개 이상
//   echo_opening: 첫 구절이 사용자 말을 되풀이(첫 구절 글자 2-gram 의 절반 이상이 사용자 말에 있음)
//   laugh: ㅋㅋ·ㅎㅎ·헤헤 포함 / top_opening_share: 가장 흔한 첫 두 글자가 차지하는 비율
function styleMetrics(run) {
  const rows = run.turns.filter((t) => t.reply);
  const n = Math.max(1, rows.length);
  const bi = (x) => { const t = x.replace(/\s+/g, ''); const o = new Set(); for (let i = 0; i + 2 <= t.length; i++) o.add(t.slice(i, i + 2)); return o; };
  let endsQ = 0, multiQ = 0, multiQStrict = 0, echo = 0, laugh = 0, narr = 0, narrMulti = 0, dlgLen = 0;
  const openings = {};
  for (const t of rows) {
    // 지문(*...*)은 빼고 대사만 본다(응답 형식: *지문* + 대사)
    const nb = (t.reply.match(/\*[^*]+\*/g) ?? []).length;
    if (nb) narr++;
    if (nb >= 2) narrMulti++;
    const r = t.reply.replace(/\*[^*]+\*/g, ' ').replace(/\s+/g, ' ').trim();
    dlgLen += r.length;
    const sents = r.split(/(?<=[.!?？~…])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
    if (/[?？]\s*[ㅋㅎ~!]*\s*$/.test(sents.at(-1) ?? '')) endsQ++;
    if ((r.match(/[?？]/g) ?? []).length >= 2) multiQ++;
    // 감탄형 '?!'(그쵸?!, 사과파이요?!)는 질문에서 뺀 엄격 버전
    if ((r.match(/[?？](?![!！])/g) ?? []).length >= 2) multiQStrict++;
    const first = (sents[0] ?? '').split(/[,，、!！?？.。~…]/)[0];
    const fb = bi(first), ub = bi(t.user ?? '');
    if (fb.size >= 3 && [...fb].filter((g) => ub.has(g)).length / fb.size >= 0.5) echo++;
    if (/ㅋㅋ|ㅎㅎ|헤헤/.test(r)) laugh++;
    const op = r.replace(/^[\s*"'(（]+/, '').slice(0, 2);
    openings[op] = (openings[op] ?? 0) + 1;
  }
  const top = Object.entries(openings).sort((a, b) => b[1] - a[1])[0];
  return { ends_question: endsQ / n, multi_question: multiQ / n, echo_opening: echo / n, laugh: laugh / n,
    top_opening: top?.[0] ?? null, top_opening_share: (top?.[1] ?? 0) / n, narration_rate: narr / n, narration_multi: narrMulti / n, multi_question_strict: multiQStrict / n, dialogue_chars: dlgLen / n };
}

function grams(s) {
  const t = s.replace(/\s+/g, '');
  const out = new Set();
  for (let i = 0; i + 3 <= t.length; i++) out.add(t.slice(i, i + 3));
  return out;
}
function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}
