import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useNotificationStore } from '../stores/notificationStore';
import NotificationDropdown from './NotificationDropdown';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  Receipt,
  Package,
  Truck,
  CheckSquare,
  BarChart2,
  Settings,
  LogOut,
  Menu,
  X,
  Zap,
  Target,
  ChevronRight,
  ClipboardList,
  UserCheck,
  Sun,
  Moon,
  Monitor,
  UserCog,
} from 'lucide-react';

const navItems = [
  { to: '/dashboard',          icon: LayoutDashboard, label: 'Dashboard',          roles: ['ADMIN', 'EMPLOYEE'] },
  { to: '/leads',              icon: Users,           label: 'Leads',              roles: ['ADMIN', 'EMPLOYEE'] },
  { to: '/quotations',         icon: Receipt,         label: 'Quotations',         roles: ['ADMIN', 'EMPLOYEE'] },
  { to: '/sales',              icon: ShoppingCart,    label: 'Sales',              roles: ['ADMIN', 'EMPLOYEE'] },
  { to: '/products',           icon: Package,         label: 'Products',           roles: ['ADMIN', 'EMPLOYEE'] },
  { to: '/purchase',           icon: Truck,           label: 'Purchase',           roles: ['ADMIN', 'EMPLOYEE'] },
  { to: '/inventory',          icon: Package,         label: 'Inventory',          roles: ['ADMIN', 'EMPLOYEE'] },
  { to: '/tasks',              icon: CheckSquare,     label: 'Tasks',              roles: ['ADMIN', 'EMPLOYEE'] },
  { to: '/daily-reports',      icon: BarChart2,       label: 'Daily Reports',      roles: ['ADMIN', 'EMPLOYEE'] },
  { to: '/targets',            icon: Target,          label: 'Sales Targets',      roles: ['ADMIN', 'EMPLOYEE'] },
  { to: '/todo-list',          icon: ClipboardList,   label: 'My To-Do List',      roles: ['ADMIN', 'EMPLOYEE'] },
  { to: '/employee-tracking',  icon: UserCheck,       label: 'Employee Tracking',  roles: ['ADMIN', 'EMPLOYEE'] },
  { to: '/settings',           icon: Settings,        label: 'Settings',           roles: ['ADMIN'] },
  { to: '/users',              icon: UserCog,         label: 'User Management',    roles: ['ADMIN'] },
];
const NAV_MODULE_KEY = {
  '/leads':             'LEADS',
  '/quotations':        'QUOTATIONS',
  '/sales':             'SALES',
  '/products':          'PRODUCTS',
  '/purchase':          'PURCHASE',
  '/inventory':         'INVENTORY',
  '/tasks':             'TASKS',
  '/daily-reports':     'DAILY_REPORTS',
  '/targets':           'SALES_TARGETS',
  '/todo-list':         'TODO',
  '/employee-tracking': 'EMPLOYEE_TRACKING',
};

// Dark mode helpers
const applyTheme = (mode) => {
  const root = document.documentElement;
  if (mode === 'dark') {
    root.classList.add('dark');
  } else if (mode === 'light') {
    root.classList.remove('dark');
  } else {
    // system
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    prefersDark ? root.classList.add('dark') : root.classList.remove('dark');
  }
};

const Layout = ({ children }) => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const { activeToast, clearToast } = useNotificationStore();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [themeMode, setThemeMode] = useState(() => localStorage.getItem('themeMode') || 'light');

  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  const cycleTheme = () => {
    const modes = ['light', 'dark', 'system'];
    const next = modes[(modes.indexOf(themeMode) + 1) % modes.length];
    setThemeMode(next);
    localStorage.setItem('themeMode', next);
  };

  const ThemeIcon = themeMode === 'dark' ? Moon : themeMode === 'system' ? Monitor : Sun;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const filteredNav = navItems.filter(item => {
    if (!item.roles.includes(user?.role)) return false;
    if (user?.role === 'ADMIN') return true;
    const moduleKey = NAV_MODULE_KEY[item.to];
    // Items with no module key (Dashboard) are always shown
    if (!moduleKey) return true;
    const perms = user?.permissions
      ? (typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions)
      : null;
    return perms?.modules?.[moduleKey] === true;
  });


  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30
          flex flex-col w-64 bg-gray-900 text-white
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        `}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-gray-700">
          <div className="flex items-center justify-center w-9 h-9 bg-green-500 rounded-lg">
            <Zap size={20} className="text-white" />
          </div>
          <div>
            <div className="font-bold text-sm leading-tight">KVB Green</div>
            <div className="text-green-400 text-xs">Energies CRM</div>
          </div>
          <button
            className="ml-auto lg:hidden text-gray-400 hover:text-white"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {filteredNav.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group
                ${isActive
                  ? 'bg-green-600 text-white shadow-md'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon size={18} className={isActive ? 'text-white' : 'text-gray-400 group-hover:text-white'} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={14} className="text-green-300" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User info at bottom */}
        <div className="border-t border-gray-700 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-green-600 flex items-center justify-center font-bold text-sm">
              {user?.firstName?.[0]}{user?.lastName?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.firstName} {user?.lastName}</div>
              <div className="text-xs text-green-400">{user?.role}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="flex items-center gap-4 px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 shadow-sm">
          <button
            className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={22} />
          </button>
          <div className="flex-1" />

          {/* Theme toggle */}
          <button
            id="theme-toggle"
            onClick={cycleTheme}
            className="p-1.5 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-full transition-colors"
            title={`Theme: ${themeMode}`}
          >
            <ThemeIcon size={18} />
          </button>

          {/* Notification bell */}
          <NotificationDropdown />

          <div className="text-sm text-gray-600 dark:text-gray-400">
            {new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-6 bg-gray-50 dark:bg-gray-900">
          {children}
        </main>
      </div>

      {/* Global Real-Time Toast Notification Pop-up */}
      {activeToast && (
        <div 
          className="fixed bottom-8 right-8 z-[99999] flex flex-col gap-2 cursor-pointer shadow-2xl rounded-2xl bg-gray-900 text-white p-4 w-80 border border-gray-700 transition-all duration-300 transform translate-y-0 opacity-100"
          onClick={() => {
            if (activeToast.link) navigate(activeToast.link);
            clearToast();
          }}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold truncate flex items-center gap-1.5">
                <span className="text-xl leading-none">{activeToast.title.split(' ')[0]}</span>
                {activeToast.title.replace(/^[^\s]+\s+/, '')}
              </h4>
              <p className="text-xs text-gray-300 mt-1 line-clamp-2 leading-relaxed">
                {activeToast.body}
              </p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); clearToast(); }}
              className="text-gray-400 hover:text-white shrink-0 p-1"
            >
              <X size={15} />
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          0% { transform: translateY(100px); opacity: 0; }
          100% { transform: translateY(0); opacity: 1; }
        }
        .animate-slide-up {
          animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </div>
  );
};

export default Layout;
