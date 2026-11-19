import './i18n';
import { isLia, mockLia } from '@lia-labs/bridge';
export const mocked=import.meta.env.DEV && __MOCK__ && import.meta.env.VITE_LIA_MOCK!=='false' && !isLia();
if(mocked)mockLia({latency:180,init:{language:document.documentElement.lang as any}});
