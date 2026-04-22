#!/usr/bin/env node
/**
 * Tiny self-hostable sync server. Stores encrypted blobs per account.
 * The client (Clover browser) encrypts client-side with AES-256-GCM
 * using a passphrase-derived key — the server never sees plaintext or
 * the passphrase. It only stores a ciphertext+iv+tag tuple.
 *
 * Usage:
 *   node scripts/sync-server.mjs
 *   PORT=8787 DATA_DIR=./sync-data node scripts/sync-server.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT ?? 8787);
const dataDir = path.resolve(process.env.DATA_DIR ?? path.join(__dirname, '..', 'sync-data'));
fs.mkdirSync(dataDir, { recursive: true });

function accountFile(account) {
  const safe = account.replace(/[^a-z0-9@._-]/gi, '_').toLowerCase();
  return path.join(dataDir, `${safe}.json`);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const match = url.pathname.match(/^\/v1\/accounts\/([^/]+)\/blob$/);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,PUT,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (!match) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const account = decodeURIComponent(match[1]);
  const file = accountFile(account);

  if (req.method === 'PUT') {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        const parsed = JSON.parse(body);
        if (!parsed.iv || !parsed.data || !parsed.tag) {
          res.writeHead(400);
          res.end('Missing fields');
          return;
        }
        fs.writeFileSync(file, JSON.stringify({ ...parsed, updatedAt: Date.now() }, null, 2));
        res.writeHead(204);
        res.end();
      } catch (err) {
        res.writeHead(400);
        res.end(`Bad JSON: ${err.message}`);
      }
    });
    return;
  }

  if (req.method === 'GET') {
    if (!fs.existsSync(file)) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end('null');
      return;
    }
    const content = fs.readFileSync(file, 'utf8');
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(content);
    return;
  }

  res.writeHead(405);
  res.end('Method not allowed');
});

server.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Clover sync server on http://localhost:${port} (data: ${dataDir})`);
});
