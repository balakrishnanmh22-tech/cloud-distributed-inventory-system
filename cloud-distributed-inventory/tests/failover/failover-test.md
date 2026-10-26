# Failover and High Availability Verification Guide

This document describes the exact steps, commands, and observations for conducting **controlled fault tolerance experiments** on the Cloud-Based Distributed Inventory Management System.

---

## 1. Test Scenario 1: MongoDB Primary Node Failure & Quorum Election

### Objective
Verify that when the current MongoDB Primary node terminates abruptly:
1. Surviving secondaries elect a new Primary using Raft-style quorum consensus (2 out of 3 votes).
2. The Node.js application driver automatically detects the new Primary via SDAM without requiring server restart.
3. Inventory operations continue with zero data corruption.

### Setup (Docker Compose or Native Local RS)
- 3 nodes active: `mongo1` (port 27018), `mongo2` (port 27019), `mongo3` (port 27020).
- `mongo1` is currently `PRIMARY`.

### Execution Steps
```bash
# Step 1: Insert verification record into Hosur partition
curl -X POST http://localhost:5000/api/stock/in \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <TOKEN>" \
  -d '{"warehouseId":"HOSUR", "sku":"DELL-XPS-15", "quantity":5, "reason":"Pre-failover check"}'

# Step 2: Identify and terminate the Primary container (mongo1)
docker stop cdi-mongo1
# (Or in local native RS: Stop-Process on node 1 PID)

# Step 3: Inspect surviving nodes election status
docker exec -it cdi-mongo2 mongosh --eval "rs.status().members.map(m => ({ name: m.name, stateStr: m.stateStr, health: m.health }))"
```

### Observed Behavior
1. Within 10 seconds (election timeout + heartbeat intervals), `mongo2` or `mongo3` transitions from `SECONDARY` to `PRIMARY`.
2. `cdi-mongo1` is marked as `health: 0` (unreachable).
3. Surviving nodes form 2/3 majority, satisfying quorum.
4. Next inventory transfer command issued to `http://localhost:5000/api/stock/transfer` succeeds after brief driver reconnection window.

---

## 2. Test Scenario 2: Backend Pod Crash & Self-Healing in Kubernetes

### Objective
Verify that when an application pod crashes in Kubernetes:
1. Kubernetes ReplicaSet controller detects the deficit.
2. Traffic is routed immediately to the remaining healthy ready pod.
3. A replacement pod is scheduled and enters `Ready` state after passing readiness probes.

### Execution Steps
```bash
# Step 1: List backend pods
kubectl get pods -n cloud-inventory -l app=backend

# Step 2: Delete one active backend pod
kubectl delete pod -n cloud-inventory <POD_NAME> --now

# Step 3: Continuously curl health endpoint during deletion
for i in {1..15}; do curl -s http://localhost:5000/api/health | jq .status; sleep 1; done

# Step 4: Verify Kubernetes created a replacement pod
kubectl get pods -n cloud-inventory -l app=backend
```

### Observed Behavior
- Zero HTTP 502/503 dropped requests because the Kubernetes Service removes the terminating pod from its endpoints and sends traffic only to ready pods.
- The desired replica count (2) is restored within ~8 seconds.
