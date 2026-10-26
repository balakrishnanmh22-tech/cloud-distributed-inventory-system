import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Building2,
  ArrowLeftRight,
  Network,
  Boxes,
} from 'lucide-react';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Product Catalog', href: '/products', icon: Package },
  { name: 'Warehouses', href: '/warehouses', icon: Building2 },
  { name: 'Stock Operations', href: '/stock', icon: ArrowLeftRight },
  { name: 'Distributed Database', href: '/distributed', icon: Network, highlight: true },
];

export default function Sidebar({ isOpen, onClose }) {
  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-slate-900 text-slate-300 transform transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        } flex flex-col`}
      >
        {/* Brand header */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-800 bg-slate-950/60">
          <div className="p-2 bg-blue-600 rounded-xl text-white shadow-lg shadow-blue-500/20">
            <Boxes className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white tracking-wide">CLOUD INVENTORY</h1>
          </div>
        </div>

        {/* Navigation list */}
        <div className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
            Core Modules
          </div>

          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === '/'}
              onClick={onClose}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60'
                }`
              }
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
              {item.highlight && (
                <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Live
                </span>
              )}
            </NavLink>
          ))}
        </div>

        {/* User / Session Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-xs font-bold text-blue-400">
              AD
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">Administrator</p>
              <p className="text-[10px] text-slate-400 truncate">admin@inventory.local</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
