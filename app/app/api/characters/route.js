import { listCharacters } from '@/lib/characters.js';
export const GET = () => Response.json(listCharacters().map(({ id, name, tagline }) => ({ id, name, tagline })));
