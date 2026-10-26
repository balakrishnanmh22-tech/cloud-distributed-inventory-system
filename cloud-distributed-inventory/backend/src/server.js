import app from './app.js';
import { connectDB, disconnectDB } from './config/database.js';
import { config } from './config/env.js';
import { PartitionRouter } from './services/partitionRouter.js';
import { seedDatabase } from './utils/seedData.js';

let server;

async function bootstrap() {
  try {
    console.log('----------------------------------------------------');
    console.log(' Cloud-Based Distributed Inventory Management System');
    console.log(' Academic Distributed Database Project');
    console.log('----------------------------------------------------');

    // 1. Connect to MongoDB
    await connectDB();

    // 2. Initialize warehouse partition collections & indexes
    await PartitionRouter.initPartitions();
    console.log('[Partitions] Horizontal warehouse partitions verified.');

    // 3. Auto-seed essential initial data if database is empty
    await seedDatabase({ quiet: true });

    // 4. Start HTTP Server
    server = app.listen(config.port, () => {
      console.log(`[Server] Backend listening on port ${config.port} (${config.nodeEnv})`);
      console.log(`[Server] Health check: http://localhost:${config.port}/api/health`);
    });

  } catch (error) {
    console.error('[Server] Fatal startup failure:', error);
    process.exit(1);
  }
}

// Graceful Shutdown Handlers (Kubernetes SIGTERM / Local Ctrl+C)
async function shutdown(signal) {
  console.log(`\n[Server] Received ${signal}. Initiating graceful shutdown...`);
  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed.');
      await disconnectDB();
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

process.on('uncaughtException', (err) => {
  console.error('[Server] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

bootstrap();
