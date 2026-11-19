import './i18n';
import { isLia, mockLia } from './lia';

// This branch is removed by production builds. Never replace a real Lia host.
export const mocked = import.meta.env.DEV && __MOCK__ && import.meta.env.VITE_LIA_MOCK !== 'false' && !isLia();
if (mocked) mockLia({ latency: 180, init: { language: document.documentElement.lang as any, rtl: document.documentElement.dir === 'rtl', capabilities: { capturePhoto: true, captureVideo: true, readMedia: true, location: true, screen: true, reminders: true, calendar: true, mediaAccess: true, usageAnalytics: true } } });
