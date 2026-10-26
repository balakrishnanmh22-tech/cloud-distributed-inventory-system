import { User } from '../models/User.js';
import { Warehouse } from '../models/Warehouse.js';
import { Product } from '../models/Product.js';
import { StockMovement } from '../models/StockMovement.js';
import { PerformanceMetric } from '../models/PerformanceMetric.js';
import { PartitionRouter, WAREHOUSE_PARTITIONS } from '../services/partitionRouter.js';
import { connectDB, disconnectDB } from '../config/database.js';

export async function seedDatabase({ quiet = false } = {}) {
  const log = (...args) => { if (!quiet) console.log(...args); };

  // 1. Seed Admin User if not present
  const existingAdmin = await User.findOne({ username: 'admin' });
  if (!existingAdmin) {
    await User.create({
      username: 'admin',
      password: 'password123',
      role: 'ADMIN',
      fullName: 'Chief Inventory Controller',
    });
    log('[Seed] Admin user created (username: admin, password: password123)');
  }

  // 2. Seed Default Warehouses if not present
  const warehouses = [
    {
      code: 'HOSUR',
      name: 'Hosur Distribution Hub',
      location: 'SIPCOT Industrial Complex, Hosur, Tamil Nadu',
      partitionCollection: 'inventory_hosur',
      capacity: 15000,
      contactEmail: 'hosur-hub@inventory.local',
    },
    {
      code: 'CHENNAI',
      name: 'Chennai Central Depot',
      location: 'Ambattur Industrial Estate, Chennai, Tamil Nadu',
      partitionCollection: 'inventory_chennai',
      capacity: 25000,
      contactEmail: 'chennai-depot@inventory.local',
    },
    {
      code: 'BANGALORE',
      name: 'Bangalore Tech Logistics',
      location: 'Electronic City Phase 1, Bangalore, Karnataka',
      partitionCollection: 'inventory_bangalore',
      capacity: 20000,
      contactEmail: 'bangalore-tech@inventory.local',
    },
  ];

  for (const wh of warehouses) {
    await Warehouse.findOneAndUpdate({ code: wh.code }, wh, { upsert: true });
  }
  log('[Seed] 3 Warehouses verified with partition collection bindings.');

  // Note: Product catalog and partition inventory remain empty for manual intake.

  // 3. Seed Benchmark Performance Metrics for Scalability Analysis
  const sampleBenchmarks = [
    {
      testId: 'BENCH-BASELINE-1R',
      testName: '1 Replica Pod Workload Baseline',
      backendReplicas: 1,
      totalRequests: 500,
      successfulRequests: 500,
      failedRequests: 0,
      concurrency: 20,
      rps: 142.8,
      avgLatencyMs: 14.2,
      p95LatencyMs: 22.5,
      p99LatencyMs: 31.0,
      errorRate: 0,
      durationSeconds: 3.5,
    },
    {
      testId: 'BENCH-SCALED-2R',
      testName: '2 Replicas Scaled Workload',
      backendReplicas: 2,
      totalRequests: 1000,
      successfulRequests: 1000,
      failedRequests: 0,
      concurrency: 40,
      rps: 278.4,
      avgLatencyMs: 8.6,
      p95LatencyMs: 14.1,
      p99LatencyMs: 19.8,
      errorRate: 0,
      durationSeconds: 3.59,
    },
    {
      testId: 'BENCH-SCALED-3R',
      testName: '3 Replicas Production Scale',
      backendReplicas: 3,
      totalRequests: 2000,
      successfulRequests: 1998,
      failedRequests: 2,
      concurrency: 80,
      rps: 412.6,
      avgLatencyMs: 6.2,
      p95LatencyMs: 10.4,
      p99LatencyMs: 15.2,
      errorRate: 0.1,
      durationSeconds: 4.85,
    },
  ];

  for (const b of sampleBenchmarks) {
    await PerformanceMetric.findOneAndUpdate({ testId: b.testId }, b, { upsert: true });
  }
  log('[Seed] Scalability performance metrics initialized.');
  log('[Seed] Seeding completed successfully!');
}

// Standalone execution script
if (process.argv[1]?.endsWith('seedData.js')) {
  (async () => {
    try {
      await connectDB();
      await PartitionRouter.initPartitions();
      await seedDatabase();
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error('[Seed Error]:', err);
      process.exit(1);
    }
  })();
}
