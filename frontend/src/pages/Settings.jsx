import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useSettingStore } from '../stores/settingStore';
import { useUserStore } from '../stores/userStore';
import { Settings as SettingsIcon, User, Shield, Building2, KeyRound, Activity } from 'lucide-react';
import AuditLogsTab from '../components/AuditLogsTab';

export default function Settings() {
  const { user } = useAuthStore();
  const { settings, fetchSettings, updateSetting } = useSettingStore();
  const { updateUser } = useUserStore();

  const [activeTab, setActiveTab] = useState('profile');
  
  // Profile state
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '' });

  // Company state
  const [companyForm, setCompanyForm] = useState({ 
    COMPANY_NAME: '', COMPANY_ADDRESS: '', COMPANY_GST: '' 
  });

  useEffect(() => {
    if (user) {
      setProfileForm({ firstName: user.firstName, lastName: user.lastName, phone: user.phone || '' });
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'ADMIN' && activeTab === 'company') {
      fetchSettings();
    }
  }, [user, activeTab]);

  useEffect(() => {
    if (settings.length > 0) {
      const getVal = (k) => settings.find(s => s.key === k)?.value || '';
      setCompanyForm({
        COMPANY_NAME: getVal('COMPANY_NAME'),
        COMPANY_ADDRESS: getVal('COMPANY_ADDRESS'),
        COMPANY_GST: getVal('COMPANY_GST')
      });
    }
  }, [settings]);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    await updateUser(user.id, profileForm);
    alert('Profile updated successfully!');
  };

  const handlePasswordUpdate = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword.length < 6) return alert('Password too short');
    await updateUser(user.id, { password: passwordForm.newPassword });
    setPasswordForm({ newPassword: '' });
    alert('Password updated!');
  };

  const handleCompanyUpdate = async (e) => {
    e.preventDefault();
    for (const [key, value] of Object.entries(companyForm)) {
      await updateSetting(key, { value, description: 'Global ' + key.replace('_', ' ') });
    }
    alert('Company settings globally saved.');
  };

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage your personal profile and system preferences</p>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar Nav */}
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="bg-white border border-gray-100 rounded-xl overflow-hidden">
            <button onClick={() => setActiveTab('profile')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium border-l-4 transition-colors ${activeTab === 'profile' ? 'bg-green-50 border-green-500 text-green-700' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
              <User size={18} /> Personal Profile
            </button>
            <button onClick={() => setActiveTab('security')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium border-l-4 transition-colors ${activeTab === 'security' ? 'bg-green-50 border-green-500 text-green-700' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
              <KeyRound size={18} /> Security
            </button>
            
            {user?.role === 'ADMIN' && (
              <>
                <div className="h-px bg-gray-100 my-1"></div>
                <div className="px-4 py-2 text-xs font-bold text-gray-400 uppercase tracking-wider">Admin Controls</div>
                <button onClick={() => setActiveTab('company')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium border-l-4 transition-colors ${activeTab === 'company' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
                  <Building2 size={18} /> Company Details
                </button>
                <button onClick={() => setActiveTab('system')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium border-l-4 transition-colors ${activeTab === 'system' ? 'bg-purple-50 border-purple-500 text-purple-700' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
                  <SettingsIcon size={18} /> System Config
                </button>
                <button onClick={() => setActiveTab('audit')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium border-l-4 transition-colors ${activeTab === 'audit' ? 'bg-slate-800 border-slate-600 text-white' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
                  <Activity size={18} /> Audit Logs
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1">
          {activeTab === 'profile' && (
            <div className="bg-white border border-gray-100 rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><User size={20} className="text-gray-400"/> Your Profile</h2>
              <form onSubmit={handleProfileUpdate} className="space-y-4 max-w-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold block mb-1">First Name</label>
                    <input required value={profileForm.firstName} onChange={e=>setProfileForm({...profileForm, firstName:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1">Last Name</label>
                    <input required value={profileForm.lastName} onChange={e=>setProfileForm({...profileForm, lastName:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Email <span className="text-gray-400 font-normal">(Cannot be changed)</span></label>
                  <input readOnly value={user?.email} className="w-full px-3 py-2 border rounded-lg text-sm bg-gray-50 text-gray-500" />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Phone Number</label>
                  <input value={profileForm.phone} onChange={e=>setProfileForm({...profileForm, phone:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm" />
                </div>
                <button type="submit" className="px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white font-medium text-sm rounded-lg transition-colors">Update Profile</button>
              </form>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="bg-white border border-gray-100 rounded-xl p-6">
              <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><Shield size={20} className="text-gray-400"/> Change Password</h2>
              <form onSubmit={handlePasswordUpdate} className="space-y-4 max-w-md">
                <div>
                  <label className="text-xs font-semibold block mb-1">New Password</label>
                  <input required type="password" minLength={6} value={passwordForm.newPassword} onChange={e=>setPasswordForm({newPassword:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-red-500" />
                </div>
                <button type="submit" className="px-5 py-2 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 font-bold text-sm rounded-lg transition-colors">Confirm Password Reset</button>
              </form>
            </div>
          )}

          {activeTab === 'company' && user?.role === 'ADMIN' && (
            <div className="bg-white border border-gray-100 rounded-xl p-6 border-t-4 border-t-purple-500">
              <h2 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><Building2 size={20} className="text-purple-500"/> Company Identity</h2>
              <form onSubmit={handleCompanyUpdate} className="space-y-4 max-w-lg">
                <div>
                  <label className="text-xs font-semibold block mb-1">Company Legal Name</label>
                  <input value={companyForm.COMPANY_NAME} onChange={e=>setCompanyForm({...companyForm, COMPANY_NAME:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-purple-500" placeholder="KVB Green Energies" />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">Company Address</label>
                  <textarea rows={3} value={companyForm.COMPANY_ADDRESS} onChange={e=>setCompanyForm({...companyForm, COMPANY_ADDRESS:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-purple-500 resize-none" placeholder="HQ Address..." />
                </div>
                <div>
                  <label className="text-xs font-semibold block mb-1">GSTIN Number</label>
                  <input value={companyForm.COMPANY_GST} onChange={e=>setCompanyForm({...companyForm, COMPANY_GST:e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm focus:border-purple-500 font-mono" placeholder="22AAAAA0000A1Z5" />
                </div>
                <button type="submit" className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium text-sm rounded-lg transition-colors shadow">Save Global Settings</button>
              </form>
            </div>
          )}

          {activeTab === 'system' && user?.role === 'ADMIN' && (
            <div className="bg-white border border-gray-100 rounded-xl p-6 text-center py-12">
              <SettingsIcon size={48} className="mx-auto text-gray-300 mb-4 animate-[spin_10s_linear_infinite]" />
              <h3 className="text-lg font-bold text-gray-700">System Config Active</h3>
              <p className="text-gray-500 mt-2 text-sm max-w-sm mx-auto">Database (MySQL) and background Cron workers are stable. Advanced config is securely handled in the `.env` file.</p>
            </div>
          )}

          {activeTab === 'audit' && user?.role === 'ADMIN' && (
            <AuditLogsTab />
          )}

        </div>
      </div>
    </Layout>
  );
}
