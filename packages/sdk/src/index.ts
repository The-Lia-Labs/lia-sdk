// @lia-labs/sdk: the Lia SDK, typed and tree-shakeable. Everything the script tag SDK does, as named
// exports, with its state as observable values that the framework packages build on.

export * from '@lia-labs/bridge';
export { computed, readonly, signal, type Readable, type Writable } from './signals';
export {
  banner,
  bindCssVars,
  colorScheme,
  contentSafeArea,
  display,
  init,
  initialized,
  isFullscreen,
  language,
  mode,
  nativeAd,
  notificationsAllowed,
  notificationsAvailable,
  platform,
  player,
  rtl,
  safeArea,
  soundOn,
  startParam,
  themeParams,
  viewport,
  resetStateForTests,
  type InitOptions,
} from './state';
export { getPageInteractions, setPageInteractions, type PageInteractions } from './page-interactions';
export * from './app';
export * from './components';
export * from './bind';

/** This package's version. */
export const VERSION = '0.6.1';

export { products, leaderboards, serverStorage, type Product, type ServerBoard } from './server-features';

export { enableDeveloperTools, type DeveloperTools } from './developer-tools';

export { createSandbox, type SandboxScenario } from './sandbox';
