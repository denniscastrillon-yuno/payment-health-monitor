import { buildApp } from './app';
import { config } from './config';
import { closeDatabase } from './infrastructure/database';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({ port: config.PORT, host: config.HOST });
    console.log(`Payment Health Monitor running on http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    app.log.error(err);
    closeDatabase();
    process.exit(1);
  }

  const shutdown = async () => {
    console.log('\nShutting down...');
    await app.close();
    closeDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main();
