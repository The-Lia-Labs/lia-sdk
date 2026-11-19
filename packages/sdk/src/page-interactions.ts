import { pageInteractions } from './page-interactions-controller.js';

/** Web-only interaction controls. All default to false; editable fields retain normal editing. */
export interface PageInteractions {
  zoom: boolean;
  textSelection: boolean;
  contextMenu: boolean;
  nativeDrag: boolean;
}

/** No native request or app update. Options are partial, and apply immediately. Call in the browser. */
export function setPageInteractions(options: Partial<PageInteractions>): PageInteractions {
  const controller = pageInteractions();
  if (!controller) throw new Error('Page interactions need a browser document.');
  return controller.set(options);
}

export function getPageInteractions(): PageInteractions {
  return pageInteractions()?.get() ?? { zoom: false, textSelection: false, contextMenu: false, nativeDrag: false };
}

/** Called by init(), before any asynchronous native request. */
export function installPageInteractions(): void { pageInteractions(); }
