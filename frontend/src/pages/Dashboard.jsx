import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useDashboardStore } from '../stores/dashboardStore';
import { useSocket } from '../hooks/useSocket';
import {
  Users, ShoppingCart, CheckSquare, TrendingUp,
  UserCheck, AlertTriangle, Activity, BarChart2, Download
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  LineChart, Line, AreaChart, Area 
} from 'recharts';

const fmtMoney = (v) => {
  const n = Number(v || 0);
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2) + ' Cr';
  if (n >= 100000)   return '₹' + (n / 100000).toFixed(2) + ' L';
  return '₹' + n.toLocaleString('en-IN');
};

const KPICard = ({ label, value, sub, icon: Icon, color, onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white rounded-xl shadow-sm border border-gray-100 p-5 flex items-start gap-4 ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
  >
    <div className={`${color} w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0`}>
      <Icon size={22} className="text-white" />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const { metrics, isLoading, fetchMetrics } = useDashboardStore();
  const { subscribeToNotifications, unsubscribeFromNotifications } = useSocket();

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    fetchMetrics();

    subscribeToNotifications((data) => {
      if (['LEAD_STATUS_CHANGED', 'LEAD_ASSIGNED', 'PAYMENT_RECEIVED'].includes(data.type)) fetchMetrics();
    });
    return () => unsubscribeFromNotifications();
  }, [isAuthenticated, navigate]);

  if (!user) return null;

  const L  = metrics.leads || {};
  const S  = metrics.sales || {};
  const T  = metrics.tasks || {};
  const chartData = metrics.chartData || [];

  const handleExport = (type) => {
    const token = localStorage.getItem('token');
    // Triggers download by opening the export API url in a new invisible window
    window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/export/${type}?token=${token}`, '_blank');
  };

  return (
    <Layout>
      {/* Welcome banner & Export Buttons */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'},{' '}
            {user.firstName} 👋
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {user?.role === 'EMPLOYEE' ? 'Here is your personalized dashboard.' : "Here's what's happening in your CRM today."}
          </p>
        </div>
        
        {user?.role === 'ADMIN' && (
          <div className="flex gap-2">
            <button onClick={() => handleExport('leads')} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-md border flex items-center gap-1 transition-colors">
              <Download size={14}/> Leads CSV
            </button>
            <button onClick={() => handleExport('sales')} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-md border flex items-center gap-1 transition-colors">
              <Download size={14}/> Sales CSV
            </button>
            <button onClick={() => handleExport('purchases')} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-md border flex items-center gap-1 transition-colors">
              <Download size={14}/> Purchases CSV
            </button>
          </div>
        )}
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KPICard label={user?.role === 'EMPLOYEE' ? 'My Leads' : 'Total Leads'} value={isLoading ? '…' : L.totalLeads ?? 0} sub={isLoading ? null : fmtMoney(L.totalLeadValue)} icon={Users} color="bg-green-500" onClick={() => navigate('/leads')} />
        <KPICard label={user?.role === 'EMPLOYEE' ? 'My Open Leads' : 'Open Leads'} value={isLoading ? '…' : L.openLeads ?? 0} sub={isLoading ? null : fmtMoney(L.openLeadValue)} icon={Activity} color="bg-blue-500" onClick={() => navigate('/leads')} />
        <KPICard label={user?.role === 'EMPLOYEE' ? 'My Won Leads' : 'Won Leads'} value={isLoading ? '…' : L.wonLeads ?? 0} sub={isLoading ? null : fmtMoney(L.wonLeadValue)} icon={UserCheck} color="bg-emerald-500" />
        <KPICard label={user?.role === 'EMPLOYEE' ? 'My Lost Leads' : 'Lost Leads'} value={isLoading ? '…' : L.lostLeads ?? 0} sub={isLoading ? null : fmtMoney(L.lostLeadValue)} icon={AlertTriangle} color="bg-red-400" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <KPICard label={user?.role === 'EMPLOYEE' ? 'My Sales' : 'Total Sales'} value={isLoading ? '…' : fmtMoney(S.revenue)} sub={isLoading ? null : `${S.count ?? 0} orders`} icon={ShoppingCart} color="bg-violet-500" onClick={() => navigate('/sales')} />
        <KPICard label={user?.role === 'EMPLOYEE' ? 'My Tasks' : 'Pending Tasks'} value={isLoading ? '…' : T.pending ?? 0} icon={CheckSquare} color="bg-amber-500" onClick={() => navigate('/tasks')} />
        {user?.role === 'ADMIN' && (
          <KPICard label="System Status" value="Live" sub="All services connected" icon={TrendingUp} color="bg-teal-500" />
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Revenue Area Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <TrendingUp size={18} className="text-violet-500" /> Revenue Growth (6 Months)
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} tickFormatter={(val) => `₹${val>=100000 ? (val/100000).toFixed(1)+'L' : val}`} />
                <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Area type="monotone" dataKey="Revenue" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorRev)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Lead Volume Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-800 mb-6 flex items-center gap-2">
            <Users size={18} className="text-blue-500" /> Lead Acquisition Volume
          </h2>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#64748b'}} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                <Bar dataKey="Leads" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={32} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </Layout>
  );
};

export default Dashboard;