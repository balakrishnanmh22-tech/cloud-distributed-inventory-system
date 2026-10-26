# Distributed Database Viva Examination Guide

This document contains **frequently asked viva questions and concise, technically rigorous answers** for academic assessment of this project.

---

### Q1: What is the core problem that a distributed database solves in an inventory system?
**Answer:**
A centralized database in a multi-region inventory system suffers from single-point-of-failure (SPOF), high geographic latency for regional warehouses, and throughput bottlenecks during peak order volumes. A distributed database distributes data across partitions (data locality), replicates data for fault tolerance, and enables parallel processing across multiple server nodes.

---

### Q2: How does horizontal fragmentation differ from vertical fragmentation?
**Answer:**
- **Horizontal Fragmentation:** Divides a relation into horizontal subsets (rows/documents) based on a tuple condition. In our project, inventory is horizontally fragmented across `inventory_hosur`, `inventory_chennai`, and `inventory_bangalore` by `warehouseId`.
- **Vertical Fragmentation:** Divides a relation into subsets of columns/fields (plus primary key). For example, splitting a product into `ProductBasicInfo` (SKU, name, category) and `ProductPricing` (cost, margin, supplier) would constitute vertical fragmentation.

---

### Q3: What is Fragmentation Transparency and where is it in your code?
**Answer:**
Fragmentation transparency allows users to query global data without knowing that the data is partitioned across multiple physical tables. In our project, it is implemented in `backend/src/services/partitionRouter.js` in the `getGlobalInventory()` method. When the client calls `GET /api/inventory/global`, the router queries all 3 partition collections concurrently and returns a single stitched array.

---

### Q4: How does a MongoDB Replica Set elect a new Primary when the current Primary fails?
**Answer:**
Nodes in a replica set exchange heartbeats every 2,000ms. If the Primary stops responding for 10 seconds (election timeout), eligible secondaries initiate an election using Raft-style consensus. A candidate must receive votes from a strict majority ($N/2 + 1$) of voting members to become the new Primary. In a 3-member set, at least 2 nodes must agree. Once elected, the MongoDB driver automatically discovers the new Primary without application restart.

---

### Q5: What is the difference between Replication and Sharding in MongoDB?
**Answer:**
- **Replication:** Copies the **same dataset** across multiple nodes for high availability, redundancy, and read distribution. Every member holds a complete copy.
- **Sharding:** Splits **different portions of a large dataset** across different shards using a shard key, enabling horizontal scale for storage and write throughput beyond a single server's capacity.

---

### Q6: Explain Brewer's CAP Theorem using your project's experiment.
**Answer:**
Brewer's CAP theorem states that under a network partition ($P$), a distributed system can either maintain Consistency ($C$) or Availability ($A$), but not both.
- When configured with `writeConcern: "majority"` and `readPreference: "primary"` (CP), writes wait for quorum confirmation across replica nodes (measured at ~2.3ms write latency), guaranteeing zero dirty reads.
- When configured with `writeConcern: 1` and `readPreference: "secondaryPreferred"` (AP/BASE), writes commit immediately on the primary (measured at ~1.4ms write latency), offering higher availability and speed, but secondaries may briefly serve stale reads due to replication lag.

---

### Q7: Why can't a stale inventory read on a dashboard be allowed to authorize a stock transfer?
**Answer:**
A dashboard can tolerate eventual consistency (showing 10 units instead of 8 for a few milliseconds) because it is informational. However, stock deduction is an active mutation; allowing a stale read to authorize a deduction would result in selling non-existent physical goods (negative inventory). Therefore, the stock transfer transaction re-validates stock at the primary storage level using conditional atomic decrement (`quantity: { $gte: qty }`).

---

### Q8: What is an Idempotency Key and why is it needed in distributed transfers?
**Answer:**
In distributed systems, a network timeout can leave the client unsure whether a transfer succeeded or failed. If the client retries, a non-idempotent server would execute the transfer a second time, deducting double the stock. An idempotency key is a unique client-generated token saved in the `stockmovements` collection with a unique sparse index. If a retry arrives with an identical key, the server returns the existing result without executing a second deduction.

---

### Q9: Why is a Kubernetes StatefulSet used for MongoDB instead of a Deployment?
**Answer:**
MongoDB replica set nodes require **stable network identities** (`mongo-0`, `mongo-1`, `mongo-2`) and **dedicated persistent storage** that reattaches to the exact same pod identity upon restart. A Kubernetes Deployment creates interchangeable pods with randomized names (`backend-78bc4-x9z`) and ephemeral storage, which breaks replica set quorum and peer discovery.

---

### Q10: What is the difference between Readiness and Liveness probes in Kubernetes?
**Answer:**
- **Liveness Probe:** Detects if a process has deadlocked or crashed. If the liveness probe fails, Kubernetes restarts the container.
- **Readiness Probe:** Detects if a pod is ready to accept user traffic. If the readiness probe fails (e.g., during database reconnection), Kubernetes temporarily removes the pod from the Service load balancer endpoints so users never receive HTTP 502/503 errors.

---

### Q11: What is MongoDB Compass?
**Answer:**
MongoDB Compass is an official Graphical User Interface (GUI) client. It is **not** the database engine; it connects over TCP to the MongoDB server (`mongod`) to let developers visually inspect document schemas, query partition collections, check index coverage, and view explain plans.
