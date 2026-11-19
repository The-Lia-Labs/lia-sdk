"""Map server-owned entitlements; keep the SQLite file on a persistent volume."""
import json, os, sqlite3
from contextlib import contextmanager
from pathlib import Path
from lia_server import LiaClient, LiaError, construct_webhook_event
PRODUCTS = {'coins-100': 100}
lia = LiaClient(os.environ['LIA_SERVER_KEY'], base_url=os.getenv('LIA_API_BASE_URL','https://api.lialabs.org/api/apps/v1'))
secret = os.environ['LIA_WEBHOOK_SECRET']
filename = os.getenv('LIA_INVENTORY_DB','data/inventory.sqlite')
Path(filename).parent.mkdir(parents=True, exist_ok=True)
@contextmanager
def database():
    db = sqlite3.connect(filename, timeout=5)
    db.executescript('CREATE TABLE IF NOT EXISTS inventory(mode TEXT,player TEXT,coins INTEGER,PRIMARY KEY(mode,player)); CREATE TABLE IF NOT EXISTS receipt(mode TEXT,id TEXT,player TEXT,coins INTEGER,PRIMARY KEY(mode,id));')
    try:
        with db: yield db
    finally:
        db.close()
with database(): pass

def inventory(player):
    with database() as db:
        row = db.execute('SELECT coins FROM inventory WHERE mode=? AND player=?',(lia.mode,player)).fetchone()
        return {'coins': row[0] if row else 0}

def settle(charge_id, player=None):
    charge = lia.get_charge(id=charge_id)['charge']
    if charge['mode'] != lia.mode or player is not None and charge['playerId'] != player or charge['status'] not in ('paid','delivered') or charge['productId'] not in PRODUCTS:
        raise LiaError('charge_not_deliverable',409)
    coins = PRODUCTS[charge['productId']]
    with database() as db:
        db.execute('BEGIN IMMEDIATE')
        prior = db.execute('SELECT player,coins FROM receipt WHERE mode=? AND id=?',(lia.mode,'charge:'+charge['id'])).fetchone()
        if prior and prior != (charge['playerId'],coins): raise LiaError('receipt_conflict',409)
        if not prior:
            db.execute('INSERT INTO receipt VALUES(?,?,?,?)',(lia.mode,'charge:'+charge['id'],charge['playerId'],coins))
            db.execute('INSERT INTO inventory VALUES(?,?,?) ON CONFLICT(mode,player) DO UPDATE SET coins=coins+excluded.coins',(lia.mode,charge['playerId'],coins))
    lia.deliver_charge(id=charge['id'],idempotency_key='deliver:'+charge['id'])
    return inventory(charge['playerId'])

def webhook(raw, signature):
    event = construct_webhook_event(secret,raw,signature)
    if event.get('test') is True: return {'received':True,'probe':True}
    if event['type'] == 'charge.paid': settle(event['data']['id'])
    elif event['type'] == 'charge.refunded':
        charge = lia.get_charge(id=event['data']['id'])['charge']
        if charge['mode'] != lia.mode or charge['status'] != 'refunded': raise LiaError('invalid_refund',409)
        with database() as db:
            db.execute('BEGIN IMMEDIATE')
            prior = db.execute('SELECT player,coins FROM receipt WHERE mode=? AND id=?',(lia.mode,'charge:'+charge['id'])).fetchone()
            if prior:
                added = db.execute('INSERT OR IGNORE INTO receipt VALUES(?,?,?,?)',(lia.mode,'refund:'+charge['id'],prior[0],-prior[1])).rowcount
                if added: db.execute('UPDATE inventory SET coins=coins-? WHERE mode=? AND player=?',(prior[1],lia.mode,prior[0]))
    return {'received':True}

def player(authorization):
    if not authorization or not authorization.startswith('Bearer '): raise LiaError('session_required',401)
    return lia.require_session(authorization[7:])['playerId']
