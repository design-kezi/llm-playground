export async function handle(fn) {
  try {
    return Response.json(await fn());
  } catch (e) {
    if (!e.status) console.error(e);
    return Response.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

// ?stream=1 이면 SSE: 응답 조각마다 {delta}, 답 저장 직후 {saved}, 끝에 {done, ...결과} 또는 {error}. 아니면 기존 JSON.
// 클라이언트가 연결을 끊으면(중지) req.signal 이 abort 된다.
export function maybeStream(req, fn) {
  if (new URL(req.url).searchParams.get('stream') !== '1') return handle(() => fn({}));
  const enc = new TextEncoder();
  return new Response(new ReadableStream({
    async start(ctrl) {
      const send = (o) => { try { ctrl.enqueue(enc.encode(`data: ${JSON.stringify(o)}\n\n`)); } catch {} };
      try {
        send({ done: true, ...(await fn({ onDelta: (d) => send({ delta: d }), onSaved: () => send({ saved: true }), signal: req.signal })) });
      } catch (e) {
        if (!e.status) console.error(e);
        send({ error: e.message });
      }
      try { ctrl.close(); } catch {}
    },
  }), { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache, no-transform', 'x-accel-buffering': 'no' } });
}
