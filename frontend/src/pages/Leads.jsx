import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import KanbanBoard from '../components/KanbanBoard';
import LeadForm from '../components/LeadForm';
import CSVImportModal from '../components/CSVImportModal';
import { useLeadStore } from '../stores/leadStore';
import { useCampaignStore } from '../stores/campaignStore';
import { useUserStore } from '../stores/userStore';
import { useAuthStore } from '../stores/authStore';
import { Plus, Send, CheckSquare, X, FileSpreadsheet, Upload, Users } from 'lucide-react';
import * as XLSX from 'xlsx';
import api from '../services/api';

const Leads = () => {
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const { leads, fetchLeads, filters, setFilters } = useLeadStore();
  const { createCampaign, isLoading: isCampaignLoading } = useCampaignStore();
  const { users, fetchUsers } = useUserStore();
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'ADMIN';

  const [isBulkMode, setIsBulkMode] = useState(false);
  const [selectedLeads, setSelectedLeads] = useState([]);
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin, fetchUsers]);
  
  const handleExportLeads = () => {
    const rows = leads.map(l => ({
      'Lead #': l.leadNumber,
      'Title': l.title,
      'Customer': l.customer?.contactName,
      'Phone': l.customer?.phone,
      'Email': l.customer?.email || '',
      'Status': l.status,
      'Source': l.source,
      'Assigned To': l.assignedTo ? `${l.assignedTo.firstName} ${l.assignedTo.lastName}` : 'Unassigned',
      'Estimate (₹)': l.estimateAmount || 0,
      'Created': new Date(l.createdAt).toLocaleDateString('en-IN'),
    }));
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Leads');
    XLSX.writeFile(wb, `Leads_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportLeads = async (rows) => {
    const res = await api.post('/leads/import', { rows });
    await fetchLeads();
    return res.data;
  };
  
  const [broadcastForm, setBroadcastForm] = useState({
    campaignName: '',
    channel: 'WHATSAPP',
    subject: '',
    messageTemplate: 'Hi [Name], '
  });

  const handleLeadClick = (lead) => {
    navigate(`/leads/${lead.id}`);
  };

  const handleCreateSuccess = () => fetchLeads();

  const toggleLeadSelection = (id) => {
    setSelectedLeads(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => setSelectedLeads(leads.map(l => l.id));
  const deselectAll = () => setSelectedLeads([]);

  const handleBroadcastSubmit = async (e) => {
    e.preventDefault();
    if (selectedLeads.length === 0) return;
    const res = await createCampaign({ ...broadcastForm, leadIds: selectedLeads });
    if (res.success) {
      setShowBroadcastModal(false);
      setIsBulkMode(false);
      setSelectedLeads([]);
      navigate('/campaigns');
    } else {
      alert(res.error || 'Failed to trigger campaign');
    }
  };

  return (
    <Layout>
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Lead Management</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track and manage your sales pipeline</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {isAdmin && (
            <div className="flex items-center gap-2 mr-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5 shadow-sm">
              <Users size={16} className="text-gray-400 ml-1" />
              <select 
                value={filters.assignedToId || ''} 
                onChange={e => { setFilters({ assignedToId: e.target.value }); fetchLeads(); }}
                className="text-sm outline-none bg-transparent font-medium text-gray-700 pr-1"
              >
                <option value="">All Employees</option>
                {[...users].sort((a,b) => a.firstName.localeCompare(b.firstName)).map(u => (
                  <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                ))}
              </select>
            </div>
          )}
          <button
            id="import-leads-btn"
            onClick={() => setShowImportModal(true)}
            className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Upload size={16} className="text-indigo-500" /> Import CSV
          </button>
          <button
            id="export-leads-btn"
            onClick={handleExportLeads}
            className="flex items-center gap-2 px-3 py-2 bg-white text-gray-700 border border-gray-200 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            <FileSpreadsheet size={16} className="text-green-600" /> Export
          </button>
          <button
            onClick={() => { setIsBulkMode(!isBulkMode); setSelectedLeads([]); }}
            className={`flex items-center gap-2 px-4 py-2 border text-sm font-medium rounded-lg transition-colors ${
              isBulkMode ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
            }`}
          >
            {isBulkMode ? <><X size={18}/>Cancel Bulk</> : <><CheckSquare size={18}/> Bulk Msg</>}
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow"
          >
            <Plus size={18} /> New Lead
          </button>
        </div>
      </div>

      {isBulkMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-blue-800">{selectedLeads.length} leads selected</span>
            <button onClick={selectAll} className="text-sm text-blue-600 hover:underline">Select All</button>
            <button onClick={deselectAll} className="text-sm text-blue-600 hover:underline">Deselect All</button>
          </div>
          <button 
            disabled={selectedLeads.length === 0}
            onClick={() => setShowBroadcastModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg shadow"
          >
            <Send size={16} /> Compose Broadcast
          </button>
        </div>
      )}

      {/* Main View */}
      {!isBulkMode ? (
        <KanbanBoard onLeadClick={handleLeadClick} onCreateLead={() => setShowForm(true)} />
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-semibold">
              <tr>
                <th className="px-4 py-3 w-10">#</th>
                <th className="px-4 py-3">Lead / Customer</th>
                <th className="px-4 py-3">Assigned To</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {leads.map(lead => (
                <tr key={lead.id} className={`hover:bg-gray-50 cursor-pointer ${selectedLeads.includes(lead.id) ? 'bg-blue-50/50' : ''}`} onClick={() => toggleLeadSelection(lead.id)}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selectedLeads.includes(lead.id)} readOnly className="w-4 h-4 text-blue-600 rounded cursor-pointer" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">{lead.title}</div>
                    <div className="text-xs text-gray-500">{lead.customer?.contactName} • {lead.customer?.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 font-medium">
                    {lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : 'Unassigned'}
                  </td>
                  <td className="px-4 py-3"><span className="text-xs font-bold text-gray-600 bg-gray-100 px-2 py-1 rounded">{lead.status.replace('_', ' ')}</span></td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{new Date(lead.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Broadcast Modal */}
      {showBroadcastModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between bg-blue-50">
              <h2 className="font-bold text-lg text-blue-900">Broadcast to {selectedLeads.length} Leads</h2>
              <button onClick={() => setShowBroadcastModal(false)} className="text-blue-400 hover:text-blue-600">✕</button>
            </div>
            <form onSubmit={handleBroadcastSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-semibold block mb-1">Campaign Name</label>
                <input required value={broadcastForm.campaignName} onChange={e=>setBroadcastForm({...broadcastForm, campaignName: e.target.value})} placeholder="e.g. Diwali Offer 2024" className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1">Channel</label>
                  <select value={broadcastForm.channel} onChange={e=>setBroadcastForm({...broadcastForm, channel: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500">
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">Email</option>
                  </select>
                </div>
              </div>
              {broadcastForm.channel === 'EMAIL' && (
                <div>
                  <label className="text-xs font-semibold block mb-1">Email Subject</label>
                  <input required value={broadcastForm.subject} onChange={e=>setBroadcastForm({...broadcastForm, subject: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-500" />
                </div>
              )}
              <div>
                <label className="text-xs font-semibold block mb-1">Message Template</label>
                <textarea required rows={5} value={broadcastForm.messageTemplate} onChange={e=>setBroadcastForm({...broadcastForm, messageTemplate: e.target.value})} className="w-full px-3 py-2 border rounded-lg text-sm resize-none outline-none focus:border-blue-500" />
                <p className="text-[11px] text-gray-500 mt-1">Variables available: [Name], [Company]</p>
              </div>
              <button disabled={isCampaignLoading} type="submit" className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg mt-2 disabled:opacity-50">
                {isCampaignLoading ? 'Sending Broadcast...' : 'Blast Message'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <CSVImportModal
          entityLabel="Leads"
          onClose={() => setShowImportModal(false)}
          onImport={handleImportLeads}
        />
      )}

      {/* Lead Form Modal */}
      {showForm && <LeadForm onClose={() => setShowForm(false)} onSuccess={handleCreateSuccess} />}
    </Layout>
  );
};

export default Leads;