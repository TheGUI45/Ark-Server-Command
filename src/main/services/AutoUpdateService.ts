import cron from 'node-cron';
import path from 'node:path';
import fs from 'node:fs';
import https from 'node:https';

interface ServerLike { id: string; installDir: string; name?: string; curseforgeMods?: { projectId: number; fileId: number; displayName?: string }[]; customIniOverrides?: { id: string; target: string; content: string; enabled: boolean }[] }
interface SettingsLike { workspaceRoot: string; autoUpdateEnabled: boolean; autoUpdateCron: string; offlineMode: boolean; defaultWorkshopAppId: number; saveCleanupEnabled?: boolean; saveCleanupCron?: string; saveCleanupRetentionDays?: number; saveCleanupMaxWorldFiles?: number }
interface SteamUpdateArgs { steamcmdDir: string; installDir: string; appId: number; validate?: boolean }
interface ModUpdateArgs { steamcmdDir: string; appId: number; modIds: Array<string|number>; outDir: string }

export class AutoUpdateService {
  private task: any | null = null; // relaxed typing to avoid dependency on cron's exported types
  constructor(
    private settingsGetter: () => SettingsLike,
    private serversGetter: () => ServerLike[],
    private steamUpdate: (args: SteamUpdateArgs) => Promise<any>,
    private modUpdate: (args: ModUpdateArgs) => Promise<any>,
    private readIniText: (iniPath: string) => string,
    private curseforge: {
      getLatestFileMetadata: (projectId: number) => Promise<{ fileId: number; displayName: string; fileDate: string } | null>;
      getFileDownloadUrl: (projectId: number, fileId: number) => Promise<string | null>;
    },
    private saveCleanup?: (serverId: string) => Promise<any> | any,
    private applyIniOverrides?: (server: ServerLike) => Promise<void> | void
  ) {}

  start() {
    this.stop();
    const settings = this.settingsGetter();
    if (!settings.autoUpdateEnabled) return;
    const cronExpr = settings.autoUpdateCron || '0 * * * *';
    this.task = cron.schedule(cronExpr, () => this.runCycle());
    this.task.start();
    // schedule separate save cleanup if distinct cron specified
    if (settings.saveCleanupEnabled && settings.saveCleanupCron && settings.saveCleanupCron !== cronExpr && this.saveCleanup) {
      cron.schedule(settings.saveCleanupCron, () => this.runSaveCleanupCycle()).start();
    }
  }

  stop() {
    if (this.task) { this.task.stop(); this.task = null; }
  }

  private async runCycle() {
    const settings = this.settingsGetter();
    if (!settings.autoUpdateEnabled || settings.offlineMode) return;
    const servers = this.serversGetter();
    for (const s of servers) {
      try {
        // Steam server update
        await this.steamUpdate({ steamcmdDir: path.join(settings.workspaceRoot, 'steamcmd'), installDir: s.installDir, appId: 2430930, validate: false });
      } catch {}
      // CurseForge / Workshop mods autoupdate based on ActiveMods from GameUserSettings.ini
      try {
        const gusPath = path.join(s.installDir, 'ShooterGame', 'Saved', 'Config', 'WindowsServer', 'GameUserSettings.ini');
        const text = this.readIniText(gusPath);
        if (text) {
          const line = text.split(/\r?\n/).find(l => /^ActiveMods=/.test(l));
          if (line) {
            const modsStr = line.replace(/^ActiveMods=/,'').trim();
            const modIds = modsStr.split(',').map(m => m.trim()).filter(Boolean);
            if (modIds.length) {
              await this.modUpdate({ steamcmdDir: path.join(settings.workspaceRoot, 'steamcmd'), appId: settings.defaultWorkshopAppId, modIds, outDir: path.join(s.installDir, 'Mods') });
            }
          }
        }
      } catch {}
      // CurseForge project auto-update using tracked profile metadata
      if (s.curseforgeMods?.length) {
        const cfDir = path.join(s.installDir, 'Mods', 'CurseForge');
        fs.mkdirSync(cfDir, { recursive: true });
        for (const m of s.curseforgeMods) {
          try {
            const latest = await this.curseforge.getLatestFileMetadata(m.projectId);
            if (!latest || latest.fileId === m.fileId) continue; // up to date or not retrievable
            const url = await this.curseforge.getFileDownloadUrl(m.projectId, latest.fileId);
            if (!url) continue;
            const outName = `${m.projectId}-${latest.fileId}.mod`;
            const outPath = path.join(cfDir, outName);
            await downloadFile(url, outPath);
            // retain previous file optionally - could implement cleanup
            m.fileId = latest.fileId;
            m.displayName = latest.displayName;
          } catch {}
        }
        // persist updated curseforgeMods back to profile storage (simple rewrite via server manifest file)
        try {
          const metaFile = path.join(cfDir, 'curseforge-mods.json');
          fs.writeFileSync(metaFile, JSON.stringify(s.curseforgeMods, null, 2));
        } catch {}
      }
      // Apply custom INI overrides if callback provided (best-effort, ignore errors)
      try { await this.applyIniOverrides?.(s); } catch {}
    }
    // optional save cleanup run piggybacking on auto-update cycle if enabled
    if (settings.saveCleanupEnabled && this.saveCleanup) {
      for (const s of servers) {
        try { await this.saveCleanup(s.id); } catch {}
      }
    }
  }

  private async runSaveCleanupCycle() {
    const settings = this.settingsGetter();
    if (!settings.saveCleanupEnabled || !this.saveCleanup) return;
    const servers = this.serversGetter();
    for (const s of servers) {
      try { await this.saveCleanup(s.id); } catch {}
    }
  }
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (res: any) => {
      if ((res.statusCode || 0) >= 400) { reject(new Error('HTTP ' + res.statusCode)); return; }
      res.pipe(file);
      file.on('finish', () => file.close(() => resolve()));
    }).on('error', (err: any) => { fs.unlink(dest, () => reject(err)); });
  });
}
