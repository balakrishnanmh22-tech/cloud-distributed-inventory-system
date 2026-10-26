import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
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
    index: true,
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
  reorderLevel: {
    type: Number,
    default: 10,
    min: [0, 'Reorder level cannot be negative'],
  },
  unit: {
    type: String,
    default: 'units',
  }
}, {
  timestamps: true,
});

export const Product = mongoose.model('Product', productSchema);
