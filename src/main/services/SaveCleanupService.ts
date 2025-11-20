import fs from 'fs';
import path from 'path';

export interface SaveCleanupResult {
  serverId: string;
  removedFiles: string[];
  keptFiles: string[];
  errors: string[];
  totalExamined: number;
}

export interface SaveCleanupSettings {
  retentionDays: number; // delete files older than this age (mtime)
  maxWorldFiles: number; // always keep newest N world save .ark files regardless of age
  enabled: boolean;
}

export interface ServerProfileLite {
  id: string;
  installDir: string;
}

export class SaveCleanupService {
  constructor(private getProfiles: () => ServerProfileLite[], private getSettings: () => SaveCleanupSettings) {}

  private getSavedDir(installDir: string) {
    return path.join(installDir, 'ShooterGame', 'Saved', 'SavedArksLocal');
  }

  cleanup(serverId: string): SaveCleanupResult {
    const settings = this.getSettings();
    const profile = this.getProfiles().find(p => p.id === serverId);
    const result: SaveCleanupResult = { serverId, removedFiles: [], keptFiles: [], errors: [], totalExamined: 0 };
    if (!profile) {
      result.errors.push('Server profile not found');
      return result;
    }
    const savedDir = this.getSavedDir(profile.installDir);
    if (!fs.existsSync(savedDir)) {
      result.errors.push('Saved directory does not exist');
      return result;
    }
    let files: string[] = [];
    try {
      files = fs.readdirSync(savedDir).map(f => path.join(savedDir, f));
    } catch (e: any) {
      result.errors.push('Failed reading saved directory: ' + e.message);
      return result;
    }
    const now = Date.now();
    const ageLimitMs = settings.retentionDays * 24 * 60 * 60 * 1000;
    const worldFiles = files.filter(f => f.endsWith('.ark') || f.endsWith('.arksave'));
    // Sort world files newest first by mtime
    worldFiles.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    const worldKeepSet = new Set(worldFiles.slice(0, settings.maxWorldFiles));
    files.forEach(f => {
      try {
        const stat = fs.statSync(f);
        result.totalExamined++;
        const ageMs = now - stat.mtimeMs;
        const ext = path.extname(f).toLowerCase();
        const isWorld = worldKeepSet.has(f);
        const isSaveType = ['.ark', '.arksave', '.arkprofile', '.arktribe', '.arktributetribe', '.arkplayer'].includes(ext);
        if (!isSaveType) {
          // skip unrelated files
          result.keptFiles.push(f);
          return;
        }
        if (isWorld) {
          result.keptFiles.push(f);
          return; // always keep newest world saves
        }
        if (ageMs > ageLimitMs) {
          try {
            fs.unlinkSync(f);
            result.removedFiles.push(f);
          } catch (e: any) {
            result.errors.push('Failed deleting ' + f + ': ' + e.message);
            result.keptFiles.push(f); // treat as kept on failure
          }
        } else {
          result.keptFiles.push(f);
        }
      } catch (e: any) {
        result.errors.push('Error processing file ' + f + ': ' + e.message);
      }
    });
    return result;
  }
}
