import express from 'express';
import {
  getWarehouseInventory,
  getGlobalInventory,
  stockIn,
  stockOut,
  stockTransfer,
  getStockMovements,
} from '../controllers/inventoryController.js';
import { authenticate } from '../middleware/auth.js';

export const inventoryRouter = express.Router();
export const stockRouter = express.Router();

// Inventory queries
inventoryRouter.get('/global', getGlobalInventory);
inventoryRouter.get('/:warehouseId', getWarehouseInventory);

// Stock operations
stockRouter.post('/in', authenticate, stockIn);
stockRouter.post('/out', authenticate, stockOut);
stockRouter.post('/transfer', authenticate, stockTransfer);
stockRouter.get('/movements', getStockMovements);
