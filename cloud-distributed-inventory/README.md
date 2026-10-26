# Cloud-Based Distributed Inventory Management System
### Academic Micro Project — Subject: Distributed Database

[![React 18](https://img.shields.io/badge/Frontend-React_18_Vite-blue.svg)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/UI-Tailwind_CSS_3-38bdf8.svg)](https://tailwindcss.com/)
[![Node.js](https://img.shields.io/badge/Backend-Node.js_Express-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/Database-MongoDB_8.x_ReplicaSet-emerald.svg)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Container-Docker_Compose-2496ed.svg)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Orchestration-Kubernetes_StatefulSet-326ce5.svg)](https://kubernetes.io/)
[![Tests](https://img.shields.io/badge/Tests-All_18_Categories_PASS-success.svg)]()

---

## 1. Abstract & Problem Statement

Modern enterprise logistics networks operate across multiple geographically distributed distribution hubs (e.g., Hosur, Chennai, and Bangalore). Traditional centralized database systems suffer from:
1. **Single Point of Failure (SPOF)**: A single database server outage halts operations across all regional warehouses.
2. **High Latency & WAN Bottlenecks**: Regional warehouse scanners query across public wide-area networks for every barcode scan.
3. **Write Contention & Race Conditions**: High-velocity order placement causes lost updates and negative inventory balances.

This project implements a complete, production-style **Cloud-Based Distributed Inventory Management System** utilizing:
- **Horizontal Warehouse Fragmentation** for localized low-latency reads and writes.
- A **3-Member MongoDB Replica Set (`rs0`)** for automated primary failover and zero data loss.
- **Multi-Document ACID Transactions** with snapshot isolation, non-negative stock guards, and idempotency key protection.
- Empirical demonstrations of **Brewer's CAP Theorem**, **BASE Eventual Consistency**, and **all 8 types of Distributed Data Transparency**.
- Full containerization using **Docker Compose** and cloud orchestration using **Kubernetes StatefulSets, Deployments, and HPA**.

---

## 2. System Architecture

```
                    +------------------------------------+
                    |   React 18 Admin Dashboard (Vite)  |
                    |           [Port 3000]              |
                    +-----------------+------------------+
                                      | HTTP REST / JWT
                                      v
                    +-----------------+------------------+
                    |  Kubernetes Service / NGINX Proxy  |
                    +-----------------+------------------+
                                      |
                     +----------------+----------------+
                     |                                 |
                     v                                 v
          [ Express Backend Pod 1 ]        [ Express Backend Pod 2 ]
          [       Port 5000       ]        [       Port 5000       ]
                     +----------------+----------------+
                                      |
                                      v
                    +-----------------+------------------+
                    |    Inventory Partition Router      |
                    | (services/partitionRouter.js)      |
                    +-----------------+------------------+
                                      |
           +--------------------------+--------------------------+
           |                          |                          |
           v                          v                          v
  [ Hosur Partition ]       [ Chennai Partition ]     [ Bangalore Partition ]
   inventory_hosur           inventory_chennai         inventory_bangalore
           |                          |                          |
           +--------------------------+--------------------------+
                                      |
                                      v
                      +---------------+---------------+
                      |  MongoDB 3-Node Replica Set   |
                      | Primary + 2 Secondaries (rs0) |
                      +-------------------------------+
```

---

## 3. Technology Stack

- **Frontend**: React.js 18, Vite 5, Tailwind CSS 3, Lucide React icons, Recharts, Axios, React Router 6.
- **Backend**: Node.js 20+, Express.js 4, Mongoose 8 & MongoDB Native Driver, JWT auth, bcryptjs, Morgan logging.
- **Database**: MongoDB 8.x, 3-member replica set (`rs0`), WiredTiger storage engine, MongoDB Compass GUI.
- **DevOps**: Docker, Docker Compose, Kubernetes (StatefulSets, Headless Services, Deployments, HPA, Ingress).
- **Testing**: Node.js native test runner (`node --test`), Supertest, custom concurrency and CAP benchmark harnesses.

---

## 4. Key Distributed Database Concepts Implemented

### 1. Horizontal Fragmentation by Warehouse
- Three logical partitions implemented as distinct MongoDB collections:
  - `inventory_hosur` (Warehouse A - Hosur Hub)
  - `inventory_chennai` (Warehouse B - Chennai Central Depot)
  - `inventory_bangalore` (Warehouse C - Bangalore Tech Logistics)
- Local queries achieve data locality; global queries transparently reconstruct the relation.

### 2. Vertical Fragmentation by Functional Attribute Concern
- Product catalog attributes are partitioned vertically across two physical MongoDB collections:
  - `product_details` (Descriptive attributes: `sku`, `name`, `description`, `category`, `reorderLevel`, `unit`, `createdAt`, `updatedAt`)
  - `product_pricing` (Financial attributes: `sku`, `costPrice`, `sellingPrice`, `currency`, `pricingTier`, `createdAt`, `updatedAt`)
- Common Candidate Key: `sku` (strictly indexed with `{ sku: 1 } (unique)` in both collections).
- Fragmentation Transparency: Handled by `ProductService`, which merges both fragments on-the-fly via MongoDB `$lookup` aggregation joins.
- Multi-fragment atomic operations: Handled under multi-document ACID transactions with compensating rollback safety guards.
- Compatibility: The original `products` collection is preserved as a verified compatibility source.

### 3. Replica Set & Automated Failover
- 3 nodes: 1 Primary (`mongo1`) and 2 Secondaries (`mongo2`, `mongo3`).
- Nodes exchange heartbeats every 2,000ms. If Primary dies, secondaries hold a Raft-style election requiring 2/3 quorum votes.
- The Node.js application driver automatically detects the new Primary via SDAM without restarting.

### 4. ACID Multi-Document Transactions
- Stock transfers execute under snapshot isolation and majority write concern:
  1. Atomically decrement source partition with constraint `quantity: { $gte: qty }`.
  2. Atomically increment destination partition.
  3. Insert immutable audit log into `stockmovements`.
  4. Abort and rollback if any invariant fails.

### 5. CAP Theorem & BASE Consistency Benchmark
- Compares **Strong Consistency (CP Profile)** (`w: majority`, `readPreference: primary`) against **Eventual Consistency (AP Profile)** (`w: 1`, `readPreference: secondaryPreferred`).
- Empirical write latency measured: Strong = 2.30 ms vs Eventual = 1.42 ms.

### 6. Implementation of All 8 Data Transparencies
- Location, Fragmentation (Horizontal & Vertical), Replication, Naming, Transaction, Concurrency, Failure, and Performance Transparency.

---

## 5. Quick Start (Windows / Mac / Linux)

### Native Local Execution
```powershell
# 1. Install dependencies
npm --prefix cloud-distributed-inventory\backend install
npm --prefix cloud-distributed-inventory\frontend install

# 2. Seed database
npm --prefix cloud-distributed-inventory\backend run seed

# 3. Start Backend (Terminal 1)
npm --prefix cloud-distributed-inventory\backend start

# 4. Start Frontend (Terminal 2)
npm --prefix cloud-distributed-inventory\frontend run dev
```

Visit `http://localhost:3000` and log in with:
- **Username:** `admin`
- **Password:** `password123`

---

## 6. Running with Docker Compose

```powershell
cd cloud-distributed-inventory\docker
docker compose up --build -d
```
Inspect containers: `docker compose ps`
Access UI: `http://localhost:3000`

---

## 7. Running Automated Test Suites

```powershell
# Run backend integration suite
npm --prefix cloud-distributed-inventory\backend test

# Run fragmentation test
node cloud-distributed-inventory\tests\fragmentation\test-fragmentation.js

# Run ACID transfer test
node cloud-distributed-inventory\tests\transactions\test-acid-transfer.js

# Run concurrency stress test (Race condition protection)
node cloud-distributed-inventory\tests\concurrency\test-concurrency.js

# Run live CAP theorem benchmark
node cloud-distributed-inventory\tests\cap\test-cap-base.js

# Run scalability load test
node cloud-distributed-inventory\tests\scalability\load-test.js
```

---

## 8. Documentation Sitemap

- [System Architecture](docs/architecture.md)
- [Database Schema & Documents](docs/database-schema.md)
- [Distributed Database Concepts](docs/distributed-database-concepts.md)
- [The 8 Data Transparencies](docs/transparency.md)
- [Transaction & Concurrency Management](docs/transaction-management.md)
- [Setup & Local Execution Guide](docs/setup-guide.md)
- [Cloud & Kubernetes Deployment Guide](docs/deployment-guide.md)
- [Automated Testing Evidence](docs/testing-results.md)
- [Viva Examination Questions & Answers](docs/viva-questions.md)
