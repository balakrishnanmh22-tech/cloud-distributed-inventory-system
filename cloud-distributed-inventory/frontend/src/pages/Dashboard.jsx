import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  ArrowLeftRight,
  CheckCircle2,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { inventoryService } from '../services/inventoryService';
import { useToast } from '../components/Toast';

const CATEGORY_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();

  const loadDashboard = async (isManual = false) => {
    if (isManual && refreshing) return;
    try {
      if (isManual) setRefreshing(true);
      const res = await inventoryService.getDashboardSummary();
      setData(res);
      if (isManual) {
        toast.success('Dashboard metrics refreshed successfully.');
      }
    } catch (err) {
      toast.error('Failed to fetch dashboard metrics: ' + (err.message || 'Server error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboard();
    const interval = setInterval(() => loadDashboard(), 20000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500">Querying distributed database partitions...</p>
      </div>
    );
  }

  const { metrics, charts, recentMovements } = data || {};

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => loadDashboard(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 active:bg-slate-300 rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
            title="Refresh Dashboard Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          <Link
            to="/stock"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Stock Transfer</span>
          </Link>
        </div>
      </div>

      {/* Active Warehouses Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Active Warehouses Stat Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500 tracking-wide">Active Warehouses</span>
            <div className="p-2.5 rounded-xl border bg-indigo-50 text-indigo-600 border-indigo-100">
              <Building2 className="w-5 h-5" />
            </div>
          </div>

          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              {metrics?.totalWarehouses || 3}
            </span>
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
              3 Partitions
            </span>
          </div>

          <p className="mt-2 text-xs text-slate-500 font-medium">Hosur, Chennai, Bangalore</p>
        </div>

        {/* 3 Regional Warehouses Locality Card */}
        <div className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-sm md:col-span-2 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Regional Partition Network
            </span>
            <Link
              to="/warehouses"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 transition"
            >
              <span>Manage Warehouses</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              { code: 'HOSUR', name: 'Hosur Hub', location: 'Hosur, Tamil Nadu', partition: 'inventory_hosur' },
              { code: 'CHENNAI', name: 'Chennai Depot', location: 'Chennai, Tamil Nadu', partition: 'inventory_chennai' },
              { code: 'BANGALORE', name: 'Bangalore Logistics', location: 'Bangalore, Karnataka', partition: 'inventory_bangalore' },
            ].map((wh) => (
              <div
                key={wh.code}
                className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-xs text-slate-900">{wh.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200/60">
                    {wh.code}
                  </span>
                </div>
                <div className="mt-2 text-[11px] text-slate-500">
                  <p className="truncate">{wh.location}</p>
                  <p className="font-mono text-[10px] text-slate-400 mt-0.5">{wh.partition}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Warehouse Stock Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Warehouse Locality Distribution</h2>
              <p className="text-xs text-slate-500">Stock units partitioned across regional facilities</p>
            </div>
            <span className="text-xs font-mono text-slate-400">Horizontal Partitions</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={charts?.warehouseDistribution || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="stock" name="Stock Units" fill="#2563eb" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown Chart */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Product Categories</h2>
              <p className="text-xs text-slate-500">Inventory share by hardware category</p>
            </div>
            <span className="text-xs font-mono text-slate-400">Catalog Union</span>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={charts?.categoryDistribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {(charts?.categoryDistribution || []).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Stock Movements Audit Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Stock Movements</h2>
            <p className="text-xs text-slate-500">Atomic transaction audit log across partitions</p>
          </div>
          <Link
            to="/stock"
            className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <span>View All</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                <th className="py-3 px-6">ID & Type</th>
                <th className="py-3 px-6">Product / SKU</th>
                <th className="py-3 px-6">Route</th>
                <th className="py-3 px-6 text-right">Quantity</th>
                <th className="py-3 px-6">Status</th>
                <th className="py-3 px-6">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {recentMovements?.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-8 text-center text-slate-400">
                    No recent stock movements recorded.
                  </td>
                </tr>
              ) : (
                recentMovements?.map((m) => (
                  <tr key={m._id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-6">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.type === 'TRANSFER'
                              ? 'bg-purple-100 text-purple-700'
                              : m.type === 'IN'
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {m.type}
                        </span>
                        <span className="font-mono text-slate-500 text-[11px]">{m.movementId}</span>
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <span className="font-semibold text-slate-900 block">{m.sku}</span>
                      <span className="text-[11px] text-slate-500 truncate block max-w-xs">{m.productName}</span>
                    </td>
                    <td className="py-3 px-6 font-mono text-slate-600">
                      {m.type === 'TRANSFER' ? (
                        <span className="flex items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100">{m.fromWarehouse}</span>
                          <span>→</span>
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">{m.toWarehouse}</span>
                        </span>
                      ) : m.type === 'IN' ? (
                        <span className="text-emerald-700">Intake → {m.toWarehouse}</span>
                      ) : (
                        <span className="text-amber-700">Dispatch ← {m.fromWarehouse}</span>
                      )}
                    </td>
                    <td className="py-3 px-6 text-right font-bold text-slate-900">
                      {m.quantity}
                    </td>
                    <td className="py-3 px-6">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{m.status}</span>
                      </span>
                    </td>
                    <td className="py-3 px-6 text-slate-400 text-[11px] font-mono">
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
  );
}
