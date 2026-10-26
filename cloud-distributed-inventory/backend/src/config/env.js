import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27018/distributed_inventory?directConnection=true',
  jwtSecret: process.env.JWT_SECRET || 'distributed-inventory-secret-key-super-secure-viva-2026',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  nodeEnv: process.env.NODE_ENV || 'development',
  replicaSetName: process.env.REPLICA_SET_NAME || 'rs0',
  defaultWarehouses: [
    { code: 'HOSUR', name: 'Hosur Distribution Hub', location: 'Hosur, TN', partition: 'inventory_hosur' },
    { code: 'CHENNAI', name: 'Chennai Central Depot', location: 'Chennai, TN', partition: 'inventory_chennai' },
    { code: 'BANGALORE', name: 'Bangalore Tech Logistics', location: 'Bangalore, KA', partition: 'inventory_bangalore' },
  ]
};
