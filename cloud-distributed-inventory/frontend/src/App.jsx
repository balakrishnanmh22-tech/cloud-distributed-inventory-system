import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import DashboardLayout from './layouts/DashboardLayout';
import Dashboard from './pages/Dashboard';
import Products from './pages/Products';
import Warehouses from './pages/Warehouses';
import StockOperations from './pages/StockOperations';
import DistributedMonitoring from './pages/DistributedMonitoring';
import ArchitectureDocs from './pages/ArchitectureDocs';
import Login from './pages/Login';
import { authService } from './services/authService';

function ProtectedRoute({ children }) {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="warehouses" element={<Warehouses />} />
          <Route path="stock" element={<StockOperations />} />
          <Route path="distributed" element={<DistributedMonitoring />} />
          <Route path="architecture" element={<ArchitectureDocs />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
