/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';
import { readFileSync } from 'node:fs';

// GitHub Pages serves the repo at /atomic-habit-tracker/.
const base = process.env.ATOMIC_BASE ?? '/atomic-habit-tracker/';

// Hand-written service worker (CLAUDE.md §3): the template gets the exact list of built files
// and a version, so caching stays explicit and every deploy replaces the cache.
function serviceWorker(): Plugin {
  return {
    name: 'atomic-service-worker',
    apply: 'build',
    generateBundle(_opts, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map'));
      const statics = ['', 'index.html', 'manifest.webmanifest', 'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon.svg',
        'fonts/Geist-Regular.woff2', 'fonts/Geist-Medium.woff2', 'fonts/Geist-SemiBold.woff2', 'fonts/GeistMono-Regular.woff2', 'fonts/GeistMono-Medium.woff2'];
      const precache = [...new Set([...statics, ...files])];
      const version = new Date().toISOString();
      const source = readFileSync(new URL('./src/sw/sw.js', import.meta.url), 'utf8')
        .replace('self.__PRECACHE__', JSON.stringify(precache))
        .replace('self.__VERSION__', JSON.stringify(version));
      this.emitFile({ type: 'asset', fileName: 'sw.js', source });
    },
  };
}

// 030: the CSP allows 'self' plus the push function's origin, and nothing else.
function contentSecurityPolicy(): Plugin {
  const pushUrl = process.env.VITE_PUSH_URL;
  const pushOrigin = pushUrl ? new URL(pushUrl).origin : '';
  return {
    name: 'atomic-csp',
    transformIndexHtml: (html) => (pushOrigin ? html.replace("connect-src 'self'", `connect-src 'self' ${pushOrigin}`) : html),
  };
}

export default defineConfig({
  base,
  plugins: [svelte(), serviceWorker(), contentSecurityPolicy(), ...(process.env.VITEST ? [svelteTesting()] : [])],
  define: { __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'), __BUILT_AT__: JSON.stringify(new Date().toISOString()) },
  build: { target: 'safari16', assetsInlineLimit: 0, sourcemap: false },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
