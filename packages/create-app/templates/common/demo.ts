import * as Lia from './lia';
import { PRODUCT_ID } from './config';

export type DemoAction = { id: string; label: string; description: string; code: string; run: () => unknown | Promise<unknown>; testOnly?: boolean; capability?: keyof NonNullable<Lia.InitResult['capabilities']> };
export type DemoGroup = { id: string; title: string; description: string; actions: DemoAction[] };
const action = (id: string, label: string, description: string, code: string, run: DemoAction['run'], extra: Partial<DemoAction> = {}): DemoAction => ({ id, label, description, code, run, ...extra });
let media: string | null = null;
export const groups: DemoGroup[] = [
  { id: 'interface', title: 'Interface', description: 'Native feedback and dialogs, with the same look as Lia.', actions: [
    action('toast','Show a toast','A small piece of feedback that does not interrupt the user.',"await toast('Hello from your app');",()=>Lia.toast('Hello from your app')),
    action('confirm','Ask for confirmation','Let the user make a decision in a native sheet.',"await confirm({ title: 'Try this feature?', body: 'You can cancel.', confirm: 'Continue' });",()=>Lia.confirm({title:'Try this feature?',body:'You can cancel.',confirm:'Continue'})),
    action('popup','Choose an option','Show up to three choices.',"await showPopup({ message: 'Choose a colour', buttons: [{ id: 'blue', text: 'Blue' }, { id: 'green', text: 'Green' }] });",()=>Lia.showPopup({message:'Choose a colour',buttons:[{id:'blue',text:'Blue'},{id:'green',text:'Green'}]})),
    action('alert','Show an alert','Wait until the user dismisses a short message.',"await showAlert('You are ready to build.');",()=>Lia.showAlert('You are ready to build.')),
    action('haptic','Feel a tap','Native haptics work on supported phones.',"await haptic('success');",()=>Lia.haptic('success')),
  ]},
  { id: 'identity', title: 'Player & session', description: 'Identity comes from Lia. Verify the session on your server.', actions: [
    action('identity','Inspect initialization','Player, language, theme and capabilities. Session tokens are redacted.', 'const me = await init();',()=>Lia.init()),
    action('session','Refresh the session','Send this token privately to your backend; never use a player name as proof.', 'const { session, exp } = await session();',()=>Lia.session()),
  ]},
  { id: 'payments', title: 'Payments', description: 'Create the demo-coins product in your developer portal first. The browser never delivers purchases or grants balances.', actions: [
    action('pay','Try a test purchase','Runs only in test mode. Your backend must verify the charge and deliver once.', "const charge = await pay('demo-coins');\n// Send charge.chargeId to your server for verification and delivery.",()=>Lia.pay(PRODUCT_ID),{testOnly:true}),
    action('charges','Check undelivered charges','Recover purchases that completed while the app reloaded.', 'const pending = await charges();',()=>Lia.charges()),
  ]},
  { id: 'ads', title: 'Ads', description: 'Lia handles placement and pacing. A closed ad is not proof that a reward was earned.', actions: [
    action('rewarded','Rewarded ad','Inspect watched, shown and reason. Verify eligibility server-side.', 'const result = await showRewardedAd();',()=>Lia.showRewardedAd()),
    action('rewarded-interstitial','Rewarded interstitial','An optional reward at a natural break.', 'await showRewardedInterstitialAd();',()=>Lia.showRewardedInterstitialAd()),
    action('interstitial','Interstitial','Show at an appropriate break; availability is not guaranteed.', 'await showInterstitialAd();',()=>Lia.showInterstitialAd()),
    action('banner','Show banner','Lia docks the banner outside your page.', "await showBanner({ position: 'bottom' });",()=>Lia.showBanner({position:'bottom'})),
    action('banner-hide','Hide banner','Give the page its full space back.', 'await hideBanner();',()=>Lia.hideBanner()),
    action('native','Native card','A compact card rendered by the Lia host.', "await showNativeAd({ placement: 'card' });",()=>Lia.showNativeAd({placement:'card'})),
    action('native-sheet','Native sheet','A larger placement at a break in your app.', "await showNativeAd({ placement: 'sheet' });",()=>Lia.showNativeAd({placement:'sheet'})),
    action('native-hide','Hide native card','Dismiss an existing docked card.', 'await hideNativeAd();',()=>Lia.hideNativeAd()),
  ]},
  { id: 'sharing', title: 'Sharing & navigation', description: 'Let people invite friends and move between your app and Lia.', actions: [
    action('invite','Invite a friend','Use Lia’s friend picker to send an app invite.', "await inviteFriend({ startParam: 'hello' });",()=>Lia.inviteFriend({startParam:'hello'})),
    action('share','Share your app','Use the launch link provided by init, not a hardcoded hostname.', "await share('Try my app: ' + inviteLink());",()=>Lia.share('Try my app: '+Lia.inviteLink())),
    action('link','Open the docs','Open a trusted HTTPS page.', "await openLink('https://docs.lialabs.org');",()=>Lia.openLink('https://docs.lialabs.org')),
    action('lia-link','Open Lia Apps','Navigate to a supported native screen.', "await openLiaLink('apps');",()=>Lia.openLiaLink('apps')),
  ]},
  { id: 'storage', title: 'Storage', description: 'Storage is scoped to this app. Client storage is never a trusted currency balance.', actions: [
    action('cloud-set','Save in the cloud','Store a harmless preference for this player.', "await cloudStorage.setItem('demo.preference', 'blue');",()=>Lia.cloudStorage.setItem('demo.preference','blue')),
    action('cloud-get','Read cloud data','The same player can read it on another device.', "await cloudStorage.getItem('demo.preference');",()=>Lia.cloudStorage.getItem('demo.preference')),
    action('cloud-keys','List cloud keys','Discover the keys belonging to this app and player.', 'await cloudStorage.getKeys();',()=>Lia.cloudStorage.getKeys()),
    action('cloud-remove','Remove demo preference','Remove only the key created by this example.', "await cloudStorage.removeItem('demo.preference');",()=>Lia.cloudStorage.removeItem('demo.preference')),
    action('device-set','Save on the phone','A local preference for this device.', "await deviceStorage.setItem('demo.preference', 'blue');",()=>Lia.deviceStorage.setItem('demo.preference','blue')),
    action('device-get','Read phone storage','Read your app’s local preference.', "await deviceStorage.getItem('demo.preference');",()=>Lia.deviceStorage.getItem('demo.preference')),
    action('secure-set','Try secure storage','Store a demo preference, not a real secret.', "await secureStorage.setItem('demo.preference', 'demo-value');",()=>Lia.secureStorage.setItem('demo.preference','demo-value')),
    action('secure-get','Read secure storage','Native secure storage is scoped to this app.', "await secureStorage.getItem('demo.preference');",()=>Lia.secureStorage.getItem('demo.preference')),
  ]},
  { id: 'device', title: 'Device & media', description: 'Permissions are requested only after you choose an action. Hardware features must also be tested in Lia.', actions: [
    action('biometric','Check biometrics','Find out whether the device supports authentication.', 'await biometric.init();',()=>Lia.biometric.init()),
    action('authenticate','Authenticate','Ask the user to confirm their identity on this device.', "await biometric.authenticate({ reason: 'Try this SDK example' });",()=>Lia.biometric.authenticate({reason:'Try this SDK example'})),
    action('qr','Scan a QR code','Open Lia’s scanner. Cancellation is normal.', "await scanQr({ text: 'Scan a demo code' });",()=>Lia.scanQr({text:'Scan a demo code'})),
    action('copy','Copy text','Copy a short message to the clipboard.', "await copyText('Built with Lia');",()=>Lia.copyText('Built with Lia')),
    action('clipboard','Read clipboard','Lia and the operating system may ask permission.', 'await readClipboard();',()=>Lia.readClipboard()),
    action('location','Request approximate location','Use the least precise location your feature needs.', "await location.get({ accuracy: 'low' });",()=>Lia.location.get({accuracy:'low'}),{capability:'location'}),
    action('photo','Capture a photo','Files stay on the device until you choose to upload them.', 'const photo = await capturePhoto();',async()=>{const photo=await Lia.capturePhoto();if(!photo.cancelled)media=photo.id;return photo;},{capability:'capturePhoto'}),
    action('video','Capture a video','Explicit permission is required on a supported Lia version.', 'const video = await captureVideo();',async()=>{const video=await Lia.captureVideo();if(!video.cancelled)media=video.id;return video;},{capability:'captureVideo'}),
    action('media-read','Read a captured file','Capture first. The readout omits the actual file contents.', 'await readMedia(capturedId, 0);',()=>{if(!media)throw Error('Capture a photo or video first.');return Lia.readMedia(media,0);},{capability:'readMedia'}),
    action('media-release','Release captured file','Let Lia clean up the temporary capture.', 'await releaseMedia(capturedId);',async()=>{if(!media)throw Error('No captured file.');const result=await Lia.releaseMedia(media);media=null;return result;}),
    action('motion-start','Start accelerometer','Read the reactive accelerometer.reading value in your component.', 'await accelerometer.start({ refreshRate: 500 });',()=>Lia.accelerometer.start({refreshRate:500})),
    action('motion-read','Inspect motion reading','The reading updates through the SDK’s observable state.', 'accelerometer.reading.get();',()=>Lia.accelerometer.reading.get()),
    action('motion-stop','Stop accelerometer','Stop sensors when your feature no longer needs them.', 'await accelerometer.stop();',()=>Lia.accelerometer.stop()),
  ]},
  { id: 'layout', title: 'Layout & screen', description: 'The SDK binds theme, language and safe-area values to the page. Layout changes depend on how your app was opened.', actions: [
    action('expand','Expand the sheet','Use the available height without losing native controls.', 'await expand();',()=>Lia.expand()),
    action('fullscreen','Enter fullscreen','Use safe-area insets around the floating controls.', 'await requestFullscreen();',()=>Lia.requestFullscreen()),
    action('fullscreen-exit','Leave fullscreen','Return to the previous app display.', 'await exitFullscreen();',()=>Lia.exitFullscreen()),
    action('portrait','Lock portrait','Screen changes are undone when the app closes.', "await screen.lockOrientation('portrait');",()=>Lia.screen.lockOrientation('portrait'),{capability:'screen'}),
    action('orientation-reset','Unlock orientation','Follow the device orientation again.', 'await screen.unlockOrientation();',()=>Lia.screen.unlockOrientation(),{capability:'screen'}),
    action('awake','Keep screen awake','Use only while your feature needs it.', 'await screen.keepAwake(true);',()=>Lia.screen.keepAwake(true),{capability:'screen'}),
    action('awake-off','Release screen lock','Restore normal sleep behavior.', 'await screen.keepAwake(false);',()=>Lia.screen.keepAwake(false),{capability:'screen'}),
  ]},
  { id: 'notifications', title: 'Notifications & reminders', description: 'Respect opt-outs. Server announcements use your secret server key on your backend, never in browser code.', actions: [
    action('notification','Request app notifications','Ask to receive notifications from this app.', 'await requestNotifications();',()=>Lia.requestNotifications()),
    action('reminder','Schedule a demo reminder','Ask for one reminder in 60 seconds.', "await reminders.schedule({ id: 'sdk-demo', title: 'Your demo reminder', inSeconds: 60 });",()=>Lia.reminders.schedule({id:'sdk-demo',title:'Your demo reminder',inSeconds:60}),{capability:'reminders'}),
    action('reminders','List reminders','View this app’s scheduled reminders.', 'await reminders.list();',()=>Lia.reminders.list(),{capability:'reminders'}),
    action('reminder-cancel','Cancel demo reminder','Cancel only the reminder created by this example.', "await reminders.cancel('sdk-demo');",()=>Lia.reminders.cancel('sdk-demo'),{capability:'reminders'}),
    action('calendar','Add a calendar event','Lia opens a calendar file in the share sheet.', "await addToCalendar({ title: 'Try my Lia app', start: Date.now() + 3600000 });",()=>Lia.addToCalendar({title:'Try my Lia app',start:Date.now()+3600000}),{capability:'calendar'}),
  ]},
  { id: 'scores', title: 'Scores', description: 'Competitive results and valuable rewards need independent server validation.', actions: [
    action('score','Submit a demo score','Only enabled in test mode. This is not an anti-cheat system.', 'await submitScore(42);',()=>Lia.submitScore(42),{testOnly:true}),
    action('leaderboard','Read leaderboard','Inspect the top players and the current player’s position.', 'await leaderboard();',()=>Lia.leaderboard()),
  ]},
];

export async function executeAction(item: DemoAction) {
  if (item.testOnly && Lia.mode.get() !== 'test') throw Error('This demo action is restricted to test mode. Add server verification before adapting it for a live app.');
  if (item.capability && !(await Lia.init()).capabilities?.[item.capability]) throw Error('This feature needs a supported Lia version and device.');
  return item.run();
}
