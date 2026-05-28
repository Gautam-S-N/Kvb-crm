import { useEffect, useState } from 'react';
import { useLeadStore } from '../stores/leadStore';
import { format } from 'date-fns';

const LEAD_STATUSES = [
  { id: 'NEW', label: 'New', color: 'bg-gray-500' },
  { id: 'INQUIRY', label: 'Inquiry', color: 'bg-blue-500' },
  { id: 'FOLLOW_UP', label: 'Follow Up', color: 'bg-yellow-500' },
  { id: 'QUOTATION_SENT', label: 'Quotation Sent', color: 'bg-purple-500' },
  { id: 'ORDER_CONFIRMED', label: 'Order Confirmed', color: 'bg-orange-500' },
  { id: 'WON', label: 'Won', color: 'bg-green-500' },
  { id: 'LOST', label: 'Lost', color: 'bg-red-500' }
];

const KanbanBoard = ({ onLeadClick, onCreateLead }) => {
  const { leads, isLoading, fetchLeads, updateLead } = useLeadStore();
  const [draggedLead, setDraggedLead] = useState(null);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const handleDragStart = (lead) => {
    setDraggedLead(lead);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = async (e, status) => {
    e.preventDefault();
    if (draggedLead && draggedLead.status !== status) {
      await updateLead(draggedLead.id, { status });
      setDraggedLead(null);
    }
  };

  const getLeadsByStatus = (status) => {
    return leads.filter(lead => lead.status === status);
  };

  const formatAmount = (amount) => {
    if (!amount) return '₹0';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Loading leads...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Lead Pipeline</h2>
        <button
          onClick={onCreateLead}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium"
        >
          + New Lead
        </button>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {LEAD_STATUSES.map((status) => (
          <div
            key={status.id}
            className="flex-shrink-0 w-80"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status.id)}
          >
            <div className={`${status.color} text-white px-4 py-2 rounded-t-lg font-semibold flex justify-between items-center`}>
              <span>{status.label}</span>
              <span className="bg-white bg-opacity-30 px-2 py-1 rounded text-sm">
                {getLeadsByStatus(status.id).length}
              </span>
            </div>
            
            <div className="bg-gray-100 rounded-b-lg p-3 min-h-[400px] max-h-[600px] overflow-y-auto">
              {getLeadsByStatus(status.id).map((lead) => (
                <div
                  key={lead.id}
                  draggable
                  onDragStart={() => handleDragStart(lead)}
                  onClick={() => onLeadClick(lead)}
                  className="bg-white p-4 rounded-lg shadow-sm mb-3 cursor-pointer hover:shadow-md transition-shadow border-l-4 border-transparent hover:border-green-500"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-xs font-mono text-gray-500">{lead.leadNumber}</span>
                    <span className="text-xs text-gray-400">
                      {format(new Date(lead.createdAt), 'MMM d')}
                    </span>
                  </div>
                  
                  <h3 className="font-semibold text-gray-800 mb-1 line-clamp-2">{lead.title}</h3>
                  
                  <div className="text-sm text-gray-600 mb-2">
                    {lead.customer?.contactName}
                  </div>
                  
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-green-600">
                      {formatAmount(lead.estimateAmount)}
                    </span>
                    <span className="text-gray-400 text-xs">
                      {lead._count?.followUps || 0} follow-ups
                    </span>
                  </div>
                  
                  {lead.assignedTo && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-500">
                      Assigned to: {lead.assignedTo.firstName} {lead.assignedTo.lastName}
                    </div>
                  )}
                </div>
              ))}
              
              {getLeadsByStatus(status.id).length === 0 && (
                <div className="text-center text-gray-400 py-8 text-sm">
                  No leads in this stage
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default KanbanBoard;