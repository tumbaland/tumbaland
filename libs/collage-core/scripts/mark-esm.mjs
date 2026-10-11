// dist/esm holds ES modules in .js files, which Node reads as CommonJS unless
// the nearest package.json says otherwise. The package root cannot say so: the
// CommonJS build next to it is what the backends require.
import { writeFileSync } from 'fs';

writeFileSync(new URL('../dist/esm/package.json', import.meta.url), '{ "type": "module" }\n');
