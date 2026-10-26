import mongoose from 'mongoose';

/**
 * Vertical Fragment B: Product Pricing & Financial Attributes
 * Physical Collection: 'product_pricing'
 * Linking Key: 'sku'
 */
const productPricingSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    uppercase: true,
    trim: true,
  },
  costPrice: {
    type: Number,
    required: [true, 'Cost price is required'],
    min: [0, 'Cost price cannot be negative'],
  },
  sellingPrice: {
    type: Number,
    required: [true, 'Selling price is required'],
    min: [0, 'Selling price cannot be negative'],
  },
  currency: {
    type: String,
    default: 'USD',
    uppercase: true,
    trim: true,
  },
  pricingTier: {
    type: String,
    default: 'STANDARD',
    uppercase: true,
    trim: true,
  },
}, {
  collection: 'product_pricing',
  timestamps: true,
});

// Enforce unique index on SKU within product_pricing fragment
productPricingSchema.index({ sku: 1 }, { unique: true });

export const ProductPricing = mongoose.model('ProductPricing', productPricingSchema);
