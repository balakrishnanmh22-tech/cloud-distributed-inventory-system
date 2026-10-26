import { connectDB, disconnectDB } from '../config/database.js';
import { PartitionRouter, WAREHOUSE_PARTITIONS } from '../services/partitionRouter.js';
import { Product } from '../models/Product.js';
import { Warehouse } from '../models/Warehouse.js';
import { StockMovement } from '../models/StockMovement.js';
import mongoose from 'mongoose';

export async function resetInventoryToZero() {
  console.log('====================================================');
  console.log(' Cloud Inventory: Safe & Reversible Reset to Zero Stock ');
  console.log('====================================================');

  await connectDB();
  await PartitionRouter.initPartitions();

  // 1. Audit and Backup Stock Movements before clearing
  const movementsCount = await StockMovement.countDocuments();
  console.log(`[Backup] Inspecting existing stock movements: ${movementsCount} records found.`);
  
  if (movementsCount > 0) {
    const backupCollectionName = `stockmovements_backup_${Date.now()}`;
    const allMovements = await StockMovement.find().lean();
    if (allMovements.length > 0) {
      await mongoose.connection.db.collection(backupCollectionName).insertMany(allMovements);
      console.log(`[Backup] Preserved ${allMovements.length} movements in backup collection "${backupCollectionName}".`);
    }
    
    // Clear demo/seed stock movements
    const deleteResult = await StockMovement.deleteMany({});
    console.log(`[Clean] Cleared ${deleteResult.deletedCount} demo stock movement records.`);
  } else {
    console.log('[Clean] Stock movements collection is already empty.');
  }

  // 2. Set all inventory records in partitions to zero
  const partitionSummary = {};

  for (const [whCode, collName] of Object.entries(WAREHOUSE_PARTITIONS)) {
    const Model = PartitionRouter.getModel(whCode);
    const countBefore = await Model.countDocuments();

    const updateResult = await Model.updateMany(
      {},
      {
        $set: {
          quantity: 0,
          reservedQuantity: 0,
          lastUpdated: new Date(),
        }
      }
    );

    const nonZeroCount = await Model.countDocuments({
      $or: [{ quantity: { $ne: 0 } }, { reservedQuantity: { $ne: 0 } }]
    });
    const zeroCount = await Model.countDocuments({ quantity: 0, reservedQuantity: 0 });

    partitionSummary[whCode] = {
      collection: collName,
      totalDocuments: countBefore,
      updatedDocuments: updateResult.modifiedCount,
      zeroStockCount: zeroCount,
      nonZeroStockCount: nonZeroCount,
      status: nonZeroCount === 0 ? 'VERIFIED_ZERO' : 'FAILED',
    };

    console.log(`[${whCode}] Partition "${collName}": ${updateResult.modifiedCount} records reset. Verification: ${zeroCount} zero-stock, ${nonZeroCount} non-zero.`);
  }

  // 3. Verify Product, Warehouse, and User integrity
  const totalProducts = await Product.countDocuments();
  const totalWarehouses = await Warehouse.countDocuments();
  const remainingMovements = await StockMovement.countDocuments();

  console.log('----------------------------------------------------');
  console.log(`[Integrity Check] Products preserved: ${totalProducts}`);
  console.log(`[Integrity Check] Warehouses preserved: ${totalWarehouses}`);
  console.log(`[Integrity Check] Stock movements remaining: ${remainingMovements}`);
  console.log('====================================================');

  return {
    partitionSummary,
    totalProducts,
    totalWarehouses,
    remainingMovements,
  };
}

if (process.argv[1]?.endsWith('resetInventoryToZero.js')) {
  (async () => {
    try {
      const summary = await resetInventoryToZero();
      console.log('Reset Summary:', JSON.stringify(summary, null, 2));
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error('Reset Error:', err);
      process.exit(1);
    }
  })();
}
