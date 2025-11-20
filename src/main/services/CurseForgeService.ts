import https from 'node:https';
import path from 'node:path';
import fs from 'node:fs';

export interface CurseForgeSearchOptions {
  query: string;
  pageSize?: number; // default 20
}

export interface CurseForgeModSummary {
  id: number;
  name: string;
  summary: string;
  downloadCount: number;
  thumbnailUrl?: string;
  latestFiles?: Array<{ displayName: string; fileId: number; fileDate: string; fileLength: number }>;
  cached?: boolean; // indicates served from local cache
}

export class CurseForgeService {
  constructor(private getApiKey: () => string | undefined, private getCacheDir: () => string) {}

  private apiRequest<T = any>(endpoint: string): Promise<T> {
    const key = this.getApiKey();
    if (!key) throw new Error('CurseForge API key not configured');
    const url = `https://api.curseforge.com${endpoint}`;
    return new Promise((resolve, reject) => {
      const req = https.request(url, { method: 'GET', headers: { 'X-Api-Key': key, 'Accept': 'application/json' } }, (res) => {
        if ((res.statusCode || 0) >= 400) {
          reject(new Error(`CurseForge HTTP ${res.statusCode}`));
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')) as T); } catch (e) { reject(e); }
        });
      });
      req.on('error', reject);
      req.end();
    });
  }

  async searchMods(opts: CurseForgeSearchOptions): Promise<CurseForgeModSummary[]> {
    const q = encodeURIComponent(opts.query);
    const pageSize = opts.pageSize ?? 20;
    // Ark Survival Ascended gameId might differ; placeholder using 1107 (Ark Survival Evolved). Adjust when confirmed.
    const gameId = 1107;
    const cacheHit = this.tryReadCache('search', q, 600_000); // 10 min TTL
    if (cacheHit) {
      return (cacheHit.value || []).map((m: any) => ({ ...m, cached: true }));
    }
    const data: any = await this.apiRequest(`/v1/mods/search?gameId=${gameId}&pageSize=${pageSize}&searchFilter=${q}`);
    const mods: CurseForgeModSummary[] = (data.data || []).map((m: any) => ({
      id: m.id,
      name: m.name,
      summary: m.summary,
      downloadCount: m.downloadCount ?? 0,
      thumbnailUrl: m.logo?.thumbnailUrl,
      latestFiles: (m.latestFiles || []).slice(0, 3).map((f: any) => ({ displayName: f.displayName, fileId: f.id, fileDate: f.fileDate, fileLength: f.fileLength }))
    }));
    this.cacheResult('search', q, mods);
    return mods;
  }

  async getModDetails(id: number): Promise<any> {
    const cacheHit = this.tryReadCache('details', String(id), 600_000);
    if (cacheHit) return { ...cacheHit.value, cached: true };
    const data: any = await this.apiRequest(`/v1/mods/${id}`);
    this.cacheResult('details', String(id), data);
    return data;
  }

  async getLatestFileMetadata(projectId: number): Promise<{ fileId: number; displayName: string; fileDate: string } | null> {
    try {
      const details = await this.getModDetails(projectId);
      const mod = details.data || details; // adapt to API envelope
      const latest = (mod.latestFiles || [])[0];
      if (!latest) return null;
      return { fileId: latest.id ?? latest.fileId, displayName: latest.displayName || latest.fileName || String(latest.id), fileDate: latest.fileDate };
    } catch {
      return null;
    }
  }

  async getFileDownloadUrl(projectId: number, fileId: number): Promise<string | null> {
    try {
      const data: any = await this.apiRequest(`/v1/mods/${projectId}/files/${fileId}/download-url`);
      return data.data || data.url || null;
    } catch {
      return null;
    }
  }

  private cacheResult(type: string, key: string, value: any) {
    try {
      const dir = path.join(this.getCacheDir(), 'curseforge-cache');
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, `${type}-${key}.json`);
      fs.writeFileSync(file, JSON.stringify({ ts: Date.now(), value }, null, 2));
    } catch {}
  }

  private tryReadCache(type: string, key: string, ttlMs: number): { ts: number; value: any } | undefined {
    try {
      const dir = path.join(this.getCacheDir(), 'curseforge-cache');
      const file = path.join(dir, `${type}-${key}.json`);
      if (!fs.existsSync(file)) return undefined;
      const data = JSON.parse(fs.readFileSync(file, 'utf8')) as { ts: number; value: any };
      if (Date.now() - data.ts > ttlMs) return undefined; // expired
      return data;
    } catch {
      return undefined;
    }
  }
}
