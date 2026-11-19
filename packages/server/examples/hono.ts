import {Hono} from 'hono';
import {bodyLimit} from 'hono/body-limit';
import {LiaClient,constructWebhookEvent} from '@lia-labs/server';
const app=new Hono();
app.use('*',bodyLimit({maxSize:20000}));
app.post('/webhooks/lia',async c=>{
 try{const event=await constructWebhookEvent(process.env.LIA_WEBHOOK_SECRET!,new Uint8Array(await c.req.arrayBuffer()),c.req.header('Lia-Signature')??'');if(event.test===true)return c.json({received:true,probe:true});return c.json({error:'configure_transactional_fulfillment'},503);}
 catch{return c.json({error:'invalid_webhook'},401);}
});
app.get('/shop',async c=>{
 const token=/^Bearer (\S+)$/.exec(c.req.header('Authorization')??'')?.[1];if(!token)return c.json({error:'session_required'},401);
 const lia=new LiaClient(process.env.LIA_SERVER_KEY!);
 try{await lia.requireSession(token);return c.json(await lia.listProducts());}catch{return c.json({error:'unavailable'},503);}
});
export default app;
