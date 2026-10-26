# System Architecture & Technical Specifications
## Cloud-Based Distributed Inventory Management System

### 1. High-Level System Architecture

```mermaid
flowchart TD
    Client["React.js Frontend (Vite + Tailwind CSS)\n[Port 3000]"]
    Ingress["Kubernetes Ingress / Service Router"]
    Backend1["Node.js Express Pod 1\n[Port 5000]"]
    Backend2["Node.js Express Pod 2\n[Port 5000]"]
    Router["Inventory Partition Router\n(services/partitionRouter.js)"]
    
    RS_Primary[("MongoDB Replica Set - Primary\n(Writes + Read Snapshot)")]
    RS_Sec1[("MongoDB Replica Set - Secondary 1\n(Oplog Replication)")]
    RS_Sec2[("MongoDB Replica Set - Secondary 2\n(Oplog Replication)")]

    PartA["Partition A: Hosur\n(collection: inventory_hosur)"]
    PartB["Partition B: Chennai\n(collection: inventory_chennai)"]
    PartC["Partition C: Bangalore\n(collection: inventory_bangalore)"]

    Client -->|HTTP / REST API| Ingress
    Ingress --> Backend1
    Ingress --> Backend2
    Backend1 --> Router
    Backend2 --> Router

    Router -->|SDAM Connection Pool| RS_Primary
    RS_Primary -.->|Heartbeat / Oplog Sync| RS_Sec1
    RS_Primary -.->|Heartbeat / Oplog Sync| RS_Sec2

    RS_Primary --> PartA
    RS_Primary --> PartB
    RS_Primary --> PartC
```

---

### 2. Cross-Partition Atomic Stock Transfer Sequence (ACID)

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Inventory Manager
    participant API as Express API (/api/stock/transfer)
    participant TxService as TransactionService
    participant Router as PartitionRouter
    participant PartA as Hosur Partition (inventory_hosur)
    participant PartB as Chennai Partition (inventory_chennai)
    participant Audit as StockMovement Collection

    Admin->>API: POST /api/stock/transfer { from: "HOSUR", to: "CHENNAI", sku, qty: 4, idempotencyKey }
    API->>TxService: transferStock()
    TxService->>Audit: Check idempotencyKey (Deduplication Guard)
    
    alt Duplicate Request Found
        TxService-->>API: Return existing transaction outcome (No-Op)
    else New Transaction
        TxService->>TxService: session.startTransaction(w: majority, snapshot)
        TxService->>Router: updateStock(HOSUR, -4)
        Router->>PartA: findOneAndUpdate({ sku, quantity: { $gte: 4 } }, { $inc: { quantity: -4 } })
        
        alt Insufficient Stock in Source
            PartA-->>Router: Null (Constraint Violation)
            Router-->>TxService: Throw Error: Insufficient stock
            TxService->>TxService: session.abortTransaction()
            TxService-->>API: 400 Bad Request
        else Stock Decremented
            PartA-->>Router: Updated Document (Remaining: 6)
            TxService->>Router: updateStock(CHENNAI, +4)
            Router->>PartB: findOneAndUpdate({ sku }, { $inc: { quantity: +4 } }, upsert: true)
            PartB-->>Router: Updated Document (Total: 10)
            TxService->>Audit: insertOne({ movementId, type: "TRANSFER", qty: 4, status: "COMMITTED" })
            TxService->>TxService: session.commitTransaction()
            TxService-->>API: 200 Success { movementId, sourceRemaining: 6, destStock: 10 }
            API-->>Admin: Render Success Notification
        end
    end
```

---

### 3. Comparison: Replica Set vs Fragmentation vs Sharded Cluster

| Attribute | Replica Set (`rs0`) | Horizontal Fragmentation (This Project) | MongoDB Sharded Cluster |
| :--- | :--- | :--- | :--- |
| **Primary Purpose** | High Availability, Fault Tolerance, Redundancy | Regional Data Locality, Partition Isolation | Massive Horizontal Write/Storage Scale |
| **Data Distribution** | Every member holds a **complete clone** of the dataset | Distinct collections store **disjoint subsets** by warehouse | Chunks of collections distributed across independent shards |
| **Routing Mechanism** | Driver-level Server Discovery & Monitoring (SDAM) | Application-level `PartitionRouter` (`services/partitionRouter.js`) | Stateless `mongos` routing query server using config server metadata |
| **Transaction Boundary**| Native multi-document transactions supported | Managed atomically within same replica set or via 2PC | Distributed transactions managed across shard boundaries |
| **Hardware Overhead** | Moderate (3 nodes for quorum) | Low (Runs on single or multi-node instance) | High (At least 2 Shard replica sets + Config replica set + mongos) |
