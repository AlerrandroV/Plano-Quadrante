// Servidor de desenvolvimento: faz no PC o mesmo que o app Android faz
// no celular (serve a pasta web/ e repassa mensagens WebSocket).
//
//   npm install
//   npm run dev
//
// Abra http://localhost:8080 no PC (vira o criador da sala) e, no
// celular, o endereço de rede mostrado no terminal (vira jogador).
// O protocolo precisa ficar IGUAL ao de android/.../LocalServer.java.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const WEB_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../web');
const PORT = Number(process.env.PORT) || 8080;
const MAX_PLAYERS = 32;
const ID_RE = /^[A-Za-z0-9_-]{1,40}$/;

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg',
};

function lanUrls(port) {
  const urls = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list ?? []) {
      if (a.family === 'IPv4' && !a.internal) urls.push(`http://${a.address}:${port}/`);
    }
  }
  return urls;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/pq-info.json') {
    res.writeHead(200, { 'content-type': MIME['.json'], 'cache-control': 'no-store' });
    res.end(JSON.stringify({ server: 'plano-quadrante', app: false, port: PORT, lanUrls: lanUrls(PORT) }));
    return;
  }
  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(WEB_ROOT, path.normalize(rel));
  if (!file.startsWith(WEB_ROOT + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('404'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
});

// ------------------------- relay -------------------------
let host = null;
const players = new Map(); // id -> { ws, name }

function sendJson(ws, obj) {
  if (ws && ws.readyState === ws.OPEN) ws.send(JSON.stringify(obj));
}
function isLoopback(addr = '') {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}

const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 64 * 1024 });

wss.on('connection', (ws, req) => {
  const q = new URL(req.url, 'http://x').searchParams;
  const role = q.get('role');

  if (role === 'host') {
    // Só o próprio aparelho pode ser o criador da sala.
    if (!isLoopback(req.socket.remoteAddress)) { ws.close(4003, 'host only on loopback'); return; }
    if (host) host.close(4000, 'replaced');
    host = ws;
    sendJson(ws, { t: 'clients', list: [...players].map(([id, p]) => ({ id, name: p.name })) });
    ws.on('message', (raw) => {
      let m; try { m = JSON.parse(raw); } catch { return; }
      if (m?.t === 'send') sendJson(players.get(m.to)?.ws, m.data);
      else if (m?.t === 'broadcast') for (const p of players.values()) sendJson(p.ws, m.data);
    });
    ws.on('close', () => {
      if (host !== ws) return;
      host = null;
      for (const p of players.values()) sendJson(p.ws, { type: '_host-offline' });
    });
    return;
  }

  const id = q.get('id') ?? '';
  const name = (q.get('name') ?? '').slice(0, 20);
  if (role !== 'player' || !ID_RE.test(id)) { ws.close(4001, 'bad request'); return; }
  if (!players.has(id) && players.size >= MAX_PLAYERS) {
    sendJson(ws, { type: '_full' }); ws.close(4002, 'full'); return;
  }
  const old = players.get(id);
  if (old) old.ws.close(4000, 'replaced');
  const entry = { ws, name };
  players.set(id, entry);
  sendJson(host, { t: 'join', id, name });
  if (!host) sendJson(ws, { type: '_host-offline' });

  ws.on('message', (raw) => {
    let data; try { data = JSON.parse(raw); } catch { return; }
    sendJson(host, { t: 'msg', id, data });
  });
  ws.on('close', () => {
    if (players.get(id) !== entry) return; // já foi substituído por reconexão
    players.delete(id);
    sendJson(host, { t: 'leave', id });
  });
});

// Detecta celulares que sumiram sem fechar a conexão.
setInterval(() => {
  for (const ws of wss.clients) {
    if (ws.isAlive === false) { ws.terminate(); continue; }
    ws.isAlive = false;
    ws.ping();
  }
}, 15000);
wss.on('connection', (ws) => { ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; }); });

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Plano Quadrante — servidor de desenvolvimento`);
  console.log(`  Criador da sala (neste PC): http://localhost:${PORT}/`);
  for (const u of lanUrls(PORT)) console.log(`  Jogadores (mesma rede):     ${u}`);
  console.log(`  Modo mesma tela:            http://localhost:${PORT}/?modo=local`);
});
