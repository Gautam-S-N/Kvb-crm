import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useTargetStore } from '../stores/targetStore';
import { useAuthStore } from '../stores/authStore';
import api from '../services/api';
import { Target, TrendingUp, Award, Plus, RefreshCw, Trophy, Edit2 } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function SalesTargets() {
  const { user } = useAuthStore();
  const { targets, isLoading, fetchTargets, createTarget, updateTarget, refreshAttainment } = useTargetStore();
  
  const [employees, setEmployees] = useState([]);
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [sortByEmployee, setSortByEmployee] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editId, setEditId] = useState(null);
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

  const [allocateModal, setAllocateModal] = useState({ show: false, parentTarget: null });
  const [allocateData, setAllocateData] = useState({ employeeId: '', revenueTarget: 0, leadsTarget: 0, quotationsTarget: 0 });

  useEffect(() => {
    fetchTargets();
    if (user?.role === 'ADMIN' || user?.permissions?.canViewSubordinates) {
      // Admins can see all employees, managers can see their subordinates
      const url = user?.role === 'ADMIN' ? '/users?role=EMPLOYEE' : '/users/subordinates';
      api.get(url).then(res => setEmployees(res.data.data)).catch(() => {});
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    let res;
    if (isEditing) {
      res = await updateTarget(editId, formData);
    } else {
      res = await createTarget(formData);
    }
    if (res.success) {
      setShowModal(false);
      setIsEditing(false);
      setEditId(null);
    }
  };

  const handleAllocateSubmit = async (e) => {
    e.preventDefault();
    const { parentTarget } = allocateModal;
    const payload = {
      employeeId: allocateData.employeeId,
      periodType: parentTarget.periodType,
      periodYear: parentTarget.periodYear,
      periodNumber: parentTarget.periodNumber,
      revenueTarget: Number(allocateData.revenueTarget),
      leadsTarget: Number(allocateData.leadsTarget),
      quotationsTarget: Number(allocateData.quotationsTarget),
      parentTargetId: parentTarget.id,
      isRecurring: parentTarget.isRecurring,
      notes: `Allocated by ${user.firstName} ${user.lastName}`
    };
    
    const res = await createTarget(payload);
    if (res.success) {
      setAllocateModal({ show: false, parentTarget: null });
      fetchTargets(); // refresh to get updated subTargets
    }
  };

  const openAllocateModal = (t) => {
    setAllocateModal({ show: true, parentTarget: t });
    setAllocateData({ employeeId: '', revenueTarget: '', leadsTarget: '', quotationsTarget: '' });
  };

  const handleEdit = (t) => {
    setFormData({
      employeeId: t.employeeId,
      periodType: t.periodType,
      periodYear: t.periodYear,
      periodNumber: t.periodNumber,
      revenueTarget: Number(t.revenueTarget),
      leadsTarget: t.leadsTarget,
      quotationsTarget: t.quotationsTarget,
      notes: t.notes || '',
      isRecurring: !!t.isRecurring,
      reminderAt: t.reminderAt ? new Date(new Date(t.reminderAt).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
    });
    setEditId(t.id);
    setIsEditing(true);
    setShowModal(true);
  };

  const openCreateModal = () => {
    setFormData({
      employeeId: '',
      periodType: 'MONTHLY',
      periodYear: new Date().getFullYear(),
      periodNumber: new Date().getMonth() + 1,
      revenueTarget: 1000000, // Default 10L
      leadsTarget: 100,
      quotationsTarget: 50,
      notes: '',
      isRecurring: false,
      reminderAt: ''
    });
    setIsEditing(false);
    setEditId(null);
    setShowModal(true);
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
          {(user?.role === 'ADMIN' || user?.permissions?.canViewSubordinates) && (
            <button onClick={openCreateModal} className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg">
              <Plus size={18} /> New Target
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-5 flex gap-3 flex-wrap">
        {(user?.role === 'ADMIN' || user?.permissions?.canViewSubordinates) && (
          <select value={employeeFilter} onChange={e => setEmployeeFilter(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500">
            <option value="">All Relevant Employees</option>
            {[...employees].sort((a,b) => a.firstName.localeCompare(b.firstName)).map(u => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
            ))}
          </select>
        )}
        <select value={sortByEmployee} onChange={e => setSortByEmployee(e.target.value)} className="px-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500">
          <option value="">Sort By</option>
          <option value="asc">Employee (A-Z)</option>
          <option value="desc">Employee (Z-A)</option>
        </select>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {(() => {
          let displayedTargets = targets;
          if (employeeFilter) displayedTargets = displayedTargets.filter(t => t.employeeId === employeeFilter);
          if (sortByEmployee === 'asc') {
            displayedTargets = [...displayedTargets].sort((a,b) => (a.employee?.firstName || '').localeCompare(b.employee?.firstName || ''));
          } else if (sortByEmployee === 'desc') {
            displayedTargets = [...displayedTargets].sort((a,b) => (b.employee?.firstName || '').localeCompare(a.employee?.firstName || ''));
          }
          
          if (displayedTargets.length === 0) {
            return (
              <div className="col-span-full py-16 text-center text-gray-400">
                <Target size={48} className="mx-auto text-gray-200 mb-4" />
                <h3 className="text-lg font-semibold text-gray-500">No targets assigned yet</h3>
                <p className="mt-1">When a target is allocated to you, it will appear here.</p>
              </div>
            );
          }
          
          return displayedTargets.map(t => {
          const pct = Math.min(100, ((t.revenueAchieved / t.revenueTarget) * 100));
          const isWinner = pct >= 100;
          const employee = t.employee || { firstName: '?', lastName: '' };
          
          return (
            <div key={t.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 relative overflow-hidden">
              {isWinner && <div className="absolute top-0 right-0 p-2 bg-yellow-100 text-yellow-600 rounded-bl-xl"><Trophy size={20} /></div>}
              {t.isRecurring && <div className="absolute bottom-0 right-0 p-1.5 bg-blue-50 text-blue-500 text-[10px] font-bold px-3 rounded-tl-xl border-t border-l border-blue-100 uppercase tracking-tighter">Recurring</div>}
              {(user?.role === 'ADMIN' || t.createdById === user?.id) && (
                <button onClick={() => handleEdit(t)} className="absolute top-2 right-12 p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors z-10" title="Edit Target">
                  <Edit2 size={16} />
                </button>
              )}
              
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                  {employee.firstName[0]}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900">{employee.firstName} {employee.lastName}</h3>
                  <p className="text-sm text-gray-500 font-medium">{getLabel(t)} Target</p>
                  {t.parentTarget && (
                    <p className="text-xs text-indigo-500 mt-0.5">Allocated by: {t.parentTarget.employee?.firstName} {t.parentTarget.employee?.lastName}</p>
                  )}
                </div>
                {(user?.role === 'ADMIN' || t.employeeId === user?.id) && employees.length > 0 && !t.parentTargetId && (
                  <button onClick={() => openAllocateModal(t)} className="px-3 py-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-md font-semibold transition-colors border border-indigo-100">
                    Allocate
                  </button>
                )}
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

              {t.subTargets && t.subTargets.length > 0 && (
                <div className="mt-4 pt-3 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 mb-2">Allocations</p>
                  <div className="space-y-1.5">
                    {t.subTargets.map(sub => (
                      <div key={sub.id} className="flex justify-between text-xs items-center bg-gray-50 px-2 py-1.5 rounded">
                        <span>{sub.employee?.firstName} {sub.employee?.lastName}</span>
                        <span className="font-mono font-medium">₹{Number(sub.revenueTarget).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs items-center px-2 py-1 mt-1 text-gray-400 border-t border-gray-100">
                      <span>Unallocated Amount</span>
                      <span className="font-mono">₹{(Number(t.revenueTarget) - t.subTargets.reduce((sum, sub) => sum + Number(sub.revenueTarget), 0)).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        }); })()}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between">
              <h2 className="font-bold text-lg">{isEditing ? 'Edit Sales Target' : 'Set Sales Target'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
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

              <button disabled={isLoading} type="submit" className="w-full py-2 bg-green-600 text-white font-semibold rounded-lg mt-4 disabled:opacity-50">
                {isEditing ? 'Update Target' : 'Save Target'}
              </button>
            </form>
          </div>
        </div>
      )}

      {allocateModal.show && allocateModal.parentTarget && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="font-bold text-lg">Allocate Target</h2>
              <button onClick={() => setAllocateModal({ show: false, parentTarget: null })} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            
            <div className="px-6 py-3 bg-blue-50 border-b border-blue-100">
              <p className="text-xs text-blue-600 font-medium mb-1">Your Total Target: ₹{Number(allocateModal.parentTarget.revenueTarget).toLocaleString('en-IN')}</p>
              <p className="text-sm font-bold text-blue-800">
                Unallocated Amount: ₹{
                  (Number(allocateModal.parentTarget.revenueTarget) - 
                  (allocateModal.parentTarget.subTargets?.reduce((sum, sub) => sum + Number(sub.revenueTarget), 0) || 0)).toLocaleString('en-IN')
                }
              </p>
            </div>

            <form onSubmit={handleAllocateSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Subordinate</label>
                <select required value={allocateData.employeeId} onChange={e=>setAllocateData({...allocateData,employeeId:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm">
                  <option value="">Select Subordinate</option>
                  {employees.filter(emp => emp.id !== allocateModal.parentTarget.employeeId).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1">Revenue Target (₹)</label>
                <input type="number" required max={Number(allocateModal.parentTarget.revenueTarget) - (allocateModal.parentTarget.subTargets?.reduce((sum, sub) => sum + Number(sub.revenueTarget), 0) || 0)} value={allocateData.revenueTarget} onChange={e=>setAllocateData({...allocateData,revenueTarget:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" placeholder="Amount to allocate" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">Leads Goal</label>
                  <input type="number" required value={allocateData.leadsTarget} onChange={e=>setAllocateData({...allocateData,leadsTarget:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Quotes Goal</label>
                  <input type="number" required value={allocateData.quotationsTarget} onChange={e=>setAllocateData({...allocateData,quotationsTarget:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
              </div>

              <button disabled={isLoading} type="submit" className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg mt-4 disabled:opacity-50">
                Confirm Allocation
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
