import fs from 'node:fs';
import path from 'node:path';
import ini from 'ini';

export class IniService {
  constructor(private workspaceRoot: () => string, private serverRootsGetter?: () => { installDir: string }[]) {}

  private ensureInside(p: string, forWrite = false): string {
    const full = path.resolve(p);
    const root = path.resolve(this.workspaceRoot());
    const serverDirs = (this.serverRootsGetter ? this.serverRootsGetter().map(s=> path.resolve(s.installDir)) : []);
    const allowedRoots = [root, ...serverDirs];
    if (allowedRoots.some(r => full.startsWith(r))) return full;
    // Allow read-only access to .ini/.log under ShooterGame Saved paths even if outside workspace/server roots
    if (!forWrite && (/\.(ini|log)$/i.test(full) || /ShooterGame[\\\/]Saved[\\\/]/i.test(full))) return full;
    throw new Error('Path outside workspace root');
  }

  read(filePath: string): any {
    const full = this.ensureInside(filePath, false);
    if (!fs.existsSync(full)) return {};
    return ini.parse(fs.readFileSync(full, 'utf8'));
  }

  write(filePath: string, data: any) {
    const full = this.ensureInside(filePath, true);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, ini.stringify(data), 'utf8');
  }

  readText(filePath: string): string {
    const full = this.ensureInside(filePath, false);
    return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
  }

  writeText(filePath: string, content: string) {
    const full = this.ensureInside(filePath, true);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, 'utf8');
  }
}
