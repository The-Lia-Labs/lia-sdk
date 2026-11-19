import json, os
from django.conf import settings
from django.http import JsonResponse
from django.urls import path
from django.views.decorators.csrf import csrf_exempt
from django.core.management import execute_from_command_line
from lia_server import LiaError, WebhookError
from service import lia, player, inventory, settle, webhook
if not settings.configured:
    settings.configure(SECRET_KEY=os.environ['DJANGO_SECRET_KEY'],DEBUG=False,ROOT_URLCONF=__name__,ALLOWED_HOSTS=os.getenv('ALLOWED_HOSTS','localhost,127.0.0.1').split(','),MIDDLEWARE=['django.middleware.security.SecurityMiddleware'],DATA_UPLOAD_MAX_MEMORY_SIZE=20000)
@csrf_exempt # This API uses Bearer player sessions, not cookie authentication. Scope exemptions to these API views.
def api(request):
    try:
        if request.path=='/health' and request.method=='GET': return JsonResponse({'ok':True})
        if request.path=='/webhooks/lia' and request.method=='POST': return JsonResponse(webhook(request.body,request.headers.get('Lia-Signature','')))
        who=player(request.headers.get('Authorization'))
        if request.path=='/shop' and request.method=='GET': return JsonResponse({**lia.list_products(),'inventory':inventory(who)})
        if request.path=='/purchases/settle' and request.method=='POST': return JsonResponse(settle(str(json.loads(request.body).get('chargeId','')),who))
        return JsonResponse({'error':'not_found'},status=404)
    except WebhookError: return JsonResponse({'error':'invalid_webhook'},status=401)
    except LiaError as error: return JsonResponse({'error':error.code},status=error.status if 400<=error.status<600 else 503)
    except (ValueError,KeyError): return JsonResponse({'error':'invalid_request'},status=400)
urlpatterns=[path('health',api),path('shop',api),path('purchases/settle',api),path('webhooks/lia',api)]
if __name__=='__main__': execute_from_command_line()
