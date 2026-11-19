<?php
declare(strict_types=1);
use LiaLabs\Server\{LiaClient,LiaError,Webhooks};
const PRODUCTS=['coins-100'=>100]; // Server-owned entitlements, never accept a client amount.
$lia=new LiaClient(getenv('LIA_SERVER_KEY')?:'',getenv('LIA_API_BASE_URL')?:'https://api.lialabs.org/api/apps/v1');
$filename=getenv('LIA_INVENTORY_DB')?:__DIR__.'/data/inventory.sqlite';if(!is_dir(dirname($filename)))mkdir(dirname($filename),0700,true);
$db=new PDO('sqlite:'.$filename,null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);$db->exec('PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS inventory(mode TEXT,player TEXT,coins INTEGER,PRIMARY KEY(mode,player));CREATE TABLE IF NOT EXISTS receipt(mode TEXT,id TEXT,player TEXT,coins INTEGER,PRIMARY KEY(mode,id));');
function sql(string $statement,array $params=[]): PDOStatement {global $db;$query=$db->prepare($statement);$query->execute($params);return $query;}
function inventory(string $player): array {global $lia;return ['coins'=>(int)(sql('SELECT coins FROM inventory WHERE mode=? AND player=?',[$lia->mode,$player])->fetchColumn()?:0)];}
function settle(string $id,?string $player=null): array {
 global $lia,$db;$charge=$lia->getCharge(['id'=>$id])['charge'];$coins=PRODUCTS[$charge['productId']]??0;
 if($charge['mode']!==$lia->mode||$player!==null&&$charge['playerId']!==$player||!in_array($charge['status'],['paid','delivered'],true)||!$coins)throw new LiaError('charge_not_deliverable',409);
 $db->exec('BEGIN IMMEDIATE');try{
  $prior=sql('SELECT player,coins FROM receipt WHERE mode=? AND id=?',[$lia->mode,'charge:'.$charge['id']])->fetch(PDO::FETCH_ASSOC);
  if($prior&&($prior['player']!==$charge['playerId']||(int)$prior['coins']!==$coins))throw new LiaError('receipt_conflict',409);
  if(!$prior){sql('INSERT INTO receipt VALUES(?,?,?,?)',[$lia->mode,'charge:'.$charge['id'],$charge['playerId'],$coins]);sql('INSERT INTO inventory VALUES(?,?,?) ON CONFLICT(mode,player) DO UPDATE SET coins=coins+excluded.coins',[$lia->mode,$charge['playerId'],$coins]);}
  $db->exec('COMMIT');
 }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
 $lia->deliverCharge(['id'=>$charge['id']],'deliver:'.$charge['id']);return inventory($charge['playerId']);
}
function webhook(string $raw,string $signature): array {
 global $lia,$db;$event=Webhooks::constructEvent(getenv('LIA_WEBHOOK_SECRET')?:'',$raw,$signature);
 if(($event['test']??false)===true)return ['received'=>true,'probe'=>true];
 if($event['type']==='charge.paid')settle((string)$event['data']['id']);
 elseif($event['type']==='charge.refunded'){
  $charge=$lia->getCharge(['id'=>(string)$event['data']['id']])['charge'];if($charge['mode']!==$lia->mode||$charge['status']!=='refunded')throw new LiaError('invalid_refund',409);
  $db->exec('BEGIN IMMEDIATE');try{$prior=sql('SELECT player,coins FROM receipt WHERE mode=? AND id=?',[$lia->mode,'charge:'.$charge['id']])->fetch(PDO::FETCH_ASSOC);
   if($prior){$added=sql('INSERT OR IGNORE INTO receipt VALUES(?,?,?,?)',[$lia->mode,'refund:'.$charge['id'],$prior['player'],-(int)$prior['coins']])->rowCount();if($added)sql('UPDATE inventory SET coins=coins-? WHERE mode=? AND player=?',[(int)$prior['coins'],$lia->mode,$prior['player']]);}
   $db->exec('COMMIT');
  }catch(Throwable $e){$db->exec('ROLLBACK');throw $e;}
 }
 return ['received'=>true];
}
