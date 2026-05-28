import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { X, Upload, AlertCircle, CheckCircle, Download, RefreshCw } from 'lucide-react';

const REQUIRED_FIELDS = ['title', 'phone'];

const DEFAULT_MAP = {
  'title':      'title',
  'lead title': 'title',
  'name':       'title',
  'phone':      'phone',
  'phone no':   'phone',
  'mobile':     'phone',
  'email':      'email',
  'source':     'source',
  'estimate':   'estimateAmount',
  'estimate amount': 'estimateAmount',
  'amount':     'estimateAmount',
  'notes':      'description',
  'description':'description',
  'company':    'companyName',
  'company name': 'companyName',
};

const CRM_FIELDS = ['title', 'phone', 'email', 'source', 'estimateAmount', 'description', 'companyName'];

export default function CSVImportModal({ onClose, onImport, entityLabel = 'Leads' }) {
  const [step, setStep] = useState('upload'); // 'upload' | 'map' | 'preview' | 'done'
  const [rawData, setRawData] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [mapping, setMapping] = useState({});
  const [preview, setPreview] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const dropRef = useRef(null);

  const autoMap = (hdrs) => {
    const m = {};
    hdrs.forEach(h => {
      const normalized = h.toLowerCase().trim();
      if (DEFAULT_MAP[normalized]) m[h] = DEFAULT_MAP[normalized];
    });
    return m;
  };

  const parseFile = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const workbook = XLSX.read(e.target.result, { type: 'binary' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        if (json.length === 0) { setError('File appears empty.'); return; }
        const hdrs = Object.keys(json[0]);
        setHeaders(hdrs);
        setRawData(json);
        setMapping(autoMap(hdrs));
        setError('');
        setStep('map');
      } catch {
        setError('Failed to parse file. Please use a valid .xlsx or .csv file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) parseFile(file);
  };

  const handleFileInput = (e) => {
    const file = e.target.files[0];
    if (file) parseFile(file);
  };

  const buildPreview = () => {
    const rows = rawData.slice(0, 5).map(row => {
      const mapped = {};
      Object.entries(mapping).forEach(([h, field]) => {
        if (field) mapped[field] = row[h];
      });
      return mapped;
    });
    setPreview(rows);
    setStep('preview');
  };

  const handleImport = async () => {
    const rows = rawData.map(row => {
      const mapped = {};
      Object.entries(mapping).forEach(([h, field]) => {
        if (field) mapped[field] = row[h];
      });
      return mapped;
    });
    setIsImporting(true);
    try {
      const res = await onImport(rows);
      setResult(res);
      setStep('done');
    } catch (e) {
      setError(e.message || 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 to-blue-600">
          <h2 className="font-bold text-white">Import {entityLabel}</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          {/* Step: Upload */}
          {step === 'upload' && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">Upload an Excel (.xlsx) or CSV file. We'll help you map columns to CRM fields.</p>
              <div
                ref={dropRef}
                onDrop={handleDrop}
                onDragOver={e => e.preventDefault()}
                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/10 transition-colors"
                onClick={() => document.getElementById('csv-file-input').click()}
              >
                <Upload size={32} className="mx-auto mb-3 text-gray-400" />
                <p className="font-semibold text-gray-700 dark:text-gray-300">Drop your file here</p>
                <p className="text-sm text-gray-400 mt-1">or click to browse</p>
                <p className="text-xs text-gray-400 mt-2">.xlsx, .xls, .csv supported</p>
              </div>
              <input id="csv-file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
              {error && <p className="mt-3 text-sm text-red-600 flex items-center gap-1"><AlertCircle size={14} /> {error}</p>}

              {/* Template download */}
              <button
                onClick={() => {
                  const wb = XLSX.utils.book_new();
                  const ws = XLSX.utils.aoa_to_sheet([['title', 'phone', 'email', 'source', 'estimateAmount', 'companyName', 'description']]);
                  XLSX.utils.book_append_sheet(wb, ws, 'Template');
                  XLSX.writeFile(wb, `${entityLabel}_import_template.xlsx`);
                }}
                className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 text-sm rounded-lg transition-colors"
              >
                <Download size={14} /> Download Template
              </button>
            </div>
          )}

          {/* Step: Map */}
          {step === 'map' && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                <span className="font-semibold text-gray-800 dark:text-gray-200">{rawData.length} rows</span> detected. Map your CSV columns to CRM fields.
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {headers.map(h => (
                  <div key={h} className="grid grid-cols-5 items-center gap-2">
                    <span className="col-span-2 text-sm font-mono bg-gray-100 dark:bg-gray-700 dark:text-gray-300 px-2 py-1 rounded text-gray-700 truncate">{h}</span>
                    <span className="text-gray-400 text-center">→</span>
                    <select
                      className="col-span-2 text-sm border border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={mapping[h] || ''}
                      onChange={e => setMapping(prev => ({ ...prev, [h]: e.target.value }))}
                    >
                      <option value="">(skip)</option>
                      {CRM_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setStep('upload')} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Back
                </button>
                <button onClick={buildPreview} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg text-sm transition-colors">
                  Preview →
                </button>
              </div>
            </div>
          )}

          {/* Step: Preview */}
          {step === 'preview' && (
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">Previewing first 5 rows. <span className="font-semibold">{rawData.length} total rows</span> will be imported.</p>
              <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-900">
                    <tr>
                      {Object.values(mapping).filter(Boolean).map(f => (
                        <th key={f} className="px-3 py-2 text-left font-semibold text-gray-600 dark:text-gray-400 uppercase">{f}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {preview.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        {Object.values(mapping).filter(Boolean).map(f => (
                          <td key={f} className="px-3 py-2 text-gray-700 dark:text-gray-300 truncate max-w-[100px]">{row[f] || '—'}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setStep('map')} className="flex-1 py-2 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 rounded-lg text-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                  Back
                </button>
                <button
                  onClick={handleImport}
                  disabled={isImporting}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isImporting ? <><RefreshCw size={14} className="animate-spin" /> Importing...</> : `Import ${rawData.length} Rows`}
                </button>
              </div>
            </div>
          )}

          {/* Step: Done */}
          {step === 'done' && (
            <div className="text-center py-4">
              {result?.success !== false ? (
                <>
                  <CheckCircle size={40} className="mx-auto mb-3 text-green-500" />
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg mb-1">Import Successful!</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm mb-4">
                    {result?.imported ?? rawData.length} records were added to the system.
                  </p>
                  <button onClick={onClose} className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm">
                    Done
                  </button>
                </>
              ) : (
                <>
                  <AlertCircle size={40} className="mx-auto mb-3 text-red-500" />
                  <h3 className="font-bold text-gray-800 dark:text-gray-200 text-lg mb-1">Import Failed</h3>
                  <p className="text-red-500 text-sm mb-4">{result?.error || 'Unknown error occurred'}</p>
                  <button onClick={() => setStep('preview')} className="px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white font-semibold rounded-lg text-sm">
                    Try Again
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
