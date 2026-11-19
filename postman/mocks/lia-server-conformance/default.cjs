// First-party model from lia-api/src/routes/developer{,-games}.ts, not a claim about deployment.
const http=require('node:http');
const counts=new Map(), receipts=new Map();
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');let raw=req.body===undefined?'':(typeof req.body==='string'?req.body:JSON.stringify(req.body));if(req.body===undefined)for await(const chunk of req)raw+=chunk;
 const json=(status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json','X-Lia-Request-Id':'fixture-request',...headers});res.end(JSON.stringify(value));};
 if(url.pathname==='/health')return json(200,{ok:true});
 if(url.pathname==='/counts')return json(200,Object.fromEntries(counts));
 if(url.pathname==='/leak')return json(500,{error:'redirect_was_followed'});
 const name=req.method+' '+url.pathname;const count=(counts.get(name)||0)+1;counts.set(name,count);
 if(!url.pathname.startsWith('/api/apps/v1/'))return json(501,{error:'not_modeled'});
 if(!/^Bearer lia_(test|live)_fixture$/.test(req.headers.authorization||''))return json(401,{error:'bad_key'});
 const mode=req.headers.authorization.includes('lia_test_')?'test':'live';
 let body;try{body=raw?JSON.parse(raw):{};}catch{return json(400,{error:'bad_json'});}
 if(url.pathname.endsWith('/session/verify')){
  if(req.headers['idempotency-key'])return json(400,{error:'unnecessary_idempotency_write'});
  if(body.session==='invalid')return json(200,{valid:false});
  return json(200,{valid:true,playerId:body.session==='other'?'p_87654321':'p_12345678',mode:body.session==='wrong-mode'?'live':mode,exp:body.session==='expired'?1:Date.now()+900000});
 }
 if(/\/charges\/retry-[a-z]+$/.test(url.pathname)&&count===1){res.writeHead(503,{'Content-Type':'text/html','Retry-After':'0'});return res.end('<html>busy: NEVER_EXPOSE_HTML</html>');}
 if(/\/charges\/rate-[a-z]+$/.test(url.pathname))return json(429,{error:'slow_down'},{'Retry-After':'60'});
 if(/\/charges\/redirect-[a-z]+$/.test(url.pathname)){res.writeHead(302,{Location:'/leak'});return res.end();}
 if(/\/charges\/invalid-[a-z]+$/.test(url.pathname)){res.writeHead(200,{'Content-Type':'text/html'});return res.end('<html>NEVER_EXPOSE_HTML</html>');}
 if(/\/charges\/slow-[a-z]+$/.test(url.pathname)){return setTimeout(()=>json(200,{charge:{id:'slow'}}),500);}
 if(/\/charges\/conflict-[a-z]+$/.test(url.pathname))return json(422,{error:'idempotency_key_reused'});
 if(req.method!=='GET'){
  const key=req.headers['idempotency-key'];if(!key)return json(400,{error:'key_required_by_fixture'});
  const existing=receipts.get(name+' '+key);if(existing&&existing!==raw)return json(422,{error:'idempotency_key_reused'});
  receipts.set(name+' '+key,raw);
  // The write succeeds, but the first response fails. Retrying must use the identical key and body.
  if(url.pathname.endsWith('/charges/replay-'+key.split(':')[0]+'/deliver')&&count===1)return json(503,{error:'temporarily_unavailable'},{'Retry-After':'0'});
 }
 const echo={method:req.method,path:url.pathname.replace('/api/apps/v1',''),body,query:Object.fromEntries(url.searchParams),idempotencyKey:req.headers['idempotency-key']||null};
 if(url.pathname.endsWith('/analytics/report.csv')){res.writeHead(200,{'Content-Type':'text/csv'});return res.end('date,active_players\r\n2026-11-19,1');}
 return json(200,{echo,products:[{id:'coins-100',name:'100 Coins',price:20,active:true}],charge:{id:'ch_fixture',playerId:'p_12345678',productId:'coins-100',mode,status:url.pathname.endsWith('/charges/refunded')?'refunded':'paid',amount:20,createdAt:Date.now(),deliveredAt:null,refundedAt:null}});
}).listen(process.env.PORT||4591,'127.0.0.1');
