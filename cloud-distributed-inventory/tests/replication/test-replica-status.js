import assert from 'node:assert/strict';
import { connectDB, disconnectDB } from '../../backend/src/config/database.js';
import { ReplicationHealthService } from '../../backend/src/services/replicationHealthService.js';

async function run() {
  console.log('--- TEST: MongoDB Replica Set Topology & Health Check ---');
  await connectDB();

  const status = await ReplicationHealthService.getReplicationStatus();
  console.log('Topology Mode:', status.mode || (status.isReplicaSet ? 'REPLICA_SET' : 'UNKNOWN'));
  console.log('Active Members Reported:', status.members.length);

  assert.ok(status.members.length > 0, 'Must report at least 1 member');
  status.members.forEach(m => {
    console.log(`• Node [${m.name}]: State = ${m.stateStr}, Health = ${m.health}`);
  });

  const health = await ReplicationHealthService.checkDatabaseHealth();
  console.log(`Roundtrip DB Ping: ${health.latencyMs} ms, Status: ${health.status}`);
  assert.equal(health.status, 'UP');

  await disconnectDB();
  console.log('--- ALL REPLICATION CHECKS PASSED ---\n');
}

run().catch(err => {
  console.error('Replication Test Failed:', err);
  process.exit(1);
});
