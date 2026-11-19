import asyncio, hashlib, hmac, json, os, pathlib, time
from lia_server import LiaClient, AsyncLiaClient, LiaError, verify_webhook, construct_webhook_event
base=os.environ['LIA_CONFORMANCE_URL']
assert base.startswith('http://127.0.0.1:')
cases=json.loads((pathlib.Path(__file__).resolve().parent/'conformance.json').read_text())
import re
with LiaClient('lia_test_fixture',base_url=base,timeout=2) as lia:
    for case in cases:
        result=getattr(lia,re.sub(r'(?<!^)(?=[A-Z])','_',case['operation']).lower())(**case['params'])
        if case['operation']=='verifySession': assert result['valid']; continue
        if case['text']: assert 'active_players' in result; continue
        assert result['echo']['method']==case['method'] and result['echo']['path']==case['path']
        assert result['echo']['body']==case['body'] and result['echo']['query']==case['query']
    assert lia.require_session('valid')['playerId']=='p_12345678'
    for session in ['invalid','expired','wrong-mode']:
        try: lia.require_session(session); raise AssertionError('session accepted')
        except LiaError as e: assert e.code=='invalid_session'
    assert lia.get_charge(id='retry-python')['charge']['id']=='ch_fixture'
    for id,code in [('rate-python','slow_down'),('redirect-python','http_error'),('invalid-python','invalid_response'),('conflict-python','idempotency_key_reused')]:
        try: lia.get_charge(id=id); raise AssertionError('error accepted')
        except LiaError as e: assert e.code==code and 'NEVER_EXPOSE' not in str(e)
    lia.deliver_charge(id='replay-python',idempotency_key='python:one')
    assert 'fixture' not in repr(lia)
    try: lia.get_charge(id='../pool'); raise AssertionError('path accepted')
    except LiaError as e: assert e.code=='invalid_path_parameter'
async def async_checks():
    async with AsyncLiaClient('lia_test_fixture',base_url=base,timeout=2) as lia:
        for case in cases:
            await getattr(lia,re.sub(r'(?<!^)(?=[A-Z])','_',case['operation']).lower())(**case['params'])
        assert (await lia.require_session('valid'))['mode']=='test'
    async with AsyncLiaClient('lia_test_fixture',base_url=base,timeout=.04) as lia:
        try: await lia.get_charge(id='slow-python'); raise AssertionError('timeout accepted')
        except LiaError as e: assert e.code=='request_timeout'
asyncio.run(async_checks())
at=int(time.time());raw=json.dumps({'id':'evt_1','type':'charge.paid','app':'example','at':at*1000}).encode();sig=f't={at},v1='+hmac.new(b'whsec_fixture',str(at).encode()+b'.'+raw,hashlib.sha256).hexdigest()
assert verify_webhook('whsec_fixture',raw,sig)
assert not verify_webhook('whsec_fixture',raw+b' ',sig)
assert not verify_webhook('wrong',raw,sig)
assert not verify_webhook('whsec_fixture',raw,sig,now=at+301)
assert construct_webhook_event('whsec_fixture',raw,sig)['id']=='evt_1'
print('Python sync + async: 27 operations, sessions, retries, idempotency, deadline and signatures passed')
