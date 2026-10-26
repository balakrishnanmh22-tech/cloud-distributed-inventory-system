import React, { useState, useEffect } from 'react';
import { Menu, LogOut, Activity, Database, Server } from 'lucide-react';
import { authService } from '../services/authService';
import { inventoryService } from '../services/inventoryService';

export default function Navbar({ onMenuClick }) {
  const user = authService.getCurrentUser();
  const [dbHealth, setDbHealth] = useState({ status: 'CHECKING', latencyMs: 0 });

  useEffect(() => {
    let isMounted = true;
    const checkHealth = async () => {
      try {
        const res = await inventoryService.getDatabaseHealth();
        if (isMounted && res.health) {
          setDbHealth(res.health);
        }
      } catch (err) {
        if (isMounted) setDbHealth({ status: 'DOWN', latencyMs: 0 });
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 15000);
    return () => { isMounted = false; clearInterval(interval); };
  }, []);

  const handleLogout = () => {
    authService.logout();
    window.location.href = '/login';
  };

  return (
    <header className="sticky top-0 z-30 h-16 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 flex items-center justify-between">
      {/* Mobile toggle and title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 lg:hidden"
        >
          <Menu className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-base font-semibold text-slate-900 hidden sm:block">
            Distributed Inventory Operations
          </h2>
          <span className="text-xs text-slate-500 sm:hidden font-medium">Cloud Inventory</span>
        </div>
      </div>

      {/* Right status indicators and user menu */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Backend & DB Health Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs font-medium text-slate-700 shadow-sm">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
              dbHealth.status === 'UP' ? 'bg-emerald-400' : 'bg-rose-400'
            }`}></span>
            <span className={`relative inline-flex rounded-full h-2 w-2 ${
              dbHealth.status === 'UP' ? 'bg-emerald-500' : 'bg-rose-500'
            }`}></span>
          </span>
          <span className="font-semibold text-slate-700">
            {dbHealth.status === 'UP' ? 'Online' : 'Offline'}
          </span>
        </div>

        {/* User profile and logout */}
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="hidden sm:block text-right">
            <p className="text-xs font-semibold text-slate-900">{user?.fullName || 'Administrator'}</p>
            <p className="text-[10px] font-mono text-slate-500">{user?.role || 'ADMIN'}</p>
          </div>

          <button
            onClick={handleLogout}
            title="Sign Out"
            className="p-2 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
