import { ReactNode } from 'react';
import { useAuth } from '../context/AuthContext';
import { NavBar } from './NavBar';
import { Sidebar } from './Sidebar';

export function AppLayout({ children }: { children: ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-clinical-50">
      {/* Sidebar */}
      {user && <Sidebar userRole={user.role} />}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navigation */}
        {user && <NavBar userName={user.name} userRole={user.role} />}

        {/* Page Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-clinical-200 py-4 px-6 text-center text-sm text-clinical-600">
          <p>© 2026 EHR System. All rights reserved. HIPAA Compliant.</p>
        </footer>
      </div>
    </div>
  );
}
