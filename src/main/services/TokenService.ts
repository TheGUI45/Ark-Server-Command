import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

/**
 * TokenService stores a sensitive Web API token in a separate file under the userData directory
 * rather than embedding it inside the general settings.json. This is NOT strong encryption, but
 * reduces accidental exposure in settings backups and source control.
 *
 * Future enhancement: replace with OS credential vault (e.g. keytar) or DPAPI encryption.
 */
export class TokenService {
  private filePath: string;

  constructor() {
    const dir = app.getPath('userData');
    this.filePath = path.join(dir, 'web-api-token.secret');
  }

  get(): string | undefined {
    try {
      if (!fs.existsSync(this.filePath)) return undefined;
      const raw = fs.readFileSync(this.filePath, 'utf8');
      return raw.trim() || undefined;
    } catch {
      return undefined;
    }
  }

  set(token: string): boolean {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(this.filePath, token, { encoding: 'utf8' });
      // Attempt to restrict permissions on POSIX systems.
      try { fs.chmodSync(this.filePath, 0o600); } catch {}
      return true;
    } catch {
      return false;
    }
  }

  clear(): boolean {
    try {
      if (fs.existsSync(this.filePath)) fs.unlinkSync(this.filePath);
      return true;
    } catch {
      return false;
    }
  }
}
