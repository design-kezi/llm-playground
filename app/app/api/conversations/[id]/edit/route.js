import { maybeStream } from '@/lib/http.js';
import { editMessage } from '@/lib/chat.js';
export const POST = async (req, { params }) => {
  const [{ id }, body] = await Promise.all([params, req.json()]);
  return maybeStream(req, (opts) => editMessage(id, body.turn_no, body.text, opts));
};
