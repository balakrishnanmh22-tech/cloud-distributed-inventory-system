import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Warehouse code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  name: {
    type: String,
    required: [true, 'Warehouse name is required'],
    trim: true,
  },
  location: {
    type: String,
    required: [true, 'Warehouse location is required'],
  },
  partitionCollection: {
    type: String,
    required: [true, 'Partition collection is required'],
    unique: true,
  },
  capacity: {
    type: Number,
    default: 10000,
  },
  contactEmail: {
    type: String,
    default: 'ops@inventory.local',
  },
  isActive: {
    type: Boolean,
    default: true,
  }
}, {
  timestamps: true,
});

export const Warehouse = mongoose.model('Warehouse', warehouseSchema);
