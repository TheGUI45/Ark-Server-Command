import fs from 'node:fs';
import path from 'node:path';

export type AnalyticsMetrics = {
  backupJobCount: number;
  totalBackupsZipCount: number;
  estimatedBackupsSizeMB: number;
  modIdsTracked: number;
  lastBackupAgeMinutes: number | null;
  offlineMode: boolean;
};

export class AnalyticsService {
  constructor(
    private getBackupJobs: () => Array<any>,
    private getSettings: () => { workspaceRoot: string; offlineMode: boolean }
  ) {}

  getMetrics(): AnalyticsMetrics {
    const settings = this.getSettings();
    const jobs = this.getBackupJobs();
    let zipCount = 0;
    let sizeBytes = 0;
    let lastBackupMtime: number | null = null;

    for (const job of jobs) {
      try {
        if (fs.existsSync(job.targetDir)) {
          const entries = fs.readdirSync(job.targetDir).filter(f => f.toLowerCase().endsWith('.zip'));
          zipCount += entries.length;
          for (const f of entries) {
            const full = path.join(job.targetDir, f);
            const st = fs.statSync(full);
            sizeBytes += st.size;
            const mt = st.mtimeMs;
            if (!lastBackupMtime || mt > lastBackupMtime) lastBackupMtime = mt;
          }
        }
      } catch { /* ignore */ }
    }

    const minutesSince = lastBackupMtime ? Math.round((Date.now() - lastBackupMtime) / 60000) : null;

    // Placeholder for mods tracked (will evolve when marketplace integration present)
    const modIdsTracked = 0;

    return {
      backupJobCount: jobs.length,
      totalBackupsZipCount: zipCount,
      estimatedBackupsSizeMB: +(sizeBytes / (1024 * 1024)).toFixed(2),
      modIdsTracked,
      lastBackupAgeMinutes: minutesSince,
      offlineMode: settings.offlineMode,
    };
  }
}
