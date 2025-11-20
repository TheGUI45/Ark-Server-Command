import fs from 'node:fs';
import path from 'node:path';

export interface ServerReportEntry { ts?: string; line: string }
export interface ServerReportSummaries {
  crashCount: number;
  connectionCount: number;
  adminCommandCount: number;
  byHour: { hour: string; crashes: number; connections: number; admin: number }[];
}
export interface ServerReport {
  crashLogs: string[]; // legacy simple arrays kept for backwards compatibility
  playerConnections: string[];
  adminCommands: string[];
  entries: { crashes: ServerReportEntry[]; connections: ServerReportEntry[]; admins: ServerReportEntry[] };
  summaries: ServerReportSummaries;
}

interface ServerLike { id: string; installDir: string; name?: string }

export class ReportsService {
  constructor(private workspaceRootGetter: () => string, private serversGetter: () => ServerLike[]) {}

  private ensureInside(target: string) {
    const root = path.resolve(this.workspaceRootGetter());
    const resolved = path.resolve(target);
    if (!resolved.startsWith(root)) throw new Error('Path outside workspace root');
    return resolved;
  }

  private tailLines(filePath: string, maxLines = 300): string[] {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, 'utf8');
    const lines = raw.split(/\r?\n/).filter(Boolean);
    return lines.slice(-maxLines);
  }

  get(serverId: string): ServerReport {
    try {
      const server = this.serversGetter().find(s => s.id === serverId);
      if (!server) return this.empty();
      const installDir = this.ensureInside(server.installDir);
      const logsDir = path.join(installDir, 'ShooterGame', 'Saved', 'Logs');
      if (!fs.existsSync(logsDir)) return this.empty();

      // Primary log (sample name assumptions) ShooterGame.log / Server.log / CrashStackTrace.log etc.
      const logFiles = fs.readdirSync(logsDir).filter(f => /\.log$/i.test(f));
      const allLines: string[] = [];
      for (const f of logFiles.slice(-5)) { // limit scanned files
        const p = path.join(logsDir, f);
        this.tailLines(p, 800).forEach(l => allLines.push(`[${f}] ${l}`));
      }

      const crashRegex = /(fatal error|crash|assert failed|ensure failed)/i;
      const connectRegex = /(joining|login|connected|player connected|player join)/i;
      const adminRegex = /(cheat |admincommand|admin cmd|serveradmin)/i;

      // Extract timestamp and group lines
      const extractTs = (line: string): string | undefined => {
        const patterns: RegExp[] = [
          /\[(\d{4}\.\d{2}\.\d{2}-\d{2}\.\d{2}\.\d{2})/,
          /(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/,
          /\[(\d{2}:\d{2}:\d{2})\]/
        ];
        for (const r of patterns) {
          const m = line.match(r);
          if (m) {
            let raw = m[1];
            if (/^\d{4}\.\d{2}\.\d{2}-/.test(raw)) {
              // Convert 2025.11.19-12.34.56 -> 2025-11-19T12:34:56
              const parts = raw.replace(/\./g, ':').split('-');
              const datePart = parts[0];
              const timePart = parts[1].replace(/:/g, ':');
              const iso = datePart.replace(/\./g, '-') + 'T' + timePart;
              return iso;
            }
            if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.replace(' ', 'T');
            if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) {
              const today = new Date();
              const d = today.toISOString().slice(0,10);
              return d + 'T' + raw;
            }
            return raw;
          }
        }
        return undefined;
      };

      const crashes: ServerReportEntry[] = [];
      const connections: ServerReportEntry[] = [];
      const admins: ServerReportEntry[] = [];

      for (const line of allLines) {
        const ts = extractTs(line);
        if (crashRegex.test(line)) crashes.push({ ts, line });
        if (connectRegex.test(line)) connections.push({ ts, line });
        if (adminRegex.test(line)) admins.push({ ts, line });
      }

      const crashLogs = crashes.map(e=>e.line).slice(-200);
      const playerConnections = connections.map(e=>e.line).slice(-200);
      const adminCommands = admins.map(e=>e.line).slice(-200);

      // Group by hour
      const bucket: Record<string, { crashes: number; connections: number; admin: number }> = {};
      const addBucket = (type: 'crashes' | 'connections' | 'admin', ts?: string) => {
        if (!ts) return;
        const hourKey = ts.slice(0,13); // YYYY-MM-DDTHH
        if (!bucket[hourKey]) bucket[hourKey] = { crashes:0, connections:0, admin:0 };
        bucket[hourKey][type]++;
      };
      crashes.forEach(e=>addBucket('crashes', e.ts));
      connections.forEach(e=>addBucket('connections', e.ts));
      admins.forEach(e=>addBucket('admin', e.ts));

      const byHour = Object.entries(bucket)
        .sort((a,b)=> a[0] > b[0] ? 1 : -1)
        .map(([hour,v])=> ({ hour, crashes: v.crashes, connections: v.connections, admin: v.admin }))
        .slice(-48); // last 48 hours

      return {
        crashLogs, playerConnections, adminCommands,
        entries: { crashes, connections, admins },
        summaries: {
          crashCount: crashes.length,
          connectionCount: connections.length,
          adminCommandCount: admins.length,
          byHour
        }
      };
    } catch {
      return this.empty();
    }
  }

  private empty(): ServerReport {
    return {
      crashLogs: [], playerConnections: [], adminCommands: [],
      entries: { crashes: [], connections: [], admins: [] },
      summaries: { crashCount:0, connectionCount:0, adminCommandCount:0, byHour: [] }
    };
  }
}