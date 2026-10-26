import { connectDB, disconnectDB } from '../config/database.js';
import { PartitionRouter, WAREHOUSE_PARTITIONS } from '../services/partitionRouter.js';
import { Product } from '../models/Product.js';
import { ProductDetail } from '../models/ProductDetail.js';
import { ProductPricing } from '../models/ProductPricing.js';
import { Warehouse } from '../models/Warehouse.js';
import { StockMovement } from '../models/StockMovement.js';

export const SAMPLE_PRODUCTS = [
  { sku: 'HOS-LAP-001', name: 'Dell Laptop', category: 'Computing', costPrice: 500, sellingPrice: 650, reorderLevel: 10, unit: 'units', description: 'Enterprise computing laptop' },
  { sku: 'HOS-MOU-002', name: 'Wireless Mouse', category: 'Accessories', costPrice: 10, sellingPrice: 18, reorderLevel: 10, unit: 'units', description: 'Ergonomic 2.4GHz wireless mouse' },
  { sku: 'HOS-KEY-003', name: 'USB Keyboard', category: 'Accessories', costPrice: 15, sellingPrice: 25, reorderLevel: 10, unit: 'units', description: 'Standard wired USB desktop keyboard' },
  { sku: 'HOS-MON-004', name: 'LED Monitor', category: 'Computing', costPrice: 120, sellingPrice: 160, reorderLevel: 10, unit: 'units', description: '24-inch Full HD LED display monitor' },
  { sku: 'HOS-USB-005', name: 'USB Drive 32GB', category: 'Storage', costPrice: 5, sellingPrice: 10, reorderLevel: 10, unit: 'units', description: 'High-speed USB 3.0 flash drive 32GB' },
  { sku: 'HOS-SSD-006', name: 'SSD 1TB', category: 'Storage', costPrice: 70, sellingPrice: 100, reorderLevel: 10, unit: 'units', description: '1TB NVMe PCIe internal solid state drive' },
  { sku: 'HOS-HDP-007', name: 'Headphones', category: 'Accessories', costPrice: 20, sellingPrice: 35, reorderLevel: 10, unit: 'units', description: 'Over-ear noise-isolating stereo headphones' },
  { sku: 'HOS-WEB-008', name: 'Webcam', category: 'Accessories', costPrice: 25, sellingPrice: 40, reorderLevel: 10, unit: 'units', description: '1080p HD autofocus web camera with microphone' },
  { sku: 'HOS-ROU-009', name: 'Wi-Fi Router', category: 'Networking', costPrice: 35, sellingPrice: 55, reorderLevel: 10, unit: 'units', description: 'Dual-band gigabit wireless router' },
  { sku: 'HOS-UPS-010', name: 'UPS Backup', category: 'Electronics', costPrice: 45, sellingPrice: 70, reorderLevel: 10, unit: 'units', description: '600VA uninterruptible power supply' },
];

export async function seedHosurProducts({ quiet = false } = {}) {
  const log = (...args) => { if (!quiet) console.log(...args); };

  log('====================================================');
  log(' Cloud Inventory: Bulk-Seed Hosur Sample Products ');
  log('====================================================');

  await connectDB();
  await PartitionRouter.initPartitions();

  const targetSkus = SAMPLE_PRODUCTS.map(p => p.sku);
  const HosurModel = PartitionRouter.getModel('HOSUR');
  const ChennaiModel = PartitionRouter.getModel('CHENNAI');
  const BangaloreModel = PartitionRouter.getModel('BANGALORE');

  // Step 1: Duplicate check & safe idempotency verification
  const existingProducts = await Product.find({ sku: { $in: targetSkus } }).lean();
  const existingHosurInventory = await HosurModel.find({ sku: { $in: targetSkus } }).lean();

  const existingProductSkus = existingProducts.map(p => p.sku);
  const existingHosurSkus = existingHosurInventory.map(i => i.sku);

  // If all 10 products and inventory already exist
  if (existingProductSkus.length === targetSkus.length && existingHosurSkus.length === targetSkus.length) {
    const allTenUnits = existingHosurInventory.every(i => i.quantity === 10);
    if (allTenUnits) {
      log('[Idempotent Check] All 10 sample products already exist in Catalog and Hosur partition with 10 units each.');
      log('[Action] No changes made to prevent stock accumulation or duplicate entries.');
      return {
        status: 'ALREADY_INITIALIZED',
        productCount: existingProducts.length,
        hosurCount: existingHosurInventory.length,
        totalHosurStock: existingHosurInventory.reduce((acc, curr) => acc + curr.quantity, 0),
      };
    }
  }

  // If some SKUs exist but not cleanly initialized, abort safely
  if (existingProductSkus.length > 0 || existingHosurSkus.length > 0) {
    const conflicting = Array.from(new Set([...existingProductSkus, ...existingHosurSkus]));
    log(`[Safety Warning] Cannot proceed. Found ${conflicting.length} pre-existing sample SKU(s): ${conflicting.join(', ')}`);
    log('[Action] Halted to avoid duplicate SKU errors or unexpected stock mutation.');
    return {
      status: 'HALTED_CONFLICT',
      conflictingSkus: conflicting,
    };
  }

  // Step 2: Track progress for transparent error reporting & safe recovery
  const createdProducts = [];
  const initializedInventory = [];
  const recordedMovements = [];

  try {
    for (const p of SAMPLE_PRODUCTS) {
      // 2a. Create Product Catalog document and vertical fragments
      const productDoc = await Product.create({
        sku: p.sku,
        name: p.name,
        category: p.category,
        costPrice: p.costPrice,
        sellingPrice: p.sellingPrice,
        reorderLevel: p.reorderLevel || 10,
        unit: p.unit || 'units',
        description: p.description || '',
      });
      await ProductDetail.findOneAndUpdate(
        { sku: p.sku },
        {
          _id: productDoc._id,
          sku: p.sku,
          name: p.name,
          category: p.category,
          reorderLevel: p.reorderLevel || 10,
          unit: p.unit || 'units',
          description: p.description || '',
        },
        { upsert: true }
      );
      await ProductPricing.findOneAndUpdate(
        { sku: p.sku },
        {
          sku: p.sku,
          costPrice: p.costPrice,
          sellingPrice: p.sellingPrice,
          currency: 'USD',
          pricingTier: 'STANDARD',
        },
        { upsert: true }
      );
      createdProducts.push(productDoc.sku);

      // 2b. Initialize stock strictly in Hosur partition (10 units)
      const inventoryDoc = await PartitionRouter.updateStock(
        'HOSUR',
        p.sku,
        10,
        null,
        {
          productName: p.name,
          category: p.category,
          costPrice: p.costPrice,
          sellingPrice: p.sellingPrice,
          reorderLevel: p.reorderLevel || 10,
        }
      );
      initializedInventory.push({ sku: inventoryDoc.sku, quantity: inventoryDoc.quantity });

      // 2c. Log audit movement using existing stock intake convention
      const movementDoc = await StockMovement.create({
        movementId: `INIT-${p.sku}-${Date.now()}`,
        type: 'IN',
        sku: p.sku,
        productName: p.name,
        toWarehouse: 'HOSUR',
        fromWarehouse: null,
        quantity: 10,
        reason: 'Initial sample stock intake for Hosur distribution hub',
        performedBy: 'admin',
        idempotencyKey: `SEED-INIT-${p.sku}`,
      });
      recordedMovements.push(movementDoc.movementId);

      log(`[Initialized] ${p.sku} | ${p.name.padEnd(16)} | Category: ${p.category.padEnd(12)} | Qty: 10 in HOSUR`);
    }
  } catch (err) {
    log(`[ERROR PARTWAY] Operation failed: ${err.message}`);
    log(`[Recovery State] Successfully created ${createdProducts.length} products: ${createdProducts.join(', ')}`);
    log(`[Recovery State] Successfully initialized ${initializedInventory.length} inventory records in Hosur.`);
    return {
      status: 'FAILED_PARTWAY',
      error: err.message,
      createdProducts,
      initializedInventory,
      recordedMovements,
    };
  }

  // Step 3: Verification
  const totalProducts = await Product.countDocuments();
  const sampleProductsCount = await Product.countDocuments({ sku: { $in: targetSkus } });

  const hosurRecords = await HosurModel.find({ sku: { $in: targetSkus } }).lean();
  const totalHosurSampleStock = hosurRecords.reduce((sum, item) => sum + item.quantity, 0);

  const chennaiCount = await ChennaiModel.countDocuments();
  const bangaloreCount = await BangaloreModel.countDocuments();

  log('----------------------------------------------------');
  log(`[Verification] Sample Products in Catalog: ${sampleProductsCount}/10 (Total Catalog: ${totalProducts})`);
  log(`[Verification] Hosur Inventory Records: ${hosurRecords.length}/10`);
  log(`[Verification] Total Hosur Stock for Sample Products: ${totalHosurSampleStock} units (Expected: 100)`);
  log(`[Verification] Chennai Inventory Documents: ${chennaiCount} (Unchanged)`);
  log(`[Verification] Bangalore Inventory Documents: ${bangaloreCount} (Unchanged)`);
  log('====================================================');

  return {
    status: 'SUCCESS',
    sampleProductsCount,
    hosurRecordsCount: hosurRecords.length,
    totalHosurSampleStock,
    chennaiCount,
    bangaloreCount,
  };
}

// Standalone execution script
if (process.argv[1]?.endsWith('seedHosurProducts.js')) {
  (async () => {
    try {
      const result = await seedHosurProducts();
      console.log('Seed Result:', JSON.stringify(result, null, 2));
      await disconnectDB();
      process.exit(result.status === 'FAILED_PARTWAY' ? 1 : 0);
    } catch (err) {
      console.error('[SeedHosur Error]:', err);
      process.exit(1);
    }
  })();
}
