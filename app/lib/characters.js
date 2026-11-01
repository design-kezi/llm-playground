import fs from 'node:fs';
import path from 'node:path';

const dir = path.join(process.cwd(), 'characters');

export function listCharacters() {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
    .sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
}
export function getCharacter(id) {
  return listCharacters().find((c) => c.id === id);
}
