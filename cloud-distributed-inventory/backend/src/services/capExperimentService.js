import mongoose from 'mongoose';
import { PartitionRouter } from './partitionRouter.js';
import { ReplicationHealthService } from './replicationHealthService.js';

export class CAPExperimentService {
  /**
   * Runs a comparative CAP & BASE experiment.
   * Benchmarks write and read latency, consistency guarantees, and quorum implications.
   */
  static async runExperiment({ iterations = 5, testWarehouse = 'HOSUR' } = {}) {
    const rsInfo = await ReplicationHealthService.getReplicationStatus();
    const testSku = `CAP-BENCH-${Date.now()}`;
    const results = {
      timestamp: new Date(),
      isReplicaSet: rsInfo.isReplicaSet,
      clusterMode: rsInfo.isReplicaSet ? `Replica Set (${rsInfo.setName})` : 'Standalone Instance',
      quorumStatus: rsInfo.quorumAvailable ? 'QUORUM_OK' : 'DEGRADED_OR_STANDALONE',
      iterations,
      strongConsistencyProfile: {
        writeConcern: 'majority',
        journal: true,
        readPreference: 'primary',
        writes: [],
        reads: [],
        avgWriteLatencyMs: 0,
        avgReadLatencyMs: 0,
        stalenessDetected: false,
        capTradeoff: 'CP (Consistency & Partition Tolerance prioritized over write latency)',
      },
      eventualConsistencyProfile: {
        writeConcern: 1,
        journal: false,
        readPreference: 'secondaryPreferred',
        writes: [],
        reads: [],
        avgWriteLatencyMs: 0,
        avgReadLatencyMs: 0,
        stalenessDetected: false,
        capTradeoff: 'AP / BASE (Availability & Low Latency prioritized over strict freshness)',
      },
      analysis: {},
    };

    const collName = PartitionRouter.getPartitionName(testWarehouse);
    const db = mongoose.connection.db;

    // Profile 1: Strong Consistency (w: 'majority')
    for (let i = 0; i < iterations; i++) {
      const wStart = performance.now();
      try {
        await db.collection(collName).insertOne(
          {
            sku: `${testSku}-SC-${i}`,
            productName: `CAP Test Item SC ${i}`,
            category: 'CAP_EXPERIMENT',
            warehouseId: testWarehouse,
            quantity: 100,
            reorderLevel: 10,
            lastUpdated: new Date(),
          },
          { writeConcern: { w: rsInfo.isReplicaSet ? 'majority' : 1, j: rsInfo.isReplicaSet ? true : false } }
        );
        const wDuration = Math.round((performance.now() - wStart) * 100) / 100;
        results.strongConsistencyProfile.writes.push({ iteration: i + 1, latencyMs: wDuration, success: true });
      } catch (err) {
        results.strongConsistencyProfile.writes.push({ iteration: i + 1, latencyMs: Math.round(performance.now() - wStart), success: false, error: err.message });
      }

      // Read with primary preference
      const rStart = performance.now();
      try {
        const doc = await db.collection(collName).findOne(
          { sku: `${testSku}-SC-${i}` },
          { readPreference: 'primary' }
        );
        const rDuration = Math.round((performance.now() - rStart) * 100) / 100;
        results.strongConsistencyProfile.reads.push({ iteration: i + 1, latencyMs: rDuration, found: !!doc });
      } catch (err) {
        results.strongConsistencyProfile.reads.push({ iteration: i + 1, latencyMs: Math.round(performance.now() - rStart), found: false, error: err.message });
      }
    }

    // Profile 2: Eventual Consistency (w: 1, readPreference: 'secondaryPreferred')
    for (let i = 0; i < iterations; i++) {
      const wStart = performance.now();
      try {
        await db.collection(collName).insertOne(
          {
            sku: `${testSku}-EC-${i}`,
            productName: `CAP Test Item EC ${i}`,
            category: 'CAP_EXPERIMENT',
            warehouseId: testWarehouse,
            quantity: 100,
            reorderLevel: 10,
            lastUpdated: new Date(),
          },
          { writeConcern: { w: 1, j: false } }
        );
        const wDuration = Math.round((performance.now() - wStart) * 100) / 100;
        results.eventualConsistencyProfile.writes.push({ iteration: i + 1, latencyMs: wDuration, success: true });
      } catch (err) {
        results.eventualConsistencyProfile.writes.push({ iteration: i + 1, latencyMs: Math.round(performance.now() - wStart), success: false, error: err.message });
      }

      // Read with secondaryPreferred preference
      const rStart = performance.now();
      try {
        const doc = await db.collection(collName).findOne(
          { sku: `${testSku}-EC-${i}` },
          { readPreference: rsInfo.isReplicaSet ? 'secondaryPreferred' : 'primary' }
        );
        const rDuration = Math.round((performance.now() - rStart) * 100) / 100;
        results.eventualConsistencyProfile.reads.push({ iteration: i + 1, latencyMs: rDuration, found: !!doc });
      } catch (err) {
        results.eventualConsistencyProfile.reads.push({ iteration: i + 1, latencyMs: Math.round(performance.now() - rStart), found: false, error: err.message });
      }
    }

    // Cleanup experiment test keys
    await db.collection(collName).deleteMany({ category: 'CAP_EXPERIMENT' }).catch(() => null);

    // Compute averages
    const calcAvg = (arr, key) => arr.length ? Math.round((arr.reduce((acc, x) => acc + (x[key] || 0), 0) / arr.length) * 100) / 100 : 0;
    
    results.strongConsistencyProfile.avgWriteLatencyMs = calcAvg(results.strongConsistencyProfile.writes, 'latencyMs');
    results.strongConsistencyProfile.avgReadLatencyMs = calcAvg(results.strongConsistencyProfile.reads, 'latencyMs');

    results.eventualConsistencyProfile.avgWriteLatencyMs = calcAvg(results.eventualConsistencyProfile.writes, 'latencyMs');
    results.eventualConsistencyProfile.avgReadLatencyMs = calcAvg(results.eventualConsistencyProfile.reads, 'latencyMs');

    results.analysis = {
      writeSpeedRatio: results.eventualConsistencyProfile.avgWriteLatencyMs > 0 ? 
        Math.round((results.strongConsistencyProfile.avgWriteLatencyMs / results.eventualConsistencyProfile.avgWriteLatencyMs) * 100) / 100 : 1,
      tradeoffSummary: 'Strong consistency (w: majority) waits for replication acknowledgement across quorum before returning, offering zero dirty reads at the cost of higher latency. Eventual consistency (w: 1) commits immediately on primary, delivering faster writes but with a window of replication lag where secondaries may return stale stock.',
      academicTakeaway: 'According to Brewer\'s CAP theorem, in the presence of a network partition (P), a distributed data store must trade off Availability (A) for Consistency (C). MongoDB defaults to CP characteristics under majority write concern and linearizable/snapshot reads, but can be configured for AP semantics under weaker read preferences.'
    };

    return results;
  }
}
