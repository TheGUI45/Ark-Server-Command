import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export type ServerProfile = {
  id: string;
  name: string;
  installDir: string; // absolute path under workspace root
  appId: number; // ASA dedicated server: 2430930 by default
  map: string;
  mods: Array<string | number>;
  clusterId?: string;
  curseforgeMods?: { projectId: number; fileId: number; displayName?: string }[]; // tracked CF mods for auto-update
  orderedMods?: {
    id: string; // steam workshop id or cf:projectId
    type: 'steam' | 'curseforge';
    displayName?: string;
    projectId?: number; // curseforge project
    fileId?: number; // latest file id for CF
    author?: string;
    link?: string;
    enabled?: boolean; // whether mod active
  }[]; // preserves explicit ordering and metadata
  customIniOverrides?: {
    id: string; // stable uuid for tracking / replacement
    target: string; // target INI filename e.g. Game.ini / GameUserSettings.ini / Engine.ini
    content: string; // raw text lines to append (without markers)
    enabled: boolean; // include when applying
  }[]; // per-server custom override blocks appended to target INI
  // Connection / RCON settings (optional). Persisted so panels can prefill values.
  rconHost?: string; // IP or hostname for RCON/game server
  rconPort?: number; // RCON port (default 27020)
  rconPassword?: string; // Stored in plaintext currently (consider encryption later)
  adminPassword?: string; // Server admin password (used for in-game admin login / ServerAdminPassword INI)
};

export type Cluster = {
  id: string;
  name: string;
};

export type ProfilesState = {
  servers: ServerProfile[];
  clusters: Cluster[];
};

const EMPTY: ProfilesState = { servers: [], clusters: [] };

export class ProfilesService {
  private filePath: string;
  constructor() {
    const dir = app.getPath('userData');
    this.filePath = path.join(dir, 'profiles.json');
  }

  private load(): ProfilesState {
    if (!fs.existsSync(this.filePath)) return { ...EMPTY };
    try {
      const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8')) as ProfilesState;
      const servers: ServerProfile[] = (data.servers ?? []).map((s: any) => {
        // Backward compatibility: if orderedMods missing, derive from mods array
        if (!s.orderedMods || s.orderedMods.length === 0) {
          const derived = (s.mods || []).map((m: string | number) => {
            const isCf = typeof m === 'string' && m.startsWith('cf:');
            const idStr = String(m);
            return {
              id: idStr,
              type: isCf ? 'curseforge' : 'steam',
              displayName: idStr,
              enabled: true,
            };
          });
          s = { ...s, orderedMods: derived };
        }
        // Backward compatibility: ensure customIniOverrides array present
        if (!Array.isArray(s.customIniOverrides)) s.customIniOverrides = [];
        // Backward compatibility: ensure connection fields present (no transformation needed)
        if (typeof s.rconHost !== 'string') s.rconHost = '';
        if (typeof s.rconPort !== 'number') s.rconPort = 27020;
        if (typeof s.rconPassword !== 'string') s.rconPassword = '';
        if (typeof s.adminPassword !== 'string') s.adminPassword = '';
        return s as ServerProfile;
      });
      return { servers, clusters: data.clusters ?? [] };
    } catch {
      return { ...EMPTY };
    }
  }

  private save(state: ProfilesState) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.writeFileSync(this.filePath, JSON.stringify(state, null, 2), 'utf8');
  }

  list() { return this.load(); }

  upsertServer(s: ServerProfile) {
    const state = this.load();
    const idx = state.servers.findIndex((x) => x.id === s.id);
    if (idx >= 0) state.servers[idx] = s; else state.servers.push(s);
    this.save(state);
    return s;
  }

  deleteServer(id: string) {
    const state = this.load();
    state.servers = state.servers.filter((s) => s.id !== id);
    this.save(state);
  }

  upsertCluster(c: Cluster) {
    const state = this.load();
    const idx = state.clusters.findIndex((x) => x.id === c.id);
    if (idx >= 0) state.clusters[idx] = c; else state.clusters.push(c);
    this.save(state);
    return c;
  }

  deleteCluster(id: string) {
    const state = this.load();
    state.clusters = state.clusters.filter((c) => c.id !== id);
    // also clear references
    state.servers = state.servers.map((s) => (s.clusterId === id ? { ...s, clusterId: undefined } : s));
    this.save(state);
  }
}
