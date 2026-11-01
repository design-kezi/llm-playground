import { handle } from '@/lib/http.js';
import { report } from '@/lib/chat.js';
export const GET = (req, { params }) => handle(async () => report((await params).id));
