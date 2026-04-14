import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useUserStore } from '../stores/userStore';
import { useAuthStore } from '../stores/authStore';
import { Users, ShieldAlert, Edit, Ban, CheckCircle, Plus } from 'lucide-react';

export default function UserManagement() {
  const { user } = useAuthStore();
  const { users, isLoading, fetchUsers, createUser, updateUser } = useUserStore();

  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    role: 'EMPLOYEE'
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  // Make sure only admins can render this effectively, others will be blocked by API anyway
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
    if (u) {
      setEditingUser(u);
      setForm({ firstName: u.firstName, lastName: u.lastName, email: u.email, phone: u.phone || '', role: u.role, password: '' });
    } else {
      setEditingUser(null);
      setForm({ firstName: '', lastName: '', email: '', phone: '', role: 'EMPLOYEE', password: '' });
    }
    setShowModal(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (editingUser) {
      // Don't send empty password if not changing
      const data = { ...form };
      if (!data.password) delete data.password;
      await updateUser(editingUser.id, data);
    } else {
      await createUser(form);
    }
    setShowModal(false);
  };

  const toggleStatus = async (u) => {
    const nextStatus = u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    if (confirm(`Are you sure you want to ${nextStatus.toLowerCase()} ${u.firstName}?`)) {
      await updateUser(u.id, { status: nextStatus });
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage employees, roles and access status</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow"
        >
          <Plus size={18} /> Add Employee
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
            <tr>
              <th className="px-5 py-4">Employee</th>
              <th className="px-5 py-4">Role</th>
              <th className="px-5 py-4">Status</th>
              <th className="px-5 py-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                      {u.firstName[0]}
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">{u.firstName} {u.lastName}</div>
                      <div className="text-xs text-gray-500">{u.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 text-[10px] uppercase font-bold rounded ${u.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-5 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded flex items-center gap-1 w-max ${u.status === 'ACTIVE' ? 'text-green-700' : 'text-red-600'}`}>
                    {u.status === 'ACTIVE' ? <CheckCircle size={14}/> : <Ban size={14}/>} {u.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-center">
                  <button onClick={() => handleOpenModal(u)} className="p-1.5 text-gray-400 hover:text-blue-600 mr-2" title="Edit">
                    <Edit size={16} />
                  </button>
                  {u.id !== user.id && (
                    <button onClick={() => toggleStatus(u)} className={`p-1.5 ${u.status === 'ACTIVE' ? 'text-gray-400 hover:text-red-600' : 'text-red-500 hover:text-green-600'}`} title={u.status === 'ACTIVE' ? 'Suspend Access' : 'Restore Access'}>
                      {u.status === 'ACTIVE' ? <Ban size={16} /> : <CheckCircle size={16} />}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between bg-gray-50">
              <h2 className="font-bold text-lg">{editingUser ? 'Edit User' : 'New Employee'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-black">✕</button>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">First Name</label>
                  <input required value={form.firstName} onChange={e=>setForm({...form, firstName: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-green-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Last Name</label>
                  <input required value={form.lastName} onChange={e=>setForm({...form, lastName: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-green-500" />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Email <span className="text-gray-400 font-normal">(Login ID)</span></label>
                <input type="email" required disabled={!!editingUser} value={form.email} onChange={e=>setForm({...form, email: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-green-500 disabled:bg-gray-50" />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Phone</label>
                <input value={form.phone} onChange={e=>setForm({...form, phone: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-green-500" />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Role</label>
                <select value={form.role} onChange={e=>setForm({...form, role: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-green-500">
                  <option value="EMPLOYEE">Employee</option>
                  <option value="ADMIN">System Admin</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1">Password {editingUser && <span className="text-gray-400 font-normal text-[10px]">(Leave blank to keep current)</span>}</label>
                <input required={!editingUser} type="password" value={form.password} onChange={e=>setForm({...form, password: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-green-500" minLength={6} />
              </div>
              
              <button disabled={isLoading} type="submit" className="w-full py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg mt-4 disabled:opacity-50">
                {isLoading ? 'Saving...' : 'Save User'}
              </button>
            </form>
          </div>
        </div>
      )}
    </Layout>
  );
}
