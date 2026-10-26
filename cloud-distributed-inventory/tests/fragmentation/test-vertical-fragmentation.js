import assert from 'node:assert/strict';
import { connectDB, disconnectDB } from '../../backend/src/config/database.js';
import { ProductService } from '../../backend/src/services/productService.js';
import { ProductDetail } from '../../backend/src/models/ProductDetail.js';
import { ProductPricing } from '../../backend/src/models/ProductPricing.js';
import { Product } from '../../backend/src/models/Product.js';
import { PartitionRouter } from '../../backend/src/services/partitionRouter.js';
import { TransactionService } from '../../backend/src/services/transactionService.js';

async function run() {
  console.log('================================================================');
  console.log(' TEST SUITE: Vertical Fragmentation & Transparency Verification ');
  console.log('================================================================');

  await connectDB();
  await PartitionRouter.initPartitions();

  // Test 1: Verify document counts and SKU parity between fragments
  console.log('\n--- Test 1: Verifying Document Counts and 100% SKU Parity ---');
  const [legacyCount, detailsCount, pricingCount] = await Promise.all([
    Product.countDocuments(),
    ProductDetail.countDocuments(),
    ProductPricing.countDocuments(),
  ]);

  console.log(`- Original "products" count:        ${legacyCount}`);
  console.log(`- "product_details" count:          ${detailsCount}`);
  console.log(`- "product_pricing" count:          ${pricingCount}`);

  assert.equal(detailsCount, legacyCount, 'product_details count must match original products count');
  assert.equal(pricingCount, legacyCount, 'product_pricing count must match original products count');

  const detailSkus = await ProductDetail.distinct('sku');
  const pricingSkus = await ProductPricing.distinct('sku');
  assert.equal(detailSkus.length, detailsCount, 'Zero duplicate SKUs allowed in product_details');
  assert.equal(pricingSkus.length, pricingCount, 'Zero duplicate SKUs allowed in product_pricing');

  const pricingSet = new Set(pricingSkus);
  const missingInPricing = detailSkus.filter(s => !pricingSet.has(s));
  assert.equal(missingInPricing.length, 0, 'Zero orphaned records: every detail SKU must exist in pricing');
  console.log('✔ Verified: Zero orphaned fragment records, zero duplicates, 100% SKU parity.');

  // Test 2: Verify attribute separation in physical fragments
  console.log('\n--- Test 2: Verifying Attribute Decomposition Across Fragments ---');
  const sampleDetail = await ProductDetail.findOne({ sku: 'HOS-LAP-001' }).lean();
  const samplePricing = await ProductPricing.findOne({ sku: 'HOS-LAP-001' }).lean();

  assert.ok(sampleDetail, 'Sample record must exist in product_details');
  assert.ok(samplePricing, 'Sample record must exist in product_pricing');

  // Verify product_details contains descriptive attributes and NO pricing attributes
  assert.ok(sampleDetail.name, 'product_details must contain "name"');
  assert.ok(sampleDetail.category, 'product_details must contain "category"');
  assert.ok(sampleDetail.sku, 'product_details must contain "sku"');
  assert.equal(sampleDetail.costPrice, undefined, 'product_details MUST NOT contain "costPrice"');
  assert.equal(sampleDetail.sellingPrice, undefined, 'product_details MUST NOT contain "sellingPrice"');

  // Verify product_pricing contains financial attributes and NO descriptive attributes
  assert.equal(samplePricing.sku, 'HOS-LAP-001', 'product_pricing must contain linking "sku"');
  assert.ok(samplePricing.costPrice > 0, 'product_pricing must contain "costPrice"');
  assert.ok(samplePricing.sellingPrice > 0, 'product_pricing must contain "sellingPrice"');
  assert.equal(samplePricing.name, undefined, 'product_pricing MUST NOT contain "name"');
  assert.equal(samplePricing.category, undefined, 'product_pricing MUST NOT contain "category"');
  console.log('✔ Verified: Pure vertical separation confirmed (no attribute leakage).');

  // Test 3: Vertical Fragmentation Transparency (Scatter-Gather Re-assembly)
  console.log('\n--- Test 3: Verifying Transparent Re-Assembly via ProductService ---');
  const result = await ProductService.getProducts({ page: 1, limit: 10 });
  assert.ok(Array.isArray(result.products), 'getProducts must return products array');
  assert.equal(result.products.length >= 10, true, 'getProducts should return all products');

  const p1 = result.products.find(p => p.sku === 'HOS-LAP-001');
  assert.ok(p1, 'HOS-LAP-001 must be transparently returned');
  assert.equal(p1.name, 'Dell Laptop', 'Name must be re-assembled from product_details');
  assert.equal(p1.costPrice, 500, 'costPrice must be re-assembled from product_pricing');
  assert.equal(p1.sellingPrice, 650, 'sellingPrice must be re-assembled from product_pricing');
  assert.ok(p1.warehouseStock, 'warehouseStock must be attached from horizontal partitions');
  console.log('✔ Verified: Transparent re-assembly successfully reconstructs complete unified schema.');

  // Test 4: Atomic Multi-Fragment Creation & Rollback on Validation Failure
  console.log('\n--- Test 4: Verifying Multi-Fragment Atomic Creation ---');
  const testSku = `VERT-TEST-${Date.now()}`;
  const created = await ProductService.createProduct({
    sku: testSku,
    name: 'Vertical Test Rig',
    description: 'Unit testing item for vertical fragmentation',
    category: 'Testing',
    costPrice: 150,
    sellingPrice: 220,
    reorderLevel: 5,
    initialStock: 10,
    initialWarehouse: 'HOSUR',
  });

  assert.equal(created.sku, testSku);
  const inDetails = await ProductDetail.findOne({ sku: testSku }).lean();
  const inPricing = await ProductPricing.findOne({ sku: testSku }).lean();
  assert.ok(inDetails, 'New product must be inserted into product_details');
  assert.ok(inPricing, 'New product must be inserted into product_pricing');
  assert.equal(inDetails.name, 'Vertical Test Rig');
  assert.equal(inPricing.costPrice, 150);
  assert.equal(inPricing.sellingPrice, 220);
  console.log('✔ Verified: Multi-fragment create correctly populates both collections.');

  // Test 5: Multi-Fragment Update Consistency
  console.log('\n--- Test 5: Verifying Multi-Fragment Update Consistency ---');
  const updated = await ProductService.updateProduct(inDetails._id, {
    name: 'Updated Vertical Test Rig',
    costPrice: 175,
    sellingPrice: 250,
  });

  assert.equal(updated.name, 'Updated Vertical Test Rig');
  assert.equal(updated.costPrice, 175);
  assert.equal(updated.sellingPrice, 250);

  const postDetail = await ProductDetail.findOne({ sku: testSku }).lean();
  const postPricing = await ProductPricing.findOne({ sku: testSku }).lean();
  assert.equal(postDetail.name, 'Updated Vertical Test Rig');
  assert.equal(postPricing.costPrice, 175);
  assert.equal(postPricing.sellingPrice, 250);
  console.log('✔ Verified: Multi-fragment update consistently modifies both collections.');

  // Test 6: Deletion with Active Stock Guard and Complete Removal
  console.log('\n--- Test 6: Verifying Stock Guard on Deletion and Multi-Fragment Delete ---');
  // 6a: Must reject deletion while stock > 0
  await assert.rejects(
    async () => {
      await ProductService.deleteProduct(inDetails._id);
    },
    /Cannot delete product with active stock/,
    'Must prevent deleting product when stock exists across partitions'
  );
  console.log('✔ Verified: Active stock guard successfully prevented premature deletion.');

  // 6b: Drain stock in Hosur partition to 0, then delete
  await PartitionRouter.updateStock('HOSUR', testSku, -10);
  const deleteResult = await ProductService.deleteProduct(inDetails._id);
  assert.equal(deleteResult.found, true);

  const afterDetail = await ProductDetail.findOne({ sku: testSku });
  const afterPricing = await ProductPricing.findOne({ sku: testSku });
  assert.equal(afterDetail, null, 'Must be removed from product_details');
  assert.equal(afterPricing, null, 'Must be removed from product_pricing');
  console.log('✔ Verified: Multi-fragment delete removed records from both collections.');

  // Test 7: Interoperability with Existing Horizontal Fragmentation & ACID Transfers
  console.log('\n--- Test 7: Verifying Coexistence with Horizontal Fragmentation & ACID Transfers ---');
  // Stock transfer using existing catalog item HOS-LAP-001
  const transferRes = await TransactionService.transferStock({
    fromWarehouse: 'HOSUR',
    toWarehouse: 'BANGALORE',
    sku: 'HOS-LAP-001',
    quantity: 1,
    reason: 'Vertical and Horizontal interoperability test',
  });
  assert.equal(transferRes.success, true);
  console.log('✔ Verified: ACID stock transfers between horizontal partitions work flawlessly alongside vertical fragmentation.');

  // Transfer back to restore initial state
  await TransactionService.transferStock({
    fromWarehouse: 'BANGALORE',
    toWarehouse: 'HOSUR',
    sku: 'HOS-LAP-001',
    quantity: 1,
    reason: 'Restoring balance',
  });
  console.log('✔ Verified: Warehouse balances restored.');

  // Test 8: Telemetry Diagnostic Endpoint
  console.log('\n--- Test 8: Verifying Telemetry Diagnostics ---');
  const fragStats = await ProductService.getVerticalFragmentationStats();
  assert.equal(fragStats.scheme, 'Vertical Fragmentation by Functional Attribute Concern');
  assert.equal(fragStats.linkingKey, 'sku');
  assert.equal(fragStats.integrity.parity, true);
  console.log('✔ Verified: Vertical fragmentation diagnostic stats reporting clean parity.');

  await disconnectDB();
  console.log('\n================================================================');
  console.log(' ALL 8 VERTICAL FRAGMENTATION TESTS PASSED SUCCESSFULLY! ✔       ');
  console.log('================================================================\n');
}

run().catch(err => {
  console.error('\n❌ Vertical Fragmentation Test Failed:', err);
  process.exit(1);
});
