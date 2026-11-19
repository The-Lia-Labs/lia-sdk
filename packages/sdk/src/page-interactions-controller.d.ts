import type { PageInteractions } from './page-interactions';
export function pageInteractions(): { get(): PageInteractions; set(options: Partial<PageInteractions>): PageInteractions } | null;
