import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stripTypeScriptTypes} from 'node:module';
import {JSDOM} from 'jsdom';
const source=readFileSync(new URL('../templates/common/i18n.ts',import.meta.url),'utf8');
const runtime=stripTypeScriptTypes(source,{mode:'transform'}).replaceAll('export ','');
const languages=['en','es','pt','fr','tr','ru','vi','id','fil','sw','hi','ar','zh'];
for(const lang of languages)test(`page copy and live updates: ${lang}`,async()=>{
 const dom=new JSDOM('<!doctype html><html><body><h1>Orbit has a home in Lia.</h1><button>Try it</button><p>Connecting to the Lia SDK…</p><code>Try it</code><input value="Try it"><pre>{"label":"Try it"}</pre></body></html>',{url:'https://example.test/?lang='+lang,runScripts:'outside-only'});
 const w=dom.window;w.eval(runtime+';window.words=pageLanguage;');const api=w.words;
 assert.equal(w.document.documentElement.lang,lang);assert.equal(w.document.documentElement.dir,lang==='ar'?'rtl':'ltr');
 const h=w.document.querySelector('h1');assert(h.textContent.includes('Orbit'));
 if(lang!=='en'){assert.notEqual(h.textContent,'Orbit has a home in Lia.');assert.notEqual(w.document.querySelector('button').textContent,'Try it');}
 assert.equal(w.document.querySelector('code').textContent,'Try it');assert.equal(w.document.querySelector('input').value,'Try it');assert.equal(w.document.querySelector('pre').textContent,'{"label":"Try it"}');
 const p=w.document.querySelector('p');p.textContent='The Lia SDK is connected. Start with this page and make it your own.';await new Promise(r=>w.setTimeout(r,0));
 assert.equal(p.textContent,api.translate('The Lia SDK is connected. Start with this page and make it your own.'));
 api.setLanguage('ar');assert.equal(w.document.documentElement.dir,'rtl');api.setLanguage('en');assert.equal(h.textContent,'Orbit has a home in Lia.');assert.equal(w.document.querySelector('button').textContent,'Try it');
 api.setLanguage('fr-CA');assert.equal(w.document.documentElement.lang,'fr');api.setLanguage('tl');assert.equal(w.document.documentElement.lang,'fil');api.setLanguage('unknown');assert.equal(w.document.documentElement.lang,'en');
 api.dispose();w.close();
});
test('all locales cover every UI entry and preserve interpolation placeholders',()=>{
 const json=source.slice(source.indexOf('installPageLanguage({')+'installPageLanguage('.length,source.lastIndexOf(');\nexport const t'));
 const catalogue=JSON.parse(json);assert.deepEqual(Object.keys(catalogue).sort(),languages.sort());
 for(const words of Object.values(catalogue)){assert.deepEqual(Object.keys(words).sort(),Object.keys(catalogue.en).sort());for(const [key,value]of Object.entries(words)){assert(value.trim());assert.deepEqual((value.match(/\{\w+\}/g)||[]).sort(),(key.match(/\{\w+\}/g)||[]).sort());}}
});
