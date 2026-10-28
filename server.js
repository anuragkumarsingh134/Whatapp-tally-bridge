const app = require('./src/app');
const { getConfig } = require('./src/config');
const { serverLog } = require('./src/services/state');

process.on('uncaughtException', (err) => serverLog('[CRASH PREVENTED] ' + err.message, 'error'));
process.on('unhandledRejection', () => serverLog('[CRASH PREVENTED] Unhandled Rejection', 'error'));

const config = getConfig();
const PORT = process.env.PORT || config.port || 5555;

const server = app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(` 🚀 WhatsApp Bridge Engine Running on Port ${PORT}`);
  console.log(` 🌐 Web Dashboard: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
  serverLog(`WhatsApp Bridge initialized on port ${PORT}`);
  if (process.send) process.send({ type: 'ready' });
});

process.on('message', (msg) => {
  if (msg && msg.type === 'getMemory') {
    const mem = process.memoryUsage();
    if (process.send) {
      process.send({ type: 'status', memoryUsage: Math.round(mem.rss / 1024 / 1024) });
    }
  }
});

process.on('SIGTERM', () => {
  server.close(() => process.exit(0));
});

process.stdin.resume();
