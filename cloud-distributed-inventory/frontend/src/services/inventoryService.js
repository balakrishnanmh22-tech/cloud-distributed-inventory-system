import api from './api';

export const inventoryService = {
  // Dashboard
  getDashboardSummary: () => api.get('/dashboard/summary'),

  // Products
  getProducts: (params) => api.get('/products', { params }),
  getProductById: (id) => api.get(`/products/${id}`),
  createProduct: (data) => api.post('/products', data),
  updateProduct: (id, data) => api.put(`/products/${id}`, data),
  deleteProduct: (id) => api.delete(`/products/${id}`),

  // Warehouses
  getWarehouses: () => api.get('/warehouses'),
  getWarehouseById: (id) => api.get(`/warehouses/${id}`),
  createWarehouse: (data) => api.post('/warehouses', data),

  // Inventory
  getWarehouseInventory: (warehouseId, params) => api.get(`/inventory/${warehouseId}`, { params }),
  getGlobalInventory: (params) => api.get('/inventory/global', { params }),

  // Stock Operations
  stockIn: (data) => api.post('/stock/in', data),
  stockOut: (data) => api.post('/stock/out', data),
  transferStock: (data) => api.post('/stock/transfer', data),
  getStockMovements: (params) => api.get('/stock/movements', { params }),

  // Distributed Database Monitoring & Experiments
  getFragmentation: () => api.get('/distributed/fragmentation'),
  getVerticalFragmentation: () => api.get('/distributed/vertical-fragmentation'),
  getReplication: () => api.get('/distributed/replication'),
  getDatabaseHealth: () => api.get('/distributed/database-health'),
  getPerformance: () => api.get('/distributed/performance'),
  runCapExperiment: (data) => api.post('/distributed/run-cap-experiment', data),
  runConcurrencyTest: (data) => api.post('/distributed/run-concurrency-test', data),
  runBenchmark: (data) => api.post('/distributed/run-benchmark', data),
};
