"""Server-only credentials. No client-supplied player ID is authentication."""
from __future__ import annotations
import asyncio
import json
import math
import random
import re
import time
import uuid
from datetime import timezone
from email.utils import parsedate_to_datetime
from importlib.resources import files
from urllib.parse import quote, urlencode, urlsplit
from typing import Any
import httpx

OPERATIONS = json.loads(files('lia_server').joinpath('operations.json').read_text())
ID = re.compile(r'^[A-Za-z0-9_.:-]{1,128}$')

class LiaError(Exception):
    def __init__(self, code: str, status: int = 0, request_id: str | None = None, retry_after: float | None = None):
        super().__init__(code)
        self.code, self.status, self.request_id, self.retry_after = code, status, request_id, retry_after
    @property
    def retryable(self) -> bool:
        return self.status in (0, 408, 425, 429, 500, 502, 503, 504) or self.code == 'idempotency_key_in_use'

def _safe(value):
    return value if isinstance(value, str) and ID.fullmatch(value) else None

def _retry_after(value):
    if not value:
        return None
    try:
        return max(0, float(value)) if re.fullmatch(r'\d+(\.\d+)?', value) else max(0, parsedate_to_datetime(value).replace(tzinfo=timezone.utc).timestamp() - time.time())
    except (ValueError, TypeError, OverflowError):
        return None

class _Base:
    def __init__(self, key: str, *, base_url='https://api.lialabs.org/api/apps/v1', timeout=15.0, max_retries=2):
        if not re.fullmatch(r'lia_(test|live)_[A-Za-z0-9_-]+', key):
            raise LiaError('invalid_server_key')
        url = urlsplit(base_url)
        if url.username or url.password or url.query or url.fragment or not url.hostname or not (url.scheme == 'https' or (url.scheme == 'http' and url.hostname in ('localhost', '127.0.0.1', '::1'))):
            raise LiaError('invalid_base_url')
        if not isinstance(timeout, (float, int)) or not math.isfinite(timeout) or not 0 < timeout <= 120 or not isinstance(max_retries, int) or not 0 <= max_retries <= 3:
            raise LiaError('invalid_client_options')
        self.__key = key
        self.mode = 'test' if key.startswith('lia_test_') else 'live'
        self._base, self._timeout, self._retries = base_url.rstrip('/'), timeout, max_retries
    def __repr__(self):
        return f'{type(self).__name__}(mode={self.mode!r})'
    def _prepare(self, operation, params, idempotency_key):
        spec = OPERATIONS.get(operation)
        if spec is None:
            raise LiaError('unknown_operation')
        if any(k not in params for k in spec['required']):
            raise LiaError('missing_parameter')
        def segment(match):
            value = params.get(match[1])
            if not _safe(value) or value in ('.', '..'):
                raise LiaError('invalid_path_parameter')
            return quote(value, safe='')
        path = re.sub(r'\{(\w+)\}', segment, spec['path'])
        query = {k: str(params[k]) for k in spec['query'] if params.get(k) is not None}
        url = self._base + path + ('?' + urlencode(query) if query else '')
        headers = {'Authorization': 'Bearer ' + self.__key, 'Accept': 'text/csv' if spec['text'] else 'application/json', 'User-Agent': 'lia-labs-server-python/0.1.0'}
        if idempotency_key is not None and not _safe(idempotency_key):
            raise LiaError('invalid_idempotency_key')
        if spec['method'] != 'GET' and operation != 'verifySession':
            headers['Idempotency-Key'] = idempotency_key or str(uuid.uuid4())
        content = None
        if spec['method'] == 'POST':
            headers['Content-Type'] = 'application/json'
            content = json.dumps({k: params[k] for k in spec['body'] if k in params}, separators=(',', ':'), allow_nan=False).encode()
        return spec, url, headers, content
    @staticmethod
    def _decode(response, spec):
        try:
            value = response.json()
        except (ValueError, UnicodeError):
            value = None
        if 200 <= response.status_code < 300:
            if spec['text']:
                return response.text
            if not isinstance(value, (dict, list)):
                raise LiaError('invalid_response', response.status_code)
            return value
        raise LiaError(_safe(value.get('error')) if isinstance(value, dict) and _safe(value.get('error')) else 'http_error', response.status_code, _safe(response.headers.get('X-Lia-Request-Id')), _retry_after(response.headers.get('Retry-After')))
    def _player(self, result):
        if not isinstance(result, dict) or result.get('valid') is not True or not re.fullmatch(r'p_\w{8,40}', str(result.get('playerId', '')), re.ASCII) or result.get('mode') != self.mode or not isinstance(result.get('exp'), int) or result['exp'] <= time.time()*1000:
            raise LiaError('invalid_session', 401)
        return result

class LiaClient(_Base):
    """Synchronous client. Use AsyncLiaClient inside async servers."""
    def __init__(self, key: str, **options):
        super().__init__(key, **options)
        self._http = httpx.Client(follow_redirects=False, trust_env=False)
    def __enter__(self): return self
    def __exit__(self, *_): self.close()
    def close(self): self._http.close()
    def call(self, operation: str, params: dict[str, Any] | None = None, *, idempotency_key: str | None = None):
        spec, url, headers, content = self._prepare(operation, params or {}, idempotency_key)
        deadline = time.monotonic() + self._timeout
        for attempt in range(self._retries + 1):
            try:
                response = self._http.request(spec['method'], url, headers=headers, content=content, timeout=max(.001, deadline-time.monotonic()))
                return self._decode(response, spec)
            except httpx.HTTPError:
                error = LiaError('network_error')
            except LiaError as e:
                error = e
            delay = error.retry_after if error.retry_after is not None else .1 * 2**attempt + random.random() * .1
            if not error.retryable or attempt == self._retries or time.monotonic() + delay >= deadline:
                raise error from None
            time.sleep(delay)
    def require_session(self, session: str):
        return self._player(self.verify_session(session=session))
    def verify_session(self, *, idempotency_key: str | None = None, **params):
        return self.call('verifySession', params, idempotency_key=idempotency_key)
    def list_products(self, *, idempotency_key: str | None = None, **params):
        return self.call('listProducts', params, idempotency_key=idempotency_key)
    def get_charge(self, *, idempotency_key: str | None = None, **params):
        return self.call('getCharge', params, idempotency_key=idempotency_key)
    def deliver_charge(self, *, idempotency_key: str | None = None, **params):
        return self.call('deliverCharge', params, idempotency_key=idempotency_key)
    def refund_charge(self, *, idempotency_key: str | None = None, **params):
        return self.call('refundCharge', params, idempotency_key=idempotency_key)
    def pay_reward(self, *, idempotency_key: str | None = None, **params):
        return self.call('payReward', params, idempotency_key=idempotency_key)
    def get_pool(self, *, idempotency_key: str | None = None, **params):
        return self.call('getPool', params, idempotency_key=idempotency_key)
    def send_notification(self, *, idempotency_key: str | None = None, **params):
        return self.call('sendNotification', params, idempotency_key=idempotency_key)
    def verify_ad(self, *, idempotency_key: str | None = None, **params):
        return self.call('verifyAd', params, idempotency_key=idempotency_key)
    def list_tables(self, *, idempotency_key: str | None = None, **params):
        return self.call('listTables', params, idempotency_key=idempotency_key)
    def save_table(self, *, idempotency_key: str | None = None, **params):
        return self.call('saveTable', params, idempotency_key=idempotency_key)
    def sit_at_table(self, *, idempotency_key: str | None = None, **params):
        return self.call('sitAtTable', params, idempotency_key=idempotency_key)
    def remove_table(self, *, idempotency_key: str | None = None, **params):
        return self.call('removeTable', params, idempotency_key=idempotency_key)
    def list_pending_charges(self, *, idempotency_key: str | None = None, **params):
        return self.call('listPendingCharges', params, idempotency_key=idempotency_key)
    def list_leaderboards(self, *, idempotency_key: str | None = None, **params):
        return self.call('listLeaderboards', params, idempotency_key=idempotency_key)
    def save_leaderboard(self, *, idempotency_key: str | None = None, **params):
        return self.call('saveLeaderboard', params, idempotency_key=idempotency_key)
    def get_leaderboard(self, *, idempotency_key: str | None = None, **params):
        return self.call('getLeaderboard', params, idempotency_key=idempotency_key)
    def submit_score(self, *, idempotency_key: str | None = None, **params):
        return self.call('submitScore', params, idempotency_key=idempotency_key)
    def moderate_score(self, *, idempotency_key: str | None = None, **params):
        return self.call('moderateScore', params, idempotency_key=idempotency_key)
    def get_player_storage(self, *, idempotency_key: str | None = None, **params):
        return self.call('getPlayerStorage', params, idempotency_key=idempotency_key)
    def set_player_storage(self, *, idempotency_key: str | None = None, **params):
        return self.call('setPlayerStorage', params, idempotency_key=idempotency_key)
    def list_webhook_events(self, *, idempotency_key: str | None = None, **params):
        return self.call('listWebhookEvents', params, idempotency_key=idempotency_key)
    def replay_webhook_event(self, *, idempotency_key: str | None = None, **params):
        return self.call('replayWebhookEvent', params, idempotency_key=idempotency_key)
    def create_ad_challenge(self, *, idempotency_key: str | None = None, **params):
        return self.call('createAdChallenge', params, idempotency_key=idempotency_key)
    def claim_ad_challenge(self, *, idempotency_key: str | None = None, **params):
        return self.call('claimAdChallenge', params, idempotency_key=idempotency_key)
    def get_analytics(self, *, idempotency_key: str | None = None, **params):
        return self.call('getAnalytics', params, idempotency_key=idempotency_key)
    def export_analytics(self, *, idempotency_key: str | None = None, **params):
        return self.call('exportAnalytics', params, idempotency_key=idempotency_key)

class AsyncLiaClient(_Base):
    def __init__(self, key: str, **options):
        super().__init__(key, **options)
        self._http = httpx.AsyncClient(follow_redirects=False, trust_env=False)
    async def __aenter__(self): return self
    async def __aexit__(self, *_): await self.aclose()
    async def aclose(self): await self._http.aclose()
    async def call(self, operation: str, params: dict[str, Any] | None = None, *, idempotency_key: str | None = None):
        spec, url, headers, content = self._prepare(operation, params or {}, idempotency_key)
        deadline = time.monotonic() + self._timeout
        # One deadline includes the network and all backoffs. asyncio.wait_for supports Python 3.10.
        try:
            return await asyncio.wait_for(self._attempts(spec, url, headers, content, deadline), self._timeout)
        except asyncio.TimeoutError:
            raise LiaError('request_timeout') from None
    async def _attempts(self, spec, url, headers, content, deadline):
        for attempt in range(self._retries + 1):
            try:
                response = await self._http.request(spec['method'], url, headers=headers, content=content, timeout=max(.001, deadline-time.monotonic()))
                return self._decode(response, spec)
            except httpx.HTTPError:
                error = LiaError('network_error')
            except LiaError as e:
                error = e
            delay = error.retry_after if error.retry_after is not None else .1 * 2**attempt + random.random() * .1
            if not error.retryable or attempt == self._retries or time.monotonic() + delay >= deadline:
                raise error from None
            await asyncio.sleep(delay)
    async def require_session(self, session: str):
        return self._player(await self.verify_session(session=session))
    async def verify_session(self, *, idempotency_key: str | None = None, **params):
        return await self.call('verifySession', params, idempotency_key=idempotency_key)
    async def list_products(self, *, idempotency_key: str | None = None, **params):
        return await self.call('listProducts', params, idempotency_key=idempotency_key)
    async def get_charge(self, *, idempotency_key: str | None = None, **params):
        return await self.call('getCharge', params, idempotency_key=idempotency_key)
    async def deliver_charge(self, *, idempotency_key: str | None = None, **params):
        return await self.call('deliverCharge', params, idempotency_key=idempotency_key)
    async def refund_charge(self, *, idempotency_key: str | None = None, **params):
        return await self.call('refundCharge', params, idempotency_key=idempotency_key)
    async def pay_reward(self, *, idempotency_key: str | None = None, **params):
        return await self.call('payReward', params, idempotency_key=idempotency_key)
    async def get_pool(self, *, idempotency_key: str | None = None, **params):
        return await self.call('getPool', params, idempotency_key=idempotency_key)
    async def send_notification(self, *, idempotency_key: str | None = None, **params):
        return await self.call('sendNotification', params, idempotency_key=idempotency_key)
    async def verify_ad(self, *, idempotency_key: str | None = None, **params):
        return await self.call('verifyAd', params, idempotency_key=idempotency_key)
    async def list_tables(self, *, idempotency_key: str | None = None, **params):
        return await self.call('listTables', params, idempotency_key=idempotency_key)
    async def save_table(self, *, idempotency_key: str | None = None, **params):
        return await self.call('saveTable', params, idempotency_key=idempotency_key)
    async def sit_at_table(self, *, idempotency_key: str | None = None, **params):
        return await self.call('sitAtTable', params, idempotency_key=idempotency_key)
    async def remove_table(self, *, idempotency_key: str | None = None, **params):
        return await self.call('removeTable', params, idempotency_key=idempotency_key)
    async def list_pending_charges(self, *, idempotency_key: str | None = None, **params):
        return await self.call('listPendingCharges', params, idempotency_key=idempotency_key)
    async def list_leaderboards(self, *, idempotency_key: str | None = None, **params):
        return await self.call('listLeaderboards', params, idempotency_key=idempotency_key)
    async def save_leaderboard(self, *, idempotency_key: str | None = None, **params):
        return await self.call('saveLeaderboard', params, idempotency_key=idempotency_key)
    async def get_leaderboard(self, *, idempotency_key: str | None = None, **params):
        return await self.call('getLeaderboard', params, idempotency_key=idempotency_key)
    async def submit_score(self, *, idempotency_key: str | None = None, **params):
        return await self.call('submitScore', params, idempotency_key=idempotency_key)
    async def moderate_score(self, *, idempotency_key: str | None = None, **params):
        return await self.call('moderateScore', params, idempotency_key=idempotency_key)
    async def get_player_storage(self, *, idempotency_key: str | None = None, **params):
        return await self.call('getPlayerStorage', params, idempotency_key=idempotency_key)
    async def set_player_storage(self, *, idempotency_key: str | None = None, **params):
        return await self.call('setPlayerStorage', params, idempotency_key=idempotency_key)
    async def list_webhook_events(self, *, idempotency_key: str | None = None, **params):
        return await self.call('listWebhookEvents', params, idempotency_key=idempotency_key)
    async def replay_webhook_event(self, *, idempotency_key: str | None = None, **params):
        return await self.call('replayWebhookEvent', params, idempotency_key=idempotency_key)
    async def create_ad_challenge(self, *, idempotency_key: str | None = None, **params):
        return await self.call('createAdChallenge', params, idempotency_key=idempotency_key)
    async def claim_ad_challenge(self, *, idempotency_key: str | None = None, **params):
        return await self.call('claimAdChallenge', params, idempotency_key=idempotency_key)
    async def get_analytics(self, *, idempotency_key: str | None = None, **params):
        return await self.call('getAnalytics', params, idempotency_key=idempotency_key)
    async def export_analytics(self, *, idempotency_key: str | None = None, **params):
        return await self.call('exportAnalytics', params, idempotency_key=idempotency_key)
