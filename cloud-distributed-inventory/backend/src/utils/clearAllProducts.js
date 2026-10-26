import { connectDB, disconnectDB } from '../config/database.js';
import { PartitionRouter, WAREHOUSE_PARTITIONS } from '../services/partitionRouter.js';
import { Product } from '../models/Product.js';
import { ProductDetail } from '../models/ProductDetail.js';
import { ProductPricing } from '../models/ProductPricing.js';
import { Warehouse } from '../models/Warehouse.js';
import { StockMovement } from '../models/StockMovement.js';
import mongoose from 'mongoose';

export async function clearAllProducts() {
  console.log('====================================================');
  console.log(' Cloud Inventory: Safe & Reversible Product Clear ');
  console.log('====================================================');

  await connectDB();
  await PartitionRouter.initPartitions();

  const timestamp = Date.now();

  // 1. Backup Products
  const products = await Product.find().lean();
  console.log(`[Backup] Found ${products.length} catalog products.`);
  if (products.length > 0) {
    const backupName = `products_backup_${timestamp}`;
    await mongoose.connection.db.collection(backupName).insertMany(products);
    console.log(`[Backup] Saved ${products.length} products to collection "${backupName}".`);
  }

  // 2. Backup and Clear Partition Stock
  for (const [whCode, collName] of Object.entries(WAREHOUSE_PARTITIONS)) {
    const Model = PartitionRouter.getModel(whCode);
    const partitionDocs = await Model.find().lean();
    console.log(`[Backup] Found ${partitionDocs.length} items in ${whCode} (${collName}).`);
    if (partitionDocs.length > 0) {
      const backupName = `${collName}_backup_${timestamp}`;
      await mongoose.connection.db.collection(backupName).insertMany(partitionDocs);
      console.log(`[Backup] Saved ${partitionDocs.length} records to "${backupName}".`);
    }
    const delResult = await Model.deleteMany({});
    console.log(`[Clean] Deleted ${delResult.deletedCount} items from ${collName}.`);
  }

  // 3. Backup and Clear Stock Movements
  const movements = await StockMovement.find().lean();
  console.log(`[Backup] Found ${movements.length} stock movements.`);
  if (movements.length > 0) {
    const backupName = `stockmovements_backup_${timestamp}`;
    await mongoose.connection.db.collection(backupName).insertMany(movements);
    console.log(`[Backup] Saved ${movements.length} movements to "${backupName}".`);
  }
  const delMovements = await StockMovement.deleteMany({});
  console.log(`[Clean] Deleted ${delMovements.deletedCount} stock movements.`);

  // 4. Clear Catalog Products and Vertical Fragments
  const details = await ProductDetail.find().lean();
  if (details.length > 0) {
    await mongoose.connection.db.collection(`product_details_backup_${timestamp}`).insertMany(details);
  }
  const pricings = await ProductPricing.find().lean();
  if (pricings.length > 0) {
    await mongoose.connection.db.collection(`product_pricing_backup_${timestamp}`).insertMany(pricings);
  }

  await ProductDetail.deleteMany({});
  await ProductPricing.deleteMany({});
  const delProducts = await Product.deleteMany({});
  console.log(`[Clean] Deleted ${delProducts.deletedCount} catalog products and vertical fragments.`);

  // 5. Verification
  const remainingProducts = await Product.countDocuments();
  const remainingMovements = await StockMovement.countDocuments();
  const totalWarehouses = await Warehouse.countDocuments();

  const partitionCounts = {};
  for (const [whCode, collName] of Object.entries(WAREHOUSE_PARTITIONS)) {
    const Model = PartitionRouter.getModel(whCode);
    partitionCounts[whCode] = await Model.countDocuments();
  }

  console.log('----------------------------------------------------');
  console.log(`[Verification] Catalog Products: ${remainingProducts}`);
  console.log(`[Verification] Stock Movements: ${remainingMovements}`);
  console.log(`[Verification] Warehouses Preserved: ${totalWarehouses}`);
  console.log(`[Verification] Partition Counts:`, partitionCounts);
  console.log('====================================================');

  return {
    remainingProducts,
    remainingMovements,
    totalWarehouses,
    partitionCounts,
  };
}

if (process.argv[1]?.endsWith('clearAllProducts.js')) {
  (async () => {
    try {
      const result = await clearAllProducts();
      console.log('Result:', JSON.stringify(result, null, 2));
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error('Error clearing products:', err);
      process.exit(1);
    }
  })();
}
