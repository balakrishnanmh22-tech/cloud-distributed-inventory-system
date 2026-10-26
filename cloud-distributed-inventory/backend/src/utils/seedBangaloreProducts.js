import { connectDB, disconnectDB } from '../config/database.js';
import { PartitionRouter, WAREHOUSE_PARTITIONS } from '../services/partitionRouter.js';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { StockMovement } from '../models/StockMovement.js';

export const TARGET_SKUS = [
  'HOS-LAP-001',
  'HOS-MOU-002',
  'HOS-KEY-003',
  'HOS-MON-004',
  'HOS-USB-005',
  'HOS-SSD-006',
  'HOS-HDP-007',
  'HOS-WEB-008',
  'HOS-ROU-009',
  'HOS-UPS-010',
];

export async function seedBangaloreProducts({ quiet = false } = {}) {
  const log = (...args) => { if (!quiet) console.log(...args); };

  log('====================================================');
  log(' Cloud Inventory: Bulk-Seed Bangalore Sample Stock ');
  log('====================================================');

  await connectDB();
  await PartitionRouter.initPartitions();

  const BangaloreModel = PartitionRouter.getModel('BANGALORE');
  const HosurModel = PartitionRouter.getModel('HOSUR');
  const ChennaiModel = PartitionRouter.getModel('CHENNAI');

  // Step 1: Verify existing Product Catalog entries (do not duplicate Product documents)
  const existingProducts = await Product.find({ sku: { $in: TARGET_SKUS } }).lean();
  const existingProductMap = new Map(existingProducts.map(p => [p.sku, p]));

  if (existingProducts.length === 0) {
    log('[Error] No sample products found in Product Catalog. Run catalog seed first.');
    return { status: 'FAILED_MISSING_CATALOG', foundProducts: 0 };
  }

  const missingSkus = TARGET_SKUS.filter(sku => !existingProductMap.has(sku));
  if (missingSkus.length > 0) {
    log(`[Error] Missing ${missingSkus.length} catalog product(s): ${missingSkus.join(', ')}`);
    return { status: 'FAILED_INCOMPLETE_CATALOG', missingSkus };
  }

  log(`[Catalog Reused] Found all ${existingProducts.length} existing products in catalog. No new catalog products will be created.`);

  // Step 2: Snapshot other warehouses to guarantee invariant non-modification
  const initialHosurDocs = await HosurModel.find({ sku: { $in: TARGET_SKUS } }).lean();
  const initialHosurStock = initialHosurDocs.reduce((acc, curr) => acc + curr.quantity, 0);

  const initialChennaiDocs = await ChennaiModel.find({ sku: { $in: TARGET_SKUS } }).lean();
  const initialChennaiStock = initialChennaiDocs.reduce((acc, curr) => acc + curr.quantity, 0);

  // Step 3: Check Bangalore partition for idempotency and prevent stock accumulation
  const existingBangaloreInventory = await BangaloreModel.find({ sku: { $in: TARGET_SKUS } }).lean();
  const existingBangaloreSkus = existingBangaloreInventory.map(i => i.sku);

  if (existingBangaloreSkus.length === TARGET_SKUS.length) {
    const allTenUnits = existingBangaloreInventory.every(i => i.quantity === 10);
    if (allTenUnits) {
      log('[Idempotent Check] All 10 sample products already exist in Bangalore partition with 10 units each.');
      log('[Action] No changes made to prevent stock accumulation or duplicate entries.');
      return {
        status: 'ALREADY_INITIALIZED',
        catalogProductsReused: existingProducts.length,
        bangaloreCount: existingBangaloreInventory.length,
        totalBangaloreStock: existingBangaloreInventory.reduce((acc, curr) => acc + curr.quantity, 0),
        hosurStockUnchanged: initialHosurStock,
        chennaiStockUnchanged: initialChennaiStock,
      };
    }
  }

  if (existingBangaloreSkus.length > 0) {
    const conflicting = existingBangaloreSkus;
    log(`[Safety Warning] Cannot proceed. Found ${conflicting.length} existing record(s) in Bangalore partition: ${conflicting.join(', ')}`);
    log('[Action] Halted to avoid duplicate entries or unintended stock mutation.');
    return {
      status: 'HALTED_CONFLICT',
      conflictingSkus: conflicting,
    };
  }

  // Step 4: Add exactly 10 units per product to Bangalore partition only
  const initializedBangalore = [];
  const recordedMovements = [];

  try {
    for (const sku of TARGET_SKUS) {
      const product = existingProductMap.get(sku);

      // Route strictly to BANGALORE partition
      const updatedDoc = await PartitionRouter.updateStock(
        'BANGALORE',
        product.sku,
        10,
        null,
        {
          productName: product.name,
          category: product.category,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          reorderLevel: product.reorderLevel || 10,
        }
      );
      initializedBangalore.push({ sku: updatedDoc.sku, quantity: updatedDoc.quantity });

      // Audit movement for Bangalore stock intake
      const movementDoc = await StockMovement.create({
        movementId: `INIT-${product.sku}-BANGALORE-${Date.now()}`,
        type: 'IN',
        sku: product.sku,
        productName: product.name,
        toWarehouse: 'BANGALORE',
        fromWarehouse: null,
        quantity: 10,
        reason: 'Initial sample stock intake for Bangalore tech logistics hub',
        performedBy: 'admin',
        idempotencyKey: `SEED-INIT-BANGALORE-${product.sku}`,
      });
      recordedMovements.push(movementDoc.movementId);

      log(`[Initialized] ${product.sku} | ${product.name.padEnd(16)} | BANGALORE partition | Qty: 10 units`);
    }
  } catch (err) {
    log(`[ERROR PARTWAY] Operation failed: ${err.message}`);
    log(`[Recovery State] Initialized ${initializedBangalore.length} Bangalore records before failure.`);
    return {
      status: 'FAILED_PARTWAY',
      error: err.message,
      initializedBangalore,
      recordedMovements,
    };
  }

  // Step 5: Verification of invariants
  const totalCatalogProducts = await Product.countDocuments();
  const bangaloreDocs = await BangaloreModel.find({ sku: { $in: TARGET_SKUS } }).lean();
  const totalBangaloreStock = bangaloreDocs.reduce((sum, item) => sum + item.quantity, 0);

  const postHosurDocs = await HosurModel.find({ sku: { $in: TARGET_SKUS } }).lean();
  const postHosurStock = postHosurDocs.reduce((sum, item) => sum + item.quantity, 0);

  const postChennaiDocs = await ChennaiModel.find({ sku: { $in: TARGET_SKUS } }).lean();
  const postChennaiStock = postChennaiDocs.reduce((sum, item) => sum + item.quantity, 0);

  log('----------------------------------------------------');
  log(`[Verification] Catalog Products: ${totalCatalogProducts} (Reused, no duplicates created)`);
  log(`[Verification] Bangalore Inventory Records: ${bangaloreDocs.length}/10`);
  log(`[Verification] Total Bangalore Stock: ${totalBangaloreStock} units (Expected: 100)`);
  log(`[Verification] Hosur Stock: ${postHosurStock} units (Unchanged: ${postHosurStock === initialHosurStock ? 'YES' : 'NO'})`);
  log(`[Verification] Chennai Stock: ${postChennaiStock} units (Unchanged: ${postChennaiStock === initialChennaiStock ? 'YES' : 'NO'})`);
  log('====================================================');

  return {
    status: 'SUCCESS',
    catalogProductsReused: existingProducts.length,
    bangaloreRecordsCount: bangaloreDocs.length,
    totalBangaloreStock,
    hosurStock: postHosurStock,
    hosurUnchanged: postHosurStock === initialHosurStock,
    chennaiStock: postChennaiStock,
    chennaiUnchanged: postChennaiStock === initialChennaiStock,
  };
}

// Standalone execution script
if (process.argv[1]?.endsWith('seedBangaloreProducts.js')) {
  (async () => {
    try {
      const result = await seedBangaloreProducts();
      console.log('Seed Result:', JSON.stringify(result, null, 2));
      await disconnectDB();
      process.exit(result.status === 'FAILED_PARTWAY' ? 1 : 0);
    } catch (err) {
      console.error('[SeedBangalore Error]:', err);
      process.exit(1);
    }
  })();
}
