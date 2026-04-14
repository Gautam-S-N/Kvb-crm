import { useEffect, useState } from 'react';
import { useReportStore } from '../stores/reportStore';
import { useAuthStore } from '../stores/authStore';
import { useUserStore } from '../stores/userStore';
import Layout from '../components/Layout';
import {
  FileText, TrendingUp, Users, Target, PhoneCall, Handshake, Calendar,
  ChevronDown, Search, Activity, Flag, Plus, FileSpreadsheet,
  CheckCircle2, AlertCircle, BarChart3, TrendingDown
} from 'lucide-react';
import { format, parseISO, isToday } from 'date-fns';

const StatCard = ({ icon: Icon, label, value, trend, trendLabel, color = 'blue' }) => {
  const colorMap = {
    blue:   'bg-blue-50 text-blue-600 border-blue-100',
    green:  'bg-green-50 text-green-600 border-green-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    orange: 'bg-orange-50 text-orange-600 border-orange-100',
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    red:    'bg-red-50 text-red-600 border-red-100'
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
      <div className={`absolute -right-4 -top-4 w-24 h-24 rounded-full opacity-[0.03] group-hover:scale-110 transition-transform ${colorMap[color].split(' ')[1]}`} style={{backgroundColor: 'currentColor'}} />
      <div className="flex justify-between items-start relative z-10">
        <div>
          <p className="text-gray-500 text-sm font-medium mb-1">{label}</p>
          <h3 className="text-2xl font-bold text-gray-900">{value}</h3>
          {(trend || trendLabel) && (
            <div className="flex items-center gap-1.5 mt-2">
              {trend === 'up' && <TrendingUp size={14} className="text-green-500" />}
              {trend === 'down' && <TrendingDown size={14} className="text-red-500" />}
              <span className={`text-xs font-semibold ${trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-500' : 'text-gray-500'}`}>
                {trendLabel}
              </span>
            </div>
          )}
        </div>
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${colorMap[color]}`}>
          <Icon size={22} className="opacity-90" />
        </div>
      </div>
    </div>
  );
};

export default function DailyReports() {
  const { user } = useAuthStore();
  const { reports, todayStats, isLoading, fetchReports, fetchTodayStats, submitReport } = useReportStore();
  const { users, fetchUsers } = useUserStore();

  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  const [empFilter, setEmpFilter] = useState('');
  
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Auto-filled stats map exactly to DB schema fields
  const [form, setForm] = useState({
    leadsCreated: 0,
    leadsContacted: 0,
    followUpsDone: 0,
    quotationsSent: 0,
    salesClosed: 0,
    revenue: '',
    activities: '',
    challenges: '',
    nextDayPlan: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchReports({ date: dateFilter, employeeId: empFilter });
  }, [dateFilter, empFilter]);

  // When opening modal, auto-fill with todayStats if available
  const handleOpenSubmit = async () => {
    await fetchTodayStats();
    setShowSubmitModal(true);
  };

  useEffect(() => {
    if (showSubmitModal && todayStats) {
      setForm(prev => ({
        ...prev,
        leadsCreated: todayStats.leadsCreated || 0,
        leadsContacted: todayStats.leadsContacted || 0,
        followUpsDone: todayStats.followUpsDone || 0,
        quotationsSent: todayStats.quotationsSent || 0,
        salesClosed: todayStats.salesClosed || 0,
        revenue: todayStats.revenue || ''
      }));
    }
  }, [showSubmitModal, todayStats]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    // Always submit for today's date
    const res = await submitReport({
      ...form,
      reportDate: new Date().toISOString().split('T')[0],
    });
    setSubmitting(false);
    if (res.success) {
      setShowSubmitModal(false);
      fetchReports({ date: dateFilter, employeeId: empFilter }); // refresh
      // Reset form text
      setForm({
        ...form, activities: '', challenges: '', nextDayPlan: ''
      });
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  const employees = users.filter(u => u.role === 'EMPLOYEE' || u.role === 'ADMIN');

  // Calculate aggregates for current view
  const totals = reports.reduce((acc, r) => ({
    leads: acc.leads + (r.leadsCreated || 0),
    calls: acc.calls + (r.leadsContacted || 0),
    sales: acc.sales + (r.salesClosed || 0),
    rev: acc.rev + parseFloat(r.revenue || 0)
  }), { leads: 0, calls: 0, sales: 0, rev: 0 });

  return (
    <Layout>
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Actions */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 bg-gradient-to-r from-gray-900 to-gray-800 p-6 sm:p-8 rounded-3xl text-white shadow-lg relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-20 pointer-events-none">
            <BarChart3 size={120} className="text-white" />
          </div>
          
          <div className="relative z-10">
            <h1 className="text-3xl font-bold mb-2">Daily Performance Reports</h1>
            <p className="text-gray-300 max-w-xl">
              Track daily progress, analyze employee output, and manage challenges across the sales pipeline.
            </p>
          </div>
          
          <div className="relative z-10 flex gap-3">
            <button onClick={handleOpenSubmit}
              className="px-6 py-3 bg-green-500 hover:bg-green-400 text-gray-900 font-bold rounded-xl shadow-sm transition-colors flex items-center gap-2">
              <Plus size={18} /> Submit Today's Report
            </button>
          </div>
        </div>

        {/* Global Statistics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Users} label="Leads Generated" value={totals.leads} color="blue" trend="up" trendLabel="In selected period" />
          <StatCard icon={PhoneCall} label="Contacts Made" value={totals.calls} color="indigo" />
          <StatCard icon={Handshake} label="Sales Closed" value={totals.sales} color="green" />
          <StatCard icon={TrendingUp} label="Total Revenue" value={`₹${totals.rev.toLocaleString('en-IN')}`} color="purple" />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex-1 min-w-[200px] flex items-center bg-gray-50 rounded-xl px-3 border border-gray-100 focus-within:ring-2 focus-within:ring-blue-500 transition-all">
            <Calendar size={18} className="text-gray-400" />
            <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
              className="w-full p-2.5 bg-transparent border-none text-sm outline-none text-gray-700 font-medium cursor-pointer" />
          </div>
          
          {isAdmin && (
            <div className="flex-1 min-w-[200px] relative">
              <select value={empFilter} onChange={e => setEmpFilter(e.target.value)}
                className="w-full p-2.5 pl-3 pr-10 bg-gray-50 border border-gray-100 rounded-xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 appearance-none">
                <option value="">All Employees</option>
                {employees.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
              </select>
              <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}
          
          <div className="px-4 text-sm font-bold text-gray-500">
            {reports.length} report{reports.length !== 1 ? 's' : ''} found
          </div>
        </div>

        {/* Report Cards Grid */}
        {isLoading ? (
          <div className="flex justify-center p-20">
            <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : reports.length === 0 ? (
          <div className="text-center bg-white p-16 rounded-3xl border border-gray-100 shadow-sm">
            <FileSpreadsheet size={64} className="mx-auto text-gray-200 mb-4" />
            <h3 className="text-lg font-bold text-gray-900 mb-1">No Reports Found</h3>
            <p className="text-gray-500 max-w-sm mx-auto">No activity has been logged for this date. Change the filters or submit a new report.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {reports.map((report) => (
              <div key={report.id} className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden flex flex-col md:flex-row">
                
                {/* Left side: Meta & Stats */}
                <div className="md:w-[350px] bg-gray-50/50 p-6 border-r border-gray-100 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-12 h-12 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center font-bold text-lg">
                        {report.employee?.firstName?.[0]}{report.employee?.lastName?.[0]}
                      </div>
                      <div>
                        <h4 className="font-bold text-gray-900 text-lg leading-tight">
                          {report.employee?.firstName} {report.employee?.lastName}
                        </h4>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                          {format(parseISO(report.reportDate.split('T')[0]), 'EEEE, MMM do yyyy')}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-6">
                      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Leads</p>
                        <p className="text-xl font-bold text-blue-600">{report.leadsCreated}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Contacts</p>
                        <p className="text-xl font-bold text-indigo-600">{report.leadsContacted}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Follow-ups</p>
                        <p className="text-xl font-bold text-orange-600">{report.followUpsDone}</p>
                      </div>
                      <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm text-center">
                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Quotations</p>
                        <p className="text-xl font-bold text-purple-600">{report.quotationsSent}</p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-green-800">Closed Won</span>
                      <span className="text-sm font-bold text-green-700 bg-green-200 px-2 rounded-md">{report.salesClosed}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-green-800">Revenue</span>
                      <span className="text-lg font-black text-green-700 tracking-tight">₹{parseFloat(report.revenue).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>

                {/* Right side: Completed Today + Qualitative Data */}
                <div className="flex-1 p-6 lg:p-8 space-y-5">
                  {/* ── Completed Today ── */}
                  <div>
                    <h5 className="flex items-center gap-2 font-bold text-gray-800 mb-3">
                      <CheckCircle2 size={16} className="text-emerald-500" /> Completed Today
                    </h5>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {[
                        { label: '📋 Leads Created',    value: report.leadsCreated,    active: report.leadsCreated > 0 },
                        { label: '📞 Calls Made',        value: report.leadsContacted,  active: report.leadsContacted > 0 },
                        { label: '🔁 Follow-ups Done',   value: report.followUpsDone,   active: report.followUpsDone > 0 },
                        { label: '📄 Quotations Sent',   value: report.quotationsSent,  active: report.quotationsSent > 0 },
                        { label: '🤝 Deals Closed',      value: report.salesClosed,     active: report.salesClosed > 0 },
                        { label: '💰 Revenue',           value: `₹${parseFloat(report.revenue || 0).toLocaleString('en-IN')}`, active: parseFloat(report.revenue || 0) > 0 },
                      ].map(item => (
                        <div key={item.label}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-medium ${
                            item.active
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                              : 'bg-gray-50 border-gray-100 text-gray-400'
                          }`}
                        >
                          <span>{item.label}</span>
                          <span className="font-bold ml-2">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {report.activities && (
                    <div>
                      <h5 className="flex items-center gap-2 font-bold text-gray-800 mb-2">
                        <Activity size={16} className="text-blue-500" /> Daily Activities &amp; Summary
                      </h5>
                      <p className="text-gray-600 text-sm leading-relaxed bg-white border border-gray-100 rounded-xl p-4 shadow-sm whitespace-pre-wrap">
                        {report.activities}
                      </p>
                    </div>
                  )}

                  {report.challenges && (
                    <div>
                      <h5 className="flex items-center gap-2 font-bold text-gray-800 mb-2">
                        <AlertCircle size={16} className="text-red-500" /> Challenges &amp; Blockers
                      </h5>
                      <p className="text-gray-600 text-sm leading-relaxed bg-red-50/30 border border-red-50 rounded-xl p-4 shadow-sm whitespace-pre-wrap">
                        {report.challenges}
                      </p>
                    </div>
                  )}

                  {report.nextDayPlan && (
                    <div>
                      <h5 className="flex items-center gap-2 font-bold text-gray-800 mb-2">
                        <Flag size={16} className="text-green-500" /> Plan for Next Day
                      </h5>
                      <p className="text-gray-600 text-sm leading-relaxed bg-green-50/30 border border-green-50 rounded-xl p-4 shadow-sm whitespace-pre-wrap">
                        {report.nextDayPlan}
                      </p>
                    </div>
                  )}

                  {(!report.activities && !report.challenges && !report.nextDayPlan) && (
                    <div className="flex flex-col items-center justify-center py-6 opacity-50">
                      <FileText size={40} className="text-gray-300 mb-2" />
                      <p className="font-semibold text-gray-400">No descriptive notes provided.</p>
                    </div>
                  )}
                </div>

              </div>
            ))}
          </div>
        )}

      </div>

      {/* ─── MODAL: Submit Daily Report ─── */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            
            <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50/80">
              <div>
                <h2 className="font-bold text-xl text-gray-900">Submit Daily Report</h2>
                <p className="text-xs font-semibold text-blue-600 mt-1 flex items-center gap-1.5">
                  <CheckCircle2 size={12} /> Auto-filled with today's CRM data
                </p>
              </div>
              <button onClick={() => setShowSubmitModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500 hover:text-gray-800 transition-colors">
                ✕
              </button>
            </div>

            <div className="overflow-y-auto p-8 bg-white flex-1">
              <form id="reportForm" onSubmit={handleSubmit} className="space-y-8">
                
                {/* Metrics Grid */}
                <div>
                  <h3 className="font-bold text-sm text-gray-800 mb-4 uppercase tracking-wider">Computed Metrics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <label className="text-xs font-bold text-gray-500 block mb-1">New Leads Added</label>
                      <input type="number" value={form.leadsCreated} onChange={e => setForm({...form, leadsCreated: parseInt(e.target.value)||0})} className="w-full bg-transparent font-bold text-xl outline-none" />
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <label className="text-xs font-bold text-gray-500 block mb-1">Leads Contacted</label>
                      <input type="number" value={form.leadsContacted} onChange={e => setForm({...form, leadsContacted: parseInt(e.target.value)||0})} className="w-full bg-transparent font-bold text-xl outline-none" />
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <label className="text-xs font-bold text-gray-500 block mb-1">Follow-ups Done</label>
                      <input type="number" value={form.followUpsDone} onChange={e => setForm({...form, followUpsDone: parseInt(e.target.value)||0})} className="w-full bg-transparent font-bold text-xl outline-none" />
                    </div>
                    <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                      <label className="text-xs font-bold text-gray-500 block mb-1">Quotations Sent</label>
                      <input type="number" value={form.quotationsSent} onChange={e => setForm({...form, quotationsSent: parseInt(e.target.value)||0})} className="w-full bg-transparent font-bold text-xl outline-none" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                      <label className="text-xs font-bold text-green-700 block mb-1">Deals Won / Closed</label>
                      <input type="number" value={form.salesClosed} onChange={e => setForm({...form, salesClosed: parseInt(e.target.value)||0})} className="w-full bg-transparent font-bold text-xl outline-none text-green-800" />
                    </div>
                    <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                      <label className="text-xs font-bold text-green-700 block mb-1">Revenue Generated (₹)</label>
                      <input type="number" value={form.revenue} onChange={e => setForm({...form, revenue: e.target.value})} className="w-full bg-transparent font-bold text-xl outline-none text-green-800" />
                    </div>
                  </div>
                </div>

                {/* Text Notes */}
                <div>
                  <h3 className="font-bold text-sm text-gray-800 mb-4 uppercase tracking-wider">Qualitative Notes</h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-gray-700 block mb-2 opacity-80">Key Activities Done Today *</label>
                      <textarea required rows={3} value={form.activities} onChange={e => setForm({...form, activities: e.target.value})}
                        placeholder="Visited 3 sites in XYZ area, met with the purchasing manager at ABC Corp..."
                        className="w-full bg-white border border-gray-200 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none shadow-sm" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-red-700 block mb-2 opacity-80">Challenges Faced</label>
                        <textarea rows={3} value={form.challenges} onChange={e => setForm({...form, challenges: e.target.value})}
                          placeholder="Client XYZ delayed the payment, inventory issue for Product A..."
                          className="w-full bg-white border border-red-100 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none shadow-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-green-700 block mb-2 opacity-80">Plan for Tomorrow</label>
                        <textarea rows={3} value={form.nextDayPlan} onChange={e => setForm({...form, nextDayPlan: e.target.value})}
                          placeholder="Follow-up list: [Client 1, Client 2]. Prepare quotation for..."
                          className="w-full bg-white border border-green-100 rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-green-400 resize-none shadow-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            
            <div className="p-4 md:px-8 md:py-5 border-t border-gray-100 bg-gray-50 flex justify-end gap-3 rounded-b-3xl">
              <button type="button" onClick={() => setShowSubmitModal(false)}
                className="px-6 py-2.5 rounded-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors text-sm">
                Cancel
              </button>
              <button type="submit" form="reportForm" disabled={submitting}
                className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2 text-sm">
                <CheckCircle2 size={16} /> {submitting ? 'Submitting...' : 'Complete & Submit'}
              </button>
            </div>
          </div>
        </div>
      )}

    </Layout>
  );
}
