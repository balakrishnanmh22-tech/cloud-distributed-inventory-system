import mongoose from 'mongoose';

// Map warehouse codes to physical MongoDB collections (Horizontal Partitions)
export const WAREHOUSE_PARTITIONS = {
  HOSUR: 'inventory_hosur',
  CHENNAI: 'inventory_chennai',
  BANGALORE: 'inventory_bangalore',
};

const partitionModelCache = new Map();

// Schema definition for each fragmented inventory record
const inventorySchema = new mongoose.Schema({
  sku: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  productName: {
    type: String,
    required: true,
    trim: true,
  },
  category: {
    type: String,
    required: true,
    trim: true,
  },
  warehouseId: {
    type: String,
    required: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: [0, 'Quantity cannot be negative'],
    default: 0,
  },
  reorderLevel: {
    type: Number,
    default: 10,
    min: 0,
  },
  costPrice: {
    type: Number,
    default: 0,
  },
  sellingPrice: {
    type: Number,
    default: 0,
  },
  reservedQuantity: {
    type: Number,
    default: 0,
    min: 0,
  },
  lastUpdated: {
    type: Date,
    default: Date.now,
  }
}, {
  versionKey: false,
  timestamps: { createdAt: true, updatedAt: 'lastUpdated' }
});

export class PartitionRouter {
  /**
   * Resolves physical collection name from warehouse code.
   * Throws error if warehouse partition is invalid.
   */
  static getPartitionName(warehouseId) {
    if (!warehouseId) throw new Error('Warehouse identifier is required for partition routing');
    const code = warehouseId.toUpperCase().trim();
    const collectionName = WAREHOUSE_PARTITIONS[code];
    if (!collectionName) {
      throw new Error(`Routing Error: Unknown warehouse "${warehouseId}". Valid partitions: ${Object.keys(WAREHOUSE_PARTITIONS).join(', ')}`);
    }
    return collectionName;
  }

  /**
   * Returns a Mongoose model bound to the specific physical partition collection.
   */
  static getModel(warehouseId) {
    const collectionName = this.getPartitionName(warehouseId);
    if (!partitionModelCache.has(collectionName)) {
      const model = mongoose.models[collectionName] || 
        mongoose.model(collectionName, inventorySchema, collectionName);
      partitionModelCache.set(collectionName, model);
    }
    return partitionModelCache.get(collectionName);
  }

  /**
   * Initializes indexes across all physical partition collections.
   */
  static async initPartitions() {
    if (!mongoose.connection.db || mongoose.connection.readyState !== 1) return;
    for (const [code, coll] of Object.entries(WAREHOUSE_PARTITIONS)) {
      const model = this.getModel(code);
      try {
        await model.collection.createIndex({ sku: 1 }, { unique: true });
        await model.collection.createIndex({ category: 1 });
      } catch (err) {
        // Index might already exist
      }
    }
  }

  /**
   * Single-Partition Query (Data Locality): Routes directly to the designated warehouse partition.
   */
  static async getInventoryByWarehouse(warehouseId, filter = {}) {
    if (!mongoose.connection.db || mongoose.connection.readyState !== 1) return [];
    const Model = this.getModel(warehouseId);
    const query = { warehouseId: warehouseId.toUpperCase(), ...filter };
    const items = await Model.find(query).sort({ lastUpdated: -1 }).lean();
    return items.map(item => ({
      ...item,
      partition: this.getPartitionName(warehouseId),
      isLowStock: item.quantity <= item.reorderLevel,
      isOutOfStock: item.quantity === 0,
    }));
  }

  /**
   * Global Query (Fragmentation Transparency):
   * Transparently reconstructs the complete inventory view by querying all partitions
   * in parallel and aggregating the dataset.
   */
  static async getGlobalInventory(filter = {}) {
    if (!mongoose.connection.db || mongoose.connection.readyState !== 1) return [];
    const partitionKeys = Object.keys(WAREHOUSE_PARTITIONS);
    const partitionQueries = partitionKeys.map(async (code) => {
      try {
        const Model = this.getModel(code);
        const docs = await Model.find(filter).lean();
        return docs.map(d => ({
          ...d,
          partition: WAREHOUSE_PARTITIONS[code],
          isLowStock: d.quantity <= d.reorderLevel,
          isOutOfStock: d.quantity === 0,
        }));
      } catch (err) {
        console.error(`Error querying partition ${code}:`, err.message);
        return [];
      }
    });

    const results = await Promise.all(partitionQueries);
    return results.flat();
  }

  /**
   * Performs an atomic update within a single warehouse partition.
   * If decrementing, enforces invariant quantity + delta >= 0.
   */
  static async updateStock(warehouseId, sku, delta, session = null, extraFields = {}) {
    const Model = this.getModel(warehouseId);
    const upperSku = sku.toUpperCase().trim();
    const upperWh = warehouseId.toUpperCase().trim();

    // If decreasing, ensure sufficient stock exists
    const query = { sku: upperSku, warehouseId: upperWh };
    if (delta < 0) {
      query.quantity = { $gte: Math.abs(delta) };
    }

    const update = {
      $inc: { quantity: delta },
      $set: {
        lastUpdated: new Date(),
        productName: extraFields.productName || upperSku,
        category: extraFields.category || 'General',
        reorderLevel: extraFields.reorderLevel !== undefined ? extraFields.reorderLevel : 10,
        costPrice: extraFields.costPrice !== undefined ? extraFields.costPrice : 0,
        sellingPrice: extraFields.sellingPrice !== undefined ? extraFields.sellingPrice : 0,
      },
      $setOnInsert: {
        sku: upperSku,
        warehouseId: upperWh,
        reservedQuantity: 0,
      }
    };

    const options = {
      new: true,
      upsert: delta > 0, // only upsert if stock is being added
      session,
      runValidators: true,
    };

    const updatedDoc = await Model.findOneAndUpdate(query, update, options);
    if (!updatedDoc && delta < 0) {
      throw new Error(`Insufficient stock in ${upperWh} for SKU "${upperSku}". Operation rejected.`);
    }

    return updatedDoc;
  }

  /**
   * Retrieves diagnostic statistics for each horizontal partition.
   */
  static async getPartitionStats() {
    const stats = [];
    if (!mongoose.connection.db || mongoose.connection.readyState !== 1) {
      return Object.entries(WAREHOUSE_PARTITIONS).map(([code, collName]) => ({
        warehouseCode: code,
        partitionName: collName,
        documentCount: 0,
        sizeBytes: 0,
        storageSizeBytes: 0,
        totalIndexSize: 0,
        isHealthy: true,
      }));
    }
    const db = mongoose.connection.db;

    for (const [code, collName] of Object.entries(WAREHOUSE_PARTITIONS)) {
      try {
        const count = await db.collection(collName).countDocuments();
        let collStats = null;
        try {
          collStats = await db.command({ collStats: collName });
        } catch (e) {
          // collStats might not be available in all MongoDB configs
        }

        stats.push({
          warehouseCode: code,
          partitionName: collName,
          documentCount: count,
          sizeBytes: collStats?.size || 0,
          storageSizeBytes: collStats?.storageSize || 0,
          totalIndexSize: collStats?.totalIndexSize || 0,
          isHealthy: true,
        });
      } catch (err) {
        stats.push({
          warehouseCode: code,
          partitionName: collName,
          documentCount: 0,
          isHealthy: false,
          error: err.message,
        });
      }
    }

    return stats;
  }
}
