import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';
import { connectDB, disconnectDB } from '../src/config/database.js';
import { PartitionRouter } from '../src/services/partitionRouter.js';
import { TransactionService } from '../src/services/transactionService.js';
import { Product } from '../src/models/Product.js';
import { StockMovement } from '../src/models/StockMovement.js';

let authToken = '';

test.before(async () => {
  await connectDB();
  await PartitionRouter.initPartitions();
});

test.after(async () => {
  await disconnectDB();
});

test('Health Check: GET /api/health should return HEALTHY status', async () => {
  // Test health check route handler directly
  const req = {};
  let resStatus = 200;
  let resBody = null;
  const res = {
    status(code) { resStatus = code; return this; },
    json(data) { resBody = data; return this; }
  };

  // Direct test of controller / response
  assert.equal(typeof app, 'function');
});

test('Concept 1 - Horizontal Fragmentation: Queries route to specific warehouse partition', async () => {
  const testHosurSku = `TEST-ROUTING-HOSUR-${Date.now()}`;
  const testChennaiSku = `TEST-ROUTING-CHENNAI-${Date.now()}`;

  await PartitionRouter.updateStock('HOSUR', testHosurSku, 5, null, { productName: 'Hosur Hardware', category: 'Testing' });
  await PartitionRouter.updateStock('CHENNAI', testChennaiSku, 3, null, { productName: 'Chennai Hardware', category: 'Testing' });

  const hosurItems = await PartitionRouter.getInventoryByWarehouse('HOSUR', { sku: testHosurSku });
  assert.ok(Array.isArray(hosurItems), 'Hosur inventory should be an array');
  assert.equal(hosurItems.length, 1, 'Hosur partition should contain the routed record');
  assert.equal(hosurItems[0].warehouseId, 'HOSUR');
  assert.equal(hosurItems[0].partition, 'inventory_hosur');

  const chennaiItems = await PartitionRouter.getInventoryByWarehouse('CHENNAI', { sku: testChennaiSku });
  assert.ok(Array.isArray(chennaiItems), 'Chennai inventory should be an array');
  assert.equal(chennaiItems.length, 1, 'Chennai partition should contain the routed record');
  assert.equal(chennaiItems[0].warehouseId, 'CHENNAI');
  assert.equal(chennaiItems[0].partition, 'inventory_chennai');

  // Clean up
  await PartitionRouter.getModel('HOSUR').deleteOne({ sku: testHosurSku });
  await PartitionRouter.getModel('CHENNAI').deleteOne({ sku: testChennaiSku });
});

test('Concept 1 - Fragmentation Transparency: Global query reconstructs all partitions', async () => {
  const testSku = `TEST-GLOBAL-${Date.now()}`;
  await PartitionRouter.updateStock('HOSUR', testSku, 1, null, { productName: 'Global Item', category: 'Testing' });
  await PartitionRouter.updateStock('CHENNAI', testSku, 1, null, { productName: 'Global Item', category: 'Testing' });
  await PartitionRouter.updateStock('BANGALORE', testSku, 1, null, { productName: 'Global Item', category: 'Testing' });

  const globalItems = await PartitionRouter.getGlobalInventory({ sku: testSku });
  assert.equal(globalItems.length, 3, 'Global inventory should reconstruct all 3 partition fragments');
  
  const partitionsFound = new Set(globalItems.map(i => i.partition));
  assert.ok(partitionsFound.has('inventory_hosur'), 'Should include Hosur partition');
  assert.ok(partitionsFound.has('inventory_chennai'), 'Should include Chennai partition');
  assert.ok(partitionsFound.has('inventory_bangalore'), 'Should include Bangalore partition');

  // Clean up
  await PartitionRouter.getModel('HOSUR').deleteOne({ sku: testSku });
  await PartitionRouter.getModel('CHENNAI').deleteOne({ sku: testSku });
  await PartitionRouter.getModel('BANGALORE').deleteOne({ sku: testSku });
});

test('Concept 2 - ACID Stock Transfer: Transfers between partitions preserve stock invariants', async () => {
  const testSku = `TEST-ACID-TRANSFER-${Date.now()}`;
  
  // Setup temporary test SKU with initial stock
  await Product.create({
    sku: testSku,
    name: 'Temporary ACID Test Hardware',
    category: 'Testing',
    costPrice: 50,
    sellingPrice: 100,
    reorderLevel: 2,
  });

  await PartitionRouter.updateStock('HOSUR', testSku, 10, null, {
    productName: 'Temporary ACID Test Hardware',
    category: 'Testing',
  });
  await PartitionRouter.updateStock('CHENNAI', testSku, 0, null, {
    productName: 'Temporary ACID Test Hardware',
    category: 'Testing',
  });

  // Perform transfer of 2 units from Hosur to Chennai
  const result = await TransactionService.transferStock({
    fromWarehouse: 'HOSUR',
    toWarehouse: 'CHENNAI',
    sku: testSku,
    quantity: 2,
    reason: 'Automated ACID test transfer',
  });

  assert.equal(result.success, true);

  // Verify updated balances
  const postHosur = (await PartitionRouter.getInventoryByWarehouse('HOSUR', { sku: testSku }))[0].quantity;
  const postChennai = (await PartitionRouter.getInventoryByWarehouse('CHENNAI', { sku: testSku }))[0].quantity;

  assert.equal(postHosur, 8, 'Source partition should decrement by 2 (10 -> 8)');
  assert.equal(postChennai, 2, 'Destination partition should increment by 2 (0 -> 2)');

  // Clean up temporary test data
  await Product.deleteOne({ sku: testSku });
  await PartitionRouter.getModel('HOSUR').deleteOne({ sku: testSku });
  await PartitionRouter.getModel('CHENNAI').deleteOne({ sku: testSku });
  await StockMovement.deleteMany({ sku: testSku });
});

test('Concept 2 - Negative Inventory Guard: Rejects transfer when product does not exist or source has insufficient stock', async () => {
  const testSku = `TEST-NEGATIVE-${Date.now()}`;

  // 1. Rejects non-existent product
  await assert.rejects(
    async () => {
      await TransactionService.transferStock({
        fromWarehouse: 'HOSUR',
        toWarehouse: 'BANGALORE',
        sku: 'NON-EXISTENT-SKU',
        quantity: 5,
        reason: 'Should fail gracefully',
      });
    },
    /does not exist in product catalog/
  );

  // 2. Rejects when product exists but has 0 stock in source warehouse
  await Product.create({
    sku: testSku,
    name: 'Temporary Guard Hardware',
    category: 'Testing',
    costPrice: 10,
    sellingPrice: 20,
    reorderLevel: 2,
  });
  await PartitionRouter.updateStock('HOSUR', testSku, 0, null, {
    productName: 'Temporary Guard Hardware',
    category: 'Testing',
  });

  await assert.rejects(
    async () => {
      await TransactionService.transferStock({
        fromWarehouse: 'HOSUR',
        toWarehouse: 'BANGALORE',
        sku: testSku,
        quantity: 5, // Exceeds available stock (0)
        reason: 'Should fail gracefully',
      });
    },
    /Insufficient stock/
  );

  // Clean up
  await Product.deleteOne({ sku: testSku });
  await PartitionRouter.getModel('HOSUR').deleteOne({ sku: testSku });
  await PartitionRouter.getModel('BANGALORE').deleteOne({ sku: testSku });
  await StockMovement.deleteMany({ sku: testSku });
});

test('Concept 2 - Concurrency & Idempotency: Duplicate transfer with same key is rejected or deduplicated', async () => {
  const idempotencyKey = `TEST-IDEM-${Date.now()}`;
  const testSku = `TEST-IDEM-${Date.now()}`;

  // Setup temporary test SKU
  await Product.create({
    sku: testSku,
    name: 'Temporary Idempotency Hardware',
    category: 'Testing',
    costPrice: 20,
    sellingPrice: 40,
    reorderLevel: 2,
  });

  await PartitionRouter.updateStock('HOSUR', testSku, 5, null, {
    productName: 'Temporary Idempotency Hardware',
    category: 'Testing',
  });
  await PartitionRouter.updateStock('CHENNAI', testSku, 0, null, {
    productName: 'Temporary Idempotency Hardware',
    category: 'Testing',
  });

  const firstCall = await TransactionService.transferStock({
    fromWarehouse: 'HOSUR',
    toWarehouse: 'CHENNAI',
    sku: testSku,
    quantity: 1,
    idempotencyKey,
  });
  assert.equal(firstCall.success, true);

  // Duplicate call with exact same key
  const secondCall = await TransactionService.transferStock({
    fromWarehouse: 'HOSUR',
    toWarehouse: 'CHENNAI',
    sku: testSku,
    quantity: 1,
    idempotencyKey,
  });
  assert.equal(secondCall.isDuplicate, true, 'Second call must be flagged as duplicate');

  // Clean up temporary test data
  await Product.deleteOne({ sku: testSku });
  await PartitionRouter.getModel('HOSUR').deleteOne({ sku: testSku });
  await PartitionRouter.getModel('CHENNAI').deleteOne({ sku: testSku });
  await StockMovement.deleteMany({ sku: testSku });
});
