import express from 'express';
import {
  getWarehouses,
  createWarehouse,
  getWarehouseById,
} from '../controllers/warehouseController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

router.get('/', getWarehouses);
router.post('/', authenticate, createWarehouse);
router.get('/:id', getWarehouseById);

export default router;
