// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {createHmac} from 'node:crypto';
import {LiaClient,constructWebhookEvent,verifyWebhook} from '../src/index';
describe('server-only security boundaries',()=>{
 const raw='{"id":"one","type":"charge.paid","app":"game","at":1000000}';
 const signature='t=1000,v1='+createHmac('sha256','secret').update('1000.'+raw).digest('hex');
 it('verifies exact bytes and rejects tampering, stale and future signatures',async()=>{
  expect(await verifyWebhook('secret',raw,signature,{now:1000000})).toBe(true);
  for(const [secret,body,now] of [['wrong',raw,1000000],['secret',raw+' ',1000000],['secret',raw,1301000],['secret',raw,699000]] as const)expect(await verifyWebhook(secret,body,signature,{now})).toBe(false);
  expect((await constructWebhookEvent('secret',raw,signature,{now:1000000})).id).toBe('one');
  await expect(constructWebhookEvent('wrong',raw,signature,{now:1000000})).rejects.toThrow('invalid_webhook');
 });
 it('refuses unsafe origins and keeps credentials out of JSON',()=>{
  for(const baseUrl of ['http://example.com','https://user:pass@example.com','https://example.com?secret=yes'])expect(()=>new LiaClient('lia_test_fixture',{baseUrl})).toThrow();
  expect(JSON.stringify(new LiaClient('lia_test_fixture'))).toBe('{"mode":"test"}');
 });
});
