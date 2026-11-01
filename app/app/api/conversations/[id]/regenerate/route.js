import { maybeStream } from '@/lib/http.js';
import { regenerate } from '@/lib/chat.js';
export const POST = async (req, { params }) => {
  const [{ id }, body] = await Promise.all([params, req.json().catch(() => ({}))]);
  return maybeStream(req, (opts) => regenerate(id, opts, body.turn_no));
};
