// 모델 레이어 (레포 루트 model/). 인터페이스: docs/10-app-design.md 다른 레이어와의 인터페이스.
// 번들하지 않고 Node가 직접 import 한다. 번들하면 model/index.js 의 import.meta.dirname 이 비어
// .env·pricing.json 경로를 못 찾고, model/node_modules 의 SDK 해석도 번들러에 맡기지 않기 위함.
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const url = pathToFileURL(path.resolve(process.cwd(), '..', 'model', 'index.js')).href;
const m = await import(/* turbopackIgnore: true */ /* webpackIgnore: true */ url);

export const { complete, embed, pricing, estimateTokens } = m;
