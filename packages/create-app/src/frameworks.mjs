export const SDK_VERSION = '0.7.0';
export const frameworks = {
  vanilla: { label: 'Plain TypeScript', binding: '@lia-labs/sdk', entry: 'main.ts' },
  react: { label: 'React', binding: '@lia-labs/sdk-react', entry: 'main.tsx', dependencies: { react: '^19.3.1', 'react-dom': '^19.3.1' }, devDependencies: { '@vitejs/plugin-react': '^6.1.2', '@types/react': '^19.3.0', '@types/react-dom': '^19.3.0' }, plugin: "import react from '@vitejs/plugin-react';", plugins: 'react()', jsx: 'react-jsx' },
  preact: { label: 'Preact', binding: '@lia-labs/sdk-preact', entry: 'main.tsx', dependencies: { preact: '^10.29.8' }, devDependencies: { '@preact/preset-vite': '^2.10.6' }, plugin: "import preact from '@preact/preset-vite';", plugins: 'preact()', jsx: 'react-jsx', jsxImportSource: 'preact' },
  vue: { label: 'Vue', binding: '@lia-labs/sdk-vue', entry: 'main.ts', dependencies: { vue: '^3.5.45' }, devDependencies: { '@vitejs/plugin-vue': '^6.0.11', 'vue-tsc': '^3.3.14' }, plugin: "import vue from '@vitejs/plugin-vue';", plugins: 'vue()', check: 'vue-tsc --noEmit' },
  svelte: { label: 'Svelte', binding: '@lia-labs/sdk-svelte', entry: 'main.ts', dependencies: { svelte: '^5.58.0' }, devDependencies: { '@sveltejs/vite-plugin-svelte': '^7.3.1', 'svelte-check': '^4.7.8' }, plugin: "import { svelte } from '@sveltejs/vite-plugin-svelte';", plugins: 'svelte()', check: 'svelte-check --tsconfig ./tsconfig.json && tsc --noEmit' },
  solid: { label: 'Solid', binding: '@lia-labs/sdk-solid', entry: 'main.tsx', dependencies: { 'solid-js': '^1.9.19' }, devDependencies: { 'vite-plugin-solid': '^2.11.17' }, plugin: "import solid from 'vite-plugin-solid';", plugins: 'solid()', jsx: 'preserve', jsxImportSource: 'solid-js' },
  angular: { label: 'Angular', binding: '@lia-labs/sdk-angular', entry: 'main.ts' },
  elements: { label: 'Web components', binding: '@lia-labs/elements', entry: 'main.ts' },
  bridge: { label: 'Low-level bridge', binding: '@lia-labs/bridge', entry: 'main.ts' },
};
export const packageManagers = ['npm', 'pnpm', 'yarn', 'bun'];
export const templates = ['starter', 'demo'];
