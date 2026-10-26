import React, { useState, useEffect } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ArrowLeftRight,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { inventoryService } from '../services/inventoryService';
import { useToast } from '../components/Toast';

export default function StockOperations() {
  const [activeTab, setActiveTab] = useState('transfer'); // 'transfer', 'in', 'out'
  const [movements, setMovements] = useState([]);
  const [loadingMovements, setLoadingMovements] = useState(true);
  const [movementFilter, setMovementFilter] = useState('');
  const [skuSearch, setSkuSearch] = useState('');

  // Form states
  const [transferForm, setTransferForm] = useState({
    fromWarehouse: 'HOSUR',
    toWarehouse: 'CHENNAI',
    sku: 'DELL-XPS-15',
    quantity: 4,
    reason: 'Inventory balance across partitions',
    idempotencyKey: '',
  });

  const [stockInForm, setStockInForm] = useState({
    warehouseId: 'HOSUR',
    sku: 'LENOVO-T14',
    quantity: 10,
    reason: 'Direct shipment receipt from supplier',
  });

  const [stockOutForm, setStockOutForm] = useState({
    warehouseId: 'BANGALORE',
    sku: 'UBI-U6-PRO',
    quantity: 5,
    reason: 'Client hardware deployment dispatch',
  });

  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const loadMovements = async () => {
    try {
      setLoadingMovements(true);
      const res = await inventoryService.getStockMovements({
        type: movementFilter,
        sku: skuSearch,
        limit: 30,
      });
      setMovements(res.movements);
    } catch (err) {
      toast.error('Failed to load stock movements: ' + err.message);
    } finally {
      setLoadingMovements(false);
    }
  };

  useEffect(() => {
    loadMovements();
  }, [movementFilter, skuSearch]);

  const handleTransfer = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const key = transferForm.idempotencyKey.trim() || `TRF-KEY-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const res = await inventoryService.transferStock({
        ...transferForm,
        idempotencyKey: key,
      });

      if (res.result?.isDuplicate) {
        toast.info('Duplicate transfer request detected and skipped safely (Idempotency Key).');
      } else {
        toast.success(`Transferred ${transferForm.quantity} units of ${transferForm.sku} from ${transferForm.fromWarehouse} to ${transferForm.toWarehouse}!`);
      }
      loadMovements();
    } catch (err) {
      toast.error(err.message || 'Transfer failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStockIn = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await inventoryService.stockIn(stockInForm);
      toast.success(res.message);
      loadMovements();
    } catch (err) {
      toast.error(err.message || 'Stock-in failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStockOut = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const res = await inventoryService.stockOut(stockOutForm);
      toast.success(res.message);
      loadMovements();
    } catch (err) {
      toast.error(err.message || 'Stock-out failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">Stock Operations & Audit Ledger</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Operations Form Box (5 cols) */}
        <div className="lg:col-span-5 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col">
          {/* Operation Selector Tabs */}
          <div className="flex p-1 bg-slate-100 rounded-xl mb-6">
            <button
              onClick={() => setActiveTab('transfer')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'transfer'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Transfer</span>
            </button>
            <button
              onClick={() => setActiveTab('in')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'in'
                  ? 'bg-white text-emerald-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ArrowDownLeft className="w-3.5 h-3.5" />
              <span>Stock In</span>
            </button>
            <button
              onClick={() => setActiveTab('out')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'out'
                  ? 'bg-white text-amber-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>Stock Out</span>
            </button>
          </div>

          {/* Form Content */}
          {activeTab === 'transfer' && (
            <form onSubmit={handleTransfer} className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Source Partition</label>
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Destination Partition</label>
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
                    <label className="block text-xs font-semibold text-slate-700 mb-1">SKU</label>
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Idempotency Key <span className="text-slate-400 font-normal">(Optional deduplication token)</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. IDEM-ORDER-8821"
                    value={transferForm.idempotencyKey}
                    onChange={(e) => setTransferForm({ ...transferForm, idempotencyKey: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Transfer Reason</label>
                  <input
                    type="text"
                    value={transferForm.reason}
                    onChange={(e) => setTransferForm({ ...transferForm, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50 mt-4"
              >
                {submitting ? 'Executing Atomic Commit...' : 'Commit Stock Transfer'}
              </button>
            </form>
          )}

          {activeTab === 'in' && (
            <form onSubmit={handleStockIn} className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Target Partition</label>
                  <select
                    value={stockInForm.warehouseId}
                    onChange={(e) => setStockInForm({ ...stockInForm, warehouseId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="HOSUR">Hosur Partition</option>
                    <option value="CHENNAI">Chennai Partition</option>
                    <option value="BANGALORE">Bangalore Partition</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">SKU</label>
                    <input
                      type="text"
                      required
                      value={stockInForm.sku}
                      onChange={(e) => setStockInForm({ ...stockInForm, sku: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={stockInForm.quantity}
                      onChange={(e) => setStockInForm({ ...stockInForm, quantity: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Reference</label>
                  <input
                    type="text"
                    value={stockInForm.reason}
                    onChange={(e) => setStockInForm({ ...stockInForm, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm transition disabled:opacity-50 mt-4"
              >
                {submitting ? 'Recording Inward...' : 'Execute Stock-In'}
              </button>
            </form>
          )}

          {activeTab === 'out' && (
            <form onSubmit={handleStockOut} className="space-y-4 flex-1 flex flex-col justify-between">
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Source Partition</label>
                  <select
                    value={stockOutForm.warehouseId}
                    onChange={(e) => setStockOutForm({ ...stockOutForm, warehouseId: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                  >
                    <option value="HOSUR">Hosur Partition</option>
                    <option value="CHENNAI">Chennai Partition</option>
                    <option value="BANGALORE">Bangalore Partition</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">SKU</label>
                    <input
                      type="text"
                      required
                      value={stockOutForm.sku}
                      onChange={(e) => setStockOutForm({ ...stockOutForm, sku: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Quantity</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={stockOutForm.quantity}
                      onChange={(e) => setStockOutForm({ ...stockOutForm, quantity: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Reason / Order #</label>
                  <input
                    type="text"
                    value={stockOutForm.reason}
                    onChange={(e) => setStockOutForm({ ...stockOutForm, reason: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-sm transition disabled:opacity-50 mt-4"
              >
                {submitting ? 'Dispatching...' : 'Execute Stock-Out'}
              </button>
            </form>
          )}
        </div>

        {/* Audit Movements Ledger (7 cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 shadow-sm flex flex-col">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Distributed Audit Ledger</h2>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={movementFilter}
                onChange={(e) => setMovementFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs"
              >
                <option value="">All Types</option>
                <option value="TRANSFER">Transfers Only</option>
                <option value="IN">Stock In Only</option>
                <option value="OUT">Stock Out Only</option>
              </select>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="SKU..."
                  value={skuSearch}
                  onChange={(e) => setSkuSearch(e.target.value)}
                  className="pl-8 pr-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-28 uppercase font-mono"
                />
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[500px]">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider sticky top-0 border-b border-slate-100">
                  <th className="py-2.5 px-4">Event</th>
                  <th className="py-2.5 px-4">SKU</th>
                  <th className="py-2.5 px-4">Routing</th>
                  <th className="py-2.5 px-4 text-right">Units</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {loadingMovements ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-400">
                      Loading audit ledger...
                    </td>
                  </tr>
                ) : movements.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="py-12 text-center text-slate-400">
                      No matching audit records found.
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m._id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            m.type === 'TRANSFER'
                              ? 'bg-purple-100 text-purple-700'
                              : m.type === 'IN'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {m.type}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-semibold text-slate-900">{m.sku}</td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {m.type === 'TRANSFER' ? (
                          <span>{m.fromWarehouse} → {m.toWarehouse}</span>
                        ) : m.type === 'IN' ? (
                          <span>→ {m.toWarehouse}</span>
                        ) : (
                          <span>{m.fromWarehouse} →</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-slate-900">{m.quantity}</td>
                      <td className="py-3 px-4 text-[11px] text-slate-400 font-mono">
                        {new Date(m.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}{' '}
                        {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
