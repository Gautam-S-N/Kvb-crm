import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useTargetStore } from '../stores/targetStore';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import { Target, TrendingUp, Award, Plus, RefreshCw, Trophy } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SalesTargets() {
  const { user } = useAuthStore();
  const { targets, isLoading, fetchTargets, createTarget, refreshAttainment } = useTargetStore();
  
  const [employees, setEmployees] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    employeeId: '',
    periodType: 'MONTHLY',
    periodYear: new Date().getFullYear(),
    periodNumber: new Date().getMonth() + 1,
    revenueTarget: 1000000, // Default 10L
    leadsTarget: 100,
    quotationsTarget: 50,
    notes: ''
  });

  useEffect(() => {
    fetchTargets();
    if (user?.role === 'ADMIN') {
      api.get('/users?role=EMPLOYEE').then(res => setEmployees(res.data.data));
    }
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    const res = await createTarget(formData);
    if (res.success) setShowModal(false);
  };

  const handleRefresh = async () => {
    await refreshAttainment();
  };

  const getLabel = (t) => {
    if (t.periodType === 'WEEKLY') return `Week ${t.periodNumber}, ${t.periodYear}`;
    if (t.periodType === 'MONTHLY') return `${MONTHS[t.periodNumber - 1]} ${t.periodYear}`;
    if (t.periodType === 'QUARTERLY') return `Q${t.periodNumber}, ${t.periodYear}`;
    if (t.periodType === 'YEARLY') return `${t.periodYear}`;
    return t.periodYear;
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Sales Targets & Progression</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track milestones and achievements across different periods</p>
        </div>
        <div className="flex gap-3">
          {user?.role === 'ADMIN' && (
            <button onClick={handleRefresh} className="p-2 text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg" title='Refresh Status'>
              <RefreshCw size={20} className={isLoading ? 'animate-spin' : ''} />
            </button>
          )}
          {user?.role === 'ADMIN' && (
            <button onClick={() => setShowModal(true)} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg">
              <Plus size={18} /> New Target
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {targets.map(t => {
          const pct = Math.min(100, ((t.revenueAchieved / t.revenueTarget) * 100));
          const isWinner = pct >= 100;
          const employee = t.employee || { firstName: '?', lastName: '' };
          
          return (
            <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
              {isWinner && <div className="absolute top-0 right-0 p-2 bg-yellow-100 text-yellow-600 rounded-bl-xl"><Trophy size={20} /></div>}
              {t.isRecurring && <div className="absolute bottom-0 right-0 p-1.5 bg-blue-50 text-blue-500 text-[10px] font-bold px-3 rounded-tl-xl border-t border-l border-blue-100 uppercase tracking-tighter">Recurring</div>}
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                  {employee.firstName[0]}
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">{employee.firstName} {employee.lastName}</h3>
                  <p className="text-sm text-gray-500 font-medium">{getLabel(t)} Target</p>
                </div>
              </div>

              <div className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-500 font-medium">Revenue Progress</span>
                  <span className="font-bold text-gray-900">{pct.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-3">
                  <div 
                    className={`h-3 rounded-full ${isWinner ? 'bg-yellow-400' : 'bg-green-500'}`} 
                    style={{ width: `${pct}%` }} 
                  />
                </div>
                <div className="flex justify-between text-xs mt-1 text-gray-500 font-mono">
                  <span>₹{Number(t.revenueAchieved).toLocaleString('en-IN')}</span>
                  <span>Goal: ₹{Number(t.revenueTarget).toLocaleString('en-IN')}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100 text-sm">
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <span className="block text-gray-500 text-xs mb-1">Leads Won</span>
                  <span className="font-bold">{t.leadsAchieved} <span className="text-gray-400 font-normal text-xs">/ {t.leadsTarget}</span></span>
                </div>
                <div className="bg-gray-50 p-3 rounded-lg text-center">
                  <span className="block text-gray-500 text-xs mb-1">Quotes Sent</span>
                  <span className="font-bold">{t.quotationsSent} <span className="text-gray-400 font-normal text-xs">/ {t.quotationsTarget}</span></span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between">
              <h2 className="font-bold text-lg">Set Sales Target</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Employee</label>
                <select required value={formData.employeeId} onChange={e=>setFormData({...formData,employeeId:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select Employee</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>)}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Target Period</label>
                <div className="grid grid-cols-2 gap-2">
                  <select value={formData.periodType} onChange={e=>setFormData({...formData,periodType:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
                    <option value="WEEKLY">Weekly</option>
                    <option value="MONTHLY">Monthly</option>
                    <option value="QUARTERLY">Quarterly</option>
                    <option value="YEARLY">Yearly</option>
                  </select>
                  <input type="number" required value={formData.periodYear} onChange={e=>setFormData({...formData,periodYear:+e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Year" />
                </div>
              </div>

              {formData.periodType !== 'YEARLY' && (
                <div>
                  <label className="text-xs font-semibold block mb-1">
                    {formData.periodType === 'WEEKLY' ? 'Week Number (1-52)' : 
                     formData.periodType === 'QUARTERLY' ? 'Quarter (1-4)' : 'Month (1-12)'}
                  </label>
                  <input type="number" min="1" max={formData.periodType === 'WEEKLY' ? 52 : formData.periodType === 'QUARTERLY' ? 4 : 12} required value={formData.periodNumber} onChange={e=>setFormData({...formData,periodNumber:+e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">Revenue Goal (₹)</label>
                  <input type="number" required value={formData.revenueTarget} onChange={e=>setFormData({...formData,revenueTarget:+e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Leads Goal</label>
                  <input type="number" required value={formData.leadsTarget} onChange={e=>setFormData({...formData,leadsTarget:+e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>

              <div className="flex items-center gap-4 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formData.isRecurring} onChange={e=>setFormData({...formData,isRecurring:e.target.checked})} className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  <span className="text-xs font-semibold">Repeat Target?</span>
                </label>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Set Reminder Date & Time</label>
                <input type="datetime-local" value={formData.reminderAt} onChange={e=>setFormData({...formData,reminderAt:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
              </div>

              <button disabled={isLoading} type="submit" className="w-full py-2 bg-green-600 text-white font-semibold rounded-lg mt-4 disabled:opacity-50">Save Target</button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
