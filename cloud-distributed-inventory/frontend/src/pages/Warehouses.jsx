import React, { useState, useEffect } from 'react';
import {
  Building2,
  Boxes,
  Database,
  ArrowRightLeft,
  MapPin,
  Layers,
  Search,
  ExternalLink,
  Plus,
} from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import Modal from '../components/Modal';
import { useToast } from '../components/Toast';

export default function Warehouses() {
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedWh, setSelectedWh] = useState(null);
  const [whInventory, setWhInventory] = useState([]);
  const [invLoading, setInvLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);

  // Transfer form state
  const [transferForm, setTransferForm] = useState({
    fromWarehouse: 'HOSUR',
    toWarehouse: 'CHENNAI',
    sku: 'DELL-XPS-15',
    quantity: 2,
    reason: 'Regional replenishment',
  });
  const [transferLoading, setTransferLoading] = useState(false);

  const toast = useToast();

  const loadWarehouses = async () => {
    try {
      setLoading(true);
      const res = await inventoryService.getWarehouses();
      setWarehouses(res.warehouses);
      if (res.warehouses.length > 0 && !selectedWh) {
        selectWarehouse(res.warehouses[0].code);
      }
    } catch (err) {
      toast.error('Failed to load warehouses: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const selectWarehouse = async (code) => {
    try {
      setSelectedWh(code);
      setInvLoading(true);
      const res = await inventoryService.getWarehouseInventory(code, { search });
      setWhInventory(res.inventory);
    } catch (err) {
      toast.error(`Could not query ${code} partition: ` + err.message);
    } finally {
      setInvLoading(false);
    }
  };

  useEffect(() => {
    loadWarehouses();
  }, []);

  useEffect(() => {
    if (selectedWh) {
      selectWarehouse(selectedWh);
    }
  }, [search]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    try {
      setTransferLoading(true);
      const idempotencyKey = `WH-TRF-${Date.now()}`;
      const res = await inventoryService.transferStock({
        ...transferForm,
        idempotencyKey,
      });
      toast.success(`Transferred ${transferForm.quantity} units of ${transferForm.sku} from ${transferForm.fromWarehouse} to ${transferForm.toWarehouse}!`);
      setIsTransferModalOpen(false);
      loadWarehouses();
      if (selectedWh) selectWarehouse(selectedWh);
    } catch (err) {
      toast.error(err.message || 'Transfer failed');
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Warehouses & Partitions</h1>
        </div>

        <button
          onClick={() => setIsTransferModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span>Inter-Partition Transfer</span>
        </button>
      </div>

      {/* Warehouse Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {warehouses.map((wh) => {
          const isSelected = selectedWh === wh.code;
          return (
            <div
              key={wh.code}
              onClick={() => selectWarehouse(wh.code)}
              className={`cursor-pointer rounded-2xl p-6 border transition-all ${
                isSelected
                  ? 'bg-blue-50/50 border-blue-500 shadow-md ring-2 ring-blue-500/20'
                  : 'bg-white border-slate-200/80 shadow-sm hover:border-slate-300 hover:shadow-md'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="p-3 bg-blue-100 text-blue-700 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700">
                  {wh.code}
                </span>
              </div>

              <h3 className="text-base font-bold text-slate-900 mt-4">{wh.name}</h3>
              <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{wh.location}</span>
              </p>

              {/* Partition Binding Info */}
              <div className="mt-4 pt-4 border-t border-slate-100/80 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Database className="w-3.5 h-3.5 text-blue-500" />
                    <span>Partition:</span>
                  </span>
                  <span className="font-mono font-semibold text-slate-800">{wh.partitionCollection}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Layers className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Stored Items:</span>
                  </span>
                  <span className="font-bold text-slate-900">{wh.documentCount || 0} unique SKUs</span>
                </div>
              </div>

              <div className="mt-4">
                <span className={`block text-center py-1.5 rounded-lg text-xs font-semibold ${
                  isSelected ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                }`}>
                  {isSelected ? 'Viewing Partition Data' : 'Inspect Partition'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Warehouse Partition Inventory */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Partition Inventory: {selectedWh}
            </h2>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${selectedWh} items...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-6">SKU</th>
                <th className="py-3 px-6">Product Name</th>
                <th className="py-3 px-6">Category</th>
                <th className="py-3 px-6 text-right">Stock Quantity</th>
                <th className="py-3 px-6">Reorder Level</th>
                <th className="py-3 px-6">Stock Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {invLoading ? (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-slate-400">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <span>Fetching partition records...</span>
                    </div>
                  </td>
                </tr>
              ) : whInventory.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-10 text-center text-slate-400">
                    No items in {selectedWh} partition matching query.
                  </td>
                </tr>
              ) : (
                whInventory.map((item) => (
                  <tr key={item.sku} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-6 font-mono font-bold text-blue-700">{item.sku}</td>
                    <td className="py-3 px-6 font-medium text-slate-900">{item.productName}</td>
                    <td className="py-3 px-6">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-700">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-6 text-right font-mono font-bold text-base text-slate-900">
                      {item.quantity}
                    </td>
                    <td className="py-3 px-6 font-mono text-slate-500">{item.reorderLevel}</td>
                    <td className="py-3 px-6">
                      {item.isOutOfStock ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700">
                          Empty
                        </span>
                      ) : item.isLowStock ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                          Low Stock
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-700">
                          Optimal
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Transfer Modal */}
      <Modal isOpen={isTransferModalOpen} onClose={() => setIsTransferModalOpen(false)} title="Stock Transfer Across Partitions">
        <form onSubmit={handleTransfer} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Source Partition (From)</label>
              <select
                value={transferForm.fromWarehouse}
                onChange={(e) => setTransferForm({ ...transferForm, fromWarehouse: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              >
                <option value="HOSUR">Hosur Partition</option>
                <option value="CHENNAI">Chennai Partition</option>
                <option value="BANGALORE">Bangalore Partition</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Partition (To)</label>
              <select
                value={transferForm.toWarehouse}
                onChange={(e) => setTransferForm({ ...transferForm, toWarehouse: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              >
                <option value="CHENNAI">Chennai Partition</option>
                <option value="HOSUR">Hosur Partition</option>
                <option value="BANGALORE">Bangalore Partition</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Product SKU</label>
              <input
                type="text"
                required
                value={transferForm.sku}
                onChange={(e) => setTransferForm({ ...transferForm, sku: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Units</label>
              <input
                type="number"
                min="1"
                required
                value={transferForm.quantity}
                onChange={(e) => setTransferForm({ ...transferForm, quantity: e.target.value })}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Reason / Authorization</label>
            <input
              type="text"
              value={transferForm.reason}
              onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsTransferModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={transferLoading}
              className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
            >
              {transferLoading ? 'Executing Atomic Commit...' : 'Execute Stock Transfer'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
