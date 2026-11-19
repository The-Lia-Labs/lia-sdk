import { request } from './lia';
import { PRODUCT_ID } from './config';
export type DemoAction={id:string;label:string;description:string;code:string;run:()=>unknown|Promise<unknown>;testOnly?:boolean};
export type DemoGroup={id:string;title:string;description:string;actions:DemoAction[]};
const action=(id:string,label:string,description:string,code:string,run:DemoAction['run'],testOnly=false):DemoAction=>({id,label,description,code,run,testOnly});
export const groups:DemoGroup[]=[
 {id:'interface',title:'Interface',description:'The raw typed messages used by SDK helpers.',actions:[
 action('toast','Toast','The bridge validates method names and parameter types.',"await request('toast', { text: 'Hello', position: 'bottom', tone: 'info' });",()=>request('toast',{text:'Hello from the bridge',position:'bottom',tone:'info'})),
 action('haptic','Haptics','A native success tap.',"await request('haptic', { kind: 'success' });",()=>request('haptic',{kind:'success'})),
 action('confirm','Confirm','A native decision sheet.',"await request('confirm', { title: 'Try it?', body: 'You can cancel.', confirm: 'Continue', danger: false });",()=>request('confirm',{title:'Try it?',body:'You can cancel.',confirm:'Continue',danger:false})),
 ]},
 {id:'identity',title:'Identity',description:'Keep authentication and valuable decisions on your server.',actions:[
 action('init','Initialization','Inspect the host response. Session tokens are redacted.',"await request('init');",()=>request('init')),
 action('session','Session refresh','Send the token privately to your backend for verification.',"await request('session');",()=>request('session')),
 ]},
 {id:'value',title:'Purchases & ads',description:'A client callback is never proof of reward eligibility or delivery.',actions:[
 action('pay','Test purchase','Create demo-coins in the portal. Deliver only after server verification.',"await request('pay', { productId: 'demo-coins' });",()=>request('pay',{productId:PRODUCT_ID}),true),
 action('charges','Undelivered charges','Recover pending delivery on your backend.',"await request('charges');",()=>request('charges')),
 action('rewarded','Rewarded ad','Inspect the result; do not award currency from the browser.',"await request('showAd', { format: 'rewarded' });",()=>request('showAd',{format:'rewarded'})),
 action('interstitial','Interstitial','Show an ad at an appropriate break.',"await request('showAd', { format: 'interstitial' });",()=>request('showAd',{format:'interstitial'})),
 action('banner','Banner','Drawn natively outside your page.',"await request('showBanner', { position: 'bottom' });",()=>request('showBanner',{position:'bottom'})),
 action('hide-banner','Hide banner','Release the docked ad.',"await request('hideBanner');",()=>request('hideBanner')),
 action('native','Native card','Lia controls placement and pacing.',"await request('showNativeAd', { placement: 'card' });",()=>request('showNativeAd',{placement:'card'})),
 action('hide-native','Hide native card','Remove the docked native card.',"await request('hideNativeAd');",()=>request('hideNativeAd')),
 ]},
 {id:'storage',title:'Storage',description:'App-scoped preferences. Client data is not a trusted balance.',actions:[
 action('save','Save preference','Use the raw storage operation shape.',"await request('cloudStorage', { op: 'set', key: 'demo.preference', value: 'blue' });",()=>request('cloudStorage',{op:'set',key:'demo.preference',value:'blue'})),
 action('read','Read preference','Only keys from this app are visible.',"await request('cloudStorage', { op: 'get', keys: ['demo.preference'] });",()=>request('cloudStorage',{op:'get',keys:['demo.preference']})),
 action('remove','Remove preference','Remove only the demo key.',"await request('cloudStorage', { op: 'remove', keys: ['demo.preference'] });",()=>request('cloudStorage',{op:'remove',keys:['demo.preference']})),
 ]},
 {id:'social',title:'Sharing & notifications',description:'The host handles dialogs and user permissions.',actions:[
 action('share','Share','Open the native share sheet.',"await request('share', { text: 'Built with Lia' });",()=>request('share',{text:'Built with Lia'})),
 action('invite','Invite a friend','Use Lia’s friend picker.',"await request('inviteFriend', { startParam: 'demo' });",()=>request('inviteFriend',{startParam:'demo'})),
 action('notify','Notifications','Respect the choice returned by the host.',"await request('requestNotifications');",()=>request('requestNotifications')),
 action('qr','Scan QR','Cancellation is a normal outcome.',"await request('scanQr', { text: 'Scan a demo code' });",()=>request('scanQr',{text:'Scan a demo code'})),
 ]},
 {id:'layout',title:'Layout',description:'Manage the host through typed requests; listen with on(event, handler).',actions:[
 action('expand','Expand','Expand a sheet.',"await request('expand');",()=>request('expand')),
 action('fullscreen','Fullscreen','Account for native safe areas.',"await request('requestFullscreen');",()=>request('requestFullscreen')),
 action('fullscreen-off','Exit fullscreen','Return to the prior display.',"await request('exitFullscreen');",()=>request('exitFullscreen')),
 action('leaderboard','Leaderboard','Inspect app-scoped scores.',"await request('leaderboard');",()=>request('leaderboard')),
 action('score','Demo score','Client scores need independent verification for real competitions.',"await request('submitScore', { score: 42 });",()=>request('submitScore',{score:42}),true),
 ]},
];
export async function executeAction(action:DemoAction){if(action.testOnly&&(await request('init')).mode!=='test')throw Error('This example is restricted to test mode. Verify value on your server before adapting it.');return action.run();}
