import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
// Simplified dev orchestrator: start Vite first, then wait for TS build artifacts, then launch Electron.
const port = process.env.DEV_PORT || process.env.VITE_PORT || '5173';
const url = `http://localhost:${port}`;

function fileExists(p) { try { return fs.existsSync(p); } catch { return false; } }

async function waitForFiles(files, timeoutMs = 15000, intervalMs = 250) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (files.every(f => fileExists(f))) return resolve(true);
      if (Date.now() - start > timeoutMs) return reject(new Error('Timed out waiting for build outputs'));
      setTimeout(tick, intervalMs);
    };
    tick();
  });
}

console.log('[dev] Starting Vite dev server (direct)...');
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', port], { stdio: 'inherit' });
vite.on('exit', (code) => console.error(`[dev] Vite process exited early with code ${code}`));

// Start TypeScript watchers for main & preload
console.log('[dev] Starting TypeScript watch (main)...');
const tsmain = spawn(process.execPath, ['node_modules/typescript/lib/tsc.js', '-p', 'tsconfig.main.json', '-w'], { stdio: 'inherit' });
tsmain.on('exit', (code) => console.error(`[dev] TS main watcher exited with code ${code}`));
console.log('[dev] Starting TypeScript watch (preload)...');
const tspreload = spawn(process.execPath, ['node_modules/typescript/lib/tsc.js', '-p', 'tsconfig.preload.json', '-w'], { stdio: 'inherit' });
tspreload.on('exit', (code) => console.error(`[dev] TS preload watcher exited with code ${code}`));

async function waitForHttp(url, timeoutMs = 20000, intervalMs = 400) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) return resolve(true);
        next();
      });
      req.on('error', next);
      req.setTimeout(2500, () => { req.destroy(); next(); });
    };
    const next = () => {
      if (Date.now() - start > timeoutMs) return reject(new Error('Timed out waiting for Vite dev server'));
      setTimeout(attempt, intervalMs);
    };
    attempt();
  });
}

// Once main & preload compiled and dev server responding, start Electron.
(async () => {
  const appRoot = process.cwd();
  const needed = [
    path.join(appRoot, 'dist', 'main', 'main.js'),
    path.join(appRoot, 'dist', 'preload', 'index.js'),
  ];
  try {
    await waitForFiles(needed);
    console.log('[dev] Build artifacts detected. Waiting for dev server HTTP...');
    await waitForHttp(url);
    // Create CommonJS preload shim for Electron (package type=module makes .js ESM)
    const preloadJs = path.join(appRoot, 'dist', 'preload', 'index.js');
    const preloadCjs = path.join(appRoot, 'dist', 'preload', 'index.cjs');
    if (fs.existsSync(preloadJs)) {
      try { fs.copyFileSync(preloadJs, preloadCjs); console.log('[dev] Preload .cjs shim ready'); } catch (e) { console.warn('[dev] Failed creating preload .cjs shim', e); }
    }
  } catch (e) {
    console.error('Dev startup aborted:', e);
    vite.kill();
    tsmain.kill();
    tspreload.kill();
    process.exit(1);
  }

  console.log('[dev] Launching Electron with VITE_DEV_SERVER_URL set.');
  const appRootResolved = process.cwd();
  const electronEntry = path.join(appRootResolved, 'node_modules', 'electron', 'cli.js');
  if (!fs.existsSync(electronEntry)) {
    console.error('[dev] Electron cli.js not found at', electronEntry);
    vite.kill();
    tsmain.kill();
    tspreload.kill();
    process.exit(1);
  }
  const electronProc = spawn(process.execPath, [electronEntry, '.'], {
    stdio: 'inherit',
    env: { 
      ...process.env, 
      VITE_DEV_SERVER_URL: url,
      ELECTRON_ENABLE_LOGGING: '1',
      ELECTRON_DEBUG_NOTIFICATIONS: '1'
    },
  });
  electronProc.on('error', (err) => console.error('[dev] Electron failed to start:', err));
  electronProc.on('exit', (code, signal) => {
    console.error(`[dev] Electron exited code=${code} signal=${signal}`);
    vite.kill();
    tsmain.kill();
    tspreload.kill();
    process.exit(code ?? 0);
  });
})();
