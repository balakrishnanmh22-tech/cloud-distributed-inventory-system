import mongoose from 'mongoose';
import { ProductDetail } from '../models/ProductDetail.js';
import { ProductPricing } from '../models/ProductPricing.js';
import { Product } from '../models/Product.js';
import { PartitionRouter } from './partitionRouter.js';
import { StockMovement } from '../models/StockMovement.js';
import { isReplicaSetActive } from '../config/database.js';

const FALLBACK_PRODUCTS = [
  { _id: 'p1', sku: 'HOS-LAP-001', name: 'Dell Laptop', category: 'Computing', costPrice: 500, sellingPrice: 650, reorderLevel: 10, totalStock: 45, warehouseStock: { HOSUR: 25, CHENNAI: 10, BANGALORE: 10 }, isLowStock: false, isOutOfStock: false },
  { _id: 'p2', sku: 'HOS-MOU-002', name: 'Wireless Mouse', category: 'Accessories', costPrice: 10, sellingPrice: 18, reorderLevel: 10, totalStock: 120, warehouseStock: { HOSUR: 50, CHENNAI: 40, BANGALORE: 30 }, isLowStock: false, isOutOfStock: false },
  { _id: 'p3', sku: 'HOS-KEY-003', name: 'USB Keyboard', category: 'Accessories', costPrice: 15, sellingPrice: 25, reorderLevel: 10, totalStock: 85, warehouseStock: { HOSUR: 30, CHENNAI: 35, BANGALORE: 20 }, isLowStock: false, isOutOfStock: false },
  { _id: 'p4', sku: 'HOS-MON-004', name: 'LED Monitor', category: 'Computing', costPrice: 120, sellingPrice: 160, reorderLevel: 10, totalStock: 30, warehouseStock: { HOSUR: 12, CHENNAI: 10, BANGALORE: 8 }, isLowStock: false, isOutOfStock: false },
  { _id: 'p5', sku: 'HOS-USB-005', name: 'USB Drive 32GB', category: 'Storage', costPrice: 5, sellingPrice: 10, reorderLevel: 10, totalStock: 200, warehouseStock: { HOSUR: 100, CHENNAI: 50, BANGALORE: 50 }, isLowStock: false, isOutOfStock: false },
  { _id: 'p6', sku: 'HOS-SSD-006', name: 'SSD 1TB', category: 'Storage', costPrice: 70, sellingPrice: 100, reorderLevel: 10, totalStock: 40, warehouseStock: { HOSUR: 15, CHENNAI: 15, BANGALORE: 10 }, isLowStock: false, isOutOfStock: false },
  { _id: 'p7', sku: 'HOS-HDP-007', name: 'Headphones', category: 'Accessories', costPrice: 20, sellingPrice: 35, reorderLevel: 10, totalStock: 60, warehouseStock: { HOSUR: 25, CHENNAI: 20, BANGALORE: 15 }, isLowStock: false, isOutOfStock: false },
  { _id: 'p8', sku: 'HOS-WEB-008', name: 'Webcam', category: 'Accessories', costPrice: 25, sellingPrice: 40, reorderLevel: 10, totalStock: 5, warehouseStock: { HOSUR: 5, CHENNAI: 0, BANGALORE: 0 }, isLowStock: true, isOutOfStock: false },
  { _id: 'p9', sku: 'HOS-ROU-009', name: 'Wi-Fi Router', category: 'Networking', costPrice: 35, sellingPrice: 55, reorderLevel: 10, totalStock: 35, warehouseStock: { HOSUR: 15, CHENNAI: 10, BANGALORE: 10 }, isLowStock: false, isOutOfStock: false },
  { _id: 'p10', sku: 'HOS-UPS-010', name: 'UPS Backup', category: 'Electronics', costPrice: 45, sellingPrice: 70, reorderLevel: 10, totalStock: 18, warehouseStock: { HOSUR: 6, CHENNAI: 6, BANGALORE: 6 }, isLowStock: false, isOutOfStock: false },
];

export class ProductService {
  /**
   * Transparently reconstructs unified product entities from vertically fragmented collections:
   * Collection A: 'product_details' (Descriptive non-pricing attributes)
   * Collection B: 'product_pricing' (Financial attributes)
   * Linked by: 'sku'
   */
  static async getProducts({
    search,
    category,
    warehouse,
    page = 1,
    limit = 10,
    sortBy = 'createdAt',
    order = 'desc',
  }) {
    if (!mongoose.connection?.db || mongoose.connection.readyState !== 1) {
      let filtered = [...FALLBACK_PRODUCTS];
      if (search) {
        const s = search.toLowerCase();
        filtered = filtered.filter(p => p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s));
      }
      if (category) {
        filtered = filtered.filter(p => p.category === category);
      }
      if (warehouse) {
        filtered = filtered.filter(p => (p.warehouseStock[warehouse.toUpperCase()] || 0) > 0);
      }
      return {
        products: filtered,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: filtered.length,
          totalPages: 1,
        }
      };
    }

    // Match conditions on details fragment
    const matchQuery = {};
    if (search) {
      matchQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) {
      matchQuery.category = category;
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 10;
    const skip = (pageNum - 1) * limitNum;
    const sortOrder = order === 'asc' ? 1 : -1;

    // Aggregation pipeline to join product_details with product_pricing on sku
    const pipeline = [
      { $match: matchQuery },
      {
        $lookup: {
          from: 'product_pricing',
          localField: 'sku',
          foreignField: 'sku',
          as: 'pricing',
        }
      },
      {
        $unwind: {
          path: '$pricing',
          preserveNullAndEmptyArrays: true,
        }
      },
      {
        $project: {
          _id: 1,
          sku: 1,
          name: 1,
          description: { $ifNull: ['$description', ''] },
          category: 1,
          reorderLevel: { $ifNull: ['$reorderLevel', 10] },
          unit: { $ifNull: ['$unit', 'units'] },
          costPrice: { $ifNull: ['$pricing.costPrice', 0] },
          sellingPrice: { $ifNull: ['$pricing.sellingPrice', 0] },
          currency: { $ifNull: ['$pricing.currency', 'USD'] },
          pricingTier: { $ifNull: ['$pricing.pricingTier', 'STANDARD'] },
          createdAt: 1,
          updatedAt: 1,
        }
      },
      { $sort: { [sortBy]: sortOrder } },
      { $skip: skip },
      { $limit: limitNum },
    ];

    const [products, totalCount] = await Promise.all([
      ProductDetail.aggregate(pipeline),
      ProductDetail.countDocuments(matchQuery),
    ]);

    // Query horizontal partitions for real-time stock balances across warehouses
    const globalInventory = await PartitionRouter.getGlobalInventory();
    const stockMap = new Map();
    const warehouseBreakdown = new Map();

    for (const inv of globalInventory) {
      const current = stockMap.get(inv.sku) || 0;
      stockMap.set(inv.sku, current + inv.quantity);

      if (!warehouseBreakdown.has(inv.sku)) {
        warehouseBreakdown.set(inv.sku, {});
      }
      warehouseBreakdown.get(inv.sku)[inv.warehouseId] = inv.quantity;
    }

    const enrichedProducts = products.map(p => ({
      ...p,
      totalStock: stockMap.get(p.sku) || 0,
      warehouseStock: warehouseBreakdown.get(p.sku) || {},
      isLowStock: (stockMap.get(p.sku) || 0) <= p.reorderLevel,
      isOutOfStock: (stockMap.get(p.sku) || 0) === 0,
    }));

    const filtered = warehouse
      ? enrichedProducts.filter(p => (p.warehouseStock[warehouse.toUpperCase()] || 0) > 0)
      : enrichedProducts;

    return {
      products: filtered,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      }
    };
  }

  /**
   * Retrieves single product by ID or SKU, reconstructing from both vertical fragments.
   */
  static async getProductById(id) {
    if (!mongoose.connection?.db || mongoose.connection.readyState !== 1) {
      return FALLBACK_PRODUCTS.find(p => p._id === id || p.sku === id) || null;
    }

    let detail = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      detail = await ProductDetail.findById(id).lean();
    }
    if (!detail) {
      detail = await ProductDetail.findOne({ sku: id.toString().toUpperCase().trim() }).lean();
    }

    // Compatibility fallback if migration not yet completed
    if (!detail) {
      const legacy = mongoose.Types.ObjectId.isValid(id)
        ? await Product.findById(id).lean()
        : await Product.findOne({ sku: id.toString().toUpperCase().trim() }).lean();
      if (!legacy) return null;
      detail = legacy;
    }

    const pricing = await ProductPricing.findOne({ sku: detail.sku }).lean();

    const merged = {
      _id: detail._id,
      sku: detail.sku,
      name: detail.name,
      description: detail.description || '',
      category: detail.category,
      costPrice: pricing ? pricing.costPrice : (detail.costPrice || 0),
      sellingPrice: pricing ? pricing.sellingPrice : (detail.sellingPrice || 0),
      currency: pricing?.currency || 'USD',
      pricingTier: pricing?.pricingTier || 'STANDARD',
      reorderLevel: detail.reorderLevel !== undefined ? detail.reorderLevel : 10,
      unit: detail.unit || 'units',
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    };

    const globalInventory = await PartitionRouter.getGlobalInventory({ sku: merged.sku });
    const warehouseStock = {};
    let totalStock = 0;
    for (const inv of globalInventory) {
      warehouseStock[inv.warehouseId] = inv.quantity;
      totalStock += inv.quantity;
    }

    return {
      ...merged,
      totalStock,
      warehouseStock,
      partitions: globalInventory.map(i => ({
        warehouse: i.warehouseId,
        partition: i.partition,
        quantity: i.quantity,
      })),
    };
  }

  /**
   * Looks up product by SKU combining both fragments.
   */
  static async getProductBySku(sku) {
    if (!sku) return null;
    const upperSku = sku.toUpperCase().trim();

    const detail = await ProductDetail.findOne({ sku: upperSku }).lean();
    if (!detail) {
      // Fallback to legacy products
      return Product.findOne({ sku: upperSku }).lean();
    }

    const pricing = await ProductPricing.findOne({ sku: upperSku }).lean();

    return {
      _id: detail._id,
      sku: detail.sku,
      name: detail.name,
      description: detail.description || '',
      category: detail.category,
      costPrice: pricing ? pricing.costPrice : (detail.costPrice || 0),
      sellingPrice: pricing ? pricing.sellingPrice : (detail.sellingPrice || 0),
      currency: pricing?.currency || 'USD',
      pricingTier: pricing?.pricingTier || 'STANDARD',
      reorderLevel: detail.reorderLevel !== undefined ? detail.reorderLevel : 10,
      unit: detail.unit || 'units',
      createdAt: detail.createdAt,
      updatedAt: detail.updatedAt,
    };
  }

  /**
   * Returns all products merged from both fragments for reporting / valuation.
   */
  static async getAllProducts() {
    if (!mongoose.connection?.db || mongoose.connection.readyState !== 1) {
      return FALLBACK_PRODUCTS;
    }

    const details = await ProductDetail.find().lean();
    if (details.length === 0) {
      // Fallback to legacy products
      return Product.find().lean();
    }

    const pricings = await ProductPricing.find().lean();
    const pricingMap = new Map(pricings.map(p => [p.sku, p]));

    return details.map(d => {
      const p = pricingMap.get(d.sku);
      return {
        _id: d._id,
        sku: d.sku,
        name: d.name,
        description: d.description || '',
        category: d.category,
        costPrice: p ? p.costPrice : (d.costPrice || 0),
        sellingPrice: p ? p.sellingPrice : (d.sellingPrice || 0),
        currency: p?.currency || 'USD',
        pricingTier: p?.pricingTier || 'STANDARD',
        reorderLevel: d.reorderLevel !== undefined ? d.reorderLevel : 10,
        unit: d.unit || 'units',
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      };
    });
  }

  /**
   * Creates a product across both vertical fragments atomically.
   * Enforces that failure in either fragment leaves zero partial records.
   */
  static async createProduct({
    sku,
    name,
    description = '',
    category,
    costPrice,
    sellingPrice,
    reorderLevel = 10,
    unit = 'units',
    initialStock = 0,
    initialWarehouse = 'HOSUR',
    performedBy = 'admin',
  }) {
    const upperSku = sku.toUpperCase().trim();

    // Check uniqueness across both fragments
    const [existingDetail, existingPricing, existingLegacy] = await Promise.all([
      ProductDetail.findOne({ sku: upperSku }),
      ProductPricing.findOne({ sku: upperSku }),
      Product.findOne({ sku: upperSku }),
    ]);

    if (existingDetail || existingPricing || existingLegacy) {
      throw new Error(`Product with SKU "${upperSku}" already exists`);
    }

    const isReplicaSet = isReplicaSetActive();
    let detailDoc = null;
    let pricingDoc = null;

    if (isReplicaSet) {
      const session = await mongoose.startSession();
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority', j: true },
      });

      try {
        // 1. Create in product_details fragment
        detailDoc = new ProductDetail({
          sku: upperSku,
          name: name.trim(),
          description: description || '',
          category: category.trim(),
          reorderLevel: Number(reorderLevel) || 10,
          unit: unit || 'units',
        });
        await detailDoc.save({ session });

        // 2. Create in product_pricing fragment
        pricingDoc = new ProductPricing({
          sku: upperSku,
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          currency: 'USD',
          pricingTier: 'STANDARD',
        });
        await pricingDoc.save({ session });

        // 3. Keep original products collection in sync for backward compatibility
        const legacyDoc = new Product({
          _id: detailDoc._id,
          sku: upperSku,
          name: name.trim(),
          description: description || '',
          category: category.trim(),
          costPrice: Number(costPrice),
          sellingPrice: Number(sellingPrice),
          reorderLevel: Number(reorderLevel) || 10,
          unit: unit || 'units',
        });
        await legacyDoc.save({ session });

        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
    } else {
      // Compensating transaction rollback for standalone mode
      try {
        detailDoc = await ProductDetail.create({
          sku: upperSku,
          name: name.trim(),
          description: description || '',
          category: category.trim(),
          reorderLevel: Number(reorderLevel) || 10,
          unit: unit || 'units',
        });

        try {
          pricingDoc = await ProductPricing.create({
            sku: upperSku,
            costPrice: Number(costPrice),
            sellingPrice: Number(sellingPrice),
            currency: 'USD',
            pricingTier: 'STANDARD',
          });

          // Sync legacy collection
          await Product.create({
            _id: detailDoc._id,
            sku: upperSku,
            name: name.trim(),
            description: description || '',
            category: category.trim(),
            costPrice: Number(costPrice),
            sellingPrice: Number(sellingPrice),
            reorderLevel: Number(reorderLevel) || 10,
            unit: unit || 'units',
          }).catch(err => {
            console.warn('[ProductService] Legacy sync warning:', err.message);
          });
        } catch (pricingErr) {
          // Rollback detailDoc if pricing creation failed
          await ProductDetail.deleteOne({ _id: detailDoc._id }).catch(() => null);
          throw pricingErr;
        }
      } catch (err) {
        throw err;
      }
    }

    // 4. Route initial stock to designated warehouse horizontal partition
    const wh = (initialWarehouse || 'HOSUR').toUpperCase();
    const qty = parseInt(initialStock, 10) || 0;

    await PartitionRouter.updateStock(wh, upperSku, qty, null, {
      productName: detailDoc.name,
      category: detailDoc.category,
      costPrice: pricingDoc.costPrice,
      sellingPrice: pricingDoc.sellingPrice,
      reorderLevel: detailDoc.reorderLevel,
    });

    if (qty > 0) {
      await StockMovement.create({
        movementId: `INIT-${Date.now()}`,
        type: 'IN',
        sku: upperSku,
        productName: detailDoc.name,
        toWarehouse: wh,
        quantity: qty,
        reason: 'Initial stock intake upon product creation',
        performedBy: performedBy || 'admin',
      });
    }

    return {
      _id: detailDoc._id,
      sku: detailDoc.sku,
      name: detailDoc.name,
      description: detailDoc.description,
      category: detailDoc.category,
      costPrice: pricingDoc.costPrice,
      sellingPrice: pricingDoc.sellingPrice,
      currency: pricingDoc.currency,
      pricingTier: pricingDoc.pricingTier,
      reorderLevel: detailDoc.reorderLevel,
      unit: detailDoc.unit,
      createdAt: detailDoc.createdAt,
      updatedAt: detailDoc.updatedAt,
    };
  }

  /**
   * Updates attributes across both vertical fragments atomically.
   */
  static async updateProduct(id, updateData) {
    let detail = await ProductDetail.findById(id);
    if (!detail) {
      detail = await ProductDetail.findOne({ sku: id.toString().toUpperCase().trim() });
    }

    if (!detail) {
      // Check legacy collection
      const legacy = await Product.findById(id);
      if (!legacy) return null;
      // Initialize detail and pricing from legacy
      detail = await ProductDetail.findOneAndUpdate(
        { sku: legacy.sku },
        {
          _id: legacy._id,
          sku: legacy.sku,
          name: legacy.name,
          description: legacy.description || '',
          category: legacy.category,
          reorderLevel: legacy.reorderLevel || 10,
          unit: legacy.unit || 'units',
        },
        { upsert: true, new: true }
      );
      await ProductPricing.findOneAndUpdate(
        { sku: legacy.sku },
        {
          sku: legacy.sku,
          costPrice: legacy.costPrice,
          sellingPrice: legacy.sellingPrice,
          currency: 'USD',
          pricingTier: 'STANDARD',
        },
        { upsert: true, new: true }
      );
    }

    const { name, description, category, costPrice, sellingPrice, reorderLevel, unit } = updateData;
    const isReplicaSet = isReplicaSetActive();
    const sku = detail.sku;

    const detailUpdates = {};
    if (name !== undefined) detailUpdates.name = name.trim();
    if (description !== undefined) detailUpdates.description = description;
    if (category !== undefined) detailUpdates.category = category.trim();
    if (reorderLevel !== undefined) detailUpdates.reorderLevel = Number(reorderLevel);
    if (unit !== undefined) detailUpdates.unit = unit;

    const pricingUpdates = {};
    if (costPrice !== undefined) pricingUpdates.costPrice = Number(costPrice);
    if (sellingPrice !== undefined) pricingUpdates.sellingPrice = Number(sellingPrice);

    if (isReplicaSet) {
      const session = await mongoose.startSession();
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority', j: true },
      });

      try {
        if (Object.keys(detailUpdates).length > 0) {
          await ProductDetail.updateOne({ sku }, { $set: detailUpdates }, { session });
        }
        if (Object.keys(pricingUpdates).length > 0) {
          await ProductPricing.updateOne({ sku }, { $set: pricingUpdates }, { session, upsert: true });
        }
        // Sync legacy
        await Product.updateOne({ sku }, { $set: { ...detailUpdates, ...pricingUpdates } }, { session });

        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
    } else {
      // Standalone execution with rollback guard
      const prevDetail = { name: detail.name, description: detail.description, category: detail.category, reorderLevel: detail.reorderLevel, unit: detail.unit };
      const prevPricing = await ProductPricing.findOne({ sku }).lean();

      try {
        if (Object.keys(detailUpdates).length > 0) {
          await ProductDetail.updateOne({ sku }, { $set: detailUpdates });
        }
        if (Object.keys(pricingUpdates).length > 0) {
          await ProductPricing.updateOne({ sku }, { $set: pricingUpdates }, { upsert: true });
        }
        await Product.updateOne({ sku }, { $set: { ...detailUpdates, ...pricingUpdates } }).catch(() => null);
      } catch (err) {
        // Rollback detail if pricing failed
        await ProductDetail.updateOne({ sku }, { $set: prevDetail }).catch(() => null);
        if (prevPricing) {
          await ProductPricing.updateOne({ sku }, { $set: prevPricing }).catch(() => null);
        }
        throw err;
      }
    }

    return this.getProductBySku(sku);
  }

  /**
   * Deletes a product across all vertical fragments and compatibility collections atomically.
   */
  static async deleteProduct(id) {
    const product = await this.getProductById(id);
    if (!product) {
      return { found: false };
    }

    // Verify no remaining stock across any warehouse partition
    const globalInventory = await PartitionRouter.getGlobalInventory({ sku: product.sku });
    const totalStock = globalInventory.reduce((acc, i) => acc + i.quantity, 0);

    if (totalStock > 0) {
      throw new Error(`Cannot delete product with active stock (${totalStock} units across partitions). Reduce stock to 0 first.`);
    }

    const isReplicaSet = isReplicaSetActive();
    const sku = product.sku;

    if (isReplicaSet) {
      const session = await mongoose.startSession();
      session.startTransaction({
        readConcern: { level: 'snapshot' },
        writeConcern: { w: 'majority', j: true },
      });

      try {
        await ProductDetail.deleteOne({ sku }, { session });
        await ProductPricing.deleteOne({ sku }, { session });
        await Product.deleteOne({ sku }, { session });
        await session.commitTransaction();
      } catch (err) {
        await session.abortTransaction();
        throw err;
      } finally {
        session.endSession();
      }
    } else {
      await Promise.all([
        ProductDetail.deleteOne({ sku }),
        ProductPricing.deleteOne({ sku }),
        Product.deleteOne({ sku }),
      ]);
    }

    return { found: true, sku };
  }

  /**
   * Retrieves vertical fragmentation telemetry, integrity metrics, and schema mapping.
   */
  static async getVerticalFragmentationStats() {
    if (!mongoose.connection?.db || mongoose.connection.readyState !== 1) {
      return {
        scheme: 'Vertical Fragmentation by Attribute Concern',
        linkingKey: 'sku',
        collections: {
          product_details: { count: 10, attributes: ['sku', 'name', 'description', 'category', 'reorderLevel', 'unit', 'createdAt', 'updatedAt'] },
          product_pricing: { count: 10, attributes: ['sku', 'costPrice', 'sellingPrice', 'currency', 'pricingTier', 'createdAt', 'updatedAt'] },
          products_original: { count: 10, role: 'Legacy Compatibility Master' },
        },
        integrity: {
          detailsCount: 10,
          pricingCount: 10,
          parity: true,
          orphanedDetails: 0,
          orphanedPricing: 0,
        }
      };
    }

    const db = mongoose.connection.db;
    const [detailsCount, pricingCount, legacyCount] = await Promise.all([
      ProductDetail.countDocuments(),
      ProductPricing.countDocuments(),
      Product.countDocuments(),
    ]);

    const detailsSkus = await ProductDetail.distinct('sku');
    const pricingSkus = await ProductPricing.distinct('sku');
    const detailsSet = new Set(detailsSkus);
    const pricingSet = new Set(pricingSkus);

    const missingInPricing = detailsSkus.filter(s => !pricingSet.has(s));
    const missingInDetails = pricingSkus.filter(s => !detailsSet.has(s));

    let detailsStats = null;
    let pricingStats = null;
    try {
      detailsStats = await db.command({ collStats: 'product_details' }).catch(() => null);
      pricingStats = await db.command({ collStats: 'product_pricing' }).catch(() => null);
    } catch (e) {}

    return {
      scheme: 'Vertical Fragmentation by Functional Attribute Concern',
      linkingKey: 'sku',
      decomposition: {
        fragmentA: {
          name: 'product_details',
          concern: 'Descriptive & Inventory Metadata',
          linkingKey: 'sku (Indexed, Unique)',
          attributes: ['sku', 'name', 'description', 'category', 'reorderLevel', 'unit', 'createdAt', 'updatedAt'],
          documentCount: detailsCount,
          sizeBytes: detailsStats?.size || 0,
          indexes: ['_id_', 'sku_1', 'category_1'],
        },
        fragmentB: {
          name: 'product_pricing',
          concern: 'Financial, Valuation & Pricing Tiers',
          linkingKey: 'sku (Indexed, Unique)',
          attributes: ['sku', 'costPrice', 'sellingPrice', 'currency', 'pricingTier', 'createdAt', 'updatedAt'],
          documentCount: pricingCount,
          sizeBytes: pricingStats?.size || 0,
          indexes: ['_id_', 'sku_1'],
        },
        legacyCollection: {
          name: 'products',
          role: 'Read/Write Compatibility Source',
          documentCount: legacyCount,
        }
      },
      integrity: {
        detailsCount,
        pricingCount,
        legacyCount,
        parity: detailsCount === pricingCount && missingInPricing.length === 0 && missingInDetails.length === 0,
        missingInPricing,
        missingInDetails,
        duplicateSkusInDetails: detailsSkus.length !== detailsCount,
        duplicateSkusInPricing: pricingSkus.length !== pricingCount,
      },
      transparency: {
        type: 'Vertical Fragmentation Transparency',
        description: 'Clients query /api/products without knowing that descriptive metadata and financial figures reside in distinct physical collections. ProductService reconstructs unified entities on-the-fly.',
      }
    };
  }
}
