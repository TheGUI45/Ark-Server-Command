import { RconService } from './RconService.js';

export type ShutdownConfig = {
  host: string;
  port: number;
  password: string;
  totalSeconds?: number; // default 600
};

export class ShutdownService {
  private rcon = new RconService();

  async startCountdown(cfg: ShutdownConfig) {
    const total = Math.max(10, cfg.totalSeconds ?? 600);

    const announce = async (msg: string) => {
      try { await this.rcon.send(cfg.host, cfg.port, cfg.password, `Broadcast ${msg}`); } catch {}
    };
    const exec = async (cmd: string) => {
      try { await this.rcon.send(cfg.host, cfg.port, cfg.password, cmd); } catch {}
    };

    const schedule = (at: number, fn: () => void) => setTimeout(fn, Math.max(0, (total - at) * 1000));

    // Milestones in seconds remaining
    const milestones = [600, 300, 120, 60, 30, 10, 5, 4, 3, 2, 1].filter((s) => s < total);
    for (const s of milestones) {
      schedule(s, () => announce(`Server shutdown in ${s} seconds.`));
    }

    // Save world at 10 seconds remaining (if enough time)
    if (total > 12) schedule(10, () => exec('SaveWorld'));

    // Final message and exit at 0
    schedule(0, async () => {
      await announce('Saving and shutting down now...');
      await exec('SaveWorld');
      await exec('DoExit');
    });

    // Immediate notice
    await announce(`Server shutdown scheduled in ${total} seconds.`);

    return { started: true, totalSeconds: total };
  }
}
