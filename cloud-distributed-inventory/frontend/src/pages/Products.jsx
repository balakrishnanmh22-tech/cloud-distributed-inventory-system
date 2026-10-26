import React, { useState, useEffect } from 'react';
import {
  Package,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Trash2,
  AlertTriangle,
  ArrowUpDown,
  Building2,
  Layers,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

export default function Products() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [warehouseFilter, setWarehouseFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState('desc');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [detailedProduct, setDetailedProduct] = useState(null);

  // Form states
  const [formData, setFormData] = useState({
    sku: '',
    name: '',
    description: '',
    category: 'Computing',
    costPrice: '',
    sellingPrice: '',
    reorderLevel: 10,
    initialStock: 20,
    initialWarehouse: 'HOSUR',
  });
  const [formLoading, setFormLoading] = useState(false);

  const toast = useToast();

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await inventoryService.getProducts({
        search,
        category: categoryFilter,
        warehouse: warehouseFilter,
        page,
        limit: 8,
        sortBy,
        order: sortOrder,
      });
      setProducts(res.products);
      setPagination(res.pagination);
    } catch (err) {
      toast.error('Failed to load products: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search, categoryFilter, warehouseFilter, page, sortBy, sortOrder]);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      setFormLoading(true);
      await inventoryService.createProduct(formData);
      toast.success(`Product ${formData.sku.toUpperCase()} created and routed to ${formData.initialWarehouse} partition!`);
      setIsAddModalOpen(false);
      setFormData({
        sku: '',
        name: '',
        description: '',
        category: 'Computing',
        costPrice: '',
        sellingPrice: '',
        reorderLevel: 10,
        initialStock: 20,
        initialWarehouse: 'HOSUR',
      });
      loadProducts();
    } catch (err) {
      toast.error(err.message || 'Error creating product');
    } finally {
      setFormLoading(false);
    }
  };

  const handleEditProduct = async (e) => {
    e.preventDefault();
    try {
      setFormLoading(true);
      await inventoryService.updateProduct(selectedProduct._id, {
        name: selectedProduct.name,
        category: selectedProduct.category,
        costPrice: selectedProduct.costPrice,
        sellingPrice: selectedProduct.sellingPrice,
        reorderLevel: selectedProduct.reorderLevel,
      });
      toast.success('Product updated successfully');
      setIsEditModalOpen(false);
      loadProducts();
    } catch (err) {
      toast.error(err.message || 'Error updating product');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteProduct = async (id, sku) => {
    if (!window.confirm(`Are you sure you want to delete product "${sku}"? This action cannot be undone.`)) return;
    try {
      await inventoryService.deleteProduct(id);
      toast.success(`Product ${sku} deleted`);
      loadProducts();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const openDetailModal = async (product) => {
    try {
      const res = await inventoryService.getProductById(product._id);
      setDetailedProduct(res.product);
      setIsDetailModalOpen(true);
    } catch (err) {
      toast.error('Could not fetch partition details: ' + err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Product Management</h1>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Product</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by SKU or name..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Categories</option>
            <option value="Computing">Computing</option>
            <option value="Displays">Displays</option>
            <option value="Networking">Networking</option>
            <option value="Storage">Storage</option>
            <option value="Peripherals">Peripherals</option>
            <option value="Power">Power</option>
          </select>

          {/* Warehouse Partition Filter */}
          <select
            value={warehouseFilter}
            onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Partitions</option>
            <option value="HOSUR">Hosur Partition</option>
            <option value="CHENNAI">Chennai Partition</option>
            <option value="BANGALORE">Bangalore Partition</option>
          </select>

          {/* Sort order toggle */}
          <button
            onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
            className="flex items-center gap-1 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition"
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="uppercase">{sortOrder}</span>
          </button>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-5">SKU & Name</th>
                <th className="py-3 px-5">Category</th>
                <th className="py-3 px-5 text-right">Cost Price</th>
                <th className="py-3 px-5 text-right">Selling Price</th>
                <th className="py-3 px-5 text-center">Distributed Stock</th>
                <th className="py-3 px-5">Status</th>
                <th className="py-3 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Loading products...</span>
                    </div>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-16 text-center">
                    <div className="flex flex-col items-center justify-center max-w-sm mx-auto">
                      <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-3">
                        <Package className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-bold text-slate-800 mb-1">
                        {search || categoryFilter || warehouseFilter ? 'No products found' : 'No products added yet'}
                      </h3>
                      <p className="text-xs text-slate-500 mb-4">
                        {search || categoryFilter || warehouseFilter
                          ? 'Try adjusting your search query or active filters to find what you are looking for.'
                          : 'Get started by adding your first product to the distributed catalog.'}
                      </p>
                      {search || categoryFilter || warehouseFilter ? (
                        <button
                          type="button"
                          onClick={() => { setSearch(''); setCategoryFilter(''); setWarehouseFilter(''); setPage(1); }}
                          className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
                        >
                          Clear Filters
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setIsAddModalOpen(true)}
                          className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
                        >
                          <Plus className="w-4 h-4" />
                          <span>Add Product</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                products.map((p) => (
                  <tr key={p._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-5">
                      <span className="font-mono font-bold text-blue-700 block">{p.sku}</span>
                      <span className="font-medium text-slate-900 block truncate max-w-xs">{p.name}</span>
                    </td>
                    <td className="py-3 px-5">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
                        {p.category}
                      </span>
                    </td>
                    <td className="py-3 px-5 text-right font-mono text-slate-600">
                      ${p.costPrice?.toFixed(2)}
                    </td>
                    <td className="py-3 px-5 text-right font-mono font-semibold text-slate-900">
                      ${p.sellingPrice?.toFixed(2)}
                    </td>
                    <td className="py-3 px-5 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50/80 border border-blue-100 font-mono">
                        <span className="font-bold text-blue-900">{p.totalStock}</span>
                        <span className="text-[10px] text-blue-600">units</span>
                      </div>
                    </td>
                    <td className="py-3 px-5">
                      {p.isOutOfStock ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                          Out of Stock
                        </span>
                      ) : p.isLowStock ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          <span>Low Stock</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          In Stock
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => openDetailModal(p)}
                          title="View Partition Distribution"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedProduct(p); setIsEditModalOpen(true); }}
                          title="Edit Product"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteProduct(p._id, p.sku)}
                          title="Delete Product"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination.total > 0 && (
          <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-slate-800">{products.length}</span> of{' '}
              <span className="font-semibold text-slate-800">{pagination.total}</span> products
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono text-slate-700">
                Page {page} of {pagination.totalPages || 1}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="Register New Distributed Product">
        <form onSubmit={handleAddProduct} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">SKU (Unique Identifier)</label>
              <input
                type="text"
                required
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="e.g. ASUS-ROG-16"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs uppercase font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="Computing">Computing</option>
                <option value="Displays">Displays</option>
                <option value="Networking">Networking</option>
                <option value="Storage">Storage</option>
                <option value="Peripherals">Peripherals</option>
                <option value="Power">Power</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. ASUS ROG Zephyrus G16"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Price ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.costPrice}
                onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                placeholder="1000"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price ($)</label>
              <input
                type="number"
                step="0.01"
                required
                value={formData.sellingPrice}
                onChange={(e) => setFormData({ ...formData, sellingPrice: e.target.value })}
                placeholder="1400"
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reorder Level</label>
              <input
                type="number"
                required
                value={formData.reorderLevel}
                onChange={(e) => setFormData({ ...formData, reorderLevel: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Initial Partition Placement */}
          <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2">
            <span className="text-xs font-bold text-blue-900 block">Initial Partition Placement</span>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Initial Warehouse</label>
                <select
                  value={formData.initialWarehouse}
                  onChange={(e) => setFormData({ ...formData, initialWarehouse: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs"
                >
                  <option value="HOSUR">Hosur Partition</option>
                  <option value="CHENNAI">Chennai Partition</option>
                  <option value="BANGALORE">Bangalore Partition</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">Initial Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={formData.initialStock}
                  onChange={(e) => setFormData({ ...formData, initialStock: e.target.value })}
                  className="w-full px-3 py-1.5 bg-white border border-blue-200 rounded-lg text-xs"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
            >
              {formLoading ? 'Creating...' : 'Create & Partition'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      {selectedProduct && (
        <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title={`Edit Product: ${selectedProduct.sku}`}>
          <form onSubmit={handleEditProduct} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Product Name</label>
              <input
                type="text"
                required
                value={selectedProduct.name}
                onChange={(e) => setSelectedProduct({ ...selectedProduct, name: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Cost Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={selectedProduct.costPrice}
                  onChange={(e) => setSelectedProduct({ ...selectedProduct, costPrice: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Selling Price ($)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={selectedProduct.sellingPrice}
                  onChange={(e) => setSelectedProduct({ ...selectedProduct, sellingPrice: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Reorder Level</label>
              <input
                type="number"
                required
                value={selectedProduct.reorderLevel}
                onChange={(e) => setSelectedProduct({ ...selectedProduct, reorderLevel: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition"
              >
                {formLoading ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Detail / Partition Distribution Modal */}
      {detailedProduct && (
        <Modal isOpen={isDetailModalOpen} onClose={() => setIsDetailModalOpen(false)} title={`Partition Telemetry: ${detailedProduct.sku}`}>
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <h4 className="text-sm font-bold text-slate-900">{detailedProduct.name}</h4>
              <p className="text-xs text-slate-500 font-mono mt-0.5">Category: {detailedProduct.category} | Reorder Threshold: {detailedProduct.reorderLevel}</p>
              <div className="mt-3 flex items-center gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px]">Cost Price</span>
                  <span className="font-mono font-semibold">${detailedProduct.costPrice?.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Selling Price</span>
                  <span className="font-mono font-semibold">${detailedProduct.sellingPrice?.toFixed(2)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Global Total Stock</span>
                  <span className="font-mono font-bold text-blue-600">{detailedProduct.totalStock} units</span>
                </div>
              </div>
            </div>

            <div>
              <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-blue-600" />
                <span>Horizontal Partition Distribution</span>
              </h5>

              <div className="space-y-2">
                {['HOSUR', 'CHENNAI', 'BANGALORE'].map((wh) => {
                  const qty = detailedProduct.warehouseStock?.[wh] || 0;
                  const collName = `inventory_${wh.toLowerCase()}`;
                  return (
                    <div
                      key={wh}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200/80 bg-white"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-900">{wh} Warehouse</span>
                          <span className="text-[10px] font-mono text-slate-400">({collName})</span>
                        </div>
                        <span className="text-[11px] text-slate-500">Partitioned record</span>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-base text-slate-900">{qty}</span>
                        <span className="text-[10px] text-slate-400 block">units in partition</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
