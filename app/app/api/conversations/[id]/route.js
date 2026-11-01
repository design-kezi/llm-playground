import { handle } from '@/lib/http.js';
import { updateConversation } from '@/lib/chat.js';
export const PATCH = (req, { params }) => handle(async () => updateConversation((await params).id, await req.json()));
export const DELETE = (req, { params }) => handle(async () => updateConversation((await params).id, { hidden: true }));
