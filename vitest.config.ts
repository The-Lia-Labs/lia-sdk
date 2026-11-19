import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url));

// Every package's tests in one run, in a browser-like page (jsdom). The packages import each other from
// source, so tests never need a build first.
export default defineConfig({
  resolve: {
    // The browser builds of Solid and Svelte (their server builds never run effects).
    conditions: ['browser', 'development'],
    alias: {
      '@lia-labs/bridge': here('./packages/bridge/src/index.ts'),
      '@lia-labs/sdk': here('./packages/sdk/src/index.ts'),
    },
  },
  test: {
    environment: 'jsdom',
    include: ['packages/*/test/**/*.test.ts'],
    server: { deps: { inline: [/solid-js/, /svelte/] } },
  },
});
