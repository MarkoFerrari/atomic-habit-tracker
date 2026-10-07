// Bundles the function and its dependencies into one CommonJS file: dist/handler.js (handler "handler.handle").
import { build } from 'esbuild';
import { writeFileSync } from 'node:fs';

await build({
  entryPoints: ['src/scaleway.ts'],
  outfile: 'dist/handler.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  minify: false, // readable on purpose: this code handles the push keys, so it should be easy to audit
  legalComments: 'eof',
});
// Ships next to handler.js in the zip, so Scaleway's Node runtime reads the bundle as CommonJS.
writeFileSync('dist/package.json', JSON.stringify({ type: 'commonjs' }) + '\n');
console.log('Built dist/handler.js');
