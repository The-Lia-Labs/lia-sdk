import { defineConfig } from 'tsup';

// The packages' builds: ESM and CommonJS with types, and a script build (IIFE) with everything inside
// it, for a plain <script> tag (window.liaElements).
export default defineConfig([
  { entry: ['src/index.ts'], format: ['esm', 'cjs'], dts: true, sourcemap: true },
  { entry: { auto: 'src/auto.ts' }, format: ['iife'], globalName: 'liaElements', minify: true, sourcemap: true, noExternal: [/.*/] },
]);
