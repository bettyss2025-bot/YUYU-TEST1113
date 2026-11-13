import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root=process.cwd();
http.createServer((req,res)=>{let name;try{name=decodeURIComponent(req.url.split('?')[0]);}catch{res.writeHead(400).end('Invalid URL');return;}const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end('Not found');return;}res.setHeader('Content-Type',({'html':'text/html; charset=utf-8','js':'text/javascript; charset=utf-8','css':'text/css; charset=utf-8','svg':'image/svg+xml','png':'image/png','jpg':'image/jpeg','webmanifest':'application/manifest+json; charset=utf-8'})[file.split('.').pop()]||'application/octet-stream');if(name==='/sw.js'||name==='/'||name==='/index.html'||name==='/manifest.webmanifest')res.setHeader('Cache-Control','no-cache');res.end(data);});}).listen(5173,'0.0.0.0',()=>console.log('Local: http://localhost:5173'));
