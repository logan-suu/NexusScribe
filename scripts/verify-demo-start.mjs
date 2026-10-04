// Bounded clean-environment npm-start smoke. No model action or credentials.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {setTimeout as delay} from 'node:timers/promises';
import {createServer} from 'node:net';
// Do not mistake an already-running app for the checkout just launched.
for (const port of [5173,8787]) await new Promise((resolve,reject)=>{
  const probe=createServer();
  probe.once('error',()=>reject(Error(`Port ${port} is unavailable; stop the existing service before the clean-launch smoke`)));
  probe.listen(port,'127.0.0.1',()=>probe.close(error=>error?reject(error):resolve()));
});
const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>!key.startsWith('NEXUS_')));
env.NEXUS_LIVE_ENABLED='false'; env.NEXUS_OVERAGE_CONFIRMED_OFF='false';
const child=spawn('npm',['start'],{cwd:new URL('../',import.meta.url),env,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});
let output='',exited=false;
child.stdout.on('data',chunk=>{output+=chunk;}); child.stderr.on('data',chunk=>{output+=chunk;});
child.on('exit',()=>{exited=true;});
try {
  let ready=false;
  for(let i=0;i<60;i++) {
    if(exited) throw Error('npm start exited before both loopback services became ready');
    try {
      const [front,api]=await Promise.all([fetch('http://127.0.0.1:5173',{signal:AbortSignal.timeout(500)}),fetch('http://127.0.0.1:8787/api/status',{signal:AbortSignal.timeout(500)})]);
      assert.equal(front.status,200); assert.match(await front.text(),/NexusScribe/);
      assert.equal(api.status,200); const status=await api.json();
      assert.equal(status.configured,false); assert.equal(status.liveEnabled,false); assert.equal(status.callsUsed,0);
      ready=true;break;
    } catch {await delay(250);}
  }
  assert.equal(ready,true,'npm start did not serve the offline frontend and disabled API');
  console.log('PASS: clean npm start serves loopback frontend/API; configured=false, liveEnabled=false, callsUsed=0. No model request made.');
} catch(error) {console.error(output); throw error;}
finally {
  if(process.platform==='win32') child.kill('SIGTERM');
  else {try{process.kill(-child.pid,'SIGTERM');}catch(error){if(error.code!=='ESRCH')throw error;}}
}
