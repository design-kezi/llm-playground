import { handle } from '@/lib/http.js';
import { endConversation } from '@/lib/chat.js';
export const POST = (req, { params }) => handle(async () => endConversation((await params).id));
