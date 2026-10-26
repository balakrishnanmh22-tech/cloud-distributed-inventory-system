# Transaction Management, Concurrency & Deadlock Handling

This document provides a technical specification of transaction processing, write conflict resolution, and concurrency guarantees in the **Cloud-Based Distributed Inventory Management System**.

---

## 1. ACID Guarantees in Distributed Inventory

### A. Atomicity
Every inter-warehouse stock transfer consists of three distinct database writes:
1. Deduct quantity $Q$ from source partition $P_{from}$.
2. Add quantity $Q$ to destination partition $P_{to}$.
3. Insert an audit record into collection `stockmovements`.

In MongoDB replica set mode, these writes are wrapped in `session.startTransaction()`:
```javascript
const session = await mongoose.startSession();
session.startTransaction({
  readConcern: { level: 'snapshot' },
  writeConcern: { w: 'majority', j: true }
});
```
If any write fails (e.g. source stock is insufficient, or duplicate idempotency key is detected), `session.abortTransaction()` ensures that neither partition is updated.

### B. Consistency
The system strictly enforces the invariant:
$$\text{Stock}(P_{from}) \ge Q \quad \land \quad \text{Stock}(P) \ge 0 \quad \forall P$$

This is guaranteed via conditional queries at the storage engine level:
```javascript
const query = { sku: upperSku, warehouseId: fromWh, quantity: { $gte: qty } };
const updated = await Model.findOneAndUpdate(query, { $inc: { quantity: -qty } });
if (!updated) throw new Error('Insufficient stock in source partition');
```

### C. Isolation (Snapshot Isolation)
MongoDB multi-document transactions run under **Snapshot Isolation**. A transaction reads from a synchronized snapshot of committed data taken at the start of the transaction, preventing:
- Dirty reads
- Non-repeatable reads
- Phantom reads

### D. Durability
Committed data is acknowledged with `{ w: "majority", j: true }`, ensuring changes are written to the on-disk journal and replicated to a majority of replica set nodes before the client receives a success response.

---

## 2. Idempotency Key Mechanics

To prevent duplicate transfers caused by network timeouts or aggressive client retries:
1. Clients generate a unique `idempotencyKey` (e.g., `TRF-KEY-1728922800000`).
2. Before executing transfer logic, `TransactionService` checks `StockMovement` for an existing entry:
```javascript
if (idempotencyKey) {
  const existing = await StockMovement.findOne({ idempotencyKey });
  if (existing) {
    return { success: true, isDuplicate: true, message: 'Transfer already processed', movement: existing };
  }
}
```
3. A unique sparse index on `idempotencyKey` prevents concurrent race conditions from inserting duplicate transfers.

---

## 3. Concurrency, Deadlocks & Write Conflicts

### Distinction Between Concurrency Hazards

| Concept | Definition in This System | Resolution Strategy |
| :--- | :--- | :--- |
| **Traditional Distributed Deadlock** | Node 1 holds Resource A and waits for B, while Node 2 holds B and waits for A. | Avoided by using fine-grained document locks and unified ordering of lock acquisition. |
| **Database Write Conflict** | Two concurrent transactions attempt to modify the exact same inventory document at the same time. | Detected via WiredTiger MVCC. Resolved via **bounded exponential backoff retries** (up to 3 retries). |
| **Lock Contention** | Multiple threads queue for access to a hot SKU. | Minimized by warehouse-based horizontal fragmentation. |
| **Transaction Timeout** | A transaction exceeds the maximum lifetime (default 60s). | Mitigated by keeping transaction operations strictly limited to atomic transfer steps. |

### Exponential Backoff Retry Implementation
```javascript
let attempt = 0;
while (attempt < maxRetries) {
  attempt++;
  try {
    return await this._executeTransaction(...);
  } catch (err) {
    const isConflict = err.hasErrorLabel?.('TransientTransactionError') || err.codeName === 'WriteConflict';
    if (isConflict && attempt < maxRetries) {
      const backoff = Math.floor(Math.random() * 50 * Math.pow(2, attempt));
      await new Promise(res => setTimeout(res, backoff));
      continue;
    }
    throw err;
  }
}
```
