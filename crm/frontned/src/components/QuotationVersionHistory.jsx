/**
 * QuotationVersionHistory
 * ─────────────────────────────────────────────────────────────────────────────
 * Shows all versions of a quotation as an expandable panel.
 * Each version is read-only; users can download any version or see
 * the full version letter progression.
 */
import { useState, useEffect } from 'react';
import { useQuotationStore } from '../stores/quotationStore';
import { History, ChevronDown, ChevronRight, Download, FileText, RefreshCw, GitBranch } from 'lucide-react';
import { format } from 'date-fns';

const fmtMoney = v => '₹' + Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 0 });
const fmtDate  = d => d ? format(new Date(d), 'dd MMM yyyy') : '—';

export default function QuotationVersionHistory({ quotationId, currentNumber }) {
  const { fetchVersionHistory, downloadPDF, downloadDOCX } = useQuotationStore();
  const [versions, setVersions]     = useState([]);
  const [loading, setLoading]       = useState(false);
  const [expanded, setExpanded]     = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const load = async () => {
    if (!quotationId) return;
    setLoading(true);
    const res = await fetchVersionHistory(quotationId);
    setLoading(false);
    if (res.success) setVersions(res.data);
  };

  useEffect(() => {
    if (expanded && versions.length === 0) load();
  }, [expanded, quotationId]);

  if (!quotationId) return null;

  return (
    <div className="mt-3 border border-violet-200 rounded-xl overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-violet-50 hover:bg-violet-100 transition-colors"
      >
        <div className="flex items-center gap-2 text-violet-700">
          <History size={15} />
          <span className="text-xs font-bold uppercase tracking-wide">Version History</span>
          {versions.length > 0 && (
            <span className="bg-violet-200 text-violet-800 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
              {versions.length}
            </span>
          )}
        </div>
        {expanded
          ? <ChevronDown size={14} className="text-violet-500" />
          : <ChevronRight size={14} className="text-violet-500" />
        }
      </button>

      {expanded && (
        <div className="bg-white divide-y divide-gray-50">
          {loading ? (
            <div className="flex items-center gap-2 p-4 text-gray-400 text-sm">
              <RefreshCw size={14} className="animate-spin" /> Loading versions…
            </div>
          ) : versions.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-sm">No version history yet.</div>
          ) : (
            versions.map((v, idx) => {
              const isLatest  = v.isLatest;
              const isOpen    = expandedId === v.id;
              return (
                <div key={v.id}>
                  {/* Version row */}
                  <div
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors ${isLatest ? 'bg-violet-50/40' : ''}`}
                    onClick={() => setExpandedId(isOpen ? null : v.id)}
                  >
                    {/* Version badge */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                      isLatest ? 'bg-violet-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {v.versionLabel || String.fromCharCode(64 + v.version)}
                    </div>

                    {/* Number & meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-900 truncate">{v.quotationNumber}</span>
                        {isLatest && (
                          <span className="bg-violet-100 text-violet-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                            Current
                          </span>
                        )}
                        {idx === 0 && versions.length > 1 && (
                          <span className="bg-gray-100 text-gray-500 text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
                            Original
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-400 mt-0.5">
                        {fmtDate(v.createdAt)} · by {v.createdBy?.firstName} {v.createdBy?.lastName} · {fmtMoney(v.totalAmount)}
                      </div>
                    </div>

                    {/* Download buttons */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); downloadPDF(v.id, v.quotationNumber); }}
                        title="Download PDF"
                        className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Download size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={e => { e.stopPropagation(); downloadDOCX(v.id, v.quotationNumber); }}
                        title="Download DOCX"
                        className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <FileText size={13} />
                      </button>
                      {isOpen
                        ? <ChevronDown size={13} className="text-gray-400 ml-1" />
                        : <ChevronRight size={13} className="text-gray-400 ml-1" />
                      }
                    </div>
                  </div>

                  {/* Expanded version details */}
                  {isOpen && (
                    <div className="bg-gray-50 border-t border-gray-100 px-5 py-4">
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-gray-400 font-semibold uppercase tracking-wide block mb-0.5">Quotation No.</span>
                          <span className="font-mono font-bold text-gray-800">{v.quotationNumber}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 font-semibold uppercase tracking-wide block mb-0.5">Version</span>
                          <span className="font-bold text-violet-700">{v.versionLabel || v.version}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 font-semibold uppercase tracking-wide block mb-0.5">Total Amount</span>
                          <span className="font-bold text-green-700 text-sm">{fmtMoney(v.totalAmount)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 font-semibold uppercase tracking-wide block mb-0.5">Original Date</span>
                          <span className="text-gray-700">{fmtDate(v.originalDate || v.quotationDate)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 font-semibold uppercase tracking-wide block mb-0.5">Status</span>
                          <span className={`inline-block px-2 py-0.5 rounded-full font-bold ${
                            v.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' :
                            v.status === 'SENT'  ? 'bg-blue-100 text-blue-700' :
                            v.status === 'CONVERTED_TO_SALE' ? 'bg-purple-100 text-purple-700' :
                            'bg-green-100 text-green-700'
                          }`}>{v.status?.replace(/_/g, ' ')}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 font-semibold uppercase tracking-wide block mb-0.5">Template</span>
                          <span className="text-gray-700">{v.templateType?.replace(/_/g, ' ')}</span>
                        </div>
                      </div>

                      {v.paymentTerms && (
                        <div className="mt-3 pt-3 border-t border-gray-200">
                          <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1">Payment Terms</span>
                          <p className="text-xs text-gray-700 leading-relaxed">{v.paymentTerms}</p>
                        </div>
                      )}

                      {v.notes && (
                        <div className="mt-2">
                          <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide block mb-1">Notes</span>
                          <p className="text-xs text-gray-700 leading-relaxed">{v.notes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
