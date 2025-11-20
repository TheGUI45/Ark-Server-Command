import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

export type DownloadModsArgs = {
  steamcmdDir: string;
  appId: number; // default ASA client app id; keep configurable
  modIds: Array<string | number>;
  outDir: string; // server Mods directory
};

export class ModService {
  constructor(private ensureSteamCmd: (dir: string) => Promise<{ path: string }>) {}

  async downloadOrUpdate(args: DownloadModsArgs): Promise<{ ok: boolean; results: Array<{ id: string; ok: boolean; code: number | null }> }> {
    fs.mkdirSync(args.outDir, { recursive: true });
    const { path: exe } = await this.ensureSteamCmd(args.steamcmdDir);

    const results: Array<{ id: string; ok: boolean; code: number | null }> = [];
    for (const raw of args.modIds) {
      const id = String(raw).trim();
      if (!id) continue;
      const cmd = process.platform === 'win32' ? exe : 'bash';
      const cmdArgs = process.platform === 'win32'
        ? ['+login', 'anonymous', '+workshop_download_item', String(args.appId), id, 'validate', '+quit']
        : [exe, '+login', 'anonymous', '+workshop_download_item', String(args.appId), id, 'validate', '+quit'];
      // Run steamcmd to fetch the mod
      const code = await new Promise<number | null>((resolve) => {
        const p = spawn(cmd, cmdArgs, { cwd: path.dirname(exe), stdio: 'inherit' });
        p.on('close', (c) => resolve(c));
      });

      // Copy downloaded files to server Mods folder
      try {
        const workshopPath = path.join(path.dirname(exe), 'steamapps', 'workshop', 'content', String(args.appId), id);
        if (fs.existsSync(workshopPath)) {
          const dest = path.join(args.outDir, id);
          copyDir(workshopPath, dest);
        }
      } catch { /* ignore copy failure; leave result by code */ }

      results.push({ id, ok: code === 0, code });
    }
    const allOk = results.every((r) => r.ok);
    return { ok: allOk, results };
  }
}

function copyDir(src: string, dest: string) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}
