import assert from 'node:assert/strict';
import { connectDB, disconnectDB } from '../../backend/src/config/database.js';
import { PartitionRouter, WAREHOUSE_PARTITIONS } from '../../backend/src/services/partitionRouter.js';

async function run() {
  console.log('--- TEST: Horizontal Warehouse Fragmentation & Locality ---');
  await connectDB();
  await PartitionRouter.initPartitions();

  const testSku = `TEST-FRAG-${Date.now()}`;

  // 1. Write to Hosur partition only
  console.log('1. Inserting item into HOSUR partition...');
  await PartitionRouter.updateStock('HOSUR', testSku, 50, null, {
    productName: 'Frag Test Product',
    category: 'Testing',
  });

  // 2. Verify item exists in HOSUR partition
  const hosurItems = await PartitionRouter.getInventoryByWarehouse('HOSUR', { sku: testSku });
  assert.equal(hosurItems.length, 1, 'Item must exist in Hosur partition');
  assert.equal(hosurItems[0].quantity, 50);
  assert.equal(hosurItems[0].partition, 'inventory_hosur');
  console.log('✔ Verified: Item stored in physical collection inventory_hosur');

  // 3. Verify item DOES NOT exist in Chennai partition (Physical isolation)
  const chennaiItems = await PartitionRouter.getInventoryByWarehouse('CHENNAI', { sku: testSku });
  assert.equal(chennaiItems.length, 0, 'Item must NOT exist in Chennai partition');
  console.log('✔ Verified: Physical isolation preserved (Item absent in inventory_chennai)');

  // 4. Verify Global Reconstruction (Fragmentation Transparency)
  const globalItems = await PartitionRouter.getGlobalInventory({ sku: testSku });
  assert.equal(globalItems.length, 1, 'Global query must locate the item');
  assert.equal(globalItems[0].partition, 'inventory_hosur');
  console.log('✔ Verified: Global query reconstructs item across partitions transparently');

  // Cleanup
  await PartitionRouter.getModel('HOSUR').deleteOne({ sku: testSku });
  await disconnectDB();
  console.log('--- ALL FRAGMENTATION TESTS PASSED ---\n');
}

run().catch(err => {
  console.error('Fragmentation Test Failed:', err);
  process.exit(1);
});
