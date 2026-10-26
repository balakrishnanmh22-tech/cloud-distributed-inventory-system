import mongoose from 'mongoose';
import crypto from 'crypto';
import { PartitionRouter } from './partitionRouter.js';
import { StockMovement } from '../models/StockMovement.js';
import { Product } from '../models/Product.js';
import { ProductService } from './productService.js';
import { isReplicaSetActive } from '../config/database.js';

export class TransactionService {
  /**
   * Executes an atomic cross-partition stock transfer between two warehouses.
   * Enforces ACID guarantees, idempotency, negative inventory guards, and bounded retries.
   */
  static async transferStock({
    fromWarehouse,
    toWarehouse,
    sku,
    quantity,
    reason = 'Warehouse rebalance',
    idempotencyKey = null,
    performedBy = 'admin',
    maxRetries = 3
  }) {
    if (!fromWarehouse || !toWarehouse || !sku || !quantity) {
      throw new Error('Transfer requires fromWarehouse, toWarehouse, sku, and quantity');
    }

    const fromWh = fromWarehouse.toUpperCase().trim();
    const toWh = toWarehouse.toUpperCase().trim();
    const upperSku = sku.toUpperCase().trim();
    const qty = Number(quantity);

    if (fromWh === toWh) {
      throw new Error('Source and destination warehouse partitions must be different');
    }
    if (qty <= 0 || !Number.isInteger(qty)) {
      throw new Error('Transfer quantity must be a positive integer');
    }

    // 1. Idempotency Check: Prevent duplicate processing
    if (idempotencyKey) {
      const existing = await StockMovement.findOne({ idempotencyKey });
      if (existing) {
        return {
          success: true,
          isDuplicate: true,
          message: 'Transfer already processed (Idempotency Key match)',
          movement: existing,
        };
      }
    }

    // 2. Fetch product details for metadata across fragments
    const product = (await ProductService.getProductBySku(upperSku)) || (await Product.findOne({ sku: upperSku }));
    if (!product) {
      throw new Error(`Product with SKU "${upperSku}" does not exist in product catalog`);
    }

    const movementId = `TRF-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    const isReplicaSet = isReplicaSetActive();

    // 3. Execution with bounded retries for write conflicts
    let attempt = 0;
    while (attempt < maxRetries) {
      attempt++;
      try {
        if (isReplicaSet) {
          // Execute using MongoDB Multi-Document ACID Transaction
          return await this._executeReplicaSetTransaction({
            fromWh,
            toWh,
            upperSku,
            qty,
            product,
            reason,
            idempotencyKey,
            performedBy,
            movementId,
          });
        } else {
          // Fallback with Compensating Two-Phase Commit for Standalone environments
          return await this._executeCompensatingTransfer({
            fromWh,
            toWh,
            upperSku,
            qty,
            product,
            reason,
            idempotencyKey,
            performedBy,
            movementId,
          });
        }
      } catch (err) {
        const isTransientWriteConflict = 
          err.hasErrorLabel?.('TransientTransactionError') ||
          err.codeName === 'WriteConflict' ||
          err.message?.includes('WriteConflict');

        if (isTransientWriteConflict && attempt < maxRetries) {
          const backoff = Math.floor(Math.random() * 50 * Math.pow(2, attempt));
          console.warn(`[TransactionService] Write conflict on attempt ${attempt}. Retrying in ${backoff}ms...`);
          await new Promise(res => setTimeout(res, backoff));
          continue;
        }

        // If not a retryable conflict or exceeded attempts, rethrow
        throw err;
      }
    }
  }

  /**
   * MongoDB Multi-Document ACID Transaction across replica set members.
   */
  static async _executeReplicaSetTransaction({
    fromWh,
    toWh,
    upperSku,
    qty,
    product,
    reason,
    idempotencyKey,
    performedBy,
    movementId,
  }) {
    const session = await mongoose.startSession();
    session.startTransaction({
      readConcern: { level: 'snapshot' },
      writeConcern: { w: 'majority', j: true },
    });

    try {
      // Step A: Decrement source warehouse partition (fails if insufficient stock)
      const sourceUpdate = await PartitionRouter.updateStock(
        fromWh,
        upperSku,
        -qty,
        session
      );

      // Step B: Increment destination warehouse partition
      const destUpdate = await PartitionRouter.updateStock(
        toWh,
        upperSku,
        qty,
        session,
        {
          productName: product.name,
          category: product.category,
          costPrice: product.costPrice,
          sellingPrice: product.sellingPrice,
          reorderLevel: product.reorderLevel,
        }
      );

      // Step C: Record audit movement document within the same atomic transaction
      const movement = new StockMovement({
        movementId,
        type: 'TRANSFER',
        sku: upperSku,
        productName: product.name,
        fromWarehouse: fromWh,
        toWarehouse: toWh,
        quantity: qty,
        reason,
        ...(idempotencyKey ? { idempotencyKey } : {}),
        transactionId: session.id?.id ? session.id.id.toString('hex') : movementId,
        status: 'COMMITTED',
        performedBy,
        timestamp: new Date(),
      });
      await movement.save({ session });

      // Commit transaction
      await session.commitTransaction();

      return {
        success: true,
        transactionMode: 'ACID_REPLICA_SET',
        movementId,
        sourceStockRemaining: sourceUpdate.quantity,
        destinationStock: destUpdate.quantity,
        movement,
      };
    } catch (error) {
      await session.abortTransaction();
      console.error(`[TransactionService] Transaction aborted: ${error.message}`);
      throw error;
    } finally {
      session.endSession();
    }
  }

  /**
   * Safe Two-Phase Compensating Transfer for Standalone / Development Environments.
   */
  static async _executeCompensatingTransfer({
    fromWh,
    toWh,
    upperSku,
    qty,
    product,
    reason,
    idempotencyKey,
    performedBy,
    movementId,
  }) {
    let sourceDeducted = false;

    try {
      // Phase 1: Atomically decrement source partition with invariant quantity >= qty
      const sourceUpdate = await PartitionRouter.updateStock(fromWh, upperSku, -qty);
      sourceDeducted = true;

      // Phase 2: Atomically increment destination partition
      const destUpdate = await PartitionRouter.updateStock(toWh, upperSku, qty, null, {
        productName: product.name,
        category: product.category,
        costPrice: product.costPrice,
        sellingPrice: product.sellingPrice,
        reorderLevel: product.reorderLevel,
      });

      // Phase 3: Create audit log
      const movement = await StockMovement.create({
        movementId,
        type: 'TRANSFER',
        sku: upperSku,
        productName: product.name,
        fromWarehouse: fromWh,
        toWarehouse: toWh,
        quantity: qty,
        reason,
        ...(idempotencyKey ? { idempotencyKey } : {}),
        transactionId: movementId,
        status: 'COMMITTED',
        performedBy,
        timestamp: new Date(),
      });

      return {
        success: true,
        transactionMode: 'COMPENSATING_2PC_STANDALONE',
        movementId,
        sourceStockRemaining: sourceUpdate.quantity,
        destinationStock: destUpdate.quantity,
        movement,
      };
    } catch (error) {
      // If source was deducted but destination failed, rollback source
      if (sourceDeducted) {
        console.warn(`[TransactionService] Destination update failed. Executing compensating rollback on ${fromWh}...`);
        await PartitionRouter.updateStock(fromWh, upperSku, qty);
        await StockMovement.create({
          movementId: `${movementId}-ABORTED`,
          type: 'TRANSFER',
          sku: upperSku,
          productName: product.name,
          fromWarehouse: fromWh,
          toWarehouse: toWh,
          quantity: qty,
          reason: `ABORTED: ${error.message}`,
          status: 'ROLLED_BACK',
          performedBy,
        }).catch(() => null);
      }
      throw error;
    }
  }
}
