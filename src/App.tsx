import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AppLayout from '@/components/layout/AppLayout';

import Login from '@/pages/Login';
import Dashboard from '@/pages/Dashboard';
import Tenants from '@/pages/Tenants';
import TenantDetail from '@/pages/TenantDetail';
import Rooms from '@/pages/Rooms';
import Payments from '@/pages/Payments';
import RentTracker from '@/pages/RentTracker';
import Expenses from '@/pages/Expenses';
import Reports from '@/pages/Reports';
import Settings from '@/pages/Settings';

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public Auth Route */}
          <Route path="/login" element={<Login />} />

          {/* Protected Application Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/tenants" element={<Tenants />} />
              <Route path="/tenants/:id" element={<TenantDetail />} />
              <Route path="/rooms" element={<Rooms />} />
              <Route path="/payments" element={<Payments />} />
              <Route path="/rent-tracker" element={<RentTracker />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/settings" element={<Settings />} />

              {/* Owner Only Route */}
              <Route element={<ProtectedRoute ownerOnly />}>
                <Route path="/reports" element={<Reports />} />
              </Route>
            </Route>
          </Route>

          {/* Fallback Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}
