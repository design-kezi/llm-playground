import { handle, maybeStream } from '@/lib/http.js';
import { sendMessage, getMessages } from '@/lib/chat.js';
export const POST = async (req, { params }) => {
  const [{ id }, body] = await Promise.all([params, req.json()]);
  return maybeStream(req, (opts) => sendMessage(id, body.text, opts));
};
export const GET = (req, { params }) => handle(async () => getMessages((await params).id));
