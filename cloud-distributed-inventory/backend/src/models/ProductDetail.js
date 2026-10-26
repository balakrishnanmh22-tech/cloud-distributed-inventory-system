import mongoose from 'mongoose';

/**
 * Vertical Fragment A: Product Descriptive Attributes
 * Physical Collection: 'product_details'
 * Linking Key: 'sku'
 */
const productDetailSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    uppercase: true,
    trim: true,
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
  },
  description: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
  },
  reorderLevel: {
    type: Number,
    default: 10,
    min: [0, 'Reorder level cannot be negative'],
  },
  unit: {
    type: String,
    default: 'units',
  },
}, {
  collection: 'product_details',
  timestamps: true,
});

// Enforce unique index on SKU within product_details fragment
productDetailSchema.index({ sku: 1 }, { unique: true });
productDetailSchema.index({ category: 1 });

export const ProductDetail = mongoose.model('ProductDetail', productDetailSchema);
