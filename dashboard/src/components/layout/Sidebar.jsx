import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  ShieldAlert,
  UserRound,
  Database,
  Activity,
} from 'lucide-react';

const links = [
  { to: '/', icon: BarChart3, label: 'Study Overview' },
  { to: '/safety', icon: ShieldAlert, label: 'Safety Dashboard' },
  { to: '/patient', icon: UserRound, label: 'Patient Journey' },
  { to: '/data', icon: Database, label: 'Data Management' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-gray-900 text-gray-300 flex flex-col min-h-screen shrink-0">
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-2">
          <Activity className="w-6 h-6 text-blue-400" />
          <span className="text-base font-bold text-white tracking-tight">FHIR Trial</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Clinical Trial Dashboard</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600/20 text-blue-400'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
              }`
            }
          >
            <Icon className="w-5 h-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4 border-t border-gray-800 text-xs text-gray-600">
        FHIR R4 &middot; HAPI v7.4.0
      </div>
    </aside>
  );
}
