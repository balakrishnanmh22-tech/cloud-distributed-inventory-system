import mongoose from 'mongoose';
import { config } from './env.js';

let isConnected = false;
let replicaSetDetected = false;
let connectingPromise = null;

export async function connectDB(uri = config.mongoUri) {
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    return mongoose.connection;
  }

  // If running in Vercel cloud and uri is localhost, avoid hanging on unreachable local IP
  if (process.env.VERCEL && (uri.includes('127.0.0.1') || uri.includes('localhost'))) {
    console.log('[Database] Running on Vercel without remote MONGODB_URI. Connect MongoDB Atlas in Vercel settings for cloud database.');
    return null;
  }

  if (connectingPromise) {
    return connectingPromise;
  }

  connectingPromise = (async () => {
    try {
      const conn = await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 4000,
        connectTimeoutMS: 8000,
        autoIndex: true,
      });

      isConnected = true;
      console.log(`[Database] MongoDB connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

      // Inspect topology to determine if replica set is active
      try {
        const adminDb = conn.connection.db.admin();
        const status = await adminDb.command({ replSetGetStatus: 1 }).catch(() => null);
        if (status && status.ok === 1) {
          replicaSetDetected = true;
          console.log(`[Database] Replica Set active: "${status.set}" with ${status.members.length} members.`);
        } else {
          replicaSetDetected = false;
        }
      } catch (err) {
        replicaSetDetected = false;
      }

      mongoose.connection.on('disconnected', () => {
        console.warn('[Database] MongoDB disconnected! Attempting reconnect...');
        isConnected = false;
      });

      mongoose.connection.on('reconnected', () => {
        console.log('[Database] MongoDB reconnected successfully.');
        isConnected = true;
      });

      mongoose.connection.on('error', (err) => {
        console.error('[Database] MongoDB connection error:', err.message);
      });

      return conn.connection;
    } catch (error) {
      isConnected = false;
      console.warn(`[Database] MongoDB connection notice: ${error.message}`);
      return null;
    } finally {
      connectingPromise = null;
    }
  })();

  return connectingPromise;
}

export function isReplicaSetActive() {
  return replicaSetDetected;
}

export async function disconnectDB() {
  if (isConnected) {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[Database] Disconnected cleanly.');
  }
}

export { mongoose };
