import assert from 'node:assert/strict';
import { connectDB, disconnectDB } from '../../backend/src/config/database.js';
import { PartitionRouter } from '../../backend/src/services/partitionRouter.js';
import { PerformanceMetric } from '../../backend/src/models/PerformanceMetric.js';

async function run() {
  console.log('--- TEST: Scalability, Load & Throughput Measurement ---');
  await connectDB();
  await PartitionRouter.initPartitions();

  const totalRequests = 100;
  const batchSize = 10;
  console.log(`Executing ${totalRequests} scattered partition read queries (batch size: ${batchSize})...`);

  const start = performance.now();
  const latencies = [];
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < totalRequests; i += batchSize) {
    const batch = [];
    for (let j = 0; j < batchSize; j++) {
      const qStart = performance.now();
      batch.push(
        PartitionRouter.getGlobalInventory()
          .then(() => {
            latencies.push(performance.now() - qStart);
            successful++;
          })
          .catch(() => {
            latencies.push(performance.now() - qStart);
            failed++;
          })
      );
    }
    await Promise.all(batch);
  }

  const durationSec = (performance.now() - start) / 1000;
  latencies.sort((a, b) => a - b);

  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95Latency = latencies[Math.floor(latencies.length * 0.95)] || avgLatency;
  const rps = Math.round((successful / durationSec) * 100) / 100;

  console.log('\n--- MEASURED BENCHMARK RESULTS ---');
  console.log(`Total Requests:      ${totalRequests}`);
  console.log(`Successful:          ${successful}`);
  console.log(`Failed:              ${failed}`);
  console.log(`Total Duration:      ${durationSec.toFixed(2)} seconds`);
  console.log(`Throughput (RPS):    ${rps} req/sec`);
  console.log(`Average Latency:     ${avgLatency.toFixed(2)} ms`);
  console.log(`p95 Latency:         ${p95Latency.toFixed(2)} ms`);

  assert.equal(failed, 0, 'No requests should fail under normal load');
  assert.ok(rps > 10, 'Throughput should exceed baseline');

  // Record to PerformanceMetric collection
  await PerformanceMetric.create({
    testId: `BENCH-CLI-${Date.now()}`,
    testName: 'CLI Automated Scalability Run',
    backendReplicas: 1,
    totalRequests,
    successfulRequests: successful,
    failedRequests: failed,
    concurrency: batchSize,
    rps,
    avgLatencyMs: Math.round(avgLatency * 100) / 100,
    p95LatencyMs: Math.round(p95Latency * 100) / 100,
    durationSeconds: Math.round(durationSec * 100) / 100,
  });

  await disconnectDB();
  console.log('--- ALL SCALABILITY TESTS PASSED ---\n');
}

run().catch(err => {
  console.error('Scalability Test Failed:', err);
  process.exit(1);
});
