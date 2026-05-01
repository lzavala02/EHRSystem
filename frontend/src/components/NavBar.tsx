import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface NavBarProps {
  userName: string;
  userRole: string;
}

export function NavBar({ userName, userRole }: NavBarProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/auth/login');
  };

  return (
    <nav className="bg-white border-b border-clinical-200 px-6 py-4 flex items-center justify-between">
      {/* Left side - Branding */}
      <div className="flex items-center space-x-3">
        <h2 className="text-xl font-bold text-clinical-900">EHR System</h2>
      </div>

      {/* Right side - User Menu */}
      <div className="flex items-center space-x-4">
        <span className="text-sm text-clinical-600">
          <span className="font-medium">{userName}</span>
          <span className="mx-2">•</span>
          <span className="inline-block px-2 py-1 bg-health-info text-white text-xs rounded">
            {userRole}
          </span>
        </span>

        <button
          onClick={handleLogout}
          className="px-4 py-2 text-sm text-health-danger hover:bg-clinical-50 rounded transition"
        >
          Logout
        </button>
      </div>
    </nav>
  );
}
