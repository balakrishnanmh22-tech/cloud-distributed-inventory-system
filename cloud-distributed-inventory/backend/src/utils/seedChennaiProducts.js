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

export async function seedChennaiProducts({ quiet = false } = {}) {
  const log = (...args) => { if (!quiet) console.log(...args); };

  log('====================================================');
  log(' Cloud Inventory: Bulk-Seed Chennai Sample Stock ');
  log('====================================================');

  await connectDB();
  await PartitionRouter.initPartitions();

  const ChennaiModel = PartitionRouter.getModel('CHENNAI');
  const HosurModel = PartitionRouter.getModel('HOSUR');
  const BangaloreModel = PartitionRouter.getModel('BANGALORE');

  // Step 1: Verify existing Product Catalog entries (do not duplicate Product documents)
  const existingProducts = await Product.find({ sku: { $in: TARGET_SKUS } }).lean();
  const existingProductMap = new Map(existingProducts.map(p => [p.sku, p]));

  if (existingProducts.length === 0) {
    log('[Error] No sample products found in Product Catalog. Run seed:hosur first to establish catalog entries.');
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

  const initialBangaloreDocs = await BangaloreModel.find().lean();
  const initialBangaloreStock = initialBangaloreDocs.reduce((acc, curr) => acc + curr.quantity, 0);

  // Step 3: Check Chennai partition for idempotency and prevent stock accumulation
  const existingChennaiInventory = await ChennaiModel.find({ sku: { $in: TARGET_SKUS } }).lean();
  const existingChennaiSkus = existingChennaiInventory.map(i => i.sku);

  if (existingChennaiSkus.length === TARGET_SKUS.length) {
    const allTenUnits = existingChennaiInventory.every(i => i.quantity === 10);
    if (allTenUnits) {
      log('[Idempotent Check] All 10 sample products already exist in Chennai partition with 10 units each.');
      log('[Action] No changes made to prevent stock accumulation or duplicate entries.');
      return {
        status: 'ALREADY_INITIALIZED',
        catalogProductsReused: existingProducts.length,
        chennaiCount: existingChennaiInventory.length,
        totalChennaiStock: existingChennaiInventory.reduce((acc, curr) => acc + curr.quantity, 0),
        hosurStockUnchanged: initialHosurStock,
        bangaloreStockUnchanged: initialBangaloreStock,
      };
    }
  }

  if (existingChennaiSkus.length > 0) {
    const conflicting = existingChennaiSkus;
    log(`[Safety Warning] Cannot proceed. Found ${conflicting.length} existing record(s) in Chennai partition: ${conflicting.join(', ')}`);
    log('[Action] Halted to avoid duplicate entries or unintended stock mutation.');
    return {
      status: 'HALTED_CONFLICT',
      conflictingSkus: conflicting,
    };
  }

  // Step 4: Add exactly 10 units per product to Chennai partition only
  const initializedChennai = [];
  const recordedMovements = [];

  try {
    for (const sku of TARGET_SKUS) {
      const product = existingProductMap.get(sku);

      // Route strictly to CHENNAI partition
      const updatedDoc = await PartitionRouter.updateStock(
        'CHENNAI',
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
      initializedChennai.push({ sku: updatedDoc.sku, quantity: updatedDoc.quantity });

      // Audit movement for Chennai stock intake
      const movementDoc = await StockMovement.create({
        movementId: `INIT-${product.sku}-CHENNAI-${Date.now()}`,
        type: 'IN',
        sku: product.sku,
        productName: product.name,
        toWarehouse: 'CHENNAI',
        fromWarehouse: null,
        quantity: 10,
        reason: 'Initial sample stock intake for Chennai central depot',
        performedBy: 'admin',
        idempotencyKey: `SEED-INIT-CHENNAI-${product.sku}`,
      });
      recordedMovements.push(movementDoc.movementId);

      log(`[Initialized] ${product.sku} | ${product.name.padEnd(16)} | CHENNAI partition | Qty: 10 units`);
    }
  } catch (err) {
    log(`[ERROR PARTWAY] Operation failed: ${err.message}`);
    log(`[Recovery State] Initialized ${initializedChennai.length} Chennai records before failure.`);
    return {
      status: 'FAILED_PARTWAY',
      error: err.message,
      initializedChennai,
      recordedMovements,
    };
  }

  // Step 5: Verification of invariants
  const totalCatalogProducts = await Product.countDocuments();
  const chennaiDocs = await ChennaiModel.find({ sku: { $in: TARGET_SKUS } }).lean();
  const totalChennaiStock = chennaiDocs.reduce((sum, item) => sum + item.quantity, 0);

  const postHosurDocs = await HosurModel.find({ sku: { $in: TARGET_SKUS } }).lean();
  const postHosurStock = postHosurDocs.reduce((sum, item) => sum + item.quantity, 0);

  const postBangaloreDocs = await BangaloreModel.find().lean();
  const postBangaloreStock = postBangaloreDocs.reduce((sum, item) => sum + item.quantity, 0);

  log('----------------------------------------------------');
  log(`[Verification] Catalog Products: ${totalCatalogProducts} (Reused, no duplicates created)`);
  log(`[Verification] Chennai Inventory Records: ${chennaiDocs.length}/10`);
  log(`[Verification] Total Chennai Stock: ${totalChennaiStock} units (Expected: 100)`);
  log(`[Verification] Hosur Stock: ${postHosurStock} units (Unchanged: ${postHosurStock === initialHosurStock ? 'YES' : 'NO'})`);
  log(`[Verification] Bangalore Stock: ${postBangaloreStock} units (Unchanged: ${postBangaloreStock === initialBangaloreStock ? 'YES' : 'NO'})`);
  log('====================================================');

  return {
    status: 'SUCCESS',
    catalogProductsReused: existingProducts.length,
    chennaiRecordsCount: chennaiDocs.length,
    totalChennaiStock,
    hosurStock: postHosurStock,
    hosurUnchanged: postHosurStock === initialHosurStock,
    bangaloreStock: postBangaloreStock,
    bangaloreUnchanged: postBangaloreStock === initialBangaloreStock,
  };
}

// Standalone execution script
if (process.argv[1]?.endsWith('seedChennaiProducts.js')) {
  (async () => {
    try {
      const result = await seedChennaiProducts();
      console.log('Seed Result:', JSON.stringify(result, null, 2));
      await disconnectDB();
      process.exit(result.status === 'FAILED_PARTWAY' ? 1 : 0);
    } catch (err) {
      console.error('[SeedChennai Error]:', err);
      process.exit(1);
    }
  })();
}
