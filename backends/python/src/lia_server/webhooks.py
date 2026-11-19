import hashlib
import hmac
import json
import re
import time

class WebhookError(ValueError):
    def __init__(self): super().__init__('invalid_webhook')

def verify_webhook(secret: str, raw: bytes, signature: str, *, now: float | None = None, tolerance: int = 300) -> bool:
    """Verify untouched request bytes. `now` is Unix seconds. Store event IDs to prevent repeated grants."""
    match = re.fullmatch(r't=(\d{1,12}),v1=([a-f0-9]{64})', signature, re.ASCII)
    if not secret or not match or not 1 <= tolerance <= 300 or len(raw) > 1048576 or abs((time.time() if now is None else now) - int(match[1])) > tolerance:
        return False
    expected = hmac.new(secret.encode(), match[1].encode() + b'.' + raw, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, match[2])

def construct_webhook_event(secret: str, raw: bytes, signature: str, *, now: float | None = None) -> dict:
    if not verify_webhook(secret, raw, signature, now=now):
        raise WebhookError()
    try:
        event = json.loads(raw)
    except (ValueError, UnicodeError):
        raise WebhookError() from None
    if not isinstance(event, dict) or not isinstance(event.get('type'), str) or not isinstance(event.get('app'), str) or not isinstance(event.get('at'), (int, float)):
        raise WebhookError()
    return event
