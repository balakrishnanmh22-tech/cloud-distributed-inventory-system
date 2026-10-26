# Distributed Database Concepts & Implementation Evidence

This document provides a comprehensive academic analysis of each distributed database concept implemented in the **Cloud-Based Distributed Inventory Management System**.

---

## 1. Horizontal Fragmentation

### 1. What It Means
Horizontal fragmentation divides a logical relation/table into disjoint horizontal subsets (tuples or documents) based on a selection predicate. Each fragment shares the same schema but contains a mutually exclusive partition of the data.

### 2. Relevance to This Project
In a multi-warehouse logistics network, 90% of warehouse queries and stock adjustments target local stock. Storing inventory in warehouse-specific partitions enables **data locality**, eliminating cross-region latency for routine operations.

### 3. Code & API Reference
- Source: `backend/src/services/partitionRouter.js`
- Controller: `backend/src/controllers/inventoryController.js`
- Test: `tests/fragmentation/test-fragmentation.js`
- API Endpoints: `GET /api/inventory/:warehouseId`, `GET /api/inventory/global`

### 4. How It Works
The `PartitionRouter` maps warehouse codes (`HOSUR`, `CHENNAI`, `BANGALORE`) to separate physical MongoDB collections (`inventory_hosur`, `inventory_chennai`, `inventory_bangalore`). When querying a single warehouse, the router queries that specific collection directly. When querying globally, it queries all partitions in parallel and unions the dataset.

### 5. How to Demonstrate
Run `node tests/fragmentation/test-fragmentation.js`. The test inserts an item into Hosur, verifies it is present in `inventory_hosur`, verifies it is absent in `inventory_chennai`, and retrieves it via `/api/inventory/global`.

### 6. Evidence It Works
Command output from test run:
```
--- TEST: Horizontal Warehouse Fragmentation & Locality ---
1. Inserting item into HOSUR partition...
✔ Verified: Item stored in physical collection inventory_hosur
✔ Verified: Physical isolation preserved (Item absent in inventory_chennai)
✔ Verified: Global query reconstructs item across partitions transparently
--- ALL FRAGMENTATION TESTS PASSED ---
```

### 7. Limitations
Cross-partition queries require scatter-gather operations, which scale linearly with the number of regional partitions.

---

## 2. Replication & Quorum Consensus

### 1. What It Means
Replication maintains copies of identical data on multiple physical database nodes to ensure fault tolerance, disaster recovery, and high availability. Quorum consensus ensures that state changes are acknowledged by a strict majority ($N/2 + 1$) of nodes before being considered durable.

### 2. Relevance to This Project
If a database node encounters power loss or network failure, an inventory management system must remain operational without losing pending shipments or corrupting stock numbers.

### 3. Code & API Reference
- Config: `docker/docker-compose.yml` (services `mongo1`, `mongo2`, `mongo3`)
- Native script: `database/replica-set/launch-local-rs.ps1`
- Service: `backend/src/services/replicationHealthService.js`
- Test: `tests/replication/test-replica-status.js`
- API Endpoint: `GET /api/distributed/replication`

### 4. How It Works
A 3-member replica set (`rs0`) runs with 1 Primary and 2 Secondaries. All writes are directed to the Primary, which records mutations in the `local.oplog.rs` collection. Secondaries continuously stream the oplog. If the Primary fails, secondaries detect missed heartbeats (2,000ms interval) and hold a Raft-style election. With 2 of 3 votes, a new Primary is elected within ~10 seconds.

### 5. How to Demonstrate
1. View the **Distributed Monitoring** tab on the dashboard to inspect all 3 members.
2. In Docker, run `docker stop cdi-mongo1`.
3. Observe `cdi-mongo2` transition to `PRIMARY`.
4. Issue a stock transfer via frontend; verify operation succeeds without restarting the backend.

### 6. Evidence It Works
```
Topology Mode: REPLICA_SET
• Node [mongo1:27017]: State = PRIMARY, Health = HEALTHY
• Node [mongo2:27017]: State = SECONDARY, Health = HEALTHY
• Node [mongo3:27017]: State = SECONDARY, Health = HEALTHY
Quorum Available: True (3/3 voting members active)
```

### 7. Limitations
During the ~5-10 second election window, write operations are temporarily blocked until a new Primary is elected.

---

## 3. Sharding vs Fragmentation

### 1. What It Means
- **Horizontal Fragmentation (Application-Managed):** Application code routes documents to separate collections based on business attributes.
- **MongoDB Sharding (Engine-Managed):** The database engine distributes chunks across independent shards using a shard key and the `mongos` router.

### 2. Relevance to This Project
Understanding the architectural boundary between application-level partitioning and engine-level sharding is essential for distributed systems design.

### 3. Code & Config Reference
- Manifests: `k8s/sharded-cluster/sharded-cluster.yaml`
- Configuration script: `database/sharding/init-sharding.js`

### 4. How It Works
A MongoDB sharded cluster consists of:
1. `configsvr` replica set storing cluster chunk ranges.
2. `shard1` and `shard2` hosting chunks.
3. `mongos` routers receiving client queries and directing them to the target shard based on the shard key `{ warehouseId: 1, sku: 1 }`.

### 5. Limitations
Running a complete sharded cluster requires substantial memory (at least 6-8 GB RAM for 2 shard replica sets + config replica set + router), which is why local academic demonstrations utilize the lightweight 3-node replica set + warehouse fragmentation model while providing production sharding manifests for cloud deployment.

---

## 4. CAP Theorem Experiment

### 1. What It Means
Brewer's CAP Theorem states that in the event of a network Partition (P), a distributed data system can provide either Consistency (C) or Availability (A), but cannot guarantee both simultaneously.

### 2. Relevance to This Project
Inventory systems require strict Consistency during stock deduction (to avoid selling the same physical item twice) but can tolerate eventual consistency for browsing catalogs or reporting.

### 3. Code & Test Reference
- Service: `backend/src/services/capExperimentService.js`
- Test: `tests/cap/test-cap-base.js`
- Interactive Page: **Distributed Database -> CAP & BASE Experiment** tab on frontend.

### 4. How It Works
The system runs two distinct profiles against the cluster:
- **Profile A (CP - Strong Consistency):** Uses write concern `w: "majority"`, `j: true`, and `readPreference: "primary"`. Writes wait for quorum replication.
- **Profile B (AP - High Availability / Eventual Consistency):** Uses write concern `w: 1` and `readPreference: "secondaryPreferred"`. Writes commit locally on primary; reads can be served by secondaries even if replication lag is present.

### 5. Empirical Results
From live execution:
- Strong Consistency Write: **2.30 ms**
- Eventual Consistency Write: **1.42 ms**
- Write Speed Ratio: Eventual consistency is ~38% faster because it does not block on inter-node network acknowledgement.

---

## 5. ACID Multi-Document Transactions

### 1. What It Means
ACID ensures:
- **Atomicity:** All parts of a transaction commit or none do.
- **Consistency:** Transactions leave database invariants intact (e.g. non-negative stock).
- **Isolation:** Concurrent transactions execute without cross-contamination.
- **Durability:** Committed state survives server crashes.

### 2. Relevance to This Project
A stock transfer between warehouses must deduct from Warehouse A and add to Warehouse B in a single atomic operation.

### 3. Code Reference
- Service: `backend/src/services/transactionService.js`
- Test: `tests/transactions/test-acid-transfer.js`

### 4. How It Works
`TransactionService.transferStock()` opens a MongoDB session with `session.startTransaction()`, performs conditional decrement on source partition (`quantity: { $gte: qty }`), increments target partition, inserts a `StockMovement` audit record, and commits with `w: "majority"`. If any constraint fails, `session.abortTransaction()` rolls back both partitions.
