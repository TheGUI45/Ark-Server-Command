import { contextBridge, ipcRenderer } from 'electron';
try {
  console.log('[preload] executing preload script');
} catch {}

const steamcmd = {
  ensure: (workspaceRoot: string, steamcmdDir: string) =>
    ipcRenderer.invoke('steamcmd:ensure', { workspaceRoot, steamcmdDir }),
  installOrUpdate: (
    workspaceRoot: string,
    steamcmdDir: string,
    installDir: string,
    appId = 2430930,
    validate = true
  ) =>
    ipcRenderer.invoke('steamcmd:installOrUpdate', {
      workspaceRoot,
      steamcmdDir,
      installDir,
      appId,
      validate,
    }),
};

const mods = {
  downloadOrUpdate: (
    workspaceRoot: string,
    steamcmdDir: string,
    modIds: Array<string | number>,
    outDir: string,
    appId = 2399830
  ) =>
    ipcRenderer.invoke('mods:downloadOrUpdate', {
      workspaceRoot,
      steamcmdDir,
      appId,
      modIds,
      outDir,
    }),
};

const backup = {
  list: () => ipcRenderer.invoke('backup:list'),
  upsert: (job: any) => ipcRenderer.invoke('backup:upsert', job),
  delete: (id: string) => ipcRenderer.invoke('backup:delete', id),
  runNow: (id: string) => ipcRenderer.invoke('backup:runNow', id),
  oneshot: (sourceDir: string, outZipPath: string) => ipcRenderer.invoke('backup:oneshot', { sourceDir, outZipPath }),
};

const rcon = {
  shutdownCountdown: (host: string, port: number, password: string, totalSeconds = 600) =>
    ipcRenderer.invoke('rcon:shutdownCountdown', { host, port, password, totalSeconds }),
  wildDinoWipe: (host: string, port: number, password: string) =>
    ipcRenderer.invoke('rcon:wildDinoWipe', { host, port, password })
  ,ping: (host: string, port: number, password: string) =>
    ipcRenderer.invoke('rcon:ping', { host, port, password })
  ,exec: (host: string, port: number, password: string, command: string) =>
    ipcRenderer.invoke('rcon:exec', { host, port, password, command })
};

let preloadError: string | null = null;
try {
  // nothing special yet, but wrap creation in try so missing modules don't kill bridge silently
} catch (e: any) {
  preloadError = 'Preload init failed: ' + String(e?.message || e);
}

const api = {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  bridge: { ping: () => ipcRenderer.invoke('bridge:ping') },
  ping: () => 'ok',
  preloadStatus: () => ({ error: preloadError }),
  token: {
    get: () => ipcRenderer.invoke('token:get'),
    set: (token: string) => ipcRenderer.invoke('token:set', token),
    clear: () => ipcRenderer.invoke('token:clear')
  },
  webapi: {
    get: (path: string) => ipcRenderer.invoke('webapi:get', path),
    post: (path: string, body: any) => ipcRenderer.invoke('webapi:post', { path, body })
    ,put: (path: string, body: any) => ipcRenderer.invoke('webapi:put', { path, body })
    ,delete: (path: string) => ipcRenderer.invoke('webapi:delete', path)
    ,history: () => ipcRenderer.invoke('webapi:history')
  },
  analytics: {
    get: () => ipcRenderer.invoke('analytics:get'),
  },
  steamcmd,
  mods,
  curseforge: {
    searchMods: (query: string, pageSize?: number) => ipcRenderer.invoke('curseforge:searchMods', { query, pageSize }),
    getModDetails: (id: number) => ipcRenderer.invoke('curseforge:getModDetails', id),
  },
  backup,
  rcon,
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    set: (partial: any) => ipcRenderer.invoke('settings:set', partial),
    getOfflineMode: () => ipcRenderer.invoke('settings:getOfflineMode'),
    setOfflineMode: (offline: boolean) => ipcRenderer.invoke('settings:setOfflineMode', offline),
    onOfflineChanged: (cb: (offline: boolean) => void) => {
      const handler = (_e: any, args: { offlineMode: boolean }) => cb(!!args.offlineMode);
      ipcRenderer.on('settings:offlineChanged', handler);
      return () => ipcRenderer.removeListener('settings:offlineChanged', handler);
    }
  },
  dialogs: {
    chooseDirectory: () => ipcRenderer.invoke('dialog:chooseDirectory'),
  },
  profiles: {
    list: () => ipcRenderer.invoke('profiles:list'),
    upsertServer: (s: any) => ipcRenderer.invoke('profiles:upsertServer', s),
    deleteServer: (id: string) => ipcRenderer.invoke('profiles:deleteServer', id),
    upsertCluster: (c: any) => ipcRenderer.invoke('profiles:upsertCluster', c),
    deleteCluster: (id: string) => ipcRenderer.invoke('profiles:deleteCluster', id),
    updateCurseForgeMods: (serverId: string, mods: { projectId: number; fileId: number; displayName?: string }[]) => ipcRenderer.invoke('profiles:updateCurseForgeMods', { serverId, mods })
    ,reorderMod: (serverId: string, modId: string, direction: 'up'|'down'|'top') => ipcRenderer.invoke('profiles:reorderMod', { serverId, modId, direction })
    ,deleteMod: (serverId: string, modId: string) => ipcRenderer.invoke('profiles:deleteMod', { serverId, modId })
    ,setOrderedMods: (serverId: string, ordered: any[]) => ipcRenderer.invoke('profiles:setOrderedMods', { serverId, ordered })
    ,toggleAllMods: (serverId: string, enabled: boolean) => ipcRenderer.invoke('profiles:toggleAllMods', { serverId, enabled })
    ,setIniOverrides: (serverId: string, overrides: any[]) => ipcRenderer.invoke('profiles:setIniOverrides', { serverId, overrides })
    ,applyAdminPassword: (serverId: string) => ipcRenderer.invoke('profiles:applyAdminPassword', serverId)
  },
  maintenance: {
    cleanModsFolder: (serverId: string) => ipcRenderer.invoke('mods:cleanFolder', { serverId })
  },
  ini: {
    readText: (filePath: string) => ipcRenderer.invoke('ini:readText', filePath),
    writeText: (filePath: string, content: string) => ipcRenderer.invoke('ini:writeText', filePath, content),
    applyOverrides: (serverId: string) => ipcRenderer.invoke('ini:applyOverrides', serverId)
  },
  reports: {
    get: (serverId: string) => ipcRenderer.invoke('reports:get', serverId)
  },
  perf: {
    getServerUsage: (serverId: string) => ipcRenderer.invoke('perf:getServerUsage', serverId)
  },
  server: {
    update: (serverId: string, steamcmdDir: string, validate = false) => ipcRenderer.invoke('server:update', { serverId, steamcmdDir, validate })
  },
  autoupdate: {
    toggle: (enabled: boolean) => ipcRenderer.invoke('autoupdate:toggle', enabled)
  },
  saves: {
    cleanup: (serverId: string) => ipcRenderer.invoke('saves:cleanup', serverId)
  }
};

export type PreloadApi = typeof api;

declare global {
  interface Window {
    api: PreloadApi;
  }
}

try {
  contextBridge.exposeInMainWorld('api', api);
} catch (e: any) {
  // final fallback
  (window as any).api = { preloadStatus: () => ({ error: 'ContextBridge failed: ' + String(e?.message || e) }) };
}
