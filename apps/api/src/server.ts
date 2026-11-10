import { createServer } from 'node:http';
import { app } from './app.js';
import { db } from './infrastructure/database.js';
import { sockets } from './realtime/socket.js';
import { startWorker } from './jobs/worker.js';
if (
  process.env.NODE_ENV === 'production' &&
  (!process.env.SMTP_HOST ||
    !process.env.CLAMAV_HOST ||
    process.env.COOKIE_SECURE !== 'true' ||
    !process.env.APP_ORIGIN?.startsWith('https://'))
)
  throw new Error(
    'Production requires SMTP_HOST, CLAMAV_HOST, COOKIE_SECURE=true and an HTTPS APP_ORIGIN',
  );
const server = createServer(app);
const io = sockets(server);
const stop = startWorker(io);
server.listen(Number(process.env.PORT || 3000), '0.0.0.0', () =>
  console.log('IDBK Chat listening on port ' + (process.env.PORT || 3000)),
);
async function shutdown() {
  stop();
  io.close();
  server.close();
  await db.destroy();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
