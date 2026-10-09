// Exercise compiled server JavaScript in a fresh Node process without any TS loader.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
const source = `
 import assert from 'node:assert/strict';
 import {once} from 'node:events';
 import http from 'node:http';
 import {createServer} from './dist-server/server/index.js';
 const denied = async () => { throw Error('No model transport permitted'); };
 const server = createServer({env:{}, fetchImpl:denied});
 server.listen(0, '127.0.0.1');
 await once(server, 'listening');
 try {
  const status = await new Promise((resolve,reject)=>{
   http.get({host:'127.0.0.1',port:server.address().port,path:'/api/status',headers:{Host:'127.0.0.1:8787'}},res=>{
    assert.equal(res.statusCode,200);let body='';res.on('data',chunk=>body+=chunk);res.on('end',()=>resolve(JSON.parse(body)));
   }).on('error',reject);
  });
  assert.equal(status.configured,false);
  assert.equal(status.liveEnabled,false);
 } finally { server.close(); await once(server,'close'); }
`;
const result=spawnSync(process.execPath,['--input-type=module','-e',source],{
 cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:15000,
 env:{PATH:process.env.PATH,NODE_OPTIONS:'',NEXUS_LIVE_ENABLED:'false',NEXUS_OVERAGE_CONFIRMED_OFF:'false'}
});
assert.equal(result.status,0,result.stderr||result.error?.message);
console.log('Compiled TypeScript gateway starts and serves offline status without a TS loader.');
