import { ConfirmPrompt, SelectPrompt, TextPrompt } from '@clack/core';
import * as prompts from '@clack/prompts';
import color from 'picocolors';
import width from 'fast-string-width';
import { wrapAnsi } from 'fast-wrap-ansi';
import { stripVTControlCharacters } from 'node:util';

const phases=['Project','Stack','Starter','Setup','Account'];
const phaseTones=[[117,176,255],[109,222,173],[255,191,121],[188,157,255],[255,156,198]];
const palette={blue:[91,125,255],cyan:[104,223,235],muted:[130,146,170],edge:[59,79,112],green:[104,218,167],ink:[239,244,255]};
const tones={react:[109,211,244],vue:[111,221,169],svelte:[255,153,116],preact:[190,156,255],solid:[132,183,255],angular:[255,141,173],vanilla:[133,183,255],elements:[128,224,219],bridge:[215,183,255]};
const safe = value => stripVTControlCharacters(String(value)).replace(/[\x00-\x1f\x7f]/g,' ');
export const terminalStyle = (env=process.env, output=process.stdout) => {
  const enabled=output.isTTY && !('NO_COLOR' in env) && env.TERM!=='dumb';
  const rgb=(tone,text)=>{
    if(!enabled)return String(text);
    const [r,g,b]=Array.isArray(tone)?tone:palette[tone]||palette.ink;
    const code=/truecolor|24bit/.test(env.COLORTERM||'')?`38;2;${r};${g};${b}`:`38;5;${16+36*Math.round(r/51)+6*Math.round(g/51)+Math.round(b/51)}`;
    return `\x1b[${code}m${text}\x1b[39m`;
  };
  const bold=text=>enabled?`\x1b[1m${text}\x1b[22m`:String(text);
  const fill=text=>enabled?`\x1b[48;5;17m${text}\x1b[49m`:String(text);
  return {rgb,bold,fill,enabled};
};
export function createStudio({output=process.stdout,env=process.env}={}) {
  const t=terminalStyle(env,output);
  const accessible=Boolean(env.ACCESSIBLE && !['0','false'].includes(env.ACCESSIBLE))||env.TERM==='dumb';
  const cols=()=>Math.max(12,Math.min(80,(output.columns||80)-4));
  const rows=()=>output.rows||30;
  const trim=(text,max)=>{let result='';for(const char of safe(text)){if(width(result+char)>max-1)return result+'…';result+=char;}return result;};
  const pad=(text,size)=>text+' '.repeat(Math.max(0,size-width(text)));
  function frame(lines,title='',tone='edge') {
    const size=cols(),inner=size-4;
    const label=title?' '+trim(title,Math.max(2,size-5))+' ':'';
    const top='╭'+(label?t.rgb(tone,'─')+t.rgb(tone,label):'')+t.rgb(tone,'─'.repeat(Math.max(0,size-width(label)-(label?3:2))))+t.rgb(tone,'╮');
    const body=lines.flatMap(line=>wrapAnsi(line,inner,{hard:true,trim:false}).split('\n')).map(line=>t.rgb(tone,'│')+' '+pad(line,inner)+' '+t.rgb(tone,'│'));
    return ['  '+t.rgb(tone,top),...body.map(line=>'  '+line),'  '+t.rgb(tone,'╰'+'─'.repeat(size-2)+'╯')].join('\n');
  }
  function stage(index) {
    const full=phases.map((name,i)=>i===index?t.bold(t.rgb(phaseTones[i],`${String(i+1).padStart(2,'0')} ${name.toUpperCase()}`)):t.rgb(i<index?'green':'muted',i<index?'✓ '+name:name)).join(t.rgb('edge','  /  '));
    return '\n  '+(width(full)<=cols()?full:t.rgb('blue',`${String(index+1).padStart(2,'0')} / 05  `)+t.bold(phases[index].toUpperCase()))+'\n';
  }
  const summary=(label,value,cancelled=false)=>'  '+t.rgb(cancelled?'muted':'green',cancelled?'−':'✓')+' '+t.rgb('muted',safe(label))+'  '+t.bold(safe(value))+'\n';
  function header(version) {
    output.write('\n');
    if(accessible){output.write(`Lia Developer Studio · ${version}\n\n`);return;}
    if(cols()>=67&&rows()>=24){
      const logo=['██╗     ██╗ █████╗ ','██║     ██║██╔══██╗','██║     ██║███████║','███████╗██║██║  ██║','╚══════╝╚═╝╚═╝  ╚═╝'];
      const side=['',t.bold('LIA DEVELOPER STUDIO'),t.rgb('muted','Your next idea starts here.'),'',t.rgb('muted',`CREATE APP  /  ${version}`)];
      for(let y=0;y<logo.length;y++){
        const line=[...logo[y]].map((char,x)=>t.rgb([91+Math.round(x*2),125+Math.round(x*4),255-Math.round(x)],char)).join('');
        output.write('  '+line+'   '+side[y]+'\n');
      }
    }else output.write('  '+t.bold(t.rgb('blue','L I A'))+'  /  '+t.bold('DEVELOPER STUDIO')+'\n  '+t.rgb('muted','Create app '+version)+'\n');
    output.write('\n  '+t.rgb('edge','─'.repeat(cols()))+'\n');
  }
  function select({message,options,initialValue,stage:step=3,cards=false,...other}) {
    if(accessible)return prompts.select({message,options,initialValue,...other});
    return new SelectPrompt({options,initialValue,...other,output,render(){
      const selected=this.options[this.cursor];
      if(this.state==='submit'||this.state==='cancel')return summary(message,selected.label||selected.value,this.state==='cancel');
      const size=cols(),available=Math.max(3,rows()-14),count=Math.min(options.length,available,9);
      const start=Math.max(0,Math.min(this.cursor-Math.floor(count/2),options.length-count));
      const shown=this.options.slice(start,start+count);
      const lines=[];
      if(start>0)lines.push(t.rgb('muted','↑ More frameworks'));
      shown.forEach((option,j)=>{
        const active=start+j===this.cursor,accent=tones[option.value]||palette.blue;
        const icon=option.badge?` ${option.badge} `:active?' ◆ ':' ◇ ';
        let label=t.rgb(accent,icon)+' '+(active?t.bold(option.label):safe(option.label));
        if(active&&option.hint&&size>=65)label+='  '+t.rgb('muted',trim(option.hint,size-width(label)-7));
        const row=pad((active?t.rgb('blue','› '):'  ')+label,size-4);
        lines.push(active?t.fill(row):row);
        if(cards){lines.push('      '+t.rgb('muted',trim(option.description||option.hint||'',size-11)));if(j<shown.length-1)lines.push('');}
      });
      if(start+count<options.length)lines.push(t.rgb('muted','↓ More frameworks'));
      if(!cards){lines.push(t.rgb('edge','─'.repeat(size-4)));lines.push(t.rgb('muted',trim(selected.description||selected.hint||'',size-4)));}
      const help=size<45?'↑/↓ choose · Enter select':'↑/↓ choose   Enter continue   Esc cancel';
      return stage(step)+'\n  '+t.bold(message)+'\n\n'+frame(lines,cards?'CHOOSE YOUR START':`${String(this.cursor+1).padStart(2,'0')} / ${String(options.length).padStart(2,'0')}`,'blue')+'\n  '+t.rgb('muted',help)+'\n';
    }}).prompt();
  }
  function text({message,stage:step=0,...opts}) {
    if(accessible)return prompts.text({message,...opts});
    return new TextPrompt({...opts,output,render(){
      if(this.state==='submit'||this.state==='cancel')return summary(message,this.value||opts.defaultValue||'',this.state==='cancel');
      const input=this.userInput?this.userInputWithCursor:t.rgb('muted',opts.placeholder||'Type here');
      const line=t.rgb('blue','› ')+input;
      const note=this.state==='error'?t.rgb([255,148,148],safe(this.error)):this.state==='validating'?t.rgb('muted','Checking your directory…'):t.rgb('muted','Enter continue   Esc cancel');
      return stage(step)+'\n  '+t.bold(message)+'\n\n'+frame([line],'','blue')+'\n  '+note+'\n';
    }}).prompt();
  }
  function confirm({message,active='Yes',inactive='No',initialValue=true,stage:step=3,...opts}) {
    if(accessible)return prompts.confirm({message,active,inactive,initialValue,...opts});
    return new ConfirmPrompt({active,inactive,initialValue,...opts,output,render(){
      if(this.state==='submit'||this.state==='cancel')return summary(message,this.value?active:inactive,this.state==='cancel');
      const option=(value,label)=> (this.value===value?t.rgb(phaseTones[step],'◆ '):t.rgb('muted','◇ '))+(this.value===value?t.bold(t.rgb(phaseTones[step],label)):t.rgb('muted',label));
      return stage(step)+'\n  '+t.bold(message)+'\n\n'+frame([option(true,active),option(false,inactive)],'YOUR PREFERENCE',phaseTones[step])+'\n  '+t.rgb('muted','←/→ choose   Enter continue   y/n quick select')+'\n';
    }}).prompt();
  }
  function livePreview({appId,framework,localUrl,publicUrl,appUrl,account}) {
    const status=(label,tone)=>t.rgb(tone,'● ')+t.bold(label);
    output.write('\n'+frame([t.bold(appId)+'  '+t.rgb('muted',framework+' · @'+safe(account.username)), '',status('LOCAL SERVER','green'),t.rgb('cyan',localUrl),'',status('CLOUDFLARE TUNNEL',[108,220,239]),t.rgb('cyan',publicUrl),'',status('CONNECTED TO LIA',[191,157,255]),t.rgb('cyan',appUrl)],'LIVE PREVIEW',[145,172,255])+'\n');
    output.write('  '+t.rgb('green','Changes update live. ')+t.rgb('muted','Reopen this test app in Lia to load the preview.')+'\n');
    output.write('  '+t.rgb('muted','The temporary URL is public. Your Lia listing stays private.')+'\n\n');
    output.write('  '+t.bold(t.rgb('cyan','o'))+' open app    '+t.bold(t.rgb([191,157,255],'d'))+' dashboard    '+t.bold(t.rgb([255,183,125],'q'))+' stop preview\n\n');
  }
  function blueprint({name,framework,template,pm,mock}) {
    const line=(a,b)=>t.rgb('muted',pad(a,13))+t.bold(safe(b));
    output.write('\n'+frame([line('PROJECT',name),line('STACK',framework),line('STARTER',template==='demo'?'SDK playground':'Clean starter'),line('PACKAGE',pm),line('PREVIEW',mock?'Browser simulation':'Inside Lia')],'YOUR BUILD','blue')+'\n');
  }
  function launchpad({commands,registration,account,installed,install}) {
    const title=install&&!installed?'PROJECT SAVED':'READY TO BUILD';
    output.write('\n'+frame([t.bold(t.rgb('green',install&&!installed?'One more step: install your packages.':'Your next app starts here.')),'',...commands.map(command=>t.rgb('muted','$ ')+t.rgb('cyan',command))],' '+title+' ','blue')+'\n');
    if(registration)output.write('  '+t.rgb('green','✓')+' '+t.bold('Registered in Lia')+(account?'  '+t.rgb('muted','@'+safe(account.username)):'')+'\n  '+t.rgb('cyan',registration.dashboardUrl)+'\n'+(registration.pendingHosting?'  '+t.rgb('muted','Run dev to preview in Lia. Add permanent hosting before review.')+'\n':''));
    output.write('\n  '+t.rgb('muted','DOCS  ')+t.rgb('cyan',cols()<65?'docs.lialabs.org':'https://docs.lialabs.org/packages/starters')+'\n  '+t.rgb('muted','BUILD '+ ' ')+t.rgb('cyan',cols()<65?'developers.lialabs.org':'https://developers.lialabs.org')+'\n\n');
  }
  function note(lines,title){output.write('\n'+frame(lines.map(safe),title,'blue')+'\n');}
  function task(onCancel) {return prompts.spinner({styleFrame:frame=>t.rgb('blue',frame),frames:env.LIA_NO_MOTION?['•']:['▰▱▱▱▱','▱▰▱▱▱','▱▱▰▱▱','▱▱▱▰▱','▱▱▱▱▰','▱▱▱▰▱','▱▱▰▱▱','▱▰▱▱▱'],delay:env.LIA_NO_MOTION?1000:110,...(onCancel?{onCancel}:{}),cancelMessage:'Stopped'});}
  return {header,select,text,confirm,livePreview,blueprint,launchpad,note,task,stage,frame,t};
}
