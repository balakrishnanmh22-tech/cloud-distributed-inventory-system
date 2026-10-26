# Database Schema & NoSQL Document Model

This document outlines the NoSQL schema design, physical collection fragmentation, constraints, indexes, and sample JSON payloads for the **Cloud-Based Distributed Inventory Management System**.

---

## 1. MongoDB Collections Overview

| Collection Name | Classification | Partitioning Scheme | Key Indexes |
| :--- | :--- | :--- | :--- |
| `products` | Master Entity | Global Catalog | `sku` (Unique), `category` |
| `warehouses` | Configuration | Global Metadata | `code` (Unique), `partitionCollection` |
| `inventory_hosur` | **Horizontal Partition** | Warehouse Locality (HOSUR) | `sku` (Unique), `category` |
| `inventory_chennai` | **Horizontal Partition** | Warehouse Locality (CHENNAI) | `sku` (Unique), `category` |
| `inventory_bangalore`| **Horizontal Partition** | Warehouse Locality (BANGALORE)| `sku` (Unique), `category` |
| `stockmovements` | Transaction Audit | Append-Only Ledger | `movementId` (Unique), `idempotencyKey` (Sparse Unique), `timestamp` |
| `performancemetrics`| Benchmark Telemetry| Timeseries Metrics | `testId` (Unique), `timestamp` |
| `users` | Security | Identity Store | `username` (Unique) |

---

## 2. Detailed Collection Schemas

### A. `products` (Product Catalog Master)
Stores product definitions and prices without duplicating transient stock counts.

```json
{
  "_id": { "$oid": "670da1f498c1192ef9a01a01" },
  "sku": "DELL-XPS-15",
  "name": "Dell XPS 15 OLED Laptop",
  "description": "Intel Core i7, 32GB RAM, 1TB NVMe, RTX 4060",
  "category": "Computing",
  "costPrice": 1200.00,
  "sellingPrice": 1599.00,
  "reorderLevel": 5,
  "unit": "units",
  "createdAt": "2026-10-14T16:00:00.000Z",
  "updatedAt": "2026-10-14T16:00:00.000Z"
}
```

### B. `inventory_hosur` (Horizontal Partition A - Hosur Hub)
Each document represents localized stock for a specific SKU in the Hosur warehouse.

```json
{
  "_id": { "$oid": "670da1f498c1192ef9a01b12" },
  "sku": "DELL-XPS-15",
  "productName": "Dell XPS 15 OLED Laptop",
  "category": "Computing",
  "warehouseId": "HOSUR",
  "quantity": 25,
  "reorderLevel": 5,
  "costPrice": 1200.00,
  "sellingPrice": 1599.00,
  "reservedQuantity": 0,
  "lastUpdated": "2026-10-14T16:15:30.000Z"
}
```

### C. `inventory_chennai` (Horizontal Partition B - Chennai Depot)
```json
{
  "_id": { "$oid": "670da1f498c1192ef9a01c23" },
  "sku": "MACBOOK-PRO-14",
  "productName": "Apple MacBook Pro M3 14\"",
  "category": "Computing",
  "warehouseId": "CHENNAI",
  "quantity": 30,
  "reorderLevel": 8,
  "costPrice": 1500.00,
  "sellingPrice": 1999.00,
  "reservedQuantity": 0,
  "lastUpdated": "2026-10-14T16:20:00.000Z"
}
```

### D. `stockmovements` (Immutable Audit & ACID Ledger)
Tracks every stock intake, order dispatch, and cross-partition transfer.

```json
{
  "_id": { "$oid": "670da1f498c1192ef9a01d34" },
  "movementId": "TRF-1728922800000-A9F",
  "type": "TRANSFER",
  "sku": "DELL-XPS-15",
  "productName": "Dell XPS 15 OLED Laptop",
  "fromWarehouse": "HOSUR",
  "toWarehouse": "CHENNAI",
  "quantity": 4,
  "reason": "Regional stock rebalancing",
  "idempotencyKey": "IDEM-ORDER-8821",
  "transactionId": "670da1f498c1192ef9a01e45",
  "status": "COMMITTED",
  "performedBy": "admin",
  "timestamp": "2026-10-14T16:30:00.000Z"
}
```

---

## 3. Visual Inspection Using MongoDB Compass

MongoDB Compass is an official graphical client used to inspect, query, and analyze MongoDB data structures.

1. Open **MongoDB Compass**.
2. Connect to URI: `mongodb://127.0.0.1:27017/distributed_inventory` (or replica set URI `mongodb://127.0.0.1:27018,127.0.0.1:27019,127.0.0.1:27020/distributed_inventory?replicaSet=rs0`).
3. Select database `distributed_inventory`.
4. Observe the separate collections:
   - Notice that `inventory_hosur` contains items located only in Hosur.
   - Notice that `inventory_chennai` contains items located only in Chennai.
   - Notice that `stockmovements` records every transaction committed by the backend.
