import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { useAuthStore } from '../stores/authStore';
import { useSettingStore } from '../stores/settingStore';
import { useUserStore } from '../stores/userStore';
import { useQuotationStore } from '../stores/quotationStore';
import { Settings as SettingsIcon, User, Shield, Building2, KeyRound, Activity, Hash } from 'lucide-react';
import AuditLogsTab from '../components/AuditLogsTab';


export default function Settings() {
  const { user } = useAuthStore();
  const { settings, fetchSettings, updateSetting } = useSettingStore();
  const { updateUser } = useUserStore();
  const { counters, fetchCounters, updateCounter } = useQuotationStore();

  const [activeTab, setActiveTab] = useState('profile');
  const [counterEdits, setCounterEdits] = useState({});
  const [counterSaving, setCounterSaving] = useState(null);

  
  // Profile state
  const [profileForm, setProfileForm] = useState({ firstName: '', lastName: '', phone: '' });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '' });

  // Company state
  const [companyForm, setCompanyForm] = useState({ 
    COMPANY_NAME: '', COMPANY_ADDRESS: '', COMPANY_GST: '' 
  });

  // Format settings state
  const [formatForm, setFormatForm] = useState({
    QTN_COMPANY_CODE: 'KVB',
    QTN_DATE_FORMAT: 'DDMMYY',
    INV_PREFIX: 'INV',
    INV_DATE_FORMAT: 'FY_YY_YY',
    INV_CUSTOM_YEAR: '25-26',
    QTN_PRODUCT_CODES: '{}'
  });
  const [productCodes, setProductCodes] = useState({
    SOLAR_TUNNEL_DRYER: 'STD',
    SOLAR_PARABOLIC_TROUGH: 'PTC',
    SOLAR_PARABOLIC_COOKER: 'SPC',
    SCHEFFLER_DISH: 'SSD',
    STANDARD: 'STD'
  });

  useEffect(() => {
    if (user) {
      setProfileForm({ firstName: user.firstName, lastName: user.lastName, phone: user.phone || '' });
    }
  }, [user]);

  useEffect(() => {
    if (user?.role === 'ADMIN' && (activeTab === 'company' || activeTab === 'quotation' || activeTab === 'invoice')) {
      fetchSettings();
    }
    if (user?.role === 'ADMIN' && activeTab === 'quotation') fetchCounters();
  }, [user, activeTab]);


  useEffect(() => {
    if (settings.length > 0) {
      const getVal = (k, def) => settings.find(s => s.key === k)?.value || def;
      setCompanyForm({
        COMPANY_NAME: getVal('COMPANY_NAME', ''),
        COMPANY_ADDRESS: getVal('COMPANY_ADDRESS', ''),
        COMPANY_GST: getVal('COMPANY_GST', '')
      });
      setFormatForm({
        QTN_COMPANY_CODE: getVal('QTN_COMPANY_CODE', 'KVB'),
        QTN_DATE_FORMAT: getVal('QTN_DATE_FORMAT', 'DDMMYY'),
        INV_PREFIX: getVal('INV_PREFIX', 'INV'),
        INV_DATE_FORMAT: getVal('INV_DATE_FORMAT', 'FY_YY_YY'),
        INV_CUSTOM_YEAR: getVal('INV_CUSTOM_YEAR', '25-26'),
        QTN_PRODUCT_CODES: getVal('QTN_PRODUCT_CODES', '{}')
      });
      try {
        const pc = JSON.parse(getVal('QTN_PRODUCT_CODES', '{}'));
        if (Object.keys(pc).length > 0) {
          setProductCodes(prev => ({ ...prev, ...pc }));
        }
      } catch(e){}
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

  const handleFormatUpdate = async (e) => {
    e.preventDefault();
    const finalFormats = { ...formatForm, QTN_PRODUCT_CODES: JSON.stringify(productCodes) };
    for (const [key, value] of Object.entries(finalFormats)) {
      await updateSetting(key, { value, description: 'Format ' + key });
    }
    alert('Numbering formats saved successfully.');
  };

  const handleCounterSave = async (productCode) => {
    const val = parseInt(counterEdits[productCode]);
    if (isNaN(val) || val < 0) return alert('Please enter a valid non-negative integer.');
    setCounterSaving(productCode);
    const res = await updateCounter(productCode, val);
    setCounterSaving(null);
    if (res.success) {
      alert(`Counter for ${productCode} updated to ${val}.`);
    } else {
      alert(res.error || 'Failed to update counter');
    }
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
                <button onClick={() => setActiveTab('quotation')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium border-l-4 transition-colors ${activeTab === 'quotation' ? 'bg-violet-50 border-violet-500 text-violet-700' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
                  <Hash size={18} /> Quotation Settings
                </button>
                <button onClick={() => setActiveTab('invoice')} className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium border-l-4 transition-colors ${activeTab === 'invoice' ? 'bg-blue-50 border-blue-500 text-blue-700' : 'border-transparent text-gray-600 hover:bg-gray-50'}`}>
                  <Hash size={18} /> Invoice Settings
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

          {activeTab === 'quotation' && user?.role === 'ADMIN' && (
            <div className="bg-white border border-gray-100 rounded-xl p-6 border-t-4 border-t-violet-500">
              <div className="flex items-center gap-2 mb-6">
                <Hash size={20} className="text-violet-500" />
                <h2 className="text-lg font-bold text-gray-800">Quotation Format Settings</h2>
              </div>
              
              <form onSubmit={handleFormatUpdate} className="space-y-6 mb-8 border-b border-gray-100 pb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-semibold block mb-1 text-gray-700">Company Code Segment</label>
                    <input 
                      value={formatForm.QTN_COMPANY_CODE} 
                      onChange={e=>setFormatForm({...formatForm, QTN_COMPANY_CODE: e.target.value.toUpperCase()})} 
                      className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:border-violet-500" 
                      placeholder="KVB" 
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Appears after QTN. (e.g. QTN.<strong>KVB</strong>.STD...)</p>
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1 text-gray-700">Date Format</label>
                    <select 
                      value={formatForm.QTN_DATE_FORMAT} 
                      onChange={e=>setFormatForm({...formatForm, QTN_DATE_FORMAT: e.target.value})} 
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:border-violet-500 font-mono"
                    >
                      <option value="DDMMYY">DDMMYY (e.g. 010426)</option>
                      <option value="MMDDYY">MMDDYY (e.g. 040126)</option>
                      <option value="YYYYMMDD">YYYYMMDD (e.g. 20260401)</option>
                      <option value="NONE">None (Omit Date)</option>
                    </select>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <h3 className="text-sm font-bold text-gray-700 mb-3">Product Short Codes</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {Object.entries({
                      SOLAR_TUNNEL_DRYER: 'Solar Tunnel Dryer',
                      SOLAR_PARABOLIC_TROUGH: 'Solar Parabolic Trough',
                      SOLAR_PARABOLIC_COOKER: 'Solar Parabolic Cooker',
                      SCHEFFLER_DISH: 'Scheffler Dish'
                    }).map(([key, label]) => (
                      <div key={key}>
                        <label className="text-[11px] font-semibold block mb-1 text-gray-600">{label}</label>
                        <input 
                          value={productCodes[key]} 
                          onChange={e=>setProductCodes({...productCodes, [key]: e.target.value.toUpperCase()})} 
                          className="w-full px-3 py-1.5 border rounded-lg text-xs font-mono" 
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <button type="submit" className="px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white font-medium text-sm rounded-lg transition-colors shadow">Save Formats</button>
              </form>

              <h3 className="text-md font-bold text-gray-800 mb-4">Sequential Counters</h3>
              <p className="text-sm text-gray-500 mb-6">Manage counters for each product type. The next quotation created will use <strong>counter + 1</strong>.</p>

              <div className="space-y-4">
                {[{ key: 'SOLAR_TUNNEL_DRYER', label: 'Solar Tunnel Dryer', color: 'violet' },
                  { key: 'SOLAR_PARABOLIC_TROUGH', label: 'Solar Parabolic Trough', color: 'blue' },
                  { key: 'SOLAR_PARABOLIC_COOKER', label: 'Solar Parabolic Cooker', color: 'green' },
                  { key: 'SCHEFFLER_DISH', label: 'Scheffler Dish', color: 'orange' }].map(({ key, label, color }) => {
                  const code = productCodes[key] || '???';
                  const row = counters.find(c => c.productCode === code);
                  const editVal = counterEdits[code] !== undefined ? counterEdits[code] : (row?.counter ?? '');
                  
                  // Live Preview Date
                  const d = new Date();
                  const dStr = String(d.getDate()).padStart(2, '0');
                  const mStr = String(d.getMonth() + 1).padStart(2, '0');
                  const y2Str = String(d.getFullYear()).slice(-2);
                  const y4Str = String(d.getFullYear());
                  let datePart = '';
                  if (formatForm.QTN_DATE_FORMAT === 'DDMMYY') datePart = `.${dStr}${mStr}${y2Str}`;
                  else if (formatForm.QTN_DATE_FORMAT === 'MMDDYY') datePart = `.${mStr}${dStr}${y2Str}`;
                  else if (formatForm.QTN_DATE_FORMAT === 'YYYYMMDD') datePart = `.${y4Str}${mStr}${dStr}`;

                  return (
                    <div key={code} className={`border border-${color}-100 bg-${color}-50/30 rounded-xl p-4`}>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{label}</p>
                          <p className="text-xs text-gray-500">Product Code: <span className="font-mono font-bold text-gray-700">{code}</span></p>
                        </div>
                        <div className={`px-2 py-1 bg-${color}-100 text-${color}-700 rounded-lg font-mono font-bold text-lg`}>
                          {String(row?.counter ?? '—').padStart(3, '0')}
                        </div>
                      </div>
                      <p className="text-xs text-gray-400 mb-2">Live Preview: <span className="font-mono font-semibold text-gray-700">QTN.{formatForm.QTN_COMPANY_CODE}.{code}.{String((row?.counter ?? 0) + 1).padStart(3, '0')}.A{datePart}</span></p>
                      <div className="flex gap-2">
                        <input
                          type="number" min={0}
                          value={editVal}
                          onChange={e => setCounterEdits(prev => ({ ...prev, [code]: e.target.value }))}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-400"
                          placeholder="Enter new counter value"
                        />
                        <button
                          type="button"
                          onClick={() => handleCounterSave(code)}
                          disabled={counterSaving === code}
                          className="px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm rounded-lg transition-colors disabled:opacity-50"
                        >
                          {counterSaving === code ? 'Saving…' : 'Set Counter'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'invoice' && user?.role === 'ADMIN' && (
            <div className="bg-white border border-gray-100 rounded-xl p-6 border-t-4 border-t-blue-500">
              <div className="flex items-center gap-2 mb-6">
                <Hash size={20} className="text-blue-500" />
                <h2 className="text-lg font-bold text-gray-800">Invoice Format Settings</h2>
              </div>
              <form onSubmit={handleFormatUpdate} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-xs font-semibold block mb-1 text-gray-700">Invoice Prefix</label>
                    <input 
                      value={formatForm.INV_PREFIX} 
                      onChange={e=>setFormatForm({...formatForm, INV_PREFIX: e.target.value.toUpperCase()})} 
                      className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:border-blue-500" 
                      placeholder="INV" 
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold block mb-1 text-gray-700">Date/Year Format</label>
                    <select 
                      value={formatForm.INV_DATE_FORMAT} 
                      onChange={e=>setFormatForm({...formatForm, INV_DATE_FORMAT: e.target.value})} 
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:border-blue-500 font-mono"
                    >
                      <option value="FY_YY_YY">Financial Year (e.g. /26-27/)</option>
                      <option value="YYYY">Calendar Year (e.g. /2026/)</option>
                      <option value="YYYYMM">Year+Month (e.g. /202604/)</option>
                      <option value="CUSTOM">Custom Year Override</option>
                      <option value="NONE">None (Omit Date)</option>
                    </select>
                  </div>
                  {formatForm.INV_DATE_FORMAT === 'CUSTOM' && (
                    <div>
                      <label className="text-xs font-semibold block mb-1 text-gray-700">Custom Year Override</label>
                      <input 
                        value={formatForm.INV_CUSTOM_YEAR} 
                        onChange={e=>setFormatForm({...formatForm, INV_CUSTOM_YEAR: e.target.value})} 
                        className="w-full px-3 py-2 border rounded-lg text-sm font-mono focus:border-blue-500" 
                        placeholder="25-26" 
                      />
                      <p className="text-[10px] text-gray-400 mt-1">E.g. 26-27, 25-26, 2026, etc.</p>
                    </div>
                  )}
                </div>

                <div className="p-4 bg-gray-50 border border-gray-200 rounded-xl mt-4">
                  <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Live Preview</h3>
                  <div className="text-2xl font-mono text-gray-800">
                    {formatForm.INV_PREFIX}
                    {formatForm.INV_DATE_FORMAT === 'FY_YY_YY' ? '/26-27' : ''}
                    {formatForm.INV_DATE_FORMAT === 'YYYY' ? '/2026' : ''}
                    {formatForm.INV_DATE_FORMAT === 'YYYYMM' ? '/202604' : ''}
                    {formatForm.INV_DATE_FORMAT === 'CUSTOM' ? `/${formatForm.INV_CUSTOM_YEAR}` : ''}
                    /001
                  </div>
                  <p className="text-[11px] text-gray-400 mt-2">Note: Invoice counters automatically reset based on the selected Date/Year format interval.</p>
                </div>

                <button type="submit" className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium text-sm rounded-lg transition-colors shadow">Save Formats</button>
              </form>
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
