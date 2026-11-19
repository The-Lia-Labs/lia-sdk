import { DatabaseSync } from 'node:sqlite';
import type { Mode } from './lia.js';
/** One persistent file, isolated by mode. Transactions and unique receipt keys prevent duplicate grants. */
export function inventoryStore(filename:string){
 const db=new DatabaseSync(filename);db.exec(`PRAGMA journal_mode=WAL;PRAGMA busy_timeout=5000;CREATE TABLE IF NOT EXISTS inventory(mode TEXT NOT NULL,player TEXT NOT NULL,coins INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(mode,player));CREATE TABLE IF NOT EXISTS receipt(mode TEXT NOT NULL,id TEXT NOT NULL,player TEXT NOT NULL,coins INTEGER NOT NULL,kind TEXT NOT NULL,at INTEGER NOT NULL,PRIMARY KEY(mode,id));CREATE TABLE IF NOT EXISTS issued_challenge(mode TEXT,id TEXT,player TEXT,PRIMARY KEY(mode,id));CREATE TABLE IF NOT EXISTS recovery_cursor(id INTEGER PRIMARY KEY,value TEXT);`);
 const inventory=(mode:Mode,player:string)=>({coins:(db.prepare('SELECT coins FROM inventory WHERE mode=? AND player=?').get(mode,player)?.coins as number|undefined)??0});
 const grant=(mode:Mode,player:string,id:string,coins:number,kind:string)=>{
  if(!Number.isSafeInteger(coins)||coins<=0)throw Error('Invalid server entitlement');db.exec('BEGIN IMMEDIATE');
  try{const added=db.prepare('INSERT OR IGNORE INTO receipt VALUES(?,?,?,?,?,?)').run(mode,id,player,coins,kind,Date.now());
   if(added.changes)db.prepare('INSERT INTO inventory VALUES(?,?,?) ON CONFLICT(mode,player) DO UPDATE SET coins=coins+excluded.coins').run(mode,player,coins);
   else{const previous=db.prepare('SELECT player,coins,kind FROM receipt WHERE mode=? AND id=?').get(mode,id);if(previous?.player!==player||previous?.coins!==coins||previous?.kind!==kind)throw Error('Receipt conflict');}
   db.exec('COMMIT');return {...inventory(mode,player),duplicate:!added.changes};
  }catch(error){db.exec('ROLLBACK');throw error;}
 };
 const revoke=(mode:Mode,chargeId:string)=>{
  db.exec('BEGIN IMMEDIATE');try{const paid=db.prepare("SELECT * FROM receipt WHERE mode=? AND id=? AND kind='purchase'").get(mode,'charge:'+chargeId);if(!paid){db.exec('COMMIT');return {revoked:false};}
   const added=db.prepare('INSERT OR IGNORE INTO receipt VALUES(?,?,?,?,?,?)').run(mode,'refund:'+chargeId,paid.player,-Number(paid.coins),'refund',Date.now());
   if(added.changes)db.prepare('UPDATE inventory SET coins=coins-? WHERE mode=? AND player=?').run(paid.coins,mode,paid.player);
   db.exec('COMMIT');return {revoked:true,duplicate:!added.changes};
  }catch(e){db.exec('ROLLBACK');throw e;}
 };
 const issueChallenge=(mode:Mode,id:string,player:string)=>{db.prepare('INSERT OR IGNORE INTO issued_challenge VALUES(?,?,?)').run(mode,id,player);};
 const ownsChallenge=(mode:Mode,id:string,player:string)=>!!db.prepare('SELECT 1 FROM issued_challenge WHERE mode=? AND id=? AND player=?').get(mode,id,player);
 const cursor=()=>db.prepare('SELECT value FROM recovery_cursor WHERE id=1').get()?.value as string|null|undefined;
 const setCursor=(value:string|null)=>{db.prepare('INSERT INTO recovery_cursor VALUES(1,?) ON CONFLICT(id) DO UPDATE SET value=excluded.value').run(value);};
 return {inventory,grant,revoke,issueChallenge,ownsChallenge,cursor,setCursor,close:()=>db.close()};
}
