import asyncio, os
from fastapi import FastAPI, Request, Header, Depends
from fastapi.responses import JSONResponse
from lia_server import LiaError, WebhookError
from service import lia, player, inventory, settle, webhook
app = FastAPI()
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(CORSMiddleware,allow_origins=[os.getenv('FRONTEND_ORIGIN','http://localhost:5173')],allow_methods=['GET','POST'],allow_headers=['Authorization','Content-Type'])
# Sync endpoints/dependencies run in FastAPI's thread pool; no blocking HTTP on the event loop.
def signed_in(authorization: str | None = Header(default=None)): return player(authorization)
@app.exception_handler(LiaError)
async def failure(request, error): return JSONResponse({'error':error.code},status_code=error.status if 400<=error.status<600 else 503)
@app.exception_handler(WebhookError)
async def signature_failure(request, error): return JSONResponse({'error':'invalid_webhook'},status_code=401)
@app.get('/health')
def health(): return {'ok':True}
@app.get('/shop')
def shop(who=Depends(signed_in)): return {**lia.list_products(),'inventory':inventory(who)}
@app.post('/purchases/settle')
def purchase(body:dict,who=Depends(signed_in)): return settle(str(body.get('chargeId','')),who)
@app.post('/webhooks/lia')
async def webhook_route(request:Request):
    raw=bytearray()
    async for chunk in request.stream():
        raw.extend(chunk)
        if len(raw)>20000: return JSONResponse({'error':'body_too_large'},status_code=413)
    return await asyncio.to_thread(webhook,bytes(raw),request.headers.get('lia-signature',''))
