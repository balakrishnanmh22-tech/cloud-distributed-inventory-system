import mongoose from 'mongoose';

const stockMovementSchema = new mongoose.Schema({
  movementId: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['IN', 'OUT', 'TRANSFER'],
    required: true,
    index: true,
  },
  sku: {
    type: String,
    required: true,
    uppercase: true,
    index: true,
  },
  productName: {
    type: String,
    default: '',
  },
  fromWarehouse: {
    type: String,
    uppercase: true,
    default: null,
  },
  toWarehouse: {
    type: String,
    uppercase: true,
    default: null,
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1'],
  },
  reason: {
    type: String,
    default: '',
  },
  idempotencyKey: {
    type: String,
  },
  transactionId: {
    type: String,
    default: null,
  },
  status: {
    type: String,
    enum: ['COMMITTED', 'ROLLED_BACK', 'FAILED'],
    default: 'COMMITTED',
    index: true,
  },
  performedBy: {
    type: String,
    default: 'admin',
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  }
});

stockMovementSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

export const StockMovement = mongoose.model('StockMovement', stockMovementSchema);
