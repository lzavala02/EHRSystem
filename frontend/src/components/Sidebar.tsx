import { useNavigate, useLocation } from 'react-router-dom';

interface SidebarProps {
  userRole: string;
}

const navigationByRole = {
  Patient: [
    { label: 'Dashboard', path: '/patient/dashboard', icon: '📊' },
    { label: 'Consent Requests', path: '/patient/consent/requests', icon: '✓' },
    { label: 'Symptom Logs', path: '/patient/symptoms/log', icon: '📝' },
    { label: 'History', path: '/patient/symptoms/history', icon: '📋' },
    { label: 'Reports', path: '/patient/reports', icon: '📄' }
  ],
  Provider: [
    { label: 'Patients', path: '/provider/patients', icon: '👥' },
    { label: 'Dashboard', path: '/provider/dashboard', icon: '📊' },
    { label: 'Request Consent', path: '/provider/consent/requests/new', icon: '📝' },
    { label: 'Alerts', path: '/provider/alerts', icon: '⚠️' },
    { label: 'Quick-Share', path: '/provider/quick-share', icon: '📤' }
  ],
  Admin: [
    { label: 'Users', path: '/admin/users', icon: '🔐' },
    { label: 'System Health', path: '/admin/system-health', icon: '⚙️' },
    { label: 'Audit Logs', path: '/admin/audit-logs', icon: '📂' }
  ]
};

export function Sidebar({ userRole }: SidebarProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const items = navigationByRole[userRole as keyof typeof navigationByRole] || [];

  return (
    <aside className="w-64 bg-clinical-900 text-white overflow-y-auto">
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-8">Navigation</h3>
        <nav className="space-y-2">
          {items.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`w-full text-left px-4 py-2 rounded transition ${
                  isActive
                    ? 'bg-clinical-700 text-white font-medium'
                    : 'text-clinical-100 hover:bg-clinical-800'
                }`}
              >
                <span className="mr-2">{item.icon}</span>
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
