// Local-only static preview for embedded players that require an HTTP referrer.
'use strict';
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {spawn}=require('node:child_process');
const root=__dirname;
const publicFiles=new Set(['index.html','listening.css','listening.js','vote-service.js','logo-vote.svg','admin.html','admin.css','admin.js','admin-data.js','admin-config.js']);
const types={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.jpg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg','.woff2':'font/woff2','.txt':'text/plain; charset=utf-8'};
const server=http.createServer((request,response)=>{
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
  let relative;
  try{relative=decodeURIComponent(new URL(request.url,'http://localhost').pathname).replace(/^\/+/, '')||'index.html';}catch{response.writeHead(400);response.end();return;}
  const target=path.resolve(root,relative);
  const withinRoot=target.startsWith(root+path.sep);
  const asset=relative.startsWith('assets/')&&['.jpg','.png','.mp3','.woff2','.txt'].includes(path.extname(relative).toLowerCase());
  if(!withinRoot||(!publicFiles.has(relative)&&!asset)){response.writeHead(404);response.end();return;}
  fs.stat(target,(error,stat)=>{
    if(error||!stat.isFile()){response.writeHead(404);response.end();return;}
    response.writeHead(200,{'Content-Type':types[path.extname(target).toLowerCase()]||'application/octet-stream','Content-Length':stat.size,'Cache-Control':'no-store','Referrer-Policy':'strict-origin-when-cross-origin','X-Content-Type-Options':'nosniff'});
    if(request.method==='HEAD'){response.end();return;}
    const stream=fs.createReadStream(target);stream.on('error',()=>response.destroy());stream.pipe(response);
  });
});
server.on('error',error=>{if(error.code==='EADDRINUSE'){console.error('Port 4176 is in use. Close the previous preview window and try again.');process.exitCode=1;}else{console.error(error.message);process.exitCode=1;}});
server.listen(4176,'127.0.0.1',()=>{
  const address='http://127.0.0.1:4176/';
  console.log('Local preview: '+address+'\nKeep this window open. Press Ctrl+C to stop.');
  if(process.argv.includes('--open'))spawn('cmd.exe',['/d','/c','start','',address],{windowsHide:true,stdio:'ignore'}).on('error',()=>console.log('Open '+address+' in your browser.'));
});
