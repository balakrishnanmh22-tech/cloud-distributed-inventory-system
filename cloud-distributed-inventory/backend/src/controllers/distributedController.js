import { PartitionRouter, WAREHOUSE_PARTITIONS } from '../services/partitionRouter.js';
import { ReplicationHealthService } from '../services/replicationHealthService.js';
import { CAPExperimentService } from '../services/capExperimentService.js';
import { PerformanceMetric } from '../models/PerformanceMetric.js';
import { TransactionService } from '../services/transactionService.js';
import { Product } from '../models/Product.js';
import { ProductService } from '../services/productService.js';
import crypto from 'crypto';

export async function getFragmentation(req, res, next) {
  try {
    const [stats, verticalStats] = await Promise.all([
      PartitionRouter.getPartitionStats(),
      ProductService.getVerticalFragmentationStats(),
    ]);

    res.json({
      success: true,
      scheme: 'Horizontal Fragmentation by Warehouse Locality',
      routingAttribute: 'warehouseId',
      partitions: stats,
      mapping: WAREHOUSE_PARTITIONS,
      verticalFragmentation: verticalStats,
      transparency: {
        type: 'Fragmentation & Location Transparency',
        description: 'Client issues query to unified /api/inventory/global; router reconstructs records across horizontal partitions, while /api/products transparently reconstructs attributes across vertical fragments.'
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getVerticalFragmentation(req, res, next) {
  try {
    const stats = await ProductService.getVerticalFragmentationStats();
    res.json({
      success: true,
      ...stats,
    });
  } catch (err) {
    next(err);
  }
}

export async function getReplication(req, res, next) {
  try {
    const status = await ReplicationHealthService.getReplicationStatus();
    res.json({
      success: true,
      replication: status,
      transparency: {
        type: 'Replication Transparency',
        description: 'Application connects via replica-set aware driver string; read and write operations are routed automatically to Primary or eligible Secondaries.'
      }
    });
  } catch (err) {
    next(err);
  }
}

export async function getDatabaseHealth(req, res, next) {
  try {
    const health = await ReplicationHealthService.checkDatabaseHealth();
    res.json({ success: true, health });
  } catch (err) {
    next(err);
  }
}

export async function getPerformance(req, res, next) {
  try {
    const metrics = await PerformanceMetric.find().sort({ timestamp: -1 }).limit(10).lean();
    res.json({ success: true, count: metrics.length, metrics });
  } catch (err) {
    next(err);
  }
}

export async function runCapExperiment(req, res, next) {
  try {
    const { iterations = 5, testWarehouse = 'HOSUR' } = req.body;
    const result = await CAPExperimentService.runExperiment({ iterations, testWarehouse });
    res.json({
      success: true,
      message: 'CAP & BASE experiment completed successfully',
      result,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Concurrency & Write Conflict Stress Test:
 * Simulates multiple concurrent transfers attempting to deplete the exact same stock.
 * Validates that ACID transactions prevent negative stock and handle conflicts safely.
 */
export async function runConcurrencyTest(req, res, next) {
  try {
    const { concurrentRequests = 6, transferAmount = 2 } = req.body;
    const testSku = `CONC-TEST-${Date.now()}`;
    const initialStock = 5; // Total 5 units available in Hosur

    // 1. Create temporary test product across vertical fragments
    await ProductService.createProduct({
      sku: testSku,
      name: 'Concurrency Stress Item',
      category: 'TEST',
      costPrice: 10,
      sellingPrice: 20,
      reorderLevel: 2,
    });

    // 2. Seed Hosur with exactly 5 units
    await PartitionRouter.updateStock('HOSUR', testSku, initialStock, null, {
      productName: 'Concurrency Stress Item',
      category: 'TEST',
    });

    // 3. Launch concurrent transfer requests (e.g. 6 requests asking for 2 units each = 12 total requested, but only 5 available!)
    const attempts = [];
    for (let i = 0; i < concurrentRequests; i++) {
      attempts.push(
        TransactionService.transferStock({
          fromWarehouse: 'HOSUR',
          toWarehouse: 'CHENNAI',
          sku: testSku,
          quantity: transferAmount,
          reason: `Concurrent Stress Test #${i + 1}`,
          idempotencyKey: `CONC-IDEM-${testSku}-${i}`,
        })
        .then(res => ({ reqId: i + 1, status: 'SUCCESS', result: res }))
        .catch(err => ({ reqId: i + 1, status: 'REJECTED_SAFELY', error: err.message }))
      );
    }

    const outcomes = await Promise.all(attempts);

    // 4. Verify post-test stock integrity
    const hosurStock = (await PartitionRouter.getInventoryByWarehouse('HOSUR', { sku: testSku }))[0]?.quantity || 0;
    const chennaiStock = (await PartitionRouter.getInventoryByWarehouse('CHENNAI', { sku: testSku }))[0]?.quantity || 0;

    const successfulTransfers = outcomes.filter(o => o.status === 'SUCCESS').length;
    const rejectedTransfers = outcomes.filter(o => o.status === 'REJECTED_SAFELY').length;

    // Cleanup test products across fragments
    await ProductService.deleteProduct(testSku).catch(() => null);
    await Product.deleteOne({ sku: testSku }).catch(() => null);
    await PartitionRouter.getModel('HOSUR').deleteOne({ sku: testSku }).catch(() => null);
    await PartitionRouter.getModel('CHENNAI').deleteOne({ sku: testSku }).catch(() => null);

    res.json({
      success: true,
      testSku,
      initialStock,
      concurrentRequests,
      transferAmountEach: transferAmount,
      totalStockDemanded: concurrentRequests * transferAmount,
      outcomes: {
        successfulTransfers,
        rejectedTransfers,
        details: outcomes,
      },
      verification: {
        expectedRemainingHosur: initialStock - (successfulTransfers * transferAmount),
        actualRemainingHosur: hosurStock,
        actualTransferredChennai: chennaiStock,
        negativeStockPrevented: hosurStock >= 0,
        invariantsPreserved: (hosurStock + chennaiStock === initialStock),
      },
      academicTakeaway: 'Concurrency transparency and atomic serialization ensure that conflicting transactions cannot create race conditions or negative balances. When stock is exhausted, excess requests are rejected safely rather than allowing lost updates.'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Scalability Benchmark Runner:
 * Measures throughput and latency under 1, 2, and 3 simulated replica/worker loads.
 */
export async function runBenchmark(req, res, next) {
  try {
    const { replicas = 1, requestCount = 50, concurrency = 10 } = req.body;
    const testId = `BENCH-${replicas}R-${Date.now()}`;
    const start = performance.now();
    const latencies = [];
    let successCount = 0;
    let failCount = 0;

    // Run parallel batches
    const batchSize = Math.max(1, Math.min(concurrency, 20));
    for (let i = 0; i < requestCount; i += batchSize) {
      const batch = [];
      const currentBatchCount = Math.min(batchSize, requestCount - i);

      for (let j = 0; j < currentBatchCount; j++) {
        const reqStart = performance.now();
        batch.push(
          PartitionRouter.getGlobalInventory()
            .then(() => {
              latencies.push(performance.now() - reqStart);
              successCount++;
            })
            .catch(() => {
              latencies.push(performance.now() - reqStart);
              failCount++;
            })
        );
      }
      await Promise.all(batch);
    }

    const durationSeconds = Math.max(0.01, (performance.now() - start) / 1000);
    latencies.sort((a, b) => a - b);

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / (latencies.length || 1);
    const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || avgLatency;
    const p99Latency = latencies[Math.floor(latencies.length * 0.99)] || p95Latency;
    const rps = Math.round((successCount / durationSeconds) * 100) / 100;
    const errorRate = Math.round((failCount / (requestCount || 1)) * 10000) / 100;

    const metric = await PerformanceMetric.create({
      testId,
      testName: `${replicas} Replica${replicas > 1 ? 's' : ''} Workload Benchmark`,
      backendReplicas: replicas,
      totalRequests: requestCount,
      successfulRequests: successCount,
      failedRequests: failCount,
      concurrency,
      rps,
      avgLatencyMs: Math.round(avgLatency * 100) / 100,
      p95LatencyMs: Math.round(p95Latency * 100) / 100,
      p99LatencyMs: Math.round(p99Latency * 100) / 100,
      errorRate,
      durationSeconds: Math.round(durationSeconds * 100) / 100,
    });

    res.json({
      success: true,
      metric,
    });
  } catch (err) {
    next(err);
  }
}
