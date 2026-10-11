import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuth } from '@/contexts/AuthContext';
import { Building2 } from 'lucide-react';

export default function AppLayout() {
  const { hostel } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex">
      <Sidebar />
      <div className="flex-1 lg:pl-64 flex flex-col transition-all duration-300">
        {/* Mobile top bar spacer header */}
        <header className="lg:hidden flex items-center justify-between h-14 px-4 bg-background border-b pl-14">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <span className="font-semibold text-sm truncate">{hostel?.name || 'Hostel Manager'}</span>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
