import { toast, haptic, showConfirm } from './lia';
export type DemoAction = { id: string; label: string; description: string; code: string; run: () => unknown | Promise<unknown> };
export type DemoGroup = { id: string; title: string; description: string; actions: DemoAction[] };
export const groups: DemoGroup[] = [{ id:'start', title:'Your first features', description:'Replace these examples with your own app. Generate the demo template to explore the full catalogue.', actions:[
  {id:'toast',label:'Show a toast',description:'Native feedback from your chosen framework.',code:"await toast('Hello from your app');",run:()=>toast('Hello from your app')},
  {id:'haptic',label:'Feel a tap',description:'Haptics work on supported devices inside Lia.',code:"await haptic('light');",run:()=>haptic('light')},
  {id:'confirm',label:'Ask a question',description:'Let Lia show a native confirmation dialog.',code:"await showConfirm('Ready to build?');",run:()=>showConfirm('Ready to build?')},
] }];
export const executeAction = async (action: DemoAction) => action.run();
