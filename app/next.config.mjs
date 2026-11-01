import path from 'node:path';
// 레포 루트의 memory/ 모듈을 import 할 수 있도록 루트를 한 단계 위로 둔다.
const root = path.resolve(import.meta.dirname, '..');
export default { turbopack: { root }, outputFileTracingRoot: root };
