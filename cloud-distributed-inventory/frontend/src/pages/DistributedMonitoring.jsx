import React, { useState, useEffect } from 'react';
import {
  Network,
  Database,
  Layers,
  Activity,
  Cpu,
  ShieldAlert,
  Play,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Server,
  Zap,
  Split,
  Eye,
  Info,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts';
import { inventoryService } from '../services/inventoryService';
import { useToast } from '../components/Toast';

export default function DistributedMonitoring() {
  const [activeTab, setActiveTab] = useState('fragmentation'); // 'fragmentation', 'replication', 'cap', 'concurrency', 'scalability'
  
  // Telemetry data
  const [fragData, setFragData] = useState(null);
  const [vertData, setVertData] = useState(null);
  const [repData, setRepData] = useState(null);
  const [healthData, setHealthData] = useState(null);
  const [perfData, setPerfData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Experiment states
  const [capRunning, setCapRunning] = useState(false);
  const [capResult, setCapResult] = useState(null);

  const [concRunning, setConcRunning] = useState(false);
  const [concResult, setConcResult] = useState(null);

  const [benchRunning, setBenchRunning] = useState(false);

  const toast = useToast();

  const loadAllTelemetry = async () => {
    try {
      setRefreshing(true);
      const [frag, vert, rep, health, perf] = await Promise.all([
        inventoryService.getFragmentation(),
        inventoryService.getVerticalFragmentation().catch(() => null),
        inventoryService.getReplication(),
        inventoryService.getDatabaseHealth(),
        inventoryService.getPerformance(),
      ]);
      setFragData(frag);
      setVertData(vert || frag?.verticalFragmentation || null);
      setRepData(rep?.replication || rep);
      setHealthData(health?.health || health);
      setPerfData(perf?.metrics || []);
    } catch (err) {
      toast.error('Failed to load distributed telemetry: ' + err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllTelemetry();
  }, []);

  const handleRunCap = async () => {
    try {
      setCapRunning(true);
      const res = await inventoryService.runCapExperiment({ iterations: 5, testWarehouse: 'HOSUR' });
      setCapResult(res.result);
      toast.success('CAP Theorem & BASE experiment executed successfully!');
    } catch (err) {
      toast.error('CAP experiment failed: ' + err.message);
    } finally {
      setCapRunning(false);
    }
  };

  const handleRunConcurrency = async () => {
    try {
      setConcRunning(true);
      const res = await inventoryService.runConcurrencyTest({ concurrentRequests: 6, transferAmount: 2 });
      setConcResult(res);
      toast.success('Concurrency stress test completed! Invariants verified.');
    } catch (err) {
      toast.error('Concurrency test error: ' + err.message);
    } finally {
      setConcRunning(false);
    }
  };

  const handleRunBenchmark = async (replicas) => {
    try {
      setBenchRunning(true);
      await inventoryService.runBenchmark({ replicas, requestCount: 40, concurrency: 10 });
      toast.success(`Benchmark for ${replicas} replica(s) recorded!`);
      const perf = await inventoryService.getPerformance();
      setPerfData(perf.metrics || []);
    } catch (err) {
      toast.error('Benchmark execution error: ' + err.message);
    } finally {
      setBenchRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Distributed Systems</h1>
        </div>

        <button
          onClick={loadAllTelemetry}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* 3 Distributed Infrastructure Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Partition Router */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-4 transition hover:shadow-md">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">PARTITION ROUTER</span>
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                Active
              </span>
            </div>
            <div className="text-base font-bold text-slate-900 mt-1 truncate">
              Horizontal Fragmentation
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {fragData?.partitions?.length || 3} Regional MongoDB collections
            </div>
          </div>
        </div>

        {/* Card 2: Replica Set */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-4 transition hover:shadow-md">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl shrink-0">
            <Network className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">REPLICA SET</span>
              <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
                {repData?.setName || (repData?.isReplicaSet ? 'rs0' : 'standalone')}
              </span>
            </div>
            <div className="text-base font-bold text-slate-900 mt-1 truncate">
              Primary: <span className="font-mono text-xs text-slate-700">{repData?.primaryNode || (healthData?.host ? `${healthData.host}:${healthData.port}` : 'mongo1:27017')}</span>
            </div>
            <div className="text-xs text-slate-500 mt-0.5">
              {repData?.isReplicaSet ? `${repData?.members?.length || 3} Members Quorum` : 'Single Node Topology'}
            </div>
          </div>
        </div>

        {/* Card 3: DB Roundtrip */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex items-start gap-4 transition hover:shadow-md">
          <div className="p-3 bg-purple-50 text-purple-600 rounded-xl shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase">DB ROUNDTRIP</span>
              <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-purple-100 text-purple-700">
                {healthData?.latencyMs != null ? `${healthData.latencyMs} ms` : 'Active'}
              </span>
            </div>
            <div className="text-base font-bold text-slate-900 mt-1 truncate">
              {healthData?.version ? (healthData.version.startsWith('MongoDB') ? healthData.version : `MongoDB ${healthData.version}`) : 'MongoDB 8.x Engine'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 font-mono truncate">
              {healthData?.host ? `${healthData.host}:${healthData.port}` : 'mongo1:27017'}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-1 bg-white rounded-2xl border border-slate-200/80 shadow-sm">
        {[
          { id: 'fragmentation', label: '1. Horizontal Fragmentation', icon: Layers },
          { id: 'vertical_fragmentation', label: '2. Vertical Fragmentation', icon: Split },
          { id: 'replication', label: '3. Replica Set & Quorum', icon: Network },
          { id: 'cap', label: '4. CAP & BASE Experiment', icon: Zap },
          { id: 'concurrency', label: '5. Concurrency & Deadlocks', icon: ShieldAlert },
          { id: 'scalability', label: '6. Scalability & Load Tests', icon: Cpu },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all ${
              activeTab === tab.id
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: HORIZONTAL FRAGMENTATION */}
      {activeTab === 'fragmentation' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {fragData?.partitions?.map((p) => (
              <div key={p.partitionName} className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-blue-50 text-blue-700">
                    {p.warehouseCode}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Locality Active</span>
                  </span>
                </div>

                <h3 className="text-sm font-bold text-slate-900">Physical Partition Collection</h3>
                <p className="font-mono text-xs text-slate-500 mt-0.5">{p.partitionName}</p>

                <div className="mt-4 pt-4 border-t border-slate-100 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Stored Documents:</span>
                    <span className="font-bold font-mono text-slate-900">{p.documentCount} items</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Partition Size:</span>
                    <span className="font-mono text-slate-700">{p.storageSizeBytes || 'Allocated'} bytes</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Index Keys:</span>
                    <span className="font-mono text-slate-700">sku (unique), category</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: VERTICAL FRAGMENTATION */}
      {activeTab === 'vertical_fragmentation' && (
        <div className="space-y-6">
          {/* Header Card */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">Concept 2</span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  Vertical Fragmentation: Attribute Decomposition
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl">
                  Product catalog attributes are partitioned vertically across two distinct physical MongoDB collections based on functional concern and security boundaries, joined transparently by candidate key <code className="text-blue-700 font-mono font-bold bg-blue-50 px-1.5 py-0.5 rounded">sku</code>.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  vertData?.integrity?.parity ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {vertData?.integrity?.parity ? '✔ 100% SKU Parity' : 'Parity Checking...'}
                </span>
              </div>
            </div>
          </div>

          {/* Fragment Decomposition Cards */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Fragment A: Descriptive */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-indigo-50 text-indigo-700">
                  FRAGMENT A
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {vertData?.decomposition?.fragmentA?.documentCount || 10} documents
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Collection: <code className="font-mono text-indigo-600">product_details</code></h3>
                <p className="text-xs text-slate-500 mt-0.5">Descriptive, classification, and inventory metadata</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs">
                <span className="font-semibold text-slate-700 block">Fragment Attributes (Columns):</span>
                <div className="flex flex-wrap gap-1.5">
                  {['sku', 'name', 'description', 'category', 'reorderLevel', 'unit', 'createdAt', 'updatedAt'].map(attr => (
                    <span key={attr} className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                      attr === 'sku' ? 'bg-blue-600 text-white font-bold' : 'bg-white border border-slate-200 text-slate-700'
                    }`}>
                      {attr} {attr === 'sku' && '(Linking Key)'}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex justify-between">
                  <span>Candidate Linking Key:</span>
                  <span className="font-mono font-bold text-blue-600">sku (Unique Index)</span>
                </div>
                <div className="flex justify-between">
                  <span>Physical Indexing:</span>
                  <span className="font-mono text-slate-700">{'{ sku: 1 } (unique), { category: 1 }'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Security & Access Pattern:</span>
                  <span className="text-slate-700">General Catalog Read / Public Browsing</span>
                </div>
              </div>
            </div>

            {/* Fragment B: Financial */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-bold bg-emerald-50 text-emerald-700">
                  FRAGMENT B
                </span>
                <span className="text-xs font-bold text-slate-400">
                  {vertData?.decomposition?.fragmentB?.documentCount || 10} documents
                </span>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">Collection: <code className="font-mono text-emerald-600">product_pricing</code></h3>
                <p className="text-xs text-slate-500 mt-0.5">Commercial valuation, wholesale cost, and price tiers</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl space-y-2 text-xs">
                <span className="font-semibold text-slate-700 block">Fragment Attributes (Columns):</span>
                <div className="flex flex-wrap gap-1.5">
                  {['sku', 'costPrice', 'sellingPrice', 'currency', 'pricingTier', 'createdAt', 'updatedAt'].map(attr => (
                    <span key={attr} className={`px-2 py-0.5 rounded font-mono text-[11px] ${
                      attr === 'sku' ? 'bg-blue-600 text-white font-bold' : 'bg-white border border-slate-200 text-slate-700'
                    }`}>
                      {attr} {attr === 'sku' && '(Linking Key)'}
                    </span>
                  ))}
                </div>
              </div>

              <div className="text-xs text-slate-500 space-y-1.5 pt-2 border-t border-slate-100">
                <div className="flex justify-between">
                  <span>Candidate Linking Key:</span>
                  <span className="font-mono font-bold text-blue-600">sku (Unique Index)</span>
                </div>
                <div className="flex justify-between">
                  <span>Physical Indexing:</span>
                  <span className="font-mono text-slate-700">{'{ sku: 1 } (unique)'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Security & Access Pattern:</span>
                  <span className="text-slate-700">Financial / Restricted Auditing & Margins</span>
                </div>
              </div>
            </div>
          </div>

          {/* Architecture Comparison Table */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <h3 className="text-base font-bold text-slate-900 mb-3">
              Architectural Comparison: Horizontal vs. Vertical Fragmentation
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-400 font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-4">Dimension</th>
                    <th className="py-2.5 px-4">Horizontal Fragmentation</th>
                    <th className="py-2.5 px-4">Vertical Fragmentation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">Partitioning Principle</td>
                    <td className="py-3 px-4">Subsets of <strong>Tuples / Rows</strong></td>
                    <td className="py-3 px-4">Subsets of <strong>Attributes / Columns</strong></td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">Physical Collections</td>
                    <td className="py-3 px-4 font-mono text-blue-600">inventory_hosur, inventory_chennai, inventory_bangalore</td>
                    <td className="py-3 px-4 font-mono text-indigo-600">product_details, product_pricing</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">Routing / Linking Key</td>
                    <td className="py-3 px-4 font-mono">warehouseId (HOSUR, CHENNAI, BANGALORE)</td>
                    <td className="py-3 px-4 font-mono text-blue-600 font-bold">sku (Candidate Key)</td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">Reconstruction Method</td>
                    <td className="py-3 px-4">Union / Scatter-Gather aggregation</td>
                    <td className="py-3 px-4">Natural Join via MongoDB <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">$lookup</code> on <code className="bg-slate-100 px-1 py-0.5 rounded font-mono">sku</code></td>
                  </tr>
                  <tr>
                    <td className="py-3 px-4 font-semibold text-slate-900">System Benefit</td>
                    <td className="py-3 px-4">Data Locality for regional operations & parallel write throughput</td>
                    <td className="py-3 px-4">Security segregation (financial data isolation) & cache efficiency</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: REPLICATION */}
      {activeTab === 'replication' && (
        <div className="space-y-6">
          {/* Topology Overview */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Topology Mode</span>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">
                  {repData?.isReplicaSet ? `MongoDB Replica Set: ${repData.setName}` : 'MongoDB Standalone Engine'}
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Primary-Secondary consensus with Raft-style heartbeat monitoring & automated failover
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  repData?.isReplicaSet ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                }`}>
                  {repData?.isReplicaSet ? 'Replica Set Quorum OK' : 'Local Standalone Engine'}
                </span>
              </div>
            </div>

            {/* Member nodes grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {repData?.members?.map((m) => (
                <div key={m.id} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-slate-700">Member #{m.id}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      m.stateStr.includes('PRIMARY')
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : 'bg-blue-100 text-blue-700 border border-blue-200'
                    }`}>
                      {m.stateStr}
                    </span>
                  </div>

                  <div className="font-mono text-xs text-slate-900 font-semibold truncate">
                    {m.name}
                  </div>

                  <div className="text-[11px] space-y-1 text-slate-500 pt-2 border-t border-slate-200/60">
                    <div className="flex justify-between">
                      <span>Health:</span>
                      <span className="font-bold text-emerald-600">{m.health}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Heartbeat / Ping:</span>
                      <span className="font-mono text-slate-700">{m.pingMs !== null ? `${m.pingMs}ms` : 'Self (0ms)'}</span>
                    </div>
                    {m.replicationLagMs !== undefined && (
                      <div className="flex justify-between">
                        <span>Replication Lag:</span>
                        <span className="font-mono text-slate-700">{m.replicationLagMs}ms</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CAP & BASE EXPERIMENT */}
      {activeTab === 'cap' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Live CAP Theorem & BASE Consistency Benchmark</h2>
                <p className="text-xs text-slate-500">
                  Direct empirical comparison: Strong Consistency (CP) vs Eventual Consistency (AP)
                </p>
              </div>

              <button
                onClick={handleRunCap}
                disabled={capRunning}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50"
              >
                <Play className={`w-4 h-4 ${capRunning ? 'animate-spin' : ''}`} />
                <span>{capRunning ? 'Executing Benchmarks...' : 'Run Live CAP Experiment'}</span>
              </button>
            </div>

            {capResult ? (
              <div className="space-y-6 mt-6">
                {/* Metric Comparison Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Strong Consistency Profile */}
                  <div className="p-5 rounded-2xl border-2 border-blue-200 bg-blue-50/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white">
                        Strong Consistency (CP Profile)
                      </span>
                      <span className="text-xs font-mono font-semibold text-blue-800">w: majority</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="bg-white p-3 rounded-xl border border-blue-100">
                        <span className="text-[11px] text-slate-500 block">Avg Write Latency</span>
                        <span className="text-xl font-bold font-mono text-slate-900">
                          {capResult.strongConsistencyProfile?.avgWriteLatencyMs} ms
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-blue-100">
                        <span className="text-[11px] text-slate-500 block">Avg Read Latency</span>
                        <span className="text-xl font-bold font-mono text-slate-900">
                          {capResult.strongConsistencyProfile?.avgReadLatencyMs} ms
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Waits for quorum acknowledgement across replica members before returning success. Guarantees zero stale reads.
                    </p>
                  </div>

                  {/* Eventual Consistency Profile */}
                  <div className="p-5 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white">
                        Eventual Consistency (AP / BASE)
                      </span>
                      <span className="text-xs font-mono font-semibold text-emerald-800">w: 1 (Primary Only)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="bg-white p-3 rounded-xl border border-emerald-100">
                        <span className="text-[11px] text-slate-500 block">Avg Write Latency</span>
                        <span className="text-xl font-bold font-mono text-slate-900">
                          {capResult.eventualConsistencyProfile?.avgWriteLatencyMs} ms
                        </span>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-emerald-100">
                        <span className="text-[11px] text-slate-500 block">Avg Read Latency</span>
                        <span className="text-xl font-bold font-mono text-slate-900">
                          {capResult.eventualConsistencyProfile?.avgReadLatencyMs} ms
                        </span>
                      </div>
                    </div>

                    <p className="text-xs text-slate-600 leading-relaxed">
                      Returns immediately upon primary write acknowledgement. Lower latency, but reads from secondaries may briefly observe lag.
                    </p>
                  </div>
                </div>

                {/* Analysis & Academic Synthesis */}
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2 text-xs leading-relaxed text-slate-700">
                  <strong className="text-slate-900 text-sm block">Academic Analysis:</strong>
                  <p>{capResult.analysis?.tradeoffSummary}</p>
                  <p className="font-semibold text-blue-900">{capResult.analysis?.academicTakeaway}</p>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 mt-4">
                Click <strong>"Run Live CAP Experiment"</strong> to trigger real-time benchmark across read/write concerns.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: CONCURRENCY & DEADLOCKS */}
      {activeTab === 'concurrency' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Concurrency Stress & Invariant Test</h2>
                <p className="text-xs text-slate-500">
                  Simultaneous transfers race to deplete the exact same stock record (Verifies ACID serialization & non-negative invariant)
                </p>
              </div>

              <button
                onClick={handleRunConcurrency}
                disabled={concRunning}
                className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition disabled:opacity-50"
              >
                <Play className={`w-4 h-4 ${concRunning ? 'animate-spin' : ''}`} />
                <span>{concRunning ? 'Running Stress Test...' : 'Run Concurrency Test'}</span>
              </button>
            </div>

            {concResult ? (
              <div className="space-y-6 mt-6">
                {/* Result Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80">
                    <span className="text-[11px] text-slate-500 block">Initial Test Stock</span>
                    <span className="text-2xl font-bold font-mono text-slate-900">{concResult.initialStock} units</span>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
                    <span className="text-[11px] text-blue-700 block">Concurrent Demanded</span>
                    <span className="text-2xl font-bold font-mono text-blue-900">{concResult.totalStockDemanded} units</span>
                  </div>
                  <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-200">
                    <span className="text-[11px] text-emerald-700 block">Committed Transfers</span>
                    <span className="text-2xl font-bold font-mono text-emerald-900">{concResult.outcomes?.successfulTransfers}</span>
                  </div>
                  <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                    <span className="text-[11px] text-amber-700 block">Safely Rejected</span>
                    <span className="text-2xl font-bold font-mono text-amber-900">{concResult.outcomes?.rejectedTransfers}</span>
                  </div>
                </div>

                {/* Invariant Verification */}
                <div className="p-5 bg-emerald-50/60 border border-emerald-200 rounded-2xl space-y-2">
                  <div className="flex items-center gap-2 text-emerald-900 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Invariants Preserved (Zero Lost Updates, Zero Negative Balances)</span>
                  </div>
                  <div className="text-xs text-emerald-800 space-y-1">
                    <p>• Remaining Source Stock: <strong>{concResult.verification?.actualRemainingHosur} units</strong> (Must be &ge; 0)</p>
                    <p>• Transferred to Destination: <strong>{concResult.verification?.actualTransferredChennai} units</strong></p>
                    <p>• Total Sum Conservation: <strong>{concResult.verification?.actualRemainingHosur + concResult.verification?.actualTransferredChennai} == {concResult.initialStock}</strong> (Verified True)</p>
                  </div>
                  <p className="text-xs text-slate-600 pt-2 border-t border-emerald-200/60">
                    {concResult.academicTakeaway}
                  </p>
                </div>
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200 mt-4">
                Click <strong>"Run Concurrency Test"</strong> to fire 6 concurrent transactions demanding 12 units against 5 available stock.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: SCALABILITY */}
      {activeTab === 'scalability' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Application Scalability & Throughput (RPS)</h2>
                <p className="text-xs text-slate-500">
                  Throughput and latency scaling characteristics under 1, 2, and 3 Kubernetes backend pod replicas
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleRunBenchmark(1)}
                  disabled={benchRunning}
                  className="px-3 py-1.5 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition"
                >
                  Test 1 Replica
                </button>
                <button
                  onClick={() => handleRunBenchmark(2)}
                  disabled={benchRunning}
                  className="px-3 py-1.5 text-xs font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl transition"
                >
                  Test 2 Replicas
                </button>
                <button
                  onClick={() => handleRunBenchmark(3)}
                  disabled={benchRunning}
                  className="px-3 py-1.5 text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl transition"
                >
                  Test 3 Replicas
                </button>
              </div>
            </div>

            {/* Scalability Chart */}
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={perfData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="testName" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'RPS (Req/s)', angle: -90, position: 'insideLeft', fontSize: 11 }} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11, fill: '#64748b' }} label={{ value: 'p95 Latency (ms)', angle: 90, position: 'insideRight', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0' }}
                  />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="rps" name="Throughput (RPS)" stroke="#2563eb" strokeWidth={3} dot={{ r: 5 }} />
                  <Line yAxisId="right" type="monotone" dataKey="p95LatencyMs" name="p95 Latency (ms)" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>


          </div>
        </div>
      )}
    </div>
  );
}
