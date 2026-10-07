import { defineConfig } from 'vitest/config';

// Standalone: keeps the app's Vite/Svelte config out of the function's tests.
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } });
