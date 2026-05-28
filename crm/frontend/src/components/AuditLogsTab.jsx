import { useEffect, useState } from 'react';
import api from '../services/api';
import { Activity, User, Clock, Search, ChevronLeft, ChevronRight } from 'lucide-react';

const ACTION_COLORS = {
  create: 'bg-green-500',
  update: 'bg-blue-500',
  delete: 'bg-red-500',
  login:  'bg-purple-500',
  status: 'bg-amber-500',
};

const getActionColor = (action = '') => {
  const a = action.toLowerCase();
  if (a.includes('creat') || a.includes('add')) return ACTION_COLORS.create;
  if (a.includes('updat') || a.includes('edit') || a.includes('status')) return ACTION_COLORS.update;
  if (a.includes('delet') || a.includes('remov')) return ACTION_COLORS.delete;
  if (a.includes('login')) return ACTION_COLORS.login;
  return 'bg-gray-400';
};

export default function AuditLogsTab() {
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchLogs = async (p = 1, q = '') => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: p, limit: 30 });
      if (q) params.append('action', q);
      const res = await api.get(`/logs?${params}`);
      setLogs(res.data.data);
      setPage(res.data.pagination.page);
      setTotalPages(res.data.pagination.pages);
      setTotal(res.data.pagination.total);
    } catch {
      setLogs([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchLogs(); }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchLogs(1, search);
  };

  const fmtDate = (d) =>
    d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-gray-700 bg-gradient-to-r from-slate-800 to-slate-900">
        <div className="flex items-center gap-2">
          <Activity size={18} className="text-green-400" />
          <h2 className="font-bold text-white">System Audit Logs</h2>
          <span className="bg-green-500/20 text-green-300 text-xs px-2 py-0.5 rounded-full font-mono">{total} events</span>
        </div>
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filter by action..."
              className="pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-600 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-500 w-44"
            />
          </div>
          <button type="submit" className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-semibold rounded-lg transition-colors">
            Filter
          </button>
        </form>
      </div>

      {/* Log timeline */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Activity size={40} className="mx-auto mb-3 opacity-30" />
            <p>No audit events found.</p>
          </div>
        ) : (
          <div className="relative">
            {/* Rail */}
            <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gradient-to-b from-green-400 via-blue-300 to-transparent" />
            <div className="space-y-0">
              {logs.map((log, idx) => {
                const action = log.action || 'Event';
                const dotColor = getActionColor(action);
                const isLast = idx === logs.length - 1;
                const actor = log.user
                  ? `${log.user.firstName} ${log.user.lastName}`
                  : log.performedBy
                  ? 'System'
                  : 'Unknown';

                return (
                  <div key={log.id} className={`relative flex gap-4 ${isLast ? '' : 'pb-4'}`}>
                    {/* Dot */}
                    <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full ${dotColor} flex items-center justify-center shadow-sm border-2 border-white dark:border-gray-800`}>
                      <Activity size={14} className="text-white" />
                    </div>
                    {/* Card */}
                    <div className="flex-1 bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-700 rounded-xl p-3 hover:shadow-sm transition-shadow">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="font-semibold text-gray-800 dark:text-gray-200 text-sm">{action}</p>
                        <span className="text-xs text-gray-400 flex items-center gap-1 shrink-0">
                          <Clock size={11} />
                          {fmtDate(log.createdAt)}
                        </span>
                      </div>
                      {log.description && (
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">{log.description}</p>
                      )}
                      <div className="flex items-center gap-1.5 mt-2">
                        <User size={12} className="text-gray-400" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {actor}
                          {log.user?.role && <span className="ml-1 uppercase text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded font-bold">{log.user.role}</span>}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100 dark:border-gray-700">
            <span className="text-sm text-gray-500 dark:text-gray-400">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                disabled={page <= 1}
                onClick={() => fetchLogs(page - 1, search)}
                className="p-1.5 border rounded disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => fetchLogs(page + 1, search)}
                className="p-1.5 border rounded disabled:opacity-40 dark:border-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
