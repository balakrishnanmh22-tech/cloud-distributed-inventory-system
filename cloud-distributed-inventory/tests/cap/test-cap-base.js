import assert from 'node:assert/strict';
import { connectDB, disconnectDB } from '../../backend/src/config/database.js';
import { CAPExperimentService } from '../../backend/src/services/capExperimentService.js';

async function run() {
  console.log('--- TEST: CAP Theorem & BASE Consistency Benchmark ---');
  await connectDB();

  console.log('Running comparative benchmark (5 iterations per profile)...');
  const result = await CAPExperimentService.runExperiment({ iterations: 5, testWarehouse: 'HOSUR' });

  assert.ok(result.strongConsistencyProfile, 'Must contain strong consistency profile');
  assert.ok(result.eventualConsistencyProfile, 'Must contain eventual consistency profile');

  console.log('\n--- EMPIRICAL RESULTS ---');
  console.log(`Topology Mode:               ${result.clusterMode}`);
  console.log(`Strong Consistency Write:    ${result.strongConsistencyProfile.avgWriteLatencyMs} ms (w: majority)`);
  console.log(`Strong Consistency Read:     ${result.strongConsistencyProfile.avgReadLatencyMs} ms (primary)`);
  console.log(`Eventual Consistency Write:  ${result.eventualConsistencyProfile.avgWriteLatencyMs} ms (w: 1)`);
  console.log(`Eventual Consistency Read:   ${result.eventualConsistencyProfile.avgReadLatencyMs} ms (secondaryPreferred)`);
  console.log(`\nAnalysis: ${result.analysis.tradeoffSummary}`);

  await disconnectDB();
  console.log('\n--- ALL CAP / BASE TESTS PASSED ---\n');
}

run().catch(err => {
  console.error('CAP Test Failed:', err);
  process.exit(1);
});
