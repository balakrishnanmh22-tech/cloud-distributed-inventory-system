import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

// Route imports
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import warehouseRoutes from './routes/warehouseRoutes.js';
import { inventoryRouter, stockRouter } from './routes/inventoryRoutes.js';
import distributedRoutes from './routes/distributedRoutes.js';
import dashboardRoutes from './routes/dashboardRoutes.js';

const app = express();

// Middleware
app.use(cors({
  origin: '*',
  credentials: true,
}));
app.use(express.json());
app.use(morgan('dev'));

// Prevent stale caching on all dynamic distributed database APIs
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// System Health Handler
const healthCheck = (req, res) => {
  res.json({
    status: 'HEALTHY',
    service: 'distributed-inventory-backend',
    timestamp: new Date(),
    uptime: process.uptime(),
    memoryMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
  });
};

const apiRouter = express.Router();
apiRouter.get('/health', healthCheck);
apiRouter.use('/auth', authRoutes);
apiRouter.use('/products', productRoutes);
apiRouter.use('/warehouses', warehouseRoutes);
apiRouter.use('/inventory', inventoryRouter);
apiRouter.use('/stock', stockRouter);
apiRouter.use('/distributed', distributedRoutes);
apiRouter.use('/dashboard', dashboardRoutes);

// Mount router on both '/api' and '/' to guarantee seamless routing in serverless and standard environments
app.use('/api', apiRouter);
app.use('/', apiRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized Error Handler
app.use(errorHandler);

export default app;
