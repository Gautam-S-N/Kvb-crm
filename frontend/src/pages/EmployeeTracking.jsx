import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  Users, CheckCircle2, Clock, AlertTriangle, TrendingUp,
  ChevronDown, ChevronUp, Loader2, ListChecks
} from 'lucide-react';

// ── Color palette ────────────────────────────────────────────
const COLORS = {
  completed:  '#10b981',
  pending:    '#f59e0b',
  overdue:    '#ef4444',
  inProgress: '#3b82f6',
};

const STATUS_COLORS = {
  PENDING:     'bg-amber-100 text-amber-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  COMPLETED:   'bg-emerald-100 text-emerald-700',
  OVERDUE:     'bg-red-100 text-red-700',
  CANCELLED:   'bg-gray-100 text-gray-500',
};

const PRIORITY_COLORS = {
  LOW:    'text-gray-500',
  MEDIUM: 'text-amber-600',
  HIGH:   'text-orange-600',
  URGENT: 'text-red-600',
};

// ── Donut chart for single employee ─────────────────────────
function EmployeeDonut({ completed, pending, overdue, inProgress, size = 120 }) {
  const data = [
    { name: 'Completed',   value: completed,  color: COLORS.completed },
    { name: 'In Progress', value: inProgress, color: COLORS.inProgress },
    { name: 'Pending',     value: pending,    color: COLORS.pending },
    { name: 'Overdue',     value: overdue,    color: COLORS.overdue },
  ].filter(d => d.value > 0);

  if (data.length === 0) {
    return (
      <div style={{ width: size, height: size }} className="flex items-center justify-center rounded-full bg-gray-100">
        <span className="text-xs text-gray-400">No tasks</span>
      </div>
    );
  }

  return (
    <PieChart width={size} height={size}>
      <Pie data={data} cx={size/2 - 5} cy={size/2 - 5} innerRadius={size*0.3} outerRadius={size*0.45} dataKey="value" strokeWidth={2}>
        {data.map((entry, i) => <Cell key={i} fill={entry.color} />)}
      </Pie>
      <Tooltip formatter={(v, n) => [v, n]} />
    </PieChart>
  );
}

// ── Score ring (CSS-based) ───────────────────────────────────
function ScoreRing({ score }) {
  const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  const label = score >= 75 ? 'On Track' : score >= 50 ? 'Moderate' : 'At Risk';
  const deg = (score / 100) * 360;
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-lg"
        style={{
          background: `conic-gradient(${color} ${deg}deg, #e5e7eb ${deg}deg)`,
          boxShadow: `0 0 0 3px white, 0 0 0 4px ${color}22`,
        }}
      >
        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-sm font-bold" style={{ color }}>
          {score}%
        </div>
      </div>
      <span className="text-[10px] font-semibold" style={{ color }}>{label}</span>
    </div>
  );
}

// ── Employee Card ────────────────────────────────────────────
function EmployeeCard({ stat, onExpand, expanded }) {
  const { employee, total, completed, pending, overdue, inProgress, score } = stat;
  const name = `${employee.firstName} ${employee.lastName}`;

  return (
    <div className={`bg-white rounded-2xl border transition-all ${expanded ? 'border-emerald-300 shadow-lg' : 'border-gray-100 shadow-sm hover:shadow-md'}`}>
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar */}
          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center text-white font-bold text-lg shrink-0">
            {employee.firstName[0]}{employee.lastName[0]}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base">{name}</h3>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-gray-500">
              <span className="flex items-center gap-1"><ListChecks size={11} />{total} Total</span>
              <span className="flex items-center gap-1 text-emerald-600 font-medium"><CheckCircle2 size={11} />{completed} Done</span>
              <span className="flex items-center gap-1 text-amber-600"><Clock size={11} />{pending} Pending</span>
              {overdue > 0 && <span className="flex items-center gap-1 text-red-600 font-medium"><AlertTriangle size={11} />{overdue} Overdue</span>}
            </div>
          </div>

          {/* Score */}
          <ScoreRing score={score} />
        </div>

        {/* Mini donut */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-50">
          <EmployeeDonut completed={completed} pending={pending} overdue={overdue} inProgress={inProgress} size={80} />
          <div className="flex-1 space-y-1.5">
            {[
              { label: 'Completed', val: completed, color: 'bg-emerald-500' },
              { label: 'In Progress', val: inProgress, color: 'bg-blue-500' },
              { label: 'Pending', val: pending, color: 'bg-amber-400' },
              { label: 'Overdue', val: overdue, color: 'bg-red-500' },
            ].map(r => (
              <div key={r.label} className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full shrink-0 ${r.color}`} />
                <span className="text-gray-500 w-20">{r.label}</span>
                <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full ${r.color} rounded-full transition-all`} style={{ width: `${total ? (r.val / total) * 100 : 0}%` }} />
                </div>
                <span className="font-semibold text-gray-700 w-4 text-right">{r.val}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Expand toggle */}
      <button
        onClick={() => onExpand(employee.id)}
        className="w-full flex items-center justify-center gap-1.5 py-2.5 border-t border-gray-100 text-xs text-gray-500 hover:bg-gray-50 hover:text-gray-800 transition-colors rounded-b-2xl font-medium"
      >
        {expanded ? <><ChevronUp size={14} /> Hide tasks</> : <><ChevronDown size={14} /> View tasks</>}
      </button>
    </div>
  );
}

// ── Task Row inside expanded panel ───────────────────────────
function TaskRow({ task }) {
  const sc = STATUS_COLORS[task.status] || 'bg-gray-100 text-gray-500';
  const pc = PRIORITY_COLORS[task.priority] || '';
  return (
    <div className="flex items-center gap-3 py-2.5 px-4 border-b last:border-0 hover:bg-gray-50">
      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${sc} shrink-0`}>{task.status.replace('_', ' ')}</span>
      <span className="flex-1 text-sm font-medium text-gray-800 truncate">{task.title}</span>
      <span className={`text-xs font-bold ${pc} shrink-0`}>{task.priority}</span>
      <span className="text-xs text-gray-400 shrink-0">{new Date(task.dueDate).toLocaleDateString('en-IN')}</span>
    </div>
  );
}

// ── Comparison bar chart ─────────────────────────────────────
function ComparisonChart({ stats }) {
  const data = stats.map(s => ({
    name: s.employee.firstName + ' ' + (s.employee.lastName?.[0] || ''),
    Completed: s.completed,
    Pending:   s.pending,
    Overdue:   s.overdue,
  }));

  // Calculate dynamic minimum width to prevent squishing when many employees exist
  const minChartWidth = Math.max(100, data.length * 80); // 80px per employee bar group

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <h2 className="font-bold text-gray-800 mb-4">Team Overview — Task Distribution</h2>
      <div className="w-full overflow-x-auto pb-2">
        <div style={{ minWidth: `${minChartWidth}px`, height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barGap={4} barCategoryGap="25%" margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 12 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip
                contentStyle={{ borderRadius: 10, border: '1px solid #e5e7eb', fontSize: 12 }}
                cursor={{ fill: '#f9fafb' }}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, bottom: -10 }} />
              <Bar dataKey="Completed" fill={COLORS.completed}  radius={[4,4,0,0]} maxBarSize={40} />
              <Bar dataKey="Pending"   fill={COLORS.pending}    radius={[4,4,0,0]} maxBarSize={40} />
              <Bar dataKey="Overdue"   fill={COLORS.overdue}    radius={[4,4,0,0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────
export default function EmployeeTracking() {
  const [stats, setStats]           = useState([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [expanded, setExpanded]     = useState(null); // employee id
  const [tasks, setTasks]           = useState([]);   // tasks for expanded employee
  const [loadingTasks, setLoadingTasks] = useState(false);

  useEffect(() => {
    (async () => {
      setIsLoading(true);
      try {
        const res = await api.get('/tasks/stats');
        setStats(res.data.data || []);
      } catch { /* ignore */ }
      setIsLoading(false);
    })();
  }, []);

  const handleExpand = async (empId) => {
    if (expanded === empId) { setExpanded(null); setTasks([]); return; }
    setExpanded(empId);
    setTasks([]);
    setLoadingTasks(true);
    try {
      const res = await api.get(`/tasks?assignedToId=${empId}&limit=50`);
      setTasks(res.data.data || []);
    } catch { setTasks([]); }
    setLoadingTasks(false);
  };

  // Aggregate totals
  const totals = stats.reduce((acc, s) => ({
    total: acc.total + s.total,
    completed: acc.completed + s.completed,
    pending: acc.pending + s.pending,
    overdue: acc.overdue + s.overdue,
  }), { total: 0, completed: 0, pending: 0, overdue: 0 });

  const teamScore = totals.total > 0 ? Math.round((totals.completed / totals.total) * 100) : 0;

  return (
    <Layout>
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users size={24} className="text-emerald-500" />
              Employee Task Tracking
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">Monitor task completion, pending work, and deadlines across your team.</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-24">
            <Loader2 size={36} className="animate-spin text-emerald-500" />
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {[
                { label: 'Total Tasks', val: totals.total, icon: ListChecks, color: 'text-gray-700 bg-gray-100' },
                { label: 'Completed',   val: totals.completed, icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50 border-emerald-200' },
                { label: 'Pending',     val: totals.pending,   icon: Clock,        color: 'text-amber-700 bg-amber-50 border-amber-200' },
                { label: 'Overdue',     val: totals.overdue,   icon: AlertTriangle, color: 'text-red-700 bg-red-50 border-red-200' },
              ].map(s => (
                <div key={s.label} className={`${s.color} border rounded-xl px-4 py-3 flex items-center gap-3`}>
                  <s.icon size={20} />
                  <div>
                    <div className="text-2xl font-bold">{s.val}</div>
                    <div className="text-xs font-medium">{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Team score + comparison chart */}
            {stats.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                {/* Team score tile */}
                <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white flex flex-col items-center justify-center gap-3">
                  <TrendingUp size={28} className="opacity-80" />
                  <div className="text-center">
                    <div className="text-5xl font-black">{teamScore}%</div>
                    <div className="text-emerald-200 text-sm font-medium mt-1">Team Completion Rate</div>
                  </div>
                  <div className="w-full bg-emerald-800/40 rounded-full h-2">
                    <div className="bg-white rounded-full h-2 transition-all" style={{ width: `${teamScore}%` }} />
                  </div>
                  <p className="text-xs text-emerald-200 text-center">{totals.completed} of {totals.total} tasks completed</p>
                </div>

                {/* Comparison chart */}
                <div className="lg:col-span-2">
                  <ComparisonChart stats={stats} />
                </div>
              </div>
            )}

            {/* Per-employee cards */}
            {stats.length === 0 ? (
              <div className="text-center py-16">
                <Users size={48} className="mx-auto text-gray-200 mb-3" />
                <p className="text-gray-400">No employee data found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400">Individual Performance</h2>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {stats.map(s => (
                    <div key={s.employee.id}>
                      <EmployeeCard
                        stat={s}
                        onExpand={handleExpand}
                        expanded={expanded === s.employee.id}
                      />
                      {/* Expanded tasks panel */}
                      {expanded === s.employee.id && (
                        <div className="mt-1 bg-white rounded-2xl border border-emerald-200 shadow-sm overflow-hidden animate-fade-in">
                          <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
                            <span className="text-sm font-semibold text-emerald-800">{s.employee.firstName}'s Tasks</span>
                            <span className="text-xs text-emerald-600">{tasks.length} tasks</span>
                          </div>
                          {loadingTasks ? (
                            <div className="flex justify-center py-8">
                              <Loader2 size={24} className="animate-spin text-emerald-400" />
                            </div>
                          ) : tasks.length === 0 ? (
                            <p className="text-center py-8 text-gray-400 text-sm">No tasks assigned.</p>
                          ) : (
                            <div className="max-h-64 overflow-y-auto">
                              {tasks.map(t => <TaskRow key={t.id} task={t} />)}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
