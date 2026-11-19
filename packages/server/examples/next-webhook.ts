// app/api/lia/webhooks/route.ts — verify untouched bytes; persist grants in your own database.
import {constructWebhookEvent} from '@lia-labs/server';
export const runtime='nodejs';
export async function POST(request:Request){
 const reader=request.body?.getReader();if(!reader)return Response.json({error:'body_required'},{status:400});
 const chunks:Uint8Array[]=[];let size=0;
 for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>20000){await reader.cancel();return Response.json({error:'body_too_large'},{status:413});}chunks.push(value);}
 const raw=new Uint8Array(size);let offset=0;for(const chunk of chunks){raw.set(chunk,offset);offset+=chunk.length;}
 try{const event=await constructWebhookEvent(process.env.LIA_WEBHOOK_SECRET!,raw,request.headers.get('Lia-Signature')??'');if(event.test===true)return Response.json({received:true,probe:true});return Response.json({error:'configure_transactional_fulfillment'},{status:503});}
 catch{return Response.json({error:'invalid_webhook'},{status:401});}
}
