import { handle } from '@/lib/http.js';
import { switchVersion } from '@/lib/chat.js';
export const POST = (req, { params }) => handle(async () => switchVersion((await params).id, (await req.json()).message_id));
