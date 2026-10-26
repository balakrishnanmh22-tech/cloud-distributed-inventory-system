import app from '../backend/src/app.js';
import { connectDB } from '../backend/src/config/database.js';
import { PartitionRouter } from '../backend/src/services/partitionRouter.js';
import { seedDatabase } from '../backend/src/utils/seedData.js';
import mongoose from 'mongoose';

let isInitialized = false;
let initPromise = null;

async function ensureDB() {
  if (isInitialized) return;
  if (!initPromise) {
    initPromise = (async () => {
      try {
        const conn = await connectDB();
        if (conn && mongoose.connection.readyState === 1) {
          await PartitionRouter.initPartitions().catch(() => {});
          await seedDatabase({ quiet: true }).catch(() => {});
        }
        isInitialized = true;
      } catch (err) {
        console.warn('[Vercel Serverless] DB init notice:', err.message);
      }
    })();
  }
  return initPromise;
}

export default async function handler(req, res) {
  await ensureDB();
  return app(req, res);
}
