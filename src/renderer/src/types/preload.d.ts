export {};

declare global {
  interface Window {
    api: {
      getAppVersion: () => Promise<string>;
      steamcmd: {
        ensure: (workspaceRoot: string, steamcmdDir: string) => Promise<{ path: string }>;
        installOrUpdate: (
          workspaceRoot: string,
          steamcmdDir: string,
          installDir: string,
          appId?: number,
          validate?: boolean
        ) => Promise<{ ok: boolean; code: number | null }>;
      };
      mods: {
        downloadOrUpdate: (
          workspaceRoot: string,
          steamcmdDir: string,
          modIds: Array<string | number>,
          outDir: string,
          appId?: number
        ) => Promise<{ ok: boolean; results: Array<{ id: string; ok: boolean; code: number | null }> }>;
      };
      backup: {
        list: () => Promise<Array<{ id: string; label: string; sourceDir: string; targetDir: string; scheduleCron?: string; retention?: number }>>;
        upsert: (job: { id: string; label: string; sourceDir: string; targetDir: string; scheduleCron?: string; retention?: number }) => Promise<{ id: string; label: string; sourceDir: string; targetDir: string; scheduleCron?: string; retention?: number }>;
        delete: (id: string) => Promise<boolean>;
        runNow: (id: string) => Promise<{ ok: boolean; path: string }>;
        oneshot: (sourceDir: string, outZipPath: string) => Promise<{ ok: boolean; path: string }>;
      };
      rcon: {
        shutdownCountdown: (host: string, port: number, password: string, totalSeconds?: number) => Promise<{ started: boolean; totalSeconds: number }>;
      };
      settings: {
        get: () => Promise<{ workspaceRoot: string; defaultWorkshopAppId: number; offlineMode: boolean }>;
        set: (partial: Partial<{ workspaceRoot: string; defaultWorkshopAppId: number; offlineMode: boolean }>) => Promise<{ workspaceRoot: string; defaultWorkshopAppId: number; offlineMode: boolean }>;
      };
      dialogs: {
        chooseDirectory: () => Promise<string | null>;
      };
      profiles: {
        list: () => Promise<{ servers: any[]; clusters: any[] }>;
        upsertServer: (s: any) => Promise<any>;
        deleteServer: (id: string) => Promise<boolean>;
        upsertCluster: (c: any) => Promise<any>;
        deleteCluster: (id: string) => Promise<boolean>;
      };
      ini: {
        readText: (filePath: string) => Promise<string>;
        writeText: (filePath: string, content: string) => Promise<boolean>;
      };
    };
  }
}
