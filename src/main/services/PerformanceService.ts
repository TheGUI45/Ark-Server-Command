import { exec } from 'node:child_process';
import pidusage from 'pidusage';
import os from 'node:os';

export interface ProcessUsage { pid: number; cpu: number; memoryMB: number; command?: string }
export interface ServerPerformanceSnapshot {
  serverId: string;
  timestamp: string;
  processes: ProcessUsage[];
  totalCpu: number;
  totalMemoryMB: number;
  systemCpuCount: number;
  systemTotalMemoryMB: number;
  note?: string;
}

interface ServerLike { id: string; installDir: string; name?: string }

export class PerformanceService {
  constructor(private serversGetter: () => ServerLike[]) {}

  async getServerUsage(serverId: string): Promise<ServerPerformanceSnapshot> {
    const server = this.serversGetter().find(s => s.id === serverId);
    const ts = new Date().toISOString();
    const systemTotalMemoryMB = os.totalmem() / (1024 * 1024);
    if (!server) {
      return { serverId, timestamp: ts, processes: [], totalCpu: 0, totalMemoryMB: 0, systemCpuCount: os.cpus().length, systemTotalMemoryMB, note: 'Server not found' };
    }

    if (process.platform !== 'win32') {
      return { serverId, timestamp: ts, processes: [], totalCpu: 0, totalMemoryMB: 0, systemCpuCount: os.cpus().length, systemTotalMemoryMB, note: 'Only Windows supported currently' };
    }

    const pids = await this.queryShooterGameServerPids();
    if (pids.length === 0) {
      return { serverId, timestamp: ts, processes: [], totalCpu: 0, totalMemoryMB: 0, systemCpuCount: os.cpus().length, systemTotalMemoryMB, note: 'No ShooterGameServer.exe processes found' };
    }

    const usages: ProcessUsage[] = [];
    for (const pid of pids) {
      try {
        const stat = await pidusage(pid);
        usages.push({ pid, cpu: stat.cpu, memoryMB: stat.memory / (1024 * 1024) });
      } catch {}
    }

    const totalCpu = usages.reduce((a,b)=>a+b.cpu,0);
    const totalMemoryMB = usages.reduce((a,b)=>a+b.memoryMB,0);

    return { serverId, timestamp: ts, processes: usages, totalCpu, totalMemoryMB, systemCpuCount: os.cpus().length, systemTotalMemoryMB };
  }

  private async queryShooterGameServerPids(): Promise<number[]> {
    return new Promise(resolve => {
      exec('tasklist /FI "IMAGENAME eq ShooterGameServer.exe" /FO CSV', (err, stdout) => {
        if (err) return resolve([]);
        const lines = stdout.split(/\r?\n/).filter(l => l && !l.startsWith('"Image Name"'));
        const pids: number[] = [];
        for (const l of lines) {
          const parts = l.split('","').map(s=>s.replace(/"/g,''));
          if (parts.length >= 2) {
            const pid = Number(parts[1]);
            if (pid) pids.push(pid);
          }
        }
        resolve(pids);
      });
    });
  }
}