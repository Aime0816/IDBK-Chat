import path from 'node:path';
import fs from 'node:fs/promises';
import net from 'node:net';
export const storageRoot = path.resolve(process.env.UPLOAD_DIR || 'data/uploads');
export async function saveFile(id: string, buffer: Buffer) {
  await fs.mkdir(storageRoot, { recursive: true, mode: 0o700 });
  await fs.writeFile(path.join(storageRoot, id), buffer, { mode: 0o600 });
}
export async function scanFile(buffer: Buffer) {
  // Fail closed. Development can explicitly opt out for trusted synthetic files only.
  if (!process.env.CLAMAV_HOST) {
    if (process.env.NODE_ENV !== 'production' && process.env.DEV_ALLOW_UNSCANNED === 'true') return;
    throw new Error('File scanning is unavailable. Configure ClamAV.');
  }
  await new Promise<void>((resolve, reject) => {
    const socket = net.connect(Number(process.env.CLAMAV_PORT || 3310), process.env.CLAMAV_HOST);
    let result = '';
    socket.setTimeout(30000, () => socket.destroy(new Error('Scanner timed out')));
    socket.on('error', reject);
    socket.on('connect', () => {
      socket.write('zINSTREAM\0');
      for (let offset = 0; offset < buffer.length; offset += 65536) {
        const chunk = buffer.subarray(offset, offset + 65536);
        const n = Buffer.alloc(4);
        n.writeUInt32BE(chunk.length);
        socket.write(n);
        socket.write(chunk);
      }
      socket.write(Buffer.alloc(4));
    });
    socket.on('data', (d) => (result += d.toString()));
    socket.on('end', () => {
      if (result.includes('stream: OK')) resolve();
      else reject(new Error('File rejected by scanner'));
    });
  });
}
