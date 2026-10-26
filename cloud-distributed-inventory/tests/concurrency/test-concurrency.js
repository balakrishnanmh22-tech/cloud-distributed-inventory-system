import assert from 'node:assert/strict';
import { connectDB, disconnectDB } from '../../backend/src/config/database.js';
import { PartitionRouter } from '../../backend/src/services/partitionRouter.js';
import { TransactionService } from '../../backend/src/services/transactionService.js';
import { Product } from '../../backend/src/models/Product.js';

async function run() {
  console.log('--- TEST: Concurrency Transparency & Race Condition Protection ---');
  await connectDB();
  await PartitionRouter.initPartitions();

  const testSku = `CONC-SKU-${Date.now()}`;
  const initialStock = 5;

  // 1. Setup Catalog Product and 5 units in Hosur
  await Product.create({
    sku: testSku,
    name: 'Concurrent Race Item',
    category: 'Test',
    costPrice: 20,
    sellingPrice: 40,
    reorderLevel: 2,
  });

  await PartitionRouter.updateStock('HOSUR', testSku, initialStock, null, {
    productName: 'Concurrent Race Item',
    category: 'Test',
  });
  console.log(`1. Seeded Hosur partition with ${initialStock} units.`);

  // 2. Fire 6 simultaneous concurrent transfers (each requesting 2 units = 12 demanded total)
  console.log('2. Firing 6 concurrent transfers of 2 units each (Total Demanded = 12)...');
  const attempts = [];
  for (let i = 0; i < 6; i++) {
    attempts.push(
      TransactionService.transferStock({
        fromWarehouse: 'HOSUR',
        toWarehouse: 'CHENNAI',
        sku: testSku,
        quantity: 2,
        reason: `Race Request #${i + 1}`,
        idempotencyKey: `RACE-${testSku}-${i}`,
      })
      .then(res => ({ id: i + 1, status: 'SUCCESS', res }))
      .catch(err => ({ id: i + 1, status: 'REJECTED', error: err.message }))
    );
  }

  const results = await Promise.all(attempts);
  const successes = results.filter(r => r.status === 'SUCCESS');
  const rejections = results.filter(r => r.status === 'REJECTED');

  console.log(`✔ Outcomes: ${successes.length} committed, ${rejections.length} rejected safely.`);

  // 3. Verify stock invariants
  const hosurRemaining = (await PartitionRouter.getInventoryByWarehouse('HOSUR', { sku: testSku }))[0]?.quantity || 0;
  const chennaiTransferred = (await PartitionRouter.getInventoryByWarehouse('CHENNAI', { sku: testSku }))[0]?.quantity || 0;

  assert.equal(successes.length, 2, 'Exactly 2 transfers should succeed (2 * 2 = 4 units)');
  assert.equal(hosurRemaining, 1, 'Hosur should have exactly 5 - 4 = 1 unit remaining');
  assert.equal(chennaiTransferred, 4, 'Chennai should have received 4 units');
  assert.equal(hosurRemaining + chennaiTransferred, initialStock, 'Total sum of stock must be perfectly conserved');
  assert.ok(hosurRemaining >= 0, 'Negative stock must never occur');

  console.log(`✔ Verified: Hosur = ${hosurRemaining}, Chennai = ${chennaiTransferred}. Total = ${hosurRemaining + chennaiTransferred}`);
  console.log('✔ Invariants preserved: Zero lost updates, zero negative inventory balances.');

  // Cleanup
  await Product.deleteOne({ sku: testSku });
  await PartitionRouter.getModel('HOSUR').deleteOne({ sku: testSku });
  await PartitionRouter.getModel('CHENNAI').deleteOne({ sku: testSku });
  await disconnectDB();

  console.log('--- ALL CONCURRENCY TESTS PASSED ---\n');
}

run().catch(err => {
  console.error('Concurrency Test Failed:', err);
  process.exit(1);
});
