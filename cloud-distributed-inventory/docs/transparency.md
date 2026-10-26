# Distributed Data Transparency Analysis

Transparency in distributed databases hides the complexity of distributed data placement, replication, network routing, and concurrency from the end user and client application.

This document details the implementation of all **8 Distributed Transparencies** in the **Cloud-Based Distributed Inventory Management System**.

---

## 1. Location Transparency

### Meaning
The client application accesses data items by logical identifiers without needing to know their physical location, host IP address, or port number.

### Implementation in Project
- **Source:** `frontend/src/services/api.js`, `backend/src/controllers/inventoryController.js`
- **Mechanism:** The frontend calls logical endpoints like `GET /api/inventory/global` or `POST /api/stock/transfer`. The browser code contains no knowledge of MongoDB node IPs, replica set ports (27018, 27019, 27020), or internal Kubernetes cluster IPs.
- **Demonstration:** Move MongoDB to another server or port; only the backend `MONGODB_URI` environment variable changes, while the frontend codebase remains 100% untouched.
- **Limitation:** Network latency between the client and backend is still observable if the physical geographic distance is high.

---

## 2. Fragmentation Transparency

### Meaning
Users and application callers can query a global relation without knowing that it has been split into multiple physical fragments across different collections or storage nodes.

### Implementation in Project
- **Source:** `backend/src/services/partitionRouter.js` (`getGlobalInventory`)
- **Mechanism:** The query `GET /api/inventory/global` queries `inventory_hosur`, `inventory_chennai`, and `inventory_bangalore` in parallel and stitches the results into a unified array of products with partition metadata.
- **Demonstration:** Inspect the Global Inventory view on the dashboard. It renders a single unified table containing records that are physically stored in three separate MongoDB collections.
- **Limitation:** Scatter-gather queries incur CPU and network overhead proportional to the number of active partitions.

---

## 3. Replication Transparency

### Meaning
The existence of multiple physical copies of data across replica nodes is hidden from client operations.

### Implementation in Project
- **Source:** `backend/src/config/database.js`
- **Mechanism:** The backend connects using the replica set URI `mongodb://mongo1:27017,mongo2:27017,mongo3:27017/distributed_inventory?replicaSet=rs0`. The MongoDB Node.js driver automatically routes writes to the active Primary and can distribute reads to Secondaries without manual node selection in application queries.
- **Demonstration:** Kill the Primary container (`docker stop cdi-mongo1`). The driver automatically switches to the newly elected Primary; the user does not need to reconfigure database endpoints.
- **Limitation:** During election windows (typically 2-10 seconds), write operations may briefly pause until the new Primary is accepted by the quorum.

---

## 4. Naming Transparency

### Meaning
Data entities have unique, stable logical names that do not embed physical file paths, collection names, or storage server IDs.

### Implementation in Project
- **Source:** `backend/src/models/Product.js`, `backend/src/models/Warehouse.js`
- **Mechanism:** Products are identified by stable business SKUs (`DELL-XPS-15`, `MACBOOK-PRO-14`) and warehouses by codes (`HOSUR`, `CHENNAI`). An SKU remains identical whether stored in Hosur, Chennai, or in-transit.
- **Demonstration:** Transferring `DELL-XPS-15` from Hosur to Chennai preserves the SKU and attributes; only the `warehouseId` partition reference changes.
- **Limitation:** Requires global unique key constraints on the SKU attribute.

---

## 5. Transaction Transparency

### Meaning
A distributed business operation spanning multiple physical partitions or database records is presented to the user as a single atomic transaction.

### Implementation in Project
- **Source:** `backend/src/services/transactionService.js` (`transferStock`)
- **Mechanism:** An inter-warehouse transfer requires: 1) Decrementing source partition, 2) Incrementing destination partition, 3) Writing an audit record. These 3 operations execute inside an atomic multi-document transaction with majority write concern.
- **Demonstration:** Trigger a transfer where the destination collection is valid but the source has insufficient stock. Both collections remain completely unchanged; no partial deduction occurs.
- **Limitation:** Distributed transactions across network partitions require two-phase commit overhead.

---

## 6. Concurrency Transparency

### Meaning
Multiple transactions can execute concurrently on shared inventory records without interfering with each other, creating race conditions, or producing inconsistent state.

### Implementation in Project
- **Source:** `backend/src/services/partitionRouter.js` (`updateStock`), `transactionService.js`
- **Mechanism:** Conditional atomic updates (`quantity: { $gte: qty }`) combined with snapshot isolation transactions and bounded retries with exponential backoff prevent lost updates and negative balances.
- **Demonstration:** Run `node tests/concurrency/test-concurrency.js`. 6 simultaneous requests demand 12 units from an inventory of 5 units. Exactly 2 succeed (4 units deducted); 4 are safely rejected; the remaining balance is exactly 1.
- **Limitation:** High concurrency on a single hot SKU can lead to write conflicts and transaction aborts.

---

## 7. Failure Transparency

### Meaning
The system detects node or network failures and recovers automatically, masking failures from the end user whenever sufficient redundant resources remain.

### Implementation in Project
- **Source:** Kubernetes Deployment (`k8s/application/backend-deployment.yaml`), MongoDB SDAM Driver
- **Mechanism:** If a backend pod crashes, the Kubernetes Service routes requests to the second healthy pod while the ReplicaSet controller launches a replacement. If a MongoDB node fails, the replica set elects a new Primary.
- **Demonstration:** Terminate a backend pod while executing load tests; zero 502/503 errors occur.
- **Limitation:** Non-idempotent HTTP requests in flight at the exact moment of an unexpected hardware crash may fail, requiring the client to retry using an idempotency key.

---

## 8. Performance Transparency

### Meaning
The distributed architecture provides visibility into network latency, replication lag, and throughput bottlenecks rather than hiding distributed performance characteristics.

### Implementation in Project
- **Source:** `backend/src/controllers/distributedController.js` (`getPerformance`), Frontend Telemetry Tab
- **Mechanism:** The system measures and surfaces roundtrip database ping, write concern latency differences (CP vs AP), and p95 latency under scaled loads.
- **Demonstration:** View the **Distributed Systems Telemetry -> Scalability** chart on the frontend dashboard to inspect RPS and p95 latency curves across 1, 2, and 3 replicas.
- **Limitation:** Distributed consensus across networks is fundamentally subject to the speed of light and physical network latency.
