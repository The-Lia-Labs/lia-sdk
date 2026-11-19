// app/api/lia/shop/route.ts — App Router, server-only route. Never NEXT_PUBLIC_LIA_SERVER_KEY.
import {LiaClient,LiaError} from '@lia-labs/server';
export const runtime='nodejs';
export async function GET(request:Request){
 const token=/^Bearer (\S+)$/.exec(request.headers.get('Authorization')??'')?.[1];
 if(!token)return Response.json({error:'session_required'},{status:401});
 try{const lia=new LiaClient(process.env.LIA_SERVER_KEY!);const player=await lia.requireSession(token);return Response.json({...(await lia.listProducts()),playerId:player.playerId},{headers:{'Cache-Control':'no-store'}});}
 catch(e){const error=e as LiaError;return Response.json({error:error.code??'unavailable'},{status:error.status===401?401:503});}
}
