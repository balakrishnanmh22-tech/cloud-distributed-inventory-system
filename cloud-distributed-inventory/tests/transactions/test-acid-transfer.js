import assert from 'node:assert/strict';
import { connectDB, disconnectDB } from '../../backend/src/config/database.js';
import { PartitionRouter } from '../../backend/src/services/partitionRouter.js';
import { TransactionService } from '../../backend/src/services/transactionService.js';
import { Product } from '../../backend/src/models/Product.js';
import { StockMovement } from '../../backend/src/models/StockMovement.js';

async function run() {
  console.log('--- TEST: ACID Stock Transfers Between Partitions ---');
  await connectDB();
  await PartitionRouter.initPartitions();

  const testSku = `ACID-SKU-${Date.now()}`;

  // 1. Setup Catalog Product
  console.log('1. Setting up catalog master...');
  await Product.create({
    sku: testSku,
    name: 'ACID Verification Hardware',
    category: 'Test',
    costPrice: 50,
    sellingPrice: 100,
    reorderLevel: 5,
  });

  // 2. Initialize Hosur Partition with 20 units
  console.log('2. Seeding Hosur partition with 20 units...');
  await PartitionRouter.updateStock('HOSUR', testSku, 20, null, {
    productName: 'ACID Verification Hardware',
    category: 'Test',
  });

  // 3. Perform Valid Transfer: 8 units from Hosur to Chennai
  console.log('3. Executing transfer of 8 units from Hosur to Chennai...');
  const transferResult = await TransactionService.transferStock({
    fromWarehouse: 'HOSUR',
    toWarehouse: 'CHENNAI',
    sku: testSku,
    quantity: 8,
    reason: 'Inter-warehouse rebalancing test',
  });

  assert.equal(transferResult.success, true);
  console.log('✔ Transfer committed with transaction mode:', transferResult.transactionMode);

  // 4. Verify Quantities in Both Partitions
  const hosurStock = (await PartitionRouter.getInventoryByWarehouse('HOSUR', { sku: testSku }))[0].quantity;
  const chennaiStock = (await PartitionRouter.getInventoryByWarehouse('CHENNAI', { sku: testSku }))[0].quantity;

  assert.equal(hosurStock, 12, 'Hosur partition must be 20 - 8 = 12');
  assert.equal(chennaiStock, 8, 'Chennai partition must be 0 + 8 = 8');
  console.log(`✔ Verified: Hosur has ${hosurStock} units, Chennai has ${chennaiStock} units (Total = 20)`);

  // 5. Test Negative Inventory Guard: Attempt to transfer 30 units (insufficient)
  console.log('4. Testing constraint enforcement: Attempting to transfer 30 units (only 12 available)...');
  await assert.rejects(
    async () => {
      await TransactionService.transferStock({
        fromWarehouse: 'HOSUR',
        toWarehouse: 'CHENNAI',
        sku: testSku,
        quantity: 30,
        reason: 'Should be rejected',
      });
    },
    /Insufficient stock/,
    'Transfer must be rejected when stock is insufficient'
  );
  console.log('✔ Verified: Negative inventory constraint prevented illegal deduction');

  // Verify stock remained unchanged after rejection
  const postRejectHosur = (await PartitionRouter.getInventoryByWarehouse('HOSUR', { sku: testSku }))[0].quantity;
  assert.equal(postRejectHosur, 12, 'Hosur stock must remain unchanged after rejected transaction');
  console.log('✔ Verified: Atomicity preserved (no partial deductions)');

  // Cleanup
  await Product.deleteOne({ sku: testSku });
  await PartitionRouter.getModel('HOSUR').deleteOne({ sku: testSku });
  await PartitionRouter.getModel('CHENNAI').deleteOne({ sku: testSku });
  await StockMovement.deleteMany({ sku: testSku });
  await disconnectDB();

  console.log('--- ALL ACID TRANSACTION TESTS PASSED ---\n');
}

run().catch(err => {
  console.error('ACID Test Failed:', err);
  process.exit(1);
});
