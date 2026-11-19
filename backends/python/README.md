# Lia Server for Python

Official server-only package for Lia mini apps.

```python
import os
from lia_server import LiaClient
with LiaClient(os.environ['LIA_SERVER_KEY']) as lia:
    player = lia.require_session(session_from_lia)
    products = lia.list_products()
```

Use `AsyncLiaClient` in async endpoints and `await client.aclose()` on shutdown. FastAPI's synchronous endpoint examples run in its thread pool. Django reads `request.body` before parsing signed webhooks. Session `exp` is Unix milliseconds. Run unit tests with `python -m unittest discover -s tests`.

For the complete installation guide, API methods, safe retries, payment delivery and framework starters, see [Lia backend packages](https://github.com/The-Lia-Labs/lia-sdk/blob/main/backends/README.md) and [developer documentation](https://docs.lialabs.org/packages/server).

The same client covers sessions, products, charges, reconciliation, rewards, notifications, ads, seasonal leaderboards, server-only storage, durable webhook history/replay and analytics. Never ship the server key to the browser. Verify charge owner, mode, status and product before granting inventory with a persistent unique receipt. A signed webhook or `watched` flag alone is not an inventory grant. Live valuable ad rewards require provider SSV and a compatible native Lia host.
