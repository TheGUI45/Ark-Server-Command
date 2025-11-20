import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export type AppSettings = {
  workspaceRoot: string;
  defaultWorkshopAppId: number; // e.g., 2399830 (ASA Workshop)
  offlineMode: boolean; // when true, block any network-dependent operations
  curseforgeApiKey?: string; // optional API key for CurseForge requests
  webApiBaseUrl?: string; // optional base URL for custom Web API
  autoUpdateEnabled: boolean; // enables scheduled server + mod updates
  autoUpdateCron: string; // cron expression controlling auto update frequency
  saveCleanupEnabled: boolean; // enables periodic pruning of old save files
  saveCleanupRetentionDays: number; // age threshold for non-world save file deletion
  saveCleanupMaxWorldFiles: number; // number of latest world .ark saves to always retain
  saveCleanupCron: string; // cron for save cleanup (can share with auto update if desired)
};

const DEFAULTS: AppSettings = {
  workspaceRoot: process.platform === 'win32' ? 'C:/ASAWorkspace' : '/tmp/asa-workspace',
  defaultWorkshopAppId: 2399830,
  offlineMode: true,
  curseforgeApiKey: undefined,
  webApiBaseUrl: '',
  autoUpdateEnabled: false,
  autoUpdateCron: '0 * * * *', // hourly by default
  saveCleanupEnabled: false,
  saveCleanupRetentionDays: 14,
  saveCleanupMaxWorldFiles: 5,
  saveCleanupCron: '30 2 * * *' // daily at 02:30 by default
};

export class SettingsService {
  private filePath: string;

  constructor() {
    const dir = app.getPath('userData');
    this.filePath = path.join(dir, 'settings.json');
  }

  get(): AppSettings {
    try {
      if (!fs.existsSync(this.filePath)) return { ...DEFAULTS };
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as Partial<AppSettings>;
      return { ...DEFAULTS, ...data };
    } catch {
      return { ...DEFAULTS };
    }
  }

  set(partial: Partial<AppSettings>): AppSettings {
    const merged = { ...this.get(), ...partial };
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(merged, null, 2), 'utf8');
    return merged;
  }
}
