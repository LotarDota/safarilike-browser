#!/usr/bin/env node
/**
 * Development launcher: runs Vite for the renderer and Electron against the
 * compiled main/preload output. Rebuilds main/preload on file changes via
 * `tsc --watch`.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const procs = [];

function run(cmd, args, opts = {}) {
  const p = spawn(cmd, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  procs.push(p);
  return p;
}

const viteBin = path.join(root, 'node_modules', '.bin', 'vite');
const tscBin = path.join(root, 'node_modules', '.bin', 'tsc');
const electronBin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'electron.cmd' : 'electron');

run(viteBin, []);
run(tscBin, ['-p', 'tsconfig.main.json', '--watch']);
run(tscBin, ['-p', 'tsconfig.preload.json', '--watch']);

// Wait until first build is available before launching Electron.
const mainEntry = path.join(root, 'dist', 'main', 'index.js');
const wait = setInterval(() => {
  if (existsSync(mainEntry)) {
    clearInterval(wait);
    run(electronBin, ['.'], { env: { ...process.env, ELECTRON_ENABLE_LOGGING: '1' } });
  }
}, 500);

const shutdown = () => {
  for (const p of procs) {
    try {
      p.kill('SIGTERM');
    } catch {
      /* noop */
    }
  }
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
