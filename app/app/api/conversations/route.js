import { handle } from '@/lib/http.js';
import { startConversation, listConversations } from '@/lib/chat.js';
export const POST = (req) => handle(async () => startConversation(await req.json()));
export const GET = (req) => handle(async () => listConversations(new URL(req.url).searchParams.get('user')));
