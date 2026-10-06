// Rule 2 in CLAUDE.md: no raw hex, px or ms values outside the generated tokens.
// Allowed: 0, 1px hairlines inside media queries are still tokens, 100% / vh / dvh layout units, and env().
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../src', import.meta.url).pathname;
const skip = new Set(['tokens.css']);
const bad = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(svelte|css)$/.test(f) && !skip.has(f)) check(p);
  }
};
const check = (file) => {
  const src = readFileSync(file, 'utf8');
  const styles = file.endsWith('.css') ? src : (src.match(/<style[\s\S]*?<\/style>/g) || []).join('\n');
  styles.split('\n').forEach((line, i) => {
    const l = line.replace(/\/\*.*?\*\//g, '');
    if (/#[0-9a-fA-F]{3,8}\b/.test(l) || /(?<![\w-])[1-9]\d*(\.\d+)?(px|ms)\b/.test(l)) bad.push(`${file.replace(root, 'src')}:${i + 1}  ${line.trim()}`);
  });
};
walk(root);
if (bad.length) {
  console.error('Raw values found (use a token):\n' + bad.join('\n'));
  process.exit(1);
}
console.log('lint:tokens ok');
