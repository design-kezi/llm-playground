import { handle } from '@/lib/http.js';
import { listMemory } from '@/lib/chat.js';
export const GET = (req) => handle(async () => {
  const sp = new URL(req.url).searchParams;
  return listMemory({ user_id: sp.get('user'), character_id: sp.get('character') ?? undefined, include_superseded: sp.get('include_superseded') === '1', include_log: sp.get('include_log') === '1' });
});
