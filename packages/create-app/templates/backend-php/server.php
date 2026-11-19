<?php
declare(strict_types=1);
require __DIR__.'/vendor/autoload.php';require __DIR__.'/service.php';
use LiaLabs\Server\LiaError;
header('Content-Type: application/json');header('Cache-Control: no-store');header('X-Content-Type-Options: nosniff');
$frontend=getenv('FRONTEND_ORIGIN')?:'http://localhost:5173';if(($_SERVER['HTTP_ORIGIN']??'')===$frontend){header('Access-Control-Allow-Origin: '.$frontend);header('Vary: Origin');header('Access-Control-Allow-Headers: Authorization,Content-Type');header('Access-Control-Allow-Methods: GET,POST,OPTIONS');}
function reply(int $status,array $value): never {http_response_code($status);echo json_encode($value,JSON_THROW_ON_ERROR);exit;}
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH);$method=$_SERVER['REQUEST_METHOD'];if($method==='OPTIONS'){http_response_code(204);exit;}
if($method==='GET'&&$path==='/health')reply(200,['ok'=>true]);
try{
 $raw='';if($method==='POST'){$stream=fopen('php://input','rb');$raw=stream_get_contents($stream,20001);if(strlen($raw)>20000)reply(413,['error'=>'body_too_large']);}
 if($method==='POST'&&$path==='/webhooks/lia')reply(200,webhook($raw,$_SERVER['HTTP_LIA_SIGNATURE']??''));
 if(!preg_match('/^Bearer (\S+)$/D',$_SERVER['HTTP_AUTHORIZATION']??'',$m))reply(401,['error'=>'session_required']);
 $player=$lia->requireSession($m[1]);
 if($method==='GET'&&$path==='/shop')reply(200,array_merge($lia->listProducts(),['inventory'=>inventory($player['playerId'])]));
 if($method==='POST'&&$path==='/purchases/settle'){$body=json_decode($raw,true,512,JSON_THROW_ON_ERROR);reply(200,settle((string)($body['chargeId']??''),$player['playerId']));}
 reply(404,['error'=>'not_found']);
}catch(LiaError $e){reply($e->status>=400&&$e->status<600?$e->status:503,['error'=>$e->errorCode]);}
catch(JsonException){reply(400,['error'=>'invalid_json']);}
catch(Throwable){reply(503,['error'=>'temporarily_unavailable']);}
