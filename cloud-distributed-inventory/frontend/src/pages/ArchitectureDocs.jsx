import React, { useState } from 'react';
import {
  BookOpen,
  HelpCircle,
  Layers,
  Network,
  Database,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Compass,
} from 'lucide-react';

const transparencies = [
  {
    name: '1. Location Transparency',
    codeRef: 'services/api.js, controllers/inventoryController.js',
    description: 'Clients interact exclusively with logical endpoints (/api/inventory/global) without knowing the physical IP addresses or server hostnames of the MongoDB nodes.',
    limitation: 'Clients still know network latency if roundtrip to cloud region degrades.'
  },
  {
    name: '2. Fragmentation Transparency (Horizontal & Vertical)',
    codeRef: 'services/partitionRouter.js (Horizontal), services/productService.js (Vertical)',
    description: 'The caller issues a single query. For horizontal fragmentation, PartitionRouter aggregates inventory_hosur, inventory_chennai, and inventory_bangalore in parallel. For vertical fragmentation, ProductService transparently executes a $lookup join on sku between product_details and product_pricing without the client knowing the attributes are physically separated.',
    limitation: 'Scatter-gather and multi-collection joins introduce minor aggregation latency compared to non-fragmented denormalized single-collection reads.'
  },
  {
    name: '3. Replication Transparency',
    codeRef: 'config/database.js, mongo connection string',
    description: 'The application uses a replica-set-aware connection string; driver automatically detects Primary for writes and Secondaries for reads.',
    limitation: 'Temporary election timeouts (2-10s) may surface during failover.'
  },
  {
    name: '4. Naming Transparency',
    codeRef: 'models/Product.js, models/Warehouse.js',
    description: 'Items are referenced uniformly by logical business SKU (e.g. DELL-XPS-15) and Warehouse code (e.g. HOSUR) rather than internal collection names or ObjectIDs.',
    limitation: 'SKUs must be strictly unique across the system.'
  },
  {
    name: '5. Transaction Transparency',
    codeRef: 'services/transactionService.js (transferStock)',
    description: 'A stock transfer between warehouses is presented as a single business operation. The underlying two-partition updates and audit log commits are handled atomically.',
    limitation: 'Multi-document transactions require replica set or sharded cluster topology.'
  },
  {
    name: '6. Concurrency Transparency',
    codeRef: 'services/partitionRouter.js (updateStock), transactionService.js',
    description: 'Multiple users can execute stock transfers simultaneously without observing dirty reads, race conditions, or lost updates.',
    limitation: 'High concurrent contention on the same SKU triggers write-conflict retries.'
  },
  {
    name: '7. Failure Transparency',
    codeRef: 'Kubernetes Pod Recovery, MongoDB SDAM driver',
    description: 'If a backend pod crashes, Kubernetes restarts it; if a MongoDB primary node dies, a secondary is elected and the driver reconnects automatically.',
    limitation: 'In-flight non-idempotent HTTP requests during an abrupt crash may receive an error requiring retry.'
  },
  {
    name: '8. Performance Transparency',
    codeRef: 'controllers/distributedController.js (/api/distributed/performance)',
    description: 'The distributed database measures and surfaces latency and throughput metrics rather than hiding distributed performance penalties.',
    limitation: 'Distributed consensus across networks is fundamentally bounded by speed of light and network jitter.'
  }
];

const vivaQuestions = [
  {
    q: 'What is vertical fragmentation, how is it implemented, and how does it differ from horizontal fragmentation?',
    a: 'Horizontal fragmentation partitions a relation into subsets of tuples (rows) based on a row-predicate (e.g. inventory records partitioned by warehouseId into inventory_hosur, inventory_chennai, and inventory_bangalore). In contrast, vertical fragmentation partitions a relation into subsets of attributes (columns) based on functional affinity and access characteristics. In this project, the product catalog is decomposed into product_details (descriptive metadata: sku, name, description, category, reorderLevel, unit) and product_pricing (commercial figures: sku, costPrice, sellingPrice, currency, pricingTier). Both fragments share the candidate key "sku" (enforced via unique indexes). ProductService reassembles them transparently via MongoDB $lookup aggregation, while multi-document transactions ensure atomicity during creates, updates, and deletes.'
  },
  {
    q: 'What is horizontal fragmentation and how is it implemented in this project?',
    a: 'Horizontal fragmentation splits a relation into subsets of rows/documents based on a partitioning condition. In our project, inventory records are horizontally fragmented across three physical MongoDB collections: inventory_hosur, inventory_chennai, and inventory_bangalore based on warehouseId. Writes stay local to each warehouse partition, and global queries transparently aggregate across all partitions via the PartitionRouter.'
  },
  {
    q: 'How does the system ensure ACID properties during stock transfers between two partitions?',
    a: 'We use MongoDB Multi-Document Transactions (with snapshot isolation and majority write concern). When transferring stock from Hosur to Chennai: 1) the source partition is decremented with a non-negative guard; 2) the destination partition is incremented; 3) an audit StockMovement record is created with an idempotency key. If any step fails or violates stock invariants, session.abortTransaction() rolls back both partitions atomically.'
  },
  {
    q: 'What is the role of the 3-member MongoDB Replica Set (rs0)?',
    a: 'The replica set provides high availability, data redundancy, and automated failover. One node is Primary (handles all writes) and two nodes are Secondaries (replicate oplog). If the Primary fails, the secondaries elect a new Primary using quorum consensus (2 out of 3 votes). The backend driver discovers the new Primary automatically.'
  },
  {
    q: 'Explain the CAP theorem trade-off demonstrated in your experiment.',
    a: 'According to Eric Brewer\'s CAP theorem, a distributed database under a network partition (P) must choose between Consistency (C) and Availability (A). When write concern is "majority", MongoDB prioritizes Consistency (CP) by requiring quorum confirmation before returning, resulting in higher write latency. With write concern 1, writes return immediately (AP/BASE) offering lower latency, but secondaries may briefly serve stale reads due to replication lag.'
  },
  {
    q: 'How does MongoDB Compass integrate with this distributed architecture?',
    a: 'MongoDB Compass is a GUI management client. It connects to the MongoDB server/replica set via the standard URI (mongodb://localhost:27017 or replica set URI) allowing visual inspection of partitioned collections, indexes, document counts, and replica member status.'
  },
  {
    q: 'What is the difference between horizontal application scaling and database scaling?',
    a: 'Horizontal application scaling (e.g. running 3 Kubernetes backend pods) distributes incoming HTTP requests and compute load across stateless pods. However, it does not distribute the database data or increase database write throughput. Database scaling requires horizontal fragmentation (our warehouse partitioning), replication for read offloading, or genuine MongoDB sharding.'
  }
];

export default function ArchitectureDocs() {
  const [openViva, setOpenViva] = useState(null);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
            Academic Reference & Viva Defense
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">System Architecture & Viva Preparation</h1>
        <p className="text-xs text-slate-500">
          Formal distributed database concepts, transparency mappings, and comprehensive viva Q&A
        </p>
      </div>

      {/* MongoDB Compass Visual Guide */}
      <div className="bg-gradient-to-r from-emerald-900 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-emerald-800/40">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-emerald-500/20 border border-emerald-500/30 rounded-xl">
            <Compass className="w-6 h-6 text-emerald-400" />
          </div>
          <div className="space-y-2">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Visual Database Inspection via MongoDB Compass</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/30 text-emerald-300">
                GUI Client
              </span>
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed">
              MongoDB Compass is a GUI management and visualization tool, not the database engine itself.
              To inspect the live partitions and records in this project:
            </p>
            <div className="p-3 bg-black/40 rounded-xl font-mono text-xs text-emerald-400 select-all border border-emerald-500/20">
              mongodb://127.0.0.1:27017/distributed_inventory
            </div>
            <p className="text-[11px] text-slate-400">
              In Compass, open database <strong>distributed_inventory</strong> to inspect: <code>inventory_hosur</code>, <code>inventory_chennai</code>, <code>inventory_bangalore</code>, <code>products</code>, and <code>stockmovements</code>.
            </p>
          </div>
        </div>
      </div>

      {/* 8 Types of Data Transparency */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <span>Implementation of the 8 Distributed Data Transparencies</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Source file mapping and architectural behavior for every transparency type
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {transparencies.map((t) => (
            <div key={t.name} className="p-4 rounded-xl border border-slate-200/80 bg-slate-50/60 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900">{t.name}</h4>
                <span className="text-[10px] font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                  {t.codeRef.split(',')[0]}
                </span>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed">{t.description}</p>
              <div className="pt-2 border-t border-slate-200/60 text-[11px] text-slate-500">
                <strong className="text-slate-700">Limitation:</strong> {t.limitation}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Viva Questions Accordion */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-purple-600" />
            <span>Viva Examination Questions & Model Answers</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Key theoretical and practical questions frequently asked during academic evaluation
          </p>
        </div>

        <div className="space-y-3">
          {vivaQuestions.map((item, idx) => {
            const isOpen = openViva === idx;
            return (
              <div
                key={idx}
                className="border border-slate-200 rounded-xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenViva(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/80 text-left transition"
                >
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-2">
                    <span className="text-blue-600 font-mono">Q{idx + 1}.</span>
                    <span>{item.q}</span>
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                </button>

                {isOpen && (
                  <div className="p-4 bg-white border-t border-slate-200 text-xs text-slate-600 leading-relaxed">
                    <strong className="text-slate-900 block font-semibold mb-1">Model Answer:</strong>
                    {item.a}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
