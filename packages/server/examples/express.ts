import express from 'express';
import {LiaClient,constructWebhookEvent,LiaError} from '@lia-labs/server';
const lia=new LiaClient(process.env.LIA_SERVER_KEY!);
const app=express();
// Install the raw route BEFORE express.json(). Never reserialize JSON for signature verification.
app.post('/webhooks/lia',express.raw({type:'application/json',limit:'20kb'}),async(req,res)=>{
 try{
  const event=await constructWebhookEvent(process.env.LIA_WEBHOOK_SECRET!,req.body,String(req.headers['lia-signature']??''));
  if(event.test===true){res.json({received:true,probe:true});return;}
  // Call your transactional, charge-ID-deduplicated fulfillment function here.
  // Do not acknowledge an unfulfilled purchase; Lia can retry it.
  res.status(503).json({error:'configure_fulfillment'});
 }catch{res.status(401).json({error:'invalid_webhook'});}
});
app.get('/shop',async(req,res)=>{
 try{const session=/^Bearer (\S+)$/.exec(req.headers.authorization??'')?.[1];if(!session){res.status(401).json({error:'session_required'});return;}await lia.requireSession(session);res.json(await lia.listProducts());}
 catch(e){const error=e as LiaError;res.status(error.status===401?401:503).json({error:error.code??'unavailable'});}
});
export default app;
