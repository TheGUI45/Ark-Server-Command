import fs from 'node:fs';
import path from 'node:path';
import archiver from 'archiver';
import cron from 'node-cron';
import { app } from 'electron';

export type BackupJob = {
  id: string;
  label: string;
  sourceDir: string; // absolute, validated path
  targetDir: string; // absolute, validated path
  scheduleCron?: string; // e.g. '0 3 * * *'
  retention?: number; // number of most-recent archives to keep
};

export class BackupService {
  // Using any for scheduled task due to simplified module declaration
  private jobs = new Map<string, any>();
  private filePath: string;

  constructor(private getWorkspaceRoot: () => string) {
    this.filePath = path.join(app.getPath('userData'), 'backups.json');
  }

  private safe(p: string): string {
    const root = path.resolve(this.getWorkspaceRoot());
    const full = path.resolve(p);
    if (!full.startsWith(root)) throw new Error('Path outside workspace root');
    return full;
  }

  async createOneshot(sourceDir: string, outZipPath: string): Promise<string> {
    sourceDir = this.safe(sourceDir);
    outZipPath = this.safe(outZipPath);
    fs.mkdirSync(path.dirname(outZipPath), { recursive: true });

    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outZipPath);
      const archive = archiver('zip', { zlib: { level: 9 } });
      output.on('close', () => resolve(outZipPath));
      archive.on('error', (err: any) => reject(err));
      archive.pipe(output);
      archive.directory(sourceDir, false);
      archive.finalize();
    });
  }

  list(): BackupJob[] {
    try {
      if (!fs.existsSync(this.filePath)) return [];
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as BackupJob[];
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  private save(all: BackupJob[]) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(all, null, 2), 'utf8');
  }

  upsert(job: BackupJob) {
    // validate paths now
    this.safe(job.sourceDir);
    this.safe(job.targetDir);

    const all = this.list();
    const i = all.findIndex((j) => j.id === job.id);
    if (i >= 0) all[i] = job; else all.push(job);
    this.save(all);
    this.schedule(job);
    return job;
  }

  remove(id: string) {
    const all = this.list().filter((j) => j.id !== id);
    this.save(all);
    this.unschedule(id);
  }

  schedule(job: BackupJob) {
    this.unschedule(job.id);
    if (!job.scheduleCron) return;
    const task = cron.schedule(job.scheduleCron, async () => {
      try {
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        const zip = path.join(this.safe(job.targetDir), `${job.label}-${ts}.zip`);
        await this.createOneshot(job.sourceDir, zip);
        this.enforceRetention(job);
      } catch {
        // swallow errors; could add logging later
      }
    });
    this.jobs.set(job.id, task);
  }

  unschedule(id: string) {
    this.jobs.get(id)?.stop();
    this.jobs.delete(id);
  }

  enforceRetention(job: BackupJob) {
    if (!job.retention || job.retention < 1) return;
    const dir = this.safe(job.targetDir);
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.zip'))
      .map((f) => ({ f, t: fs.statSync(path.join(dir, f)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    const toDelete = files.slice(job.retention);
    for (const d of toDelete) {
      try { fs.unlinkSync(path.join(dir, d.f)); } catch { /* ignore */ }
    }
  }

  rescheduleAll() {
    for (const id of Array.from(this.jobs.keys())) this.unschedule(id);
    for (const j of this.list()) this.schedule(j);
  }
}
