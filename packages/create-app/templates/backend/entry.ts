import {createServer} from 'node:http';
import {handler,startRecovery} from './server.js';
startRecovery();createServer(handler).listen(Number(process.env.PORT??3001),process.env.HOST??'127.0.0.1');
