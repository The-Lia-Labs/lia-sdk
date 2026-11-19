import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHmac} from 'node:crypto';
import {LiaClient,LiaError,verifyWebhook,constructWebhookEvent} from '../packages/server/dist/index.js';
const baseUrl=process.env.LIA_CONFORMANCE_URL;
assert(baseUrl?.startsWith('http://127.0.0.1:'),'A local simulation URL is required');
const lia=new LiaClient('lia_test_fixture',{baseUrl,timeoutMs:2000});
for(const c of JSON.parse(await readFile(new URL('../backends/conformance.json',import.meta.url)))){
 const result=await lia[c.operation](c.params);
 if(c.operation==='verifySession'){assert.equal(result.valid,true);continue;}
 if(c.text){assert.match(result,/active_players/);continue;}
 assert.equal(result.echo.method,c.method);assert.equal(result.echo.path,c.path);assert.deepEqual(result.echo.body,c.body);assert.deepEqual(result.echo.query,c.query);
}
assert.equal((await lia.requireSession('valid')).playerId,'p_12345678');
for(const session of ['invalid','expired','wrong-mode'])await assert.rejects(()=>lia.requireSession(session),e=>e.code==='invalid_session');
assert.equal((await lia.getCharge({id:'retry-node'})).charge.id,'ch_fixture');
for(const [id,code] of [['rate-node','slow_down'],['redirect-node','http_error'],['invalid-node','invalid_response'],['conflict-node','idempotency_key_reused']])await assert.rejects(()=>lia.getCharge({id}),e=>e.code===code&&!e.message.includes('NEVER_EXPOSE'));
await lia.deliverCharge({id:'replay-node'},{idempotencyKey:'node:one'});
await assert.rejects(()=>new LiaClient('lia_test_fixture',{baseUrl,timeoutMs:40}).getCharge({id:'slow-node'}),e=>e.code==='request_timeout');
await assert.rejects(()=>lia.getCharge({id:'../pool'}),e=>e.code==='invalid_path_parameter');
for(const url of ['http://example.com','https://user:pass@example.com','https://example.com?bad=1'])assert.throws(()=>new LiaClient('lia_test_fixture',{baseUrl:url}));
assert(!JSON.stringify(lia).includes('fixture'));
const at=Math.floor(Date.now()/1000),raw=JSON.stringify({id:'evt_1',type:'charge.paid',app:'example',at:at*1000,data:{}}),signature='t='+at+',v1='+createHmac('sha256','whsec_fixture').update(at+'.'+raw).digest('hex');
assert(await verifyWebhook('whsec_fixture',raw,signature));assert(!await verifyWebhook('whsec_fixture',raw+' ',signature));assert(!await verifyWebhook('wrong',raw,signature));assert(!await verifyWebhook('whsec_fixture',raw,signature,{now:Date.now()+301000}));assert.equal((await constructWebhookEvent('whsec_fixture',raw,signature)).id,'evt_1');
const counts=await fetch(baseUrl.replace('/api/apps/v1','/counts')).then(r=>r.json());
assert.equal(counts['GET /api/apps/v1/charges/retry-node'],2);assert.equal(counts['POST /api/apps/v1/charges/replay-node/deliver'],2);assert.equal(counts['GET /api/apps/v1/charges/rate-node'],1);assert.equal(counts['GET /leak'],undefined);
console.log('Node: 27 operations + retry, idempotency, session, redirect, deadline and webhook checks passed');
