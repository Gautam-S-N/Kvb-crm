import React, { useState, useEffect } from 'react';
import { useMaterialStore } from '../stores/materialStore';
import { getCurrentFY, getFYOptions } from '../stores/projectPlanStore';
import { X, Calendar, User, Info, ArrowUpRight, ArrowDownRight, RotateCcw, Loader } from 'lucide-react';

export default function MaterialHistoryDrawer({ material, onClose }) {
  const { materialHistory, fetchMaterialHistory, isLoading } = useMaterialStore();
  const [selectedFY, setSelectedFY] = useState(getCurrentFY());

  useEffect(() => {
    if (material?.id) {
      fetchMaterialHistory(material.id, selectedFY);
    }
  }, [material?.id, selectedFY]);

  if (!material) return null;

  const fyOptions = ['ALL', ...getFYOptions()];

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-[60] backdrop-blur-xs transition-opacity" 
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
        onClick={onClose} 
      />

      {/* Slide-over Drawer Panel */}
      <div 
        className="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-gray-800 z-[70] border-l border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 transform translate-x-0"
        style={{ 
          boxShadow: '-10px 0 35px rgba(0, 0, 0, 0.15)'
        }}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-55 dark:bg-gray-700/30">
          <div className="flex-1 min-w-0 pr-4">
            <span className="text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded font-mono font-bold">
              USAGE TIMELINE
            </span>
            <h2 className="text-base font-bold text-gray-900 dark:text-white truncate mt-1">
              {material.itemName}
            </h2>
            <p className="text-xs text-gray-500 font-mono mt-0.5">
              Code: {material.itemCode || '—'}
            </p>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-white rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Financial Year Selector Filter */}
        <div className="px-6 py-4 bg-gray-50/50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between gap-4">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
            <Calendar size={13} /> Filter Period:
          </span>
          <select 
            value={selectedFY} 
            onChange={(e) => setSelectedFY(e.target.value)}
            className="text-xs font-bold border border-gray-300 dark:border-gray-600 rounded-lg px-2.5 py-1.5 bg-white dark:bg-gray-700 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
          >
            {fyOptions.map(fy => (
              <option key={fy} value={fy}>
                {fy === 'ALL' ? 'All History' : `Financial Year ${fy}`}
              </option>
            ))}
          </select>
        </div>

        {/* History List Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center h-full py-10 text-gray-400">
              <Loader className="w-8 h-8 animate-spin text-blue-600 mb-2" />
              <p className="text-xs">Fetching usage timeline...</p>
            </div>
          ) : materialHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-gray-500 text-center">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700/50 rounded-full flex items-center justify-center mb-3">
                <Info size={20} className="text-gray-400" />
              </div>
              <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">No History Found</p>
              <p className="text-xs mt-1 max-w-[240px]">
                {selectedFY === 'ALL' 
                  ? 'This material has not been used or reserved in any project plans yet.'
                  : `No records of reservations or collections found for Financial Year ${selectedFY}.`}
              </p>
            </div>
          ) : (
            <div className="relative border-l border-gray-200 dark:border-gray-700 ml-3 pl-6 space-y-6">
              {materialHistory.map((log) => {
                let badgeClass = 'bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/20 dark:border-blue-800';
                let Icon = ArrowUpRight;
                let actionText = 'Reserved';

                if (log.action === 'COLLECTED') {
                  badgeClass = 'bg-green-50 text-green-700 border-green-100 dark:bg-green-900/20 dark:border-green-800';
                  Icon = ArrowDownRight;
                  actionText = 'Collected / Used';
                } else if (log.action === 'RELEASED') {
                  badgeClass = 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-700 dark:border-gray-600';
                  Icon = RotateCcw;
                  actionText = 'Released Back';
                }

                return (
                  <div key={log.id} className="relative">
                    {/* Circle Indicator on the line */}
                    <div className="absolute -left-[37px] top-1.5 w-6 h-6 rounded-full border bg-white dark:bg-gray-800 flex items-center justify-center shadow-sm">
                      <Icon size={12} className={log.action === 'COLLECTED' ? 'text-green-600' : log.action === 'RELEASED' ? 'text-gray-500' : 'text-blue-600'} />
                    </div>

                    {/* Timeline Item Content Card */}
                    <div className="bg-gray-50/50 dark:bg-gray-850 border border-gray-100 dark:border-gray-750 p-4 rounded-xl space-y-2">
                      <div className="flex justify-between items-start gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase tracking-wider ${badgeClass}`}>
                          {actionText}
                        </span>
                        <span className="text-[10px] text-gray-400 font-medium">
                          {new Date(log.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>

                      {/* Quantity & Plan info */}
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-base font-bold text-gray-800 dark:text-white">
                          {Number(log.qty).toLocaleString('en-IN')}
                        </span>
                        <span className="text-xs text-gray-500 font-semibold uppercase">{material.unit}</span>
                      </div>

                      <p className="text-xs text-gray-600 dark:text-gray-300">
                        Project: <strong className="text-gray-800 dark:text-white">{log.projectName}</strong>
                      </p>

                      {log.note && (
                        <p className="text-xs bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-2.5 py-1.5 rounded-lg text-gray-500 italic mt-1.5">
                          "{log.note}"
                        </p>
                      )}

                      {/* Performed By Info */}
                      <div className="flex items-center gap-1 text-[10px] text-gray-450 dark:text-gray-400 pt-1 border-t border-gray-100 dark:border-gray-700/50 mt-1">
                        <User size={10} className="shrink-0" />
                        <span>By: {log.performedBy ? `${log.performedBy.firstName} ${log.performedBy.lastName}` : 'System'}</span>
                        {log.financialYear && (
                          <>
                            <span className="mx-1">•</span>
                            <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.2 rounded font-mono font-semibold">
                              FY {log.financialYear}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
