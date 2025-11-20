import net from 'node:net';

// Minimal Source RCON client sufficient for ASA (auth, exec, no streaming aggregation)
const SERVERDATA_AUTH = 3;
const SERVERDATA_AUTH_RESPONSE = 2;
const SERVERDATA_EXECCOMMAND = 2;
const SERVERDATA_RESPONSE_VALUE = 0;

function packPacket(id: number, type: number, body: string): Buffer {
  const bodyBuf = Buffer.from(body, 'utf8');
  const len = 4 + 4 + bodyBuf.length + 2; // id + type + body + 2 nulls
  const buf = Buffer.alloc(4 + len);
  buf.writeInt32LE(len, 0);
  buf.writeInt32LE(id, 4);
  buf.writeInt32LE(type, 8);
  bodyBuf.copy(buf, 12);
  buf.writeInt16LE(0, 12 + bodyBuf.length);
  return buf;
}

export class RconService {
  async send(host: string, port: number, password: string, command: string, timeoutMs = 3000): Promise<string> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let resolved = false;
      let idCounter = 1;

      const cleanup = (err?: any) => {
        try { socket.destroy(); } catch {}
        if (!resolved) {
          resolved = true;
          err ? reject(err) : resolve('');
        }
      };

      const onData = (data: Buffer) => {
        // We don't strictly parse all packets; resolve on first response
        // as we don't need output for Broadcast/SaveWorld/DoExit.
        if (resolved) return;
        resolved = true;
        resolve(data.toString('utf8'));
        setTimeout(() => socket.destroy(), 10);
      };

      socket.on('error', cleanup);
      socket.on('close', () => cleanup());
      socket.on('data', onData);

      socket.connect(port, host, () => {
        // auth first
        socket.write(packPacket(idCounter++, SERVERDATA_AUTH, password));
        // slight delay then send command
        setTimeout(() => {
          socket.write(packPacket(idCounter++, SERVERDATA_EXECCOMMAND, command));
        }, 100);
      });

      setTimeout(() => cleanup(new Error('RCON timeout')), timeoutMs);
    });
  }
}
