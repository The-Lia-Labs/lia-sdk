import hashlib, hmac, unittest
from lia_server import verify_webhook, construct_webhook_event, WebhookError, LiaClient
class WebhooksTest(unittest.TestCase):
    def test_raw_signature_and_replays(self):
        raw=b'{"id":"one","type":"charge.paid","app":"game","at":1000000}'
        sig='t=1000,v1='+hmac.new(b'secret',b'1000.'+raw,hashlib.sha256).hexdigest()
        self.assertTrue(verify_webhook('secret',raw,sig,now=1000))
        self.assertFalse(verify_webhook('secret',raw+b' ',sig,now=1000))
        self.assertFalse(verify_webhook('wrong',raw,sig,now=1000))
        self.assertFalse(verify_webhook('secret',raw,sig,now=1301))
        self.assertFalse(verify_webhook('secret',raw,sig,now=699))
        self.assertEqual(construct_webhook_event('secret',raw,sig,now=1000)['id'],'one')
        with self.assertRaises(WebhookError): construct_webhook_event('wrong',raw,sig,now=1000)
    def test_configuration_rejects_insecure_remote_urls(self):
        for url in ['http://example.com','https://user:pass@example.com','https://example.com?secret=yes']:
            with self.assertRaises(Exception): LiaClient('lia_test_fixture',base_url=url)
