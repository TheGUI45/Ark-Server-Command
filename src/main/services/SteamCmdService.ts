import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { spawn } from 'node:child_process';
import extractZip from 'extract-zip';
import * as tar from 'tar';

export class SteamCmdService {
  private getArchiveUrl(): { url: string; type: 'zip' | 'targz'; exe: string } {
    if (process.platform === 'win32')
      return {
        url: 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd.zip',
        type: 'zip',
        exe: 'steamcmd.exe',
      };
    if (process.platform === 'darwin')
      return {
        url: 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd_osx.tar.gz',
        type: 'targz',
        exe: 'steamcmd.sh',
      };
    return {
      url: 'https://steamcdn-a.akamaihd.net/client/installer/steamcmd_linux.tar.gz',
      type: 'targz',
      exe: 'steamcmd.sh',
    };
  }

  async ensureSteamCmd(dir: string): Promise<{ path: string }> {
    fs.mkdirSync(dir, { recursive: true });
    const { url, type, exe } = this.getArchiveUrl();
    const exePath = path.join(dir, exe);
    if (fs.existsSync(exePath)) return { path: exePath };

    const tmp = path.join(dir, `steamcmd-download.${type === 'zip' ? 'zip' : 'tar.gz'}`);
    await download(url, tmp);
    if (type === 'zip') await extractZip(tmp, { dir: dir });
    else await tar.x({ file: tmp, cwd: dir });
    fs.unlinkSync(tmp);
    if (!fs.existsSync(exePath)) throw new Error('SteamCMD not found after extract');
    if (process.platform !== 'win32') fs.chmodSync(exePath, 0o755);
    return { path: exePath };
  }

  async installOrUpdateServer(args: {
    steamcmdDir: string;
    installDir: string;
    appId: number;
    validate?: boolean;
  }): Promise<{ ok: boolean; code: number | null }>
  {
    const { path: exe } = await this.ensureSteamCmd(args.steamcmdDir);
    fs.mkdirSync(args.installDir, { recursive: true });

    const cmd = process.platform === 'win32' ? exe : 'bash';
    const cmdArgs = process.platform === 'win32'
      ? ['+login', 'anonymous', '+force_install_dir', args.installDir, '+app_update', String(args.appId), ...(args.validate ? ['validate'] : []), '+quit']
      : [exe, '+login', 'anonymous', '+force_install_dir', args.installDir, '+app_update', String(args.appId), ...(args.validate ? ['validate'] : []), '+quit'];

    return new Promise((resolve) => {
      const p = spawn(cmd, cmdArgs, { cwd: path.dirname(exe), stdio: 'inherit' });
      p.on('close', (code) => resolve({ ok: code === 0, code }));
    });
  }
}

function download(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https
      .get(url, (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        res.pipe(file);
        file.on('finish', () => file.close(() => resolve()));
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err));
      });
  });
}
