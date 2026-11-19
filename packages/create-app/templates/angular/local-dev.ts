import './i18n';
import { isLia, mockLia } from '@lia-labs/sdk-angular';
// Angular production builds replace this entire module with local-dev.production.ts.
export const mocked=__MOCK__ && !isLia();
if(mocked)mockLia({latency:180,init:{language:document.documentElement.lang as any,rtl:document.documentElement.dir==='rtl',capabilities:{capturePhoto:true,captureVideo:true,readMedia:true,location:true,screen:true,reminders:true,calendar:true,mediaAccess:true}}});
