# Setup & Local Execution Guide

This guide explains how to set up, run, and test the **Cloud-Based Distributed Inventory Management System** on your local machine (Windows, macOS, or Linux).

---

## 1. Prerequisites

- **Node.js**: v18.0.0 or higher (Tested with v24.13.1)
- **MongoDB**: v6.0 or higher (Installed locally or via Docker)
- **Git** & **PowerShell / Terminal**
- *(Optional)* **Docker Desktop** for multi-container and Kubernetes deployments.
- *(Optional)* **MongoDB Compass** for visual database inspection.

---

## 2. Quick Start: Local Native Execution (Fastest)

### Step 1: Install Dependencies
Open your terminal in the workspace and install packages for both backend and frontend:

```powershell
# In backend
npm --prefix cloud-distributed-inventory\backend install

# In frontend
npm --prefix cloud-distributed-inventory\frontend install
```

### Step 2: Ensure MongoDB Is Running
If MongoDB is installed as a Windows service (default), verify it is active:
```powershell
Get-Service MongoDB
```

### Step 3: Seed Database
Populate the 3 warehouse partitions, product catalog, and admin credentials:
```powershell
npm --prefix cloud-distributed-inventory\backend run seed
```

### Step 4: Start Backend Server
```powershell
npm --prefix cloud-distributed-inventory\backend start
```
*Backend runs on `http://localhost:5000`.*
*Health Check: `http://localhost:5000/api/health`.*

### Step 5: Start Frontend Dashboard
Open a second terminal window:
```powershell
npm --prefix cloud-distributed-inventory\frontend run dev
```
*Frontend runs on `http://localhost:3000`.*

### Step 6: Log In
- **URL:** `http://localhost:3000`
- **Username:** `admin`
- **Password:** `password123`
- *(Or click the "Click to auto-fill Viva Demo Credentials" pill on the login screen).*

---

## 3. Running with 3-Member MongoDB Replica Set (Native Windows)

To demonstrate multi-node replica set election, failover, and native multi-document ACID transactions without Docker:

```powershell
# Launch 3 mongod instances on ports 27018, 27019, 27020 and initiate rs0
.\cloud-distributed-inventory\database\replica-set\launch-local-rs.ps1
```

Update `backend/.env`:
```env
MONGODB_URI=mongodb://127.0.0.1:27018,127.0.0.1:27019,127.0.0.1:27020/distributed_inventory?replicaSet=rs0
```

To stop the native replica set when finished:
```powershell
.\cloud-distributed-inventory\database\replica-set\stop-local-rs.ps1
```

---

## 4. Running with Docker Compose

To run the entire distributed stack (3 MongoDB replica nodes + backend + frontend Nginx) in Docker:

```powershell
cd cloud-distributed-inventory\docker
docker compose up --build -d
```

### Inspect Container Status
```powershell
docker compose ps
```

### Verify Replica Set Quorum
```powershell
docker exec -it cdi-mongo1 mongosh --eval "rs.status()"
```

### Stop Containers
```powershell
docker compose down
```

---

## 5. Visual Inspection with MongoDB Compass

1. Launch **MongoDB Compass**.
2. Connect to URI:
   ```
   mongodb://127.0.0.1:27017/distributed_inventory
   ```
3. Expand database `distributed_inventory`.
4. Inspect the collections:
   - `inventory_hosur`: Items localized in Hosur
   - `inventory_chennai`: Items localized in Chennai
   - `inventory_bangalore`: Items localized in Bangalore
   - `products`: Catalog definitions
   - `stockmovements`: Immutable transaction ledger

---

## 6. Running Automated Integration Tests

To run the full test suite verifying fragmentation, transactions, concurrency, and CAP benchmarks:

```powershell
# Run all backend tests
npm --prefix cloud-distributed-inventory\backend test

# Run specific distributed tests
node cloud-distributed-inventory\tests\fragmentation\test-fragmentation.js
node cloud-distributed-inventory\tests\transactions\test-acid-transfer.js
node cloud-distributed-inventory\tests\concurrency\test-concurrency.js
node cloud-distributed-inventory\tests\cap\test-cap-base.js
node cloud-distributed-inventory\tests\scalability\load-test.js
```
