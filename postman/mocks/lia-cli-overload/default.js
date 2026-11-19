// Models Lia's documented 503 + Retry-After response. Counters prove which operations replay.
const http = require('http');
const counts = new Map();
http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const path=url.pathname;
 const send=(status,body,headers={})=>{res.writeHead(status,{'Content-Type':'application/json',...headers});res.end(JSON.stringify(body));};
 if(path==='/cli/counts')return send(200,Object.fromEntries(counts));
 if(!['/cli/me','/cli/apps','/cli/apps/retry-preview/preview'].includes(path))return send(501,{error:'not_modeled'});
 const key=req.method+' '+req.url;
 const n=(counts.get(key)||0)+1;counts.set(key,n);
 if(req.method==='POST')return send(503,{error:'temporarily_unavailable'},{'Retry-After':'0'});
 const mode=url.searchParams.get('case')||'recover';
 if(mode==='unauthorized')return send(401,{error:'unauthorized'});
 if(mode==='invalid')return send(400,{error:'invalid_request'});
 if(mode==='long')return send(429,{error:'slow_down'},{'Retry-After':'60'});
 if(mode==='abort')return send(503,{error:'temporarily_unavailable'},{'Retry-After':'10'});
 if(mode==='date'&&n===1)return send(503,{error:'temporarily_unavailable'},{'Retry-After':new Date(Date.now()+1500).toUTCString()});
 if(mode==='always'||n===1)return send(503,{error:'temporarily_unavailable'},{'Retry-After':'0'});
 if(path.endsWith('/preview'))return send(200,{connected:true,leaseId:'00000000-0000-4000-8000-000000000001'});
 return send(200,{username:'local-fixture',scope:'apps:read apps:create apps:dev',apps:[]});
}).listen(process.env.PORT||4500,'127.0.0.1');
