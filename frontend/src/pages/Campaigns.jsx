import { useEffect } from 'react';
import Layout from '../components/Layout';
import { useCampaignStore } from '../stores/campaignStore';
import { MessageSquare, Send, XCircle, Clock, Link as LinkIcon, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

const STATUS_COLORS = {
  COMPLETED: 'bg-green-100 text-green-800 border-green-200',
  PARTIAL:   'bg-yellow-100 text-yellow-800 border-yellow-200',
  FAILED:    'bg-red-100 text-red-800 border-red-200',
  SENDING:   'bg-blue-100 text-blue-800 border-blue-200',
  DRAFT:     'bg-gray-100 text-gray-800 border-gray-200'
};

export default function Campaigns() {
  const { campaigns, isLoading, fetchCampaigns } = useCampaignStore();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Broadcast Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Track your bulk WhatsApp and Email blasts</p>
        </div>
        <Link
          to="/leads"
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors shadow"
        >
          <Send size={18} /> New Broadcast (from Leads)
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" /></div>
      ) : campaigns.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-xl border border-gray-100">
          <MessageSquare size={48} className="mx-auto mb-4 opacity-30 text-gray-500" />
          <p className="text-gray-500 text-lg">No campaigns sent yet.</p>
          <p className="text-sm text-gray-400 mt-2">Go to the Leads page, select multiple leads, and hit Bulk Message to start one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {campaigns.map(camp => (
            <div key={camp.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
              <div className="flex justify-between items-start mb-3">
                <div className="flex gap-2 items-center">
                  <span className="px-2.5 py-1 text-xs font-bold bg-gray-100 text-gray-700 rounded border border-gray-200">{camp.channel}</span>
                  <span className={`px-2.5 py-1 text-xs font-bold rounded border ${STATUS_COLORS[camp.status]}`}>
                    {camp.status}
                  </span>
                </div>
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Clock size={12}/> {new Date(camp.createdAt).toLocaleDateString()}
                </span>
              </div>
              
              <h3 className="font-bold text-gray-900 text-lg mb-2">{camp.campaignName}</h3>
              {camp.subject && <p className="text-sm text-gray-700 font-medium mb-1 line-clamp-1">Sub: {camp.subject}</p>}
              <p className="text-sm text-gray-500 line-clamp-2 mb-4 bg-gray-50 p-2 border border-gray-100 rounded-md">
                {camp.messageTemplate}
              </p>
              
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-gray-100">
                <div className="text-center">
                  <div className="flex justify-center text-gray-500 mb-1"><Users size={16}/></div>
                  <span className="block text-lg font-bold text-gray-800">{camp.totalLeads}</span>
                  <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Total</span>
                </div>
                <div className="text-center">
                  <div className="flex justify-center text-green-500 mb-1"><Send size={16}/></div>
                  <span className="block text-lg font-bold text-gray-800">{camp.sentCount}</span>
                  <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Sent</span>
                </div>
                <div className="text-center">
                  <div className="flex justify-center text-red-500 mb-1"><XCircle size={16}/></div>
                  <span className="block text-lg font-bold text-gray-800">{camp.failedCount}</span>
                  <span className="block text-[10px] text-gray-400 uppercase tracking-wider">Failed</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
