import { app, BrowserWindow, ipcMain, shell, session, dialog } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
console.log('[main] starting main process');
// (path import moved to top)
import { URL } from 'node:url';
import { SteamCmdService } from './services/SteamCmdService.js';
import { ModService } from './services/ModService.js';
import { SettingsService } from './services/SettingsService.js';
import { ProfilesService } from './services/ProfilesService.js';
import { IniService } from './services/IniService.js';
import { AutoUpdateService } from './services/AutoUpdateService.js';
import { BackupService } from './services/BackupService.js';
import { ShutdownService } from './services/ShutdownService.js';
import { CurseForgeService } from './services/CurseForgeService.js';
import { AnalyticsService } from './services/AnalyticsService.js';
import { ReportsService } from './services/ReportsService.js';
import { PerformanceService } from './services/PerformanceService.js';
import { SaveCleanupService } from './services/SaveCleanupService.js';
import { TokenService } from './services/TokenService.js';
import { WebApiService } from './services/WebApiService.js';
import { ClaudeService } from './services/ClaudeService.js';

const steam = new SteamCmdService();
// Global reference to main window to prevent GC-induced auto close.
let mainWindow: BrowserWindow | null = null;
const mods = new ModService((dir) => steam.ensureSteamCmd(dir));
const settings = new SettingsService();
const profiles = new ProfilesService();
const ini = new IniService(() => settings.get().workspaceRoot, () => profiles.list().servers);
const backups = new BackupService(() => settings.get().workspaceRoot);
const shutdownService = new ShutdownService();
const analytics = new AnalyticsService(() => backups.list(), () => settings.get());
const curseforge = new CurseForgeService(() => settings.get().curseforgeApiKey || '', () => settings.get().workspaceRoot);
const reports = new ReportsService(() => settings.get().workspaceRoot, () => profiles.list().servers);
const perf = new PerformanceService(() => profiles.list().servers);
const tokenService = new TokenService();
const webApi = new WebApiService(() => settings.get(), () => tokenService.get());
const claude = new ClaudeService(() => settings.get());
const webApiHistory: Array<{ ts: string; method: string; path: string; ok: boolean; error?: string }> = [];
function logWebApi(method: string, path: string, ok: boolean, error?: string) {
  webApiHistory.push({ ts: new Date().toISOString(), method, path, ok, error });
  if (webApiHistory.length > 50) webApiHistory.shift();
}
const saveCleanup = new SaveCleanupService(
  () => profiles.list().servers.map(s => ({ id: s.id, installDir: s.installDir })),
  () => {
    const s = settings.get();
    return { enabled: s.saveCleanupEnabled, retentionDays: s.saveCleanupRetentionDays, maxWorldFiles: s.saveCleanupMaxWorldFiles } as any;
  }
);
const autoUpdate = new AutoUpdateService(
  () => settings.get(),
  () => profiles.list().servers,
  (args) => steam.installOrUpdateServer(args),
  (modArgs) => mods.downloadOrUpdate(modArgs),
  (iniPath: string) => ini.readText(iniPath),
  {
    getLatestFileMetadata: (projectId: number) => curseforge.getLatestFileMetadata(projectId),
    getFileDownloadUrl: (projectId: number, fileId: number) => curseforge.getFileDownloadUrl(projectId, fileId)
  },
  (serverId: string) => saveCleanup.cleanup(serverId),
  (server) => applyIniOverrides(server.id)
);

function applyIniOverrides(serverId: string) {
  const srv = profiles.list().servers.find(s => s.id === serverId);
  if (!srv || !srv.customIniOverrides || !srv.customIniOverrides.length) return;
  for (const ov of srv.customIniOverrides) {
    if (!ov.enabled) continue;
    const fileName = ov.target || 'GameUserSettings.ini';
    const targetPath = path.join(srv.installDir, 'ShooterGame', 'Saved', 'Config', 'WindowsServer', fileName);
    try {
      const existing = ini.readText(targetPath);
      const beginMarker = `# BEGIN OVERRIDE ${ov.id}`;
      const endMarker = `# END OVERRIDE ${ov.id}`;
      // Remove existing block if present
      const replaced = existing.replace(new RegExp(`# BEGIN OVERRIDE ${ov.id}[\s\S]*?# END OVERRIDE ${ov.id}\n?`, 'g'), '').trim();
      const newContent = `${replaced}\n\n${beginMarker}\n${ov.content.replace(/\r?\n$/,'')}\n${endMarker}\n`;
      ini.writeText(targetPath, newContent);
    } catch(e) {
      console.warn('[main] applyIniOverrides failed for', serverId, ov.id, e);
    }
  }
}

function createWindow() {
  // Resolve icon path safely (package build may place assets inside asar)
  let iconPath: string | undefined;
  try {
    const candidate = path.join(app.getAppPath(), 'build', 'icon.ico');
    const alt = path.join(process.resourcesPath, 'build', 'icon.ico');
    if (fs.existsSync(candidate)) iconPath = candidate; else if (fs.existsSync(alt)) iconPath = alt;
  } catch {}
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    icon: iconPath, // desktop/taskbar icon (packaged)
    webPreferences: {
      preload: path.join(app.getAppPath(), 'dist/preload/index.cjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      devTools: !app.isPackaged,
      spellcheck: false,
    },
  });

  win.on('ready-to-show', () => {
    console.log('[main] ready-to-show');
    win.show();
  });
  win.removeMenu();
  const createdAt = Date.now();
  let earlyClosePrevented = false;
  win.on('close', (e) => {
    const age = Date.now() - createdAt;
    const stack = new Error('Window close stack').stack;
    console.log('[main] window close requested age(ms)=', age, 'prevented=', earlyClosePrevented);
    console.log('[main] window close stack:\n', stack);
    // Prevent auto-close if within first 4000ms to capture renderer interaction
    if (age < 4000 && !earlyClosePrevented) {
      e.preventDefault();
      earlyClosePrevented = true;
      console.log('[main] early close prevented (diagnostic)');
      // expose a banner to renderer
      try { win.webContents.send('diag:earlyClosePrevented', { age }); } catch {}
    }
  });
  win.on('closed', () => {
    console.log('[main] window closed');
    mainWindow = null;
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    const host = new URL(url).host;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      e.preventDefault();
    }
  });

  const devServer = process.env.VITE_DEV_SERVER_URL;
  if (devServer) {
    console.log('[main] loading dev server', devServer);
    win.loadURL(devServer);
  } else {
    console.log('[main] loading file renderer');
    win.loadFile(path.join(app.getAppPath(), 'dist/renderer/index.html'));
  }

  mainWindow = win; // keep global ref
}

app.disableHardwareAcceleration();
app.on('web-contents-created', (_e, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault();
  });
});

app.whenReady().then(async () => {
  await session.defaultSession.setPermissionRequestHandler((_wc, _permission, cb) => cb(false));
  createWindow();
  // reschedule any persisted backup jobs
  backups.rescheduleAll();
  // start auto update scheduler if enabled
  if (settings.get().autoUpdateEnabled) autoUpdate.start();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// IPC: secure, parameter-validated endpoints
function ensureInside(base: string, target: string) {
  const resolved = path.resolve(target);
  const root = path.resolve(base);
  if (!resolved.startsWith(root)) throw new Error('Path outside workspace root');
  return resolved;
}

ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('bridge:ping', () => ({ pong: true, ts: Date.now() }));
// Diagnostics for unexpected renderer termination
app.on('render-process-gone', (_e, wc, details) => {
  console.error('[diag] render-process-gone', details);
});
app.on('child-process-gone', (_e, details) => {
  console.error('[diag] child-process-gone', details);
});
process.on('uncaughtException', (err) => {
  console.error('[diag] uncaughtException', err);
});
process.on('unhandledRejection', (reason) => {
  console.error('[diag] unhandledRejection', reason);
});
// Web API Token IPC
ipcMain.handle('token:get', () => ({ token: tokenService.get(), present: !!tokenService.get() }));
ipcMain.handle('token:set', (_e, token: string) => ({ ok: tokenService.set(token) }));
ipcMain.handle('token:clear', () => ({ ok: tokenService.clear() }));
// Generic Web API IPC passthrough
ipcMain.handle('webapi:get', async (_e, path: string) => {
  try { const r = await webApi.get(path); logWebApi('GET', path, true); return r; } catch (e: any) { logWebApi('GET', path, false, String(e?.message||e)); throw e; }
});
ipcMain.handle('webapi:post', async (_e, args: { path: string; body: any }) => {
  try { const r = await webApi.post(args.path, args.body); logWebApi('POST', args.path, true); return r; } catch (e: any) { logWebApi('POST', args.path, false, String(e?.message||e)); throw e; }
});
ipcMain.handle('webapi:put', async (_e, args: { path: string; body: any }) => {
  try { const r = await webApi.put(args.path, args.body); logWebApi('PUT', args.path, true); return r; } catch (e: any) { logWebApi('PUT', args.path, false, String(e?.message||e)); throw e; }
});
ipcMain.handle('webapi:delete', async (_e, path: string) => {
  try { const r = await webApi.delete(path); logWebApi('DELETE', path, true); return r; } catch (e: any) { logWebApi('DELETE', path, false, String(e?.message||e)); throw e; }
});
ipcMain.handle('webapi:history', () => webApiHistory.slice().reverse());

// Settings IPC
ipcMain.handle('settings:get', () => settings.get());
ipcMain.handle('settings:set', (_e, partial: Partial<ReturnType<typeof settings.get>>) => settings.set(partial));
// Explicit offline mode getters/setters with event broadcast
ipcMain.handle('settings:getOfflineMode', () => ({ offlineMode: settings.get().offlineMode }));
ipcMain.handle('settings:setOfflineMode', (_e, offline: boolean) => {
  const updated = settings.set({ offlineMode: !!offline });
  // broadcast to all renderers
  for (const win of BrowserWindow.getAllWindows()) {
    try { win.webContents.send('settings:offlineChanged', { offlineMode: updated.offlineMode }); } catch {}
  }
  return { offlineMode: updated.offlineMode };
});
ipcMain.handle('dialog:chooseDirectory', async () => {
  const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  if (res.canceled || res.filePaths.length === 0) return null;
  return res.filePaths[0];
});

// Profiles IPC
ipcMain.handle('profiles:list', () => profiles.list());
ipcMain.handle('profiles:upsertServer', (_e, s) => profiles.upsertServer(s));
ipcMain.handle('profiles:deleteServer', (_e, id: string) => { profiles.deleteServer(id); return true; });
ipcMain.handle('profiles:upsertCluster', (_e, c) => profiles.upsertCluster(c));
ipcMain.handle('profiles:deleteCluster', (_e, id: string) => { profiles.deleteCluster(id); return true; });
ipcMain.handle('profiles:reorderMod', (_e, args: { serverId: string; modId: string; direction: 'up'|'down'|'top' }) => {
  const state = profiles.list();
  const srv = state.servers.find(s => s.id === args.serverId);
  if (!srv) throw new Error('Server not found');
  const list = srv.orderedMods || [];
  const idx = list.findIndex(m => m.id === args.modId);
  if (idx < 0) throw new Error('Mod not found');
  if (args.direction === 'top') {
    const [item] = list.splice(idx, 1);
    list.unshift(item);
  } else if (args.direction === 'up' && idx > 0) {
    [list[idx-1], list[idx]] = [list[idx], list[idx-1]];
  } else if (args.direction === 'down' && idx < list.length - 1) {
    [list[idx+1], list[idx]] = [list[idx], list[idx+1]];
  }
  // keep legacy mods array in sync
  srv.mods = list.map(m => m.id);
  srv.orderedMods = list;
  profiles.upsertServer(srv);
  return { ok: true, orderedMods: list };
});
ipcMain.handle('profiles:deleteMod', (_e, args: { serverId: string; modId: string }) => {
  ipcMain.handle('profiles:setOrderedMods', (_e, args: { serverId: string; ordered: any[] }) => {
    const state = profiles.list();
    const srv = state.servers.find(s => s.id === args.serverId);
    if (!srv) throw new Error('Server not found');
    srv.orderedMods = args.ordered;
    // mods array reflects enabled mods only
    srv.mods = (srv.orderedMods || []).filter(m => m.enabled !== false).map(m => m.id);
    profiles.upsertServer(srv);
    return { ok: true, orderedMods: srv.orderedMods };
  });
  ipcMain.handle('profiles:toggleAllMods', (_e, args: { serverId: string; enabled: boolean }) => {
    const state = profiles.list();
    const srv = state.servers.find(s => s.id === args.serverId);
    if (!srv) throw new Error('Server not found');
    srv.orderedMods = (srv.orderedMods || []).map(m => ({ ...m, enabled: args.enabled }));
    srv.mods = (srv.orderedMods).filter(m => m.enabled !== false).map(m => m.id);
    profiles.upsertServer(srv);
    return { ok: true, orderedMods: srv.orderedMods };
  });

  // Clean Mods Folder (removes numeric directories not present as enabled steam mods)
  ipcMain.handle('mods:cleanFolder', (_e, args: { serverId: string }) => {
    const state = profiles.list();
    const srv = state.servers.find(s => s.id === args.serverId);
    if (!srv) throw new Error('Server not found');
    const modsDir = path.join(srv.installDir, 'ShooterGame', 'Content', 'Mods');
    const existing = fs.existsSync(modsDir) ? fs.readdirSync(modsDir, { withFileTypes: true }).filter(d=>d.isDirectory()).map(d=>d.name) : [];
    const keep = new Set((srv.orderedMods||[]).filter(m=>m.type==='steam' && m.enabled!==false).map(m=>m.id));
    const removed: string[] = [];
    for (const dir of existing) {
      if (/^\d+$/.test(dir) && !keep.has(dir)) {
        try { fs.rmSync(path.join(modsDir, dir), { recursive:true, force:true }); removed.push(dir); } catch {}
      }
    }
    return { ok: true, removed, kept: Array.from(keep), folder: modsDir };
  });
  const state = profiles.list();
  const srv = state.servers.find(s => s.id === args.serverId);
  if (!srv) throw new Error('Server not found');
  srv.orderedMods = (srv.orderedMods || []).filter(m => m.id !== args.modId);
  srv.mods = (srv.orderedMods).map(m => m.id);
  profiles.upsertServer(srv);
  return { ok: true, orderedMods: srv.orderedMods };
});
// CurseForge mods tracking per server
ipcMain.handle('profiles:updateCurseForgeMods', (_e, args: { serverId: string; mods: { projectId: number; fileId: number; displayName?: string }[] }) => {
  const state = profiles.list();
  const srv = state.servers.find(s => s.id === args.serverId);
  if (!srv) throw new Error('Server not found');
  srv.curseforgeMods = args.mods;
  profiles.upsertServer(srv);
  return { ok: true, mods: srv.curseforgeMods };
});
// INI Overrides set
ipcMain.handle('profiles:setIniOverrides', (_e, args: { serverId: string; overrides: { id: string; target: string; content: string; enabled: boolean }[] }) => {
  const state = profiles.list();
  const srv = state.servers.find(s => s.id === args.serverId);
  if (!srv) throw new Error('Server not found');
  srv.customIniOverrides = args.overrides.map(o => ({ id: o.id, target: o.target, content: o.content, enabled: !!o.enabled }));
  profiles.upsertServer(srv);
  return { ok: true, overrides: srv.customIniOverrides };
});

// INI IPC (raw text editor for now)
ipcMain.handle('ini:readText', (_e, filePath: string) => ini.readText(filePath));
ipcMain.handle('ini:writeText', (_e, filePath: string, content: string) => { ini.writeText(filePath, content); return true; });
ipcMain.handle('ini:applyOverrides', (_e, serverId: string) => { applyIniOverrides(serverId); return { ok: true }; });
// Apply admin password to GameUserSettings.ini
ipcMain.handle('profiles:applyAdminPassword', (_e, serverId: string) => {
  const srv = profiles.list().servers.find(s=>s.id===serverId);
  if (!srv) throw new Error('Server not found');
  if (!srv.adminPassword) throw new Error('Admin password not set');
  const gusPath = path.join(srv.installDir, 'ShooterGame', 'Saved', 'Config', 'WindowsServer', 'GameUserSettings.ini');
  try {
    const existing = ini.readText(gusPath);
    let lines = existing.split(/\r?\n/);
    const key = 'ServerAdminPassword=';
    const has = lines.findIndex(l=>l.startsWith(key));
    if (has >= 0) {
      lines[has] = key + srv.adminPassword;
    } else {
      // place near end of [ServerSettings] if present
      const sectionIdx = lines.findIndex(l=>/^\[ServerSettings\]/i.test(l));
      if (sectionIdx >= 0) {
        // insert after section header and any immediate comment lines
        let insertPos = sectionIdx + 1;
        while (insertPos < lines.length && /^\s*#/.test(lines[insertPos])) insertPos++;
        lines.splice(insertPos, 0, key + srv.adminPassword);
      } else {
        lines.push(key + srv.adminPassword);
      }
    }
    ini.writeText(gusPath, lines.join('\n'));
    return { ok: true, path: gusPath };
  } catch (e:any) {
    throw new Error('Failed to apply admin password: ' + String(e?.message||e));
  }
});

ipcMain.handle('steamcmd:ensure', async (_e, args: { workspaceRoot: string; steamcmdDir: string }) => {
  const root = path.resolve(args.workspaceRoot);
  const dir = ensureInside(root, path.join(root, args.steamcmdDir));
  if (settings.get().offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to use SteamCMD.');
  return steam.ensureSteamCmd(dir);
});

ipcMain.handle(
  'steamcmd:installOrUpdate',
  async (
    _e,
    args: { workspaceRoot: string; steamcmdDir: string; installDir: string; appId?: number; validate?: boolean }
  ) => {
    const root = path.resolve(args.workspaceRoot);
    const steamDir = ensureInside(root, path.join(root, args.steamcmdDir));
    const installDir = ensureInside(root, path.join(root, args.installDir));
    if (settings.get().offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to update server.');
    return steam.installOrUpdateServer({
      steamcmdDir: steamDir,
      installDir,
      appId: args.appId ?? 2430930,
      validate: args.validate ?? true,
    });
  }
);

// Analytics IPC
ipcMain.handle('analytics:get', () => analytics.getMetrics());
ipcMain.handle('curseforge:searchMods', async (_e, args: { query: string; pageSize?: number }) => {
  const settingsData = settings.get();
  if (settingsData.offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to search CurseForge.');
  return await curseforge.searchMods({ query: args.query, pageSize: args.pageSize });
});
ipcMain.handle('curseforge:getModDetails', async (_e, id: number) => {
  if (settings.get().offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to fetch mod details.');
  return curseforge.getModDetails(id);
});

// Claude AI (Anthropic) IPC
ipcMain.handle('claude:complete', async (_e, args: { prompt: string; system?: string; maxTokens?: number }) => {
  const s = settings.get();
  if (s.offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to use Claude.');
  if (!s.claudeEnabled) throw new Error('Claude feature disabled. Enable in Settings.');
  if (!s.anthropicApiKey) throw new Error('Anthropic API key not set.');
  return claude.complete({ prompt: args.prompt, system: args.system, maxTokens: args.maxTokens });
});
ipcMain.handle('claude:stream', async (_e, args: { prompt: string; system?: string; jobId: string; maxTokens?: number }) => {
  const s = settings.get();
  if (s.offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to use Claude.');
  if (!s.claudeEnabled) throw new Error('Claude feature disabled. Enable in Settings.');
  if (!s.anthropicApiKey) throw new Error('Anthropic API key not set.');
  // Fire-and-forget: streaming events emitted on ipc channel 'claude:streamEvent'
  claude.stream({ prompt: args.prompt, system: args.system, jobId: args.jobId, maxTokens: args.maxTokens }, (ev) => {
    try {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('claude:streamEvent', ev);
      }
    } catch {}
  });
  return { ok: true, jobId: args.jobId };
});

// Reports IPC
ipcMain.handle('reports:get', (_e, serverId: string) => reports.get(serverId));
ipcMain.handle('perf:getServerUsage', async (_e, serverId: string) => perf.getServerUsage(serverId));
ipcMain.handle('server:update', async (_e, args: { serverId: string; steamcmdDir: string; validate?: boolean }) => {
  const s = profiles.list().servers.find(x => x.id === args.serverId);
  if (!s) throw new Error('Server not found');
  const root = settings.get().workspaceRoot;
  const steamDir = path.join(root, args.steamcmdDir);
  if (settings.get().offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to update server.');
  return steam.installOrUpdateServer({ steamcmdDir: steamDir, installDir: s.installDir, appId: 2430930, validate: args.validate ?? false });
});
ipcMain.handle('autoupdate:toggle', (_e, enabled: boolean) => {
  settings.set({ autoUpdateEnabled: enabled });
  if (enabled) autoUpdate.start(); else autoUpdate.stop();
  return { enabled };
});

// Save cleanup IPC
ipcMain.handle('saves:cleanup', (_e, serverId: string) => {
  return saveCleanup.cleanup(serverId);
});

// App update from Git repository (development / unpacked only)
ipcMain.handle('app:updateFromGit', async () => {
  const appPath = app.getAppPath();
  const gitDir = path.join(appPath, '.git');
  if (!fs.existsSync(gitDir)) {
    return { ok: false, error: 'Git repository not found (.git missing). Packaged builds are read-only.' };
  }
  if (settings.get().offlineMode) {
    return { ok: false, error: 'Offline Mode enabled. Disable to perform update.' };
  }
  // Pre-flight: ensure git executable available
  const preflight = await new Promise<{ ok: boolean; output: string }>((resolve) => {
    try {
      const proc = spawn('git', ['--version'], { cwd: appPath });
      const chunks: string[] = [];
      proc.stdout.on('data', d => chunks.push(String(d)));
      proc.stderr.on('data', d => chunks.push(String(d)));
      proc.on('close', code => resolve({ ok: code === 0, output: chunks.join('').trim() }));
    } catch (e:any) {
      resolve({ ok: false, output: 'Spawn failed: ' + String(e?.message||e) });
    }
  });
  if (!preflight.ok) {
    return { ok: false, error: 'git --version failed. Ensure Git is installed and on PATH. ' + preflight.output };
  }
  
  // Check if remote 'origin' is configured
  const checkRemote = await new Promise<{ ok: boolean; output: string }>((resolve) => {
    try {
      const proc = spawn('git', ['remote', 'get-url', 'origin'], { cwd: appPath });
      const chunks: string[] = [];
      proc.stdout.on('data', d => chunks.push(String(d)));
      proc.stderr.on('data', d => chunks.push(String(d)));
      proc.on('close', code => resolve({ ok: code === 0, output: chunks.join('').trim() }));
    } catch (e:any) {
      resolve({ ok: false, output: String(e?.message||e) });
    }
  });
  
  // If no remote, add it
  if (!checkRemote.ok) {
    const addRemote = await new Promise<{ ok: boolean; output: string }>((resolve) => {
      try {
        const proc = spawn('git', ['remote', 'add', 'origin', 'https://github.com/TheGUI45/Ark-Server-Command.git'], { cwd: appPath });
        const chunks: string[] = [];
        proc.stdout.on('data', d => chunks.push(String(d)));
        proc.stderr.on('data', d => chunks.push(String(d)));
        proc.on('close', code => resolve({ ok: code === 0, output: chunks.join('').trim() }));
      } catch (e:any) {
        resolve({ ok: false, output: String(e?.message||e) });
      }
    });
    if (!addRemote.ok) {
      return { ok: false, error: 'Failed to add remote origin: ' + addRemote.output };
    }
  }
  
  const runGit = (args: string[]) => new Promise<{ code: number|null; output: string }>((resolve) => {
    try {
      const proc = spawn('git', args, { cwd: appPath });
      const chunks: string[] = [];
      proc.stdout.on('data', (d) => chunks.push(String(d)));
      proc.stderr.on('data', (d) => chunks.push(String(d)));
      proc.on('close', (code) => resolve({ code, output: chunks.join('') }));
    } catch (e:any) {
      resolve({ code: -1, output: 'Spawn failed: ' + String(e?.message||e) });
    }
  });
  const steps: Array<{ step: string; args: string[]; result?: any }> = [
    { step: 'fetch', args: ['fetch', '--all', '--prune'] },
    { step: 'pull', args: ['pull', '--rebase', 'origin', 'main'] }
  ];
  for (const s of steps) {
    // eslint-disable-next-line no-await-in-loop
    const res = await runGit(s.args);
    s.result = res;
    if (res.code !== 0) {
      return { ok: false, step: s.step, output: res.output, code: res.code };
    }
  }
  return { ok: true, preflight: preflight.output, steps };
});

// App restart helper (will relaunch and exit)
ipcMain.handle('app:restart', () => {
  try {
    app.relaunch();
    app.exit(0);
    return { ok: true };
  } catch (e:any) {
    return { ok: false, error: String(e?.message||e) };
  }
});

// Backups IPC
ipcMain.handle('backup:list', () => backups.list());
ipcMain.handle('backup:upsert', (_e, job) => backups.upsert(job));
ipcMain.handle('backup:delete', (_e, id: string) => { backups.remove(id); return true; });
ipcMain.handle('backup:runNow', async (_e, id: string) => {
  const job = backups.list().find(j => j.id === id);
  if (!job) throw new Error('Backup job not found');
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const out = path.join(job.targetDir, `${job.label}-${ts}.zip`);
  const result = await backups.createOneshot(job.sourceDir, out);
  backups.enforceRetention(job);
  return { ok: true, path: result };
});
ipcMain.handle('backup:oneshot', async (_e, args: { sourceDir: string; outZipPath: string }) => {
  const p = await backups.createOneshot(args.sourceDir, args.outZipPath);
  return { ok: true, path: p };
});

// RCON / Shutdown IPC
ipcMain.handle('rcon:shutdownCountdown', async (_e, args: { host: string; port: number; password: string; totalSeconds?: number }) => {
  if (settings.get().offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to use RCON shutdown.');
  return shutdownService.startCountdown(args);
});

ipcMain.handle('rcon:wildDinoWipe', async (_e, args: { host: string; port: number; password: string }) => {
  if (settings.get().offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to use RCON.');
  const rcon = new (await import('./services/RconService.js')).RconService();
  await rcon.send(args.host, args.port, args.password, 'DestroyWildDinos');
  return { ok: true };
});
ipcMain.handle('rcon:ping', async (_e, args: { host: string; port: number; password: string }) => {
  if (settings.get().offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to use RCON.');
  const rcon = new (await import('./services/RconService.js')).RconService();
  try {
    await rcon.send(args.host, args.port, args.password, 'ListPlayers');
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
});
ipcMain.handle('rcon:exec', async (_e, args: { host: string; port: number; password: string; command: string }) => {
  if (settings.get().offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to use RCON.');
  const rcon = new (await import('./services/RconService.js')).RconService();
  const output = await rcon.send(args.host, args.port, args.password, args.command);
  return { ok: true, output };
});

ipcMain.handle(
  'mods:downloadOrUpdate',
  async (
    _e,
    args: {
      workspaceRoot: string;
      steamcmdDir: string;
      appId?: number;
      modIds: Array<string | number>;
      outDir: string;
    }
  ) => {
    const root = path.resolve(args.workspaceRoot);
    const steamDir = ensureInside(root, path.join(root, args.steamcmdDir));
    const outDir = ensureInside(root, path.join(root, args.outDir));
    if (settings.get().offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to download/update mods.');
    return mods.downloadOrUpdate({ steamcmdDir: steamDir, appId: args.appId ?? 2399830, modIds: args.modIds, outDir });
  }
);
// Basic Steam workshop mod info (size, file count) for hover preview
ipcMain.handle('mods:getSteamModInfo', (_e, args: { serverId: string; modId: string }) => {
  const state = profiles.list();
  const srv = state.servers.find(s => s.id === args.serverId);
  if (!srv) throw new Error('Server not found');
  const root = settings.get().workspaceRoot;
  const cachePath = path.join(root, 'steam-mod-info-cache.json');
  let cache: Record<string, { ts: number; exists: boolean; path: string; sizeBytes: number; fileCount: number }> = {};
  try {
    if (fs.existsSync(cachePath)) cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  } catch {}
  const key = `${args.serverId}:${args.modId}`;
  const now = Date.now();
  const ttlMs = 30 * 60 * 1000; // 30 minutes
  if (cache[key] && (now - cache[key].ts) < ttlMs) {
    const entry = cache[key];
    return { ok: true, modId: args.modId, exists: entry.exists, path: entry.path, sizeBytes: entry.sizeBytes, fileCount: entry.fileCount, cached: true };
  }
  const modsDir = path.join(srv.installDir, 'ShooterGame', 'Content', 'Mods');
  const targetDir = path.join(modsDir, args.modId);
  const exists = fs.existsSync(targetDir);
  let sizeBytes = 0;
  let fileCount = 0;
  if (exists) {
    const stack: string[] = [targetDir];
    while (stack.length) {
      const current = stack.pop()!;
      try {
        const entries = fs.readdirSync(current, { withFileTypes: true });
        for (const e of entries) {
          const full = path.join(current, e.name);
          if (e.isDirectory()) stack.push(full); else {
            fileCount++; try { sizeBytes += fs.statSync(full).size; } catch {}
          }
        }
      } catch {}
    }
  }
  cache[key] = { ts: now, exists, path: targetDir, sizeBytes, fileCount };
  try { fs.writeFileSync(cachePath, JSON.stringify(cache, null, 2)); } catch {}
  return { ok: true, modId: args.modId, exists, path: targetDir, sizeBytes, fileCount, cached: false };
});
