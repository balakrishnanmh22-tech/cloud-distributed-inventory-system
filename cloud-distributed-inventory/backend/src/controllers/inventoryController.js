import { PartitionRouter } from '../services/partitionRouter.js';
import { TransactionService } from '../services/transactionService.js';
import { StockMovement } from '../models/StockMovement.js';
import { Product } from '../models/Product.js';
import { ProductService } from '../services/productService.js';

export async function getWarehouseInventory(req, res, next) {
  try {
    const { warehouseId } = req.params;
    const { search, category, lowStockOnly } = req.query;

    const filter = {};
    if (search) {
      filter.$or = [
        { sku: { $regex: search, $options: 'i' } },
        { productName: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) filter.category = category;

    let items = await PartitionRouter.getInventoryByWarehouse(warehouseId, filter);
    if (lowStockOnly === 'true') {
      items = items.filter(i => i.isLowStock);
    }

    res.json({
      success: true,
      warehouse: warehouseId.toUpperCase(),
      partition: PartitionRouter.getPartitionName(warehouseId),
      count: items.length,
      inventory: items,
    });
  } catch (err) {
    next(err);
  }
}

export async function getGlobalInventory(req, res, next) {
  try {
    const { search, category, lowStockOnly } = req.query;
    const filter = {};
    if (search) {
      filter.$or = [
        { sku: { $regex: search, $options: 'i' } },
        { productName: { $regex: search, $options: 'i' } },
      ];
    }
    if (category) filter.category = category;

    let items = await PartitionRouter.getGlobalInventory(filter);
    if (lowStockOnly === 'true') {
      items = items.filter(i => i.isLowStock);
    }

    res.json({
      success: true,
      transparencyNote: 'Fragmentation Transparency: Single logical view reconstructed from Hosur, Chennai, and Bangalore partitions',
      count: items.length,
      inventory: items,
    });
  } catch (err) {
    next(err);
  }
}

export async function stockIn(req, res, next) {
  try {
    const { warehouseId, sku, quantity, reason = 'Inventory intake' } = req.body;
    if (!warehouseId || !sku || !quantity) {
      return res.status(400).json({ success: false, error: 'warehouseId, sku, and quantity are required' });
    }

    const qty = parseInt(quantity, 10);
    if (qty <= 0) {
      return res.status(400).json({ success: false, error: 'Quantity must be greater than zero' });
    }

    const upperWh = warehouseId.toUpperCase().trim();
    const upperSku = sku.toUpperCase().trim();

    const product = (await ProductService.getProductBySku(upperSku)) || (await Product.findOne({ sku: upperSku }));
    if (!product) {
      return res.status(404).json({ success: false, error: `Product with SKU "${upperSku}" does not exist` });
    }

    const updated = await PartitionRouter.updateStock(upperWh, upperSku, qty, null, {
      productName: product.name,
      category: product.category,
      costPrice: product.costPrice,
      sellingPrice: product.sellingPrice,
      reorderLevel: product.reorderLevel,
    });

    const movement = await StockMovement.create({
      movementId: `IN-${Date.now()}`,
      type: 'IN',
      sku: upperSku,
      productName: product.name,
      toWarehouse: upperWh,
      quantity: qty,
      reason,
      performedBy: req.user?.username || 'admin',
    });

    res.json({
      success: true,
      message: `Stock-in successful in partition ${updated.warehouseId}`,
      currentStock: updated.quantity,
      movement,
    });
  } catch (err) {
    next(err);
  }
}

export async function stockOut(req, res, next) {
  try {
    const { warehouseId, sku, quantity, reason = 'Order dispatch' } = req.body;
    if (!warehouseId || !sku || !quantity) {
      return res.status(400).json({ success: false, error: 'warehouseId, sku, and quantity are required' });
    }

    const qty = parseInt(quantity, 10);
    if (qty <= 0) {
      return res.status(400).json({ success: false, error: 'Quantity must be greater than zero' });
    }

    const upperWh = warehouseId.toUpperCase().trim();
    const upperSku = sku.toUpperCase().trim();

    const product = (await ProductService.getProductBySku(upperSku)) || (await Product.findOne({ sku: upperSku }));
    if (!product) {
      return res.status(404).json({ success: false, error: `Product with SKU "${upperSku}" does not exist` });
    }

    const updated = await PartitionRouter.updateStock(upperWh, upperSku, -qty);

    const movement = await StockMovement.create({
      movementId: `OUT-${Date.now()}`,
      type: 'OUT',
      sku: upperSku,
      productName: product.name,
      fromWarehouse: upperWh,
      quantity: qty,
      reason,
      performedBy: req.user?.username || 'admin',
    });

    res.json({
      success: true,
      message: `Stock-out successful from partition ${upperWh}`,
      currentStock: updated.quantity,
      movement,
    });
  } catch (err) {
    next(err);
  }
}

export async function stockTransfer(req, res, next) {
  try {
    const { fromWarehouse, toWarehouse, sku, quantity, reason, idempotencyKey } = req.body;
    
    const result = await TransactionService.transferStock({
      fromWarehouse,
      toWarehouse,
      sku,
      quantity,
      reason,
      idempotencyKey,
      performedBy: req.user?.username || 'admin',
    });

    res.json({
      success: true,
      message: 'Stock transfer completed across distributed partitions',
      result,
    });
  } catch (err) {
    next(err);
  }
}

export async function getStockMovements(req, res, next) {
  try {
    const { sku, warehouse, type, limit = 50 } = req.query;
    const filter = {};

    if (sku) filter.sku = sku.toUpperCase();
    if (type) filter.type = type.toUpperCase();
    if (warehouse) {
      const upperWh = warehouse.toUpperCase();
      filter.$or = [{ fromWarehouse: upperWh }, { toWarehouse: upperWh }];
    }

    const movements = await StockMovement.find(filter)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit, 10))
      .lean();

    res.json({ success: true, count: movements.length, movements });
  } catch (err) {
    next(err);
  }
}
