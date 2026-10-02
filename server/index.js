import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {ApiError,MAX_BODY_BYTES,createAgentService} from './provider.js';
const LOCAL_HOSTS=new Set(['127.0.0.1:8787','localhost:8787','127.0.0.1:5173','localhost:5173','127.0.0.1:4173','localhost:4173']);
export function originAllowed(origin){if(!origin)return true;try{const u=new URL(origin);return u.protocol==='http:'&&LOCAL_HOSTS.has(u.host)&&u.origin===origin;}catch{return false;}}
export function createHandler(service=createAgentService()) {
 return async function handler(req,res) {
  const send=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));};
  try {
   if(!LOCAL_HOSTS.has(req.headers.host)||!originAllowed(req.headers.origin))throw new ApiError(403,'ORIGIN_DENIED','仅允许本机应用请求');
   if(req.method==='GET'&&req.url==='/api/status'){send(200,service.status());return;}
   if(req.method!=='POST'||req.url!=='/api/agent'){send(404,{error:{code:'NOT_FOUND',message:'接口不存在'}});return;}
   if(!/^application\/json(?:;|$)/i.test(req.headers['content-type']||''))throw new ApiError(415,'JSON_REQUIRED','仅接受 JSON 请求');
   const chunks=[];let bytes=0;
   for await(const chunk of req){bytes+=chunk.length;if(bytes>MAX_BODY_BYTES)throw new ApiError(413,'BODY_TOO_LARGE','请求内容过大');chunks.push(chunk);}
   let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ApiError(400,'INVALID_JSON','请求不是有效 JSON');}
   if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['action','input'].includes(k)))throw new ApiError(400,'INVALID_INPUT','请求不符合接口约定');
   send(200,{output:await service.run(body.action,body.input)});
  }catch(e){send(e instanceof ApiError?e.status:500,{error:{code:e instanceof ApiError?e.code:'SERVER_ERROR',message:e instanceof ApiError?e.message:'服务器请求失败'}});}
 };
}
export function createServer(options={}){return http.createServer(createHandler(createAgentService(options)));}
export function startServer(){const server=createServer();server.requestTimeout=35000;server.headersTimeout=10000;server.listen(8787,'127.0.0.1');return server;}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){startServer();console.log('NexusScribe API listening on http://127.0.0.1:8787 (live generation requires explicit server configuration)');}
