import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useUserStore } from '../stores/userStore';
import { useAuthStore } from '../stores/authStore';
import {
  Users, ShieldAlert, Edit, Ban, CheckCircle, Plus, X, Shield,
  GitBranch, Clock, History, Crown, Trash2, Search
} from 'lucide-react';

// All toggleable modules (Dashboard always ON, Settings/UserMgmt admin-only)
const ALL_MODULES = [
  { key: 'LEADS', label: 'Leads' },
  { key: 'QUOTATIONS', label: 'Quotations' },
  { key: 'SALES', label: 'Sales' },
  { key: 'PRODUCTS', label: 'Products' },
  { key: 'PURCHASE', label: 'Purchase' },
  { key: 'INVENTORY', label: 'Inventory' },
  { key: 'TASKS', label: 'Tasks' },
  { key: 'DAILY_REPORTS', label: 'Daily Reports' },
  { key: 'SALES_TARGETS', label: 'Sales Targets' },
  { key: 'TODO', label: 'My To-Do List' },
  { key: 'EMPLOYEE_TRACKING', label: 'Employee Tracking' },
  { key: 'MATERIAL_REQUESTS', label: 'Material Requests' },
];


const DEFAULT_PERMISSIONS = {
  modules: {
    LEADS: false, QUOTATIONS: false, SALES: false, PRODUCTS: false,
    PURCHASE: false, INVENTORY: false, TASKS: false, DAILY_REPORTS: false,
    SALES_TARGETS: false, TODO: false, EMPLOYEE_TRACKING: false, MATERIAL_REQUESTS: false,
  },
  canAssignTasks: false,
  canAssignLeads: false,
  canViewSubordinates: false,
  canCreateMaterialRequests: false,
};


const Toggle = ({ checked, onChange, label, disabled }) => (
  <label className={`flex items-center justify-between gap-3 py-2.5 px-3 rounded-lg hover:bg-gray-50 transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
    <span className="text-sm text-gray-700">{label}</span>
    <div
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-green-500' : 'bg-gray-300'} ${disabled ? '' : 'cursor-pointer'}`}
    >
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </div>
  </label>
);

const PermBadge = ({ label, color = 'blue' }) => {
  const colors = {
    blue: 'bg-blue-100 text-blue-700',
    green: 'bg-green-100 text-green-700',
    purple: 'bg-purple-100 text-purple-700',
    orange: 'bg-orange-100 text-orange-700',
    teal: 'bg-teal-100 text-teal-700',
  };
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold ${colors[color]}`}>{label}</span>;
};


export default function UserManagement() {
  const { user } = useAuthStore();
  const { users, isLoading, fetchUsers, createUser, updateUser, deleteUser, transferSubordinates, fetchPermissionAuditLogs } = useUserStore();

  // Handover modal state — shown when suspending a manager with active subordinates
  const [handoverModal, setHandoverModal] = useState(null); // { user, subordinateCount }
  const [handoverNewManagerId, setHandoverNewManagerId] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [modalTab, setModalTab] = useState('basic'); // basic | hierarchy | modules | elevated
  const [auditLogs, setAuditLogs] = useState([]);
  const [showAudit, setShowAudit] = useState(null);
  const [filterModule, setFilterModule] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [lastSavedPerms, setLastSavedPerms] = useState(null); // confirmed live permissions after save

  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '', password: '', role: 'EMPLOYEE'
  });
  const [managerId, setManagerId] = useState('');
  const [delegatedManagerId, setDelegatedManagerId] = useState('');
  const [delegationExpiresAt, setDelegationExpiresAt] = useState('');
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);

  useEffect(() => { 
    const delayDebounceFn = setTimeout(() => {
      fetchUsers({ search: searchTerm });
    }, 300);
    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm, fetchUsers]);

  if (user?.role !== 'ADMIN') {
    return (
      <Layout>
        <div className="p-12 text-center text-gray-500">
          <ShieldAlert size={48} className="mx-auto mb-4 opacity-50" />
          <h2 className="text-xl font-bold">Access Denied</h2>
          <p>You do not have permission to view User Management.</p>
        </div>
      </Layout>
    );
  }

  const handleOpenModal = (u = null) => {
    setModalTab('basic');
    setLastSavedPerms(null);
    if (u) {
      setEditingUser(u);
      setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone || '', role: u.role, password: '' });
      setManagerId(u.managerId || '');
      setDelegatedManagerId(u.delegatedManagerId || '');
      setDelegationExpiresAt(u.delegationExpiresAt ? u.delegationExpiresAt.slice(0, 16) : '');
      const savedPerms = u.permissions ? (typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions) : DEFAULT_PERMISSIONS;
      setPermissions({ ...DEFAULT_PERMISSIONS, ...savedPerms, modules: { ...DEFAULT_PERMISSIONS.modules, ...(savedPerms.modules || {}) } });
    } else {
      setEditingUser(null);
      setForm({ firstName: '', lastName: '', email: '', phone: '', role: 'EMPLOYEE', password: '' });
      setManagerId('');
      setDelegatedManagerId('');
      setDelegationExpiresAt('');
      setPermissions(DEFAULT_PERMISSIONS);
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const payload = {
      ...form,
      managerId: managerId || null,
      delegatedManagerId: delegatedManagerId || null,
      delegationExpiresAt: delegationExpiresAt || null,
      permissions: form.role === 'ADMIN' ? null : permissions,
    };
    if (!payload.password) delete payload.password;

    let result;
    if (editingUser) {
      result = await updateUser(editingUser.id, payload);
    } else {
      result = await createUser(payload);
    }

    // After save: store confirmed permissions so admin can verify what is now live
    if (result?.success && payload.permissions) {
      setLastSavedPerms(payload.permissions);
      // Stay on modal so admin can review; switch to elevated tab if permissions were set
      setModalTab('elevated');
    } else {
      setShowModal(false);
    }
  };

  const toggleStatus = async (u) => {
    const nextStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (!confirm(`Are you sure you want to ${nextStatus.toLowerCase()} ${u.firstName}?`)) return;

    const result = await updateUser(u.id, { status: nextStatus });

    // If backend says this manager has active subordinates, show the handover modal
    if (!result.success && result.code === 'MANAGER_HAS_SUBORDINATES') {
      setHandoverModal({ user: u, subordinateCount: result.subordinateCount });
      setHandoverNewManagerId('');
    }
  };

  const handleHandoverConfirm = async () => {
    if (!handoverModal) return;
    const result = await transferSubordinates(handoverModal.user.id, handoverNewManagerId || null);
    if (result.success) {
      setHandoverModal(null);
    } else {
      alert(result.error || 'Transfer failed. Please try again.');
    }
  };

  const handleDeleteUser = async (u) => {
    if (u.isSuperAdmin) return;
    if (!confirm(`CRITICAL: Are you sure you want to PERMANENTLY DELETE ${u.firstName} ${u.lastName}? This action cannot be undone.`)) return;
    
    const res = await deleteUser(u.id);
    if (!res.success) {
      alert(res.error || 'Failed to delete user');
    }
  };

  const handleShowAudit = async (userId) => {
    if (showAudit === userId) { setShowAudit(null); return; }
    const logs = await fetchPermissionAuditLogs(userId);
    setAuditLogs(logs);
    setShowAudit(userId);
  };

  const setModule = (key, val) => setPermissions(p => ({ ...p, modules: { ...p.modules, [key]: val } }));
  const setElevated = (key, val) => setPermissions(p => ({ ...p, [key]: val }));

  const getActiveModules = (u) => {
    if (u.role === 'ADMIN') return null;
    const perms = u.permissions ? (typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions) : null;
    if (!perms) return [];
    return Object.entries(perms.modules || {}).filter(([, v]) => v).map(([k]) => k);
  };

  const filteredUsers = filterModule
    ? users.filter(u => {
        if (u.role === 'ADMIN') return false;
        const mods = getActiveModules(u) || [];
        return mods.includes(filterModule);
      })
    : users;

  const MODAL_TABS = [
    { id: 'basic', label: 'Basic Details', icon: '👤' },
    { id: 'hierarchy', label: 'Hierarchy', icon: '🌿' },
    { id: 'modules', label: 'Module Access', icon: '🔲', hidden: form.role === 'ADMIN' },
    { id: 'elevated', label: 'Elevated Perms', icon: '⚡', hidden: form.role === 'ADMIN' },
  ].filter(t => !t.hidden);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage employees, hierarchy, roles and module access</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text"
              placeholder="Search by name or email..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-green-500/20 focus:border-green-500 w-64 transition-all"
            />
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow"
          >
            <Plus size={18} /> Add Employee
          </button>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs font-semibold text-gray-500 uppercase">Filter by module:</span>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setFilterModule('')}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${!filterModule ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >All</button>
          {ALL_MODULES.map(m => (
            <button
              key={m.key}
              onClick={() => setFilterModule(filterModule === m.key ? '' : m.key)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${filterModule === m.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
            >{m.label}</button>
          ))}
        </div>
      </div>

      {/* User Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-5 py-4">Employee</th>
              <th className="px-5 py-4">Reports To</th>
              <th className="px-5 py-4">Modules & Permissions</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredUsers.map(u => {
              const activeMods = getActiveModules(u);
              const perms = u.permissions ? (typeof u.permissions === 'string' ? JSON.parse(u.permissions) : u.permissions) : null;
              const manager = users.find(m => m.id === u.managerId);
              return (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-sm ${u.isSuperAdmin ? 'bg-yellow-100 text-yellow-700' : u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                        {u.isSuperAdmin ? <Crown size={16} /> : u.firstName[0]}
                      </div>
                      <div>
                        <div className="font-bold text-gray-900 flex items-center gap-1.5">
                          {u.firstName} {u.lastName}
                          {u.isSuperAdmin && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-yellow-100 text-yellow-700 text-[9px] font-bold rounded border border-yellow-200">
                              <Crown size={9} /> SUPER ADMIN
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500">{u.email}</div>
                        <span className={`mt-0.5 inline-block px-1.5 py-0.5 text-[9px] uppercase font-bold rounded ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>{u.role}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-sm text-gray-600">
                    {manager ? (
                      <span className="flex items-center gap-1.5">
                        <GitBranch size={12} className="text-gray-400" />
                        {manager.firstName} {manager.lastName}
                      </span>
                    ) : <span className="text-gray-300 text-xs">— No manager</span>}
                  </td>
                  <td className="px-5 py-4">
                    {u.role === 'ADMIN' ? (
                      <span className="text-purple-600 text-xs font-bold flex items-center gap-1"><Shield size={12}/> Full Admin Access</span>
                    ) : activeMods === null || !perms ? (
                      <span className="text-gray-300 text-xs">No permissions set</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {activeMods.slice(0, 4).map(k => <PermBadge key={k} label={k.replace('_', ' ')} color="blue" />)}
                        {activeMods.length > 4 && <PermBadge label={`+${activeMods.length - 4}`} color="blue" />}
                        {perms.canAssignTasks && <PermBadge label="Assign Tasks" color="orange" />}
                        {perms.canAssignLeads && <PermBadge label="Assign Leads" color="green" />}
                        {perms.canViewSubordinates && <PermBadge label="Team View" color="purple" />}
                        {perms.canCreateMaterialRequests && <PermBadge label="Material Requests" color="teal" />}

                      </div>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span className={`flex items-center gap-1 text-xs font-semibold w-max ${u.status === 'ACTIVE' ? 'text-green-700' : 'text-red-600'}`}>
                      {u.status === 'ACTIVE' ? <CheckCircle size={13}/> : <Ban size={13}/>} {u.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      {u.isSuperAdmin ? (
                        // Super Admin: show audit log only — no edit or suspend
                        <>
                          <span className="text-[10px] text-yellow-600 font-semibold flex items-center gap-1 mr-1"><Crown size={11}/> Protected</span>
                          <button onClick={() => handleShowAudit(u.id)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded" title="Audit Log">
                            <History size={15} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => handleOpenModal(u)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded" title="Edit Permissions">
                            <Edit size={15} />
                          </button>
                          <button onClick={() => handleShowAudit(u.id)} className="p-1.5 text-gray-400 hover:text-indigo-600 rounded" title="Audit Log">
                            <History size={15} />
                          </button>
                          {u.id !== user.id && (
                            <>
                              <button onClick={() => toggleStatus(u)} className={`p-1.5 rounded ${u.status === 'ACTIVE' ? 'text-gray-400 hover:text-red-600' : 'text-red-400 hover:text-green-600'}`} title={u.status === 'ACTIVE' ? 'Suspend' : 'Restore'}>
                                {u.status === 'ACTIVE' ? <Ban size={15}/> : <CheckCircle size={15}/>}
                              </button>
                              <button onClick={() => handleDeleteUser(u)} className="p-1.5 text-gray-400 hover:text-red-600 rounded" title="Permanently Delete">
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Audit Log Inline Panel */}
      {showAudit && (
        <div className="mt-4 bg-white rounded-xl border border-indigo-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 flex items-center gap-2"><History size={16} className="text-indigo-500" /> Permission Audit Log — {users.find(u => u.id === showAudit)?.firstName}</h3>
            <button onClick={() => setShowAudit(null)} className="text-gray-400 hover:text-black"><X size={16}/></button>
          </div>
          {auditLogs.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">No permission changes recorded yet.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {auditLogs.map(log => (
                <div key={log.id} className="border border-gray-100 rounded-lg p-3 bg-gray-50">
                  <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                    <span className="font-semibold text-gray-700">Changed by: {log.changedBy?.firstName} {log.changedBy?.lastName}</span>
                    <span className="flex items-center gap-1"><Clock size={11}/> {new Date(log.timestamp).toLocaleString('en-IN')}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-red-50 border border-red-100 rounded p-2">
                      <div className="font-bold text-red-600 mb-1">Before</div>
                      <pre className="text-gray-600 whitespace-pre-wrap text-[10px]">{JSON.stringify(log.previousState, null, 2)}</pre>
                    </div>
                    <div className="bg-green-50 border border-green-100 rounded p-2">
                      <div className="font-bold text-green-600 mb-1">After</div>
                      <pre className="text-gray-600 whitespace-pre-wrap text-[10px]">{JSON.stringify(log.newState, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <h2 className="font-bold text-lg">{editingUser ? `Edit — ${editingUser.firstName}` : 'New Employee'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-black"><X size={18}/></button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 flex-shrink-0 bg-white overflow-x-auto">
              {MODAL_TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => setModalTab(t.id)}
                  className={`px-4 py-3 text-xs font-semibold whitespace-nowrap transition-colors ${modalTab === t.id ? 'border-b-2 border-green-500 text-green-700 bg-green-50' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleSave} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">

                {/* Tab: Basic Details */}
                {modalTab === 'basic' && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold block mb-1">First Name</label>
                        <input required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-green-500" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold block mb-1">Last Name</label>
                        <input required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-green-500" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1">Email <span className="text-gray-400 font-normal">(Login ID)</span></label>
                      <input type="email" required disabled={!!editingUser} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-green-500 disabled:bg-gray-50" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1">Phone</label>
                      <input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-green-500" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1">System Role</label>
                      <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-green-500">
                        <option value="EMPLOYEE">Employee</option>
                        <option value="ADMIN">System Admin (Full Access)</option>
                      </select>
                      {form.role === 'ADMIN' && <p className="text-[10px] text-purple-600 mt-1">⚠️ Admin users bypass all module restrictions and have full system access.</p>}
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1">
                        Password {editingUser && <span className="text-gray-400 font-normal text-[10px]">(Leave blank to keep current)</span>}
                      </label>
                      <input required={!editingUser} type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-green-500" minLength={6} />
                    </div>
                  </>
                )}

                {/* Tab: Hierarchy */}
                {modalTab === 'hierarchy' && (
                  <>
                    <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 mb-2">
                      <p className="font-semibold mb-1">🌿 Reporting Hierarchy</p>
                      <p>Setting a manager defines who this employee reports to. Managers with elevated permissions will have cascading visibility over all their direct and deep subordinates.</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold block mb-1">Reports To (Manager)</label>
                      <select value={managerId} onChange={e => setManagerId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-green-500">
                        <option value="">— No Manager (Top Level)</option>
                        {users.filter(u => u.id !== editingUser?.id).map(u => (
                          <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                    <div className="border-t border-gray-100 pt-4 mt-2">
                      <p className="text-xs font-bold text-gray-700 mb-1 flex items-center gap-2">
                        <Clock size={13} className="text-orange-500"/> Temporary Delegated Authority
                      </p>
                      <p className="text-[11px] text-gray-500 mb-3">Temporarily grant this employee the reporting access of another manager (e.g., during leave).</p>
                      <div>
                        <label className="text-xs font-semibold block mb-1">Acting As Manager Of</label>
                        <select value={delegatedManagerId} onChange={e => setDelegatedManagerId(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-orange-400">
                          <option value="">— No Delegation</option>
                          {users.filter(u => u.id !== editingUser?.id).map(u => (
                            <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                          ))}
                        </select>
                      </div>
                      {delegatedManagerId && (
                        <div className="mt-3">
                          <label className="text-xs font-semibold block mb-1">Delegation Expires At</label>
                          <input type="datetime-local" value={delegationExpiresAt} onChange={e => setDelegationExpiresAt(e.target.value)} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-orange-400" />
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Tab: Module Access */}
                {modalTab === 'modules' && (
                  <>
                    <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-xs text-green-700 mb-2">
                      Modules toggled OFF will be completely hidden from this user's navigation and interface.
                    </div>
                    <div className="divide-y divide-gray-50">
                      <Toggle label="🏠 Dashboard" checked={true} onChange={() => {}} disabled={true} />
                      {ALL_MODULES.map(m => (
                        <Toggle
                          key={m.key}
                          label={m.label}
                          checked={permissions.modules[m.key] || false}
                          onChange={v => setModule(m.key, v)}
                        />
                      ))}
                      <Toggle label="⚙️ Settings (Admin Only)" checked={false} onChange={() => {}} disabled={true} />
                      <Toggle label="👥 User Management (Admin Only)" checked={false} onChange={() => {}} disabled={true} />
                    </div>
                  </>
                )}

                {/* Tab: Elevated Permissions */}
                {modalTab === 'elevated' && (
                  <>
                    <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 text-xs text-orange-700 mb-2">
                      These permissions grant managerial capabilities to non-admin users. They only work if a reporting hierarchy is configured.
                    </div>
                    <div className="divide-y divide-gray-50">
                      <div className="py-3">
                        <Toggle
                          label="⚡ Task Assignment — Can assign tasks to subordinates"
                          checked={permissions.canAssignTasks}
                          onChange={v => setElevated('canAssignTasks', v)}
                        />
                      </div>
                      <div className="py-3">
                        <Toggle
                          label="🎯 Lead Assignment — Can assign leads to subordinates"
                          checked={permissions.canAssignLeads}
                          onChange={v => setElevated('canAssignLeads', v)}
                        />
                      </div>
                      <div className="py-3">
                        <Toggle
                          label="👁️ Team View — Can view subordinate activity in Employee Tracking"
                          checked={permissions.canViewSubordinates}
                          onChange={v => setElevated('canViewSubordinates', v)}
                        />
                      </div>
                      <div className="py-3">
                        <Toggle
                          label="📦 Material Requests — Can create and assign material request orders"
                          checked={permissions.canCreateMaterialRequests || false}
                          onChange={v => setElevated('canCreateMaterialRequests', v)}
                        />
                        <p className="text-xs text-gray-400 ml-3 -mt-1 mb-1">Without this, they can only view and action requests assigned to them.</p>
                      </div>

                    </div>
                  </>
                )}
              </div>

              <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex-shrink-0 space-y-3">
                {/* Live confirmation: what was just saved */}
                {lastSavedPerms && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-xs text-green-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-green-700 flex items-center gap-1">✅ Permissions saved & now live</span>
                      <button type="button" onClick={() => { setLastSavedPerms(null); setShowModal(false); }} className="text-green-500 hover:text-green-700">
                        <X size={13} />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(lastSavedPerms.modules || {}).filter(([,v]) => v).map(([k]) => (
                        <span key={k} className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-semibold text-[10px]">{k.replace('_',' ')}</span>
                      ))}
                      {lastSavedPerms.canAssignLeads && <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-semibold text-[10px]">Assign Leads ✓</span>}
                      {lastSavedPerms.canAssignTasks && <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded font-semibold text-[10px]">Assign Tasks ✓</span>}
                      {lastSavedPerms.canViewSubordinates && <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-semibold text-[10px]">Team View ✓</span>}
                      {lastSavedPerms.canCreateMaterialRequests && <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded font-semibold text-[10px]">Material Requests ✓</span>}

                      {Object.entries(lastSavedPerms.modules || {}).filter(([,v]) => v).length === 0 && !lastSavedPerms.canAssignLeads && !lastSavedPerms.canAssignTasks && !lastSavedPerms.canViewSubordinates && (
                        <span className="text-gray-500 italic">No permissions granted</span>
                      )}
                    </div>
                    <p className="mt-2 text-[10px] text-green-600">The employee's session has been notified. Their interface will reflect these changes immediately.</p>
                  </div>
                )}
                <button disabled={isLoading} type="submit" className="w-full py-2.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors">
                  {isLoading ? 'Saving...' : `Save ${editingUser ? 'Changes' : 'Employee'}`}
                </button>
                {lastSavedPerms && (
                  <button type="button" onClick={() => { setLastSavedPerms(null); setShowModal(false); }} className="w-full py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-100 transition-colors">
                    Done — Close
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Manager Suspension Handover Modal ──────────────────────────────── */}
      {handoverModal && (
        <div className="fixed inset-0 bg-black bg-opacity-60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                  <GitBranch size={20} className="text-amber-600" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Manager Handover Required</h2>
                  <p className="text-sm text-gray-500 mt-0.5">
                    <strong>{handoverModal.user.firstName} {handoverModal.user.lastName}</strong> currently manages{' '}
                    <strong>{handoverModal.subordinateCount}</strong> active employee(s). Please reassign them before suspending.
                  </p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  Assign subordinates to
                </label>
                <select
                  value={handoverNewManagerId}
                  onChange={e => setHandoverNewManagerId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
                >
                  <option value="">— Unassigned Pool (no new manager) —</option>
                  {users
                    .filter(u => u.status === 'ACTIVE' && u.id !== handoverModal.user.id)
                    .sort((a, b) => a.firstName.localeCompare(b.firstName))
                    .map(u => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                    ))
                  }
                </select>
                {!handoverNewManagerId && (
                  <p className="text-xs text-amber-600 mt-1.5">
                    ⚠️ Leaving this blank will move all subordinates to the Unassigned Pool — they will be visible only to Admins.
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setHandoverModal(null)}
                  className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleHandoverConfirm}
                  disabled={isLoading}
                  className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Transferring...' : 'Confirm & Suspend'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
