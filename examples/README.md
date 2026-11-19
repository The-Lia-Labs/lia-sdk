# Examples

For complete projects, run `npm create @lia-labs/app@latest` and select your framework and **SDK demo**. These starters include TypeScript configuration, local simulation, native integration and a feature catalogue. The files below remain small drop-in examples.

- `script/index.html`: the script build (`window.liaSdk`) with `mockLia()`, runnable in any browser. Run `npm run build` first, then serve the repo root (`npx serve .`) and open `/examples/script/`.
- `react/App.tsx`, `preact/App.tsx`, `vue/App.vue`, `svelte/App.svelte`, `solid/App.tsx`, `angular/app.component.ts`: the same small app in each framework (a greeting in the player's language, a main button that buys an item, a back button on a detail screen, and closing confirmation while a game runs). Drop one into a new Vite (or Angular CLI) project with the package installed.
