import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLeadStore } from '../stores/leadStore';
import { useQuotationStore } from '../stores/quotationStore';
import { format } from 'date-fns';
import Layout from '../components/Layout';
import { useUserStore } from '../stores/userStore';
import { useProductStore } from '../stores/productStore';
import { useAuthStore } from '../stores/authStore';
import VoiceRecorder from '../components/VoiceRecorder/VoiceRecorder';
import DOMPurify from 'dompurify';
import {
  PhoneCall, MessageCircle, Mail, FileText, PackagePlus, Clock,
  Plus, Trash2, Download, ChevronDown, X, Search, CheckCircle2,
  IndianRupee, Calendar, AlertCircle, Edit3
} from 'lucide-react';

const TABS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'notes', label: 'Notes' },
  { id: 'followups', label: 'Follow-ups' },
  { id: 'emails', label: 'Emails' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'quotations', label: 'Quotations' },
  { id: 'products', label: 'Products' }
];

const DOT_COLORS = {
  call: 'bg-blue-500', whatsapp: 'bg-emerald-500', message: 'bg-emerald-500',
  email: 'bg-purple-500', status: 'bg-amber-500', stage: 'bg-amber-500',
  won: 'bg-green-600', closed: 'bg-green-600', lost: 'bg-red-500',
  cancel: 'bg-red-500', note: 'bg-indigo-500', follow: 'bg-cyan-500',
  product: 'bg-orange-500', quotation: 'bg-violet-500', assign: 'bg-sky-500',
};

const getDotColor = (action = '') => {
  const a = action.toLowerCase();
  for (const [key, color] of Object.entries(DOT_COLORS)) {
    if (a.includes(key)) return color;
  }
  return 'bg-green-500';
};

const EMPTY_QUOTATION_ITEM = () => ({ productId: '', description: '', quantity: 1, unitPrice: '', discount: 0, taxRate: 18 });

const LeadDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    currentLead, isLoading, getLead, updateLead, assignLead,
    addNote, addFollowUp, logInteraction, addLeadProduct, removeLeadProduct, addTimelineEvent
  } = useLeadStore();
  const { users, fetchUsers } = useUserStore();
  const { products, fetchProducts } = useProductStore();
  const {
    leadQuotations, fetchLeadQuotations, createQuotation, downloadPDF, isLoading: quotLoading
  } = useQuotationStore();

  // Tab state
  const [activeTab, setActiveTab] = useState('timeline');

  // Notes state
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteVoiceBlob, setNoteVoiceBlob] = useState(null);
  const [savingNote, setSavingNote] = useState(false);

  // Timeline Event state
  const [showLogEvent, setShowLogEvent] = useState(false);
  const [eventForm, setEventForm] = useState({ action: '', description: '' });

  // Follow-up state
  const [showAddFollowUp, setShowAddFollowUp] = useState(false);
  const [followUpForm, setFollowUpForm] = useState({ type: 'CALL', description: '', scheduledAt: '' });

  // Simulator State
  const [simulatorMessage, setSimulatorMessage] = useState('');

  // Product State
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productForm, setProductForm] = useState({ productId: '', quantity: 1, notes: '' });

  // Quotation State
  const [showQuotationForm, setShowQuotationForm] = useState(false);
  const [quotItems, setQuotItems] = useState([EMPTY_QUOTATION_ITEM()]);
  const [quotMeta, setQuotMeta] = useState({ validUntil: '', paymentTerms: '', deliveryTerms: '', notes: '', discountPercent: 0 });
  const [quotSubmitting, setQuotSubmitting] = useState(false);

  useEffect(() => {
    getLead(id);
    fetchUsers();
    fetchProducts();
    fetchLeadQuotations(id);
  }, [id]);

  const handleStatusChange = async (newStatus) => updateLead(id, { status: newStatus });
  const handleAssign = async (employeeId) => assignLead(id, employeeId);

  const handleTimelineSubmit = async (e) => {
    e.preventDefault();
    if (!eventForm.action) return;
    await addTimelineEvent(id, eventForm);
    setShowLogEvent(false);
    setEventForm({ action: '', description: '' });
  };

  const handleSubmitNote = async () => {
    if (!noteText.trim() && !noteVoiceBlob) return;
    setSavingNote(true);
    await addNote(id, noteText.trim(), noteVoiceBlob || undefined);
    setNoteText('');
    setNoteVoiceBlob(null);
    setShowAddNote(false);
    setSavingNote(false);
  };

  const handleCreateFollowUp = async (e) => {
    e.preventDefault();
    await addFollowUp(id, followUpForm);
    setShowAddFollowUp(false);
    setFollowUpForm({ type: 'CALL', description: '', scheduledAt: '' });
  };

  const handleSimulateMessage = async (channel) => {
    if (!simulatorMessage.trim()) return;
    await logInteraction(id, { channel, message: simulatorMessage });
    setSimulatorMessage('');
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!productForm.productId) return;
    await addLeadProduct(id, productForm);
    setShowAddProduct(false);
    setProductForm({ productId: '', quantity: 1, notes: '' });
    setProductSearch('');
  };

  const handleRemoveProduct = async (recordId) => {
    if (!window.confirm('Remove this product from the lead?')) return;
    await removeLeadProduct(id, recordId);
  };

  // Quotation line-item helpers
  const addQuotItem = () => setQuotItems(prev => [...prev, EMPTY_QUOTATION_ITEM()]);
  const removeQuotItem = (idx) => setQuotItems(prev => prev.filter((_, i) => i !== idx));
  const updateQuotItem = (idx, field, val) =>
    setQuotItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));

  const handleQuotProductSelect = (idx, productId) => {
    const p = products.find(x => x.id === productId);
    if (!p) return updateQuotItem(idx, 'productId', productId);
    setQuotItems(prev => prev.map((item, i) =>
      i === idx ? { ...item, productId: p.id, unitPrice: Number(p.basePrice), taxRate: Number(p.taxRate) || 18 } : item
    ));
  };

  const calcQuotTotals = () => {
    let sub = 0;
    for (const item of quotItems) {
      const qty = parseFloat(item.quantity) || 0;
      const price = parseFloat(item.unitPrice) || 0;
      const disc = parseFloat(item.discount) || 0;
      sub += qty * price * (1 - disc / 100);
    }
    const discountAmt = sub * ((parseFloat(quotMeta.discountPercent) || 0) / 100);
    const taxable = sub - discountAmt;
    const tax = taxable * 0.18;
    return { sub, discountAmt, taxable, tax, total: taxable + tax };
  };

  const handleCreateQuotation = async (e) => {
    e.preventDefault();
    const validItems = quotItems.filter(it => it.productId && it.unitPrice);
    if (validItems.length === 0) return alert('Add at least one product line item');
    setQuotSubmitting(true);
    const { discountPercent, ...meta } = quotMeta;
    const res = await createQuotation({
      leadId: id,
      discountPercent: parseFloat(discountPercent) || 0,
      ...meta,
      items: validItems.map(it => ({
        productId: it.productId,
        description: it.description,
        quantity: parseInt(it.quantity) || 1,
        unitPrice: parseFloat(it.unitPrice),
        discount: parseFloat(it.discount) || 0,
        taxRate: parseFloat(it.taxRate) || 18,
      }))
    });
    setQuotSubmitting(false);
    if (res.success) {
      setShowQuotationForm(false);
      setQuotItems([EMPTY_QUOTATION_ITEM()]);
      setQuotMeta({ validUntil: '', paymentTerms: '', deliveryTerms: '', notes: '', discountPercent: 0 });
    } else {
      alert(res.error || 'Failed to create quotation');
    }
  };

  if (isLoading && !currentLead) return (
    <Layout>
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-green-500 border-t-transparent rounded-full" />
      </div>
    </Layout>
  );
  if (!currentLead) return null;

  const { customer, assignedTo, timeline, notes, followUps, quotations: leadQuots, products: leadProducts } = currentLead;

  // Timeline: newest first
  const sortedTimeline = [...(timeline || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  const filteredProductOptions = products.filter(p =>
    p.isActive && p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  const totals = calcQuotTotals();

  return (
    <Layout>
      <main className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ─── Left Panel ─── */}
          <div className="lg:col-span-1 space-y-4">

            {/* Lead Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex justify-between items-start mb-3">
                <h2 className="text-base font-bold text-gray-900 leading-snug">{currentLead.title}</h2>
                <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                  {currentLead.leadNumber}
                </span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Source</span>
                  <span className="font-medium">{currentLead.source}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Estimate</span>
                  <span className="font-bold text-green-600">₹{currentLead.estimateAmount?.toLocaleString() || '0'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Created</span>
                  <span className="text-gray-600">{format(new Date(currentLead.createdAt), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </div>

            {/* Customer Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Customer</h3>
              <div className="space-y-2.5 text-sm">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center font-bold text-green-700 text-base flex-shrink-0">
                    {customer?.contactName?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{customer?.contactName}</p>
                    {customer?.companyName && <p className="text-xs text-gray-500">{customer.companyName}</p>}
                  </div>
                </div>
                {customer?.phone && (
                  <a href={`tel:${customer.phone}`} className="flex items-center gap-2 text-blue-600 hover:underline">
                    <PhoneCall size={14} /> {customer.phone}
                  </a>
                )}
                {customer?.email && (
                  <p className="flex items-center gap-2 text-gray-600">
                    <Mail size={14} /> {customer.email}
                  </p>
                )}
                {customer?.city && <p className="text-gray-500 text-xs">{customer.city}{customer.state ? `, ${customer.state}` : ''}</p>}
              </div>
            </div>

            {/* Assignment & Stage */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Assignment & Stage</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Assigned To</label>
                  <select value={assignedTo?.id || ''} onChange={e => handleAssign(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="">Unassigned</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-600 block mb-1">Lead Stage</label>
                  <select value={currentLead.status} onChange={e => handleStatusChange(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-semibold bg-gray-50 focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="NEW">NEW</option>
                    <option value="INQUIRY">INQUIRY</option>
                    <option value="FOLLOW_UP">FOLLOW UP</option>
                    <option value="QUOTATION_SENT">QUOTATION SENT</option>
                    <option value="ORDER_CONFIRMED">ORDER CONFIRMED</option>
                    <option value="WON">WON</option>
                    <option value="LOST">LOST</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-800 mb-3">Quick Actions</h3>
              <div className="space-y-2">
                <button onClick={() => setActiveTab('whatsapp')}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 text-sm font-semibold transition-colors">
                  <MessageCircle size={15} /> Log WhatsApp
                </button>
                <button onClick={() => { setActiveTab('quotations'); setShowQuotationForm(true); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-violet-50 text-violet-700 border border-violet-200 rounded-lg hover:bg-violet-100 text-sm font-semibold transition-colors">
                  <FileText size={15} /> Create Quotation
                </button>
                <button onClick={() => { setActiveTab('followups'); setShowAddFollowUp(true); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 text-sm font-semibold transition-colors">
                  <Clock size={15} /> Schedule Follow-up
                </button>
                <button onClick={() => { setActiveTab('products'); setShowAddProduct(true); }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-50 text-orange-700 border border-orange-200 rounded-lg hover:bg-orange-100 text-sm font-semibold transition-colors">
                  <PackagePlus size={15} /> Add Product Interest
                </button>
              </div>
            </div>
          </div>

          {/* ─── Right Panel (Tabs) ─── */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100">
              {/* Tab Nav */}
              <div className="border-b border-gray-100">
                <nav className="flex overflow-x-auto px-4 scrollbar-none">
                  {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`py-3.5 px-3 border-b-2 font-semibold text-xs whitespace-nowrap transition-colors ${
                        activeTab === tab.id
                          ? 'border-green-500 text-green-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700'
                      }`}>
                      {tab.label}
                      {tab.id === 'quotations' && leadQuotations.length > 0 && (
                        <span className="ml-1.5 bg-violet-100 text-violet-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          {leadQuotations.length}
                        </span>
                      )}
                      {tab.id === 'products' && leadProducts?.length > 0 && (
                        <span className="ml-1.5 bg-orange-100 text-orange-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                          {leadProducts.length}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>

              <div className="p-6">

                {/* ════ TIMELINE ════ */}
                {activeTab === 'timeline' && (
                  <div>
                    <div className="flex justify-between items-center mb-5">
                      <h3 className="font-bold text-gray-900">Activity Timeline</h3>
                      <button onClick={() => setShowLogEvent(!showLogEvent)}
                        className="px-3 py-1.5 bg-gray-800 text-white rounded-lg hover:bg-gray-900 text-xs font-semibold transition-colors">
                        {showLogEvent ? 'Cancel' : '+ Log Event'}
                      </button>
                    </div>

                    {showLogEvent && (
                      <form onSubmit={handleTimelineSubmit}
                        className="bg-gray-50 p-4 rounded-xl mb-5 border border-gray-200 space-y-3">
                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1">Action / Title *</label>
                          <input required value={eventForm.action}
                            onChange={e => setEventForm({ ...eventForm, action: e.target.value })}
                            placeholder="e.g. Visited site, Received documents"
                            className="w-full text-sm p-2.5 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-gray-400" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1">Description (optional)</label>
                          <textarea value={eventForm.description}
                            onChange={e => setEventForm({ ...eventForm, description: e.target.value })}
                            rows={2} className="w-full text-sm p-2.5 border border-gray-200 rounded-lg outline-none resize-none focus:ring-2 focus:ring-gray-400" />
                        </div>
                        <button type="submit" className="w-full py-2 bg-gray-800 text-white rounded-lg font-bold hover:bg-gray-900 text-sm">
                          Add to Timeline
                        </button>
                      </form>
                    )}

                    {sortedTimeline.length === 0 ? (
                      <div className="text-center py-16">
                        <Clock size={40} className="mx-auto mb-3 text-gray-200" />
                        <p className="text-gray-400 text-sm">No activities yet. Use the tabs above to log actions.</p>
                      </div>
                    ) : (
                      <div className="relative">
                        <div className="absolute left-4 top-2 bottom-2 w-0.5 bg-gradient-to-b from-green-300 via-green-100 to-transparent" />
                        <div className="space-y-0">
                          {sortedTimeline.map((item, idx) => {
                            const isLast = idx === sortedTimeline.length - 1;
                            const dotColor = getDotColor(item.action);
                            return (
                              <div key={item.id} className={`relative flex gap-4 ${isLast ? '' : 'pb-5'}`}>
                                <div className={`relative z-10 flex-shrink-0 w-8 h-8 rounded-full ${dotColor} flex items-center justify-center shadow-sm border-2 border-white`}>
                                  <span className="text-white text-[10px]">✦</span>
                                </div>
                                <div className="flex-1 bg-white border border-gray-100 rounded-xl p-3.5 shadow-sm hover:shadow-md transition-shadow min-w-0">
                                  <p className="font-semibold text-gray-900 text-sm leading-tight">{item.action}</p>
                                  {item.description && (
                                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{item.description}</p>
                                  )}
                                  {(item.oldValue || item.newValue) && (
                                    <div className="flex items-center gap-2 mt-1.5">
                                      {item.oldValue && <span className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded">{item.oldValue}</span>}
                                      <span className="text-gray-400 text-xs">→</span>
                                      {item.newValue && <span className="text-xs bg-green-50 text-green-600 px-2 py-0.5 rounded">{item.newValue}</span>}
                                    </div>
                                  )}
                                  <div className="flex justify-between mt-2.5 text-xs text-gray-400 pt-2 border-t border-gray-50">
                                    <span className="flex items-center gap-1">
                                      <span className="w-4 h-4 rounded-full bg-gray-200 inline-flex items-center justify-center font-bold text-[9px] uppercase text-gray-600">
                                        {item.user?.firstName?.[0]}
                                      </span>
                                      {item.user?.firstName} {item.user?.lastName}
                                    </span>
                                    <span>{format(new Date(item.createdAt), 'MMM d, yyyy · h:mm a')}</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ════ NOTES ════ */}
                {activeTab === 'notes' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-900">Notes</h3>
                      <button onClick={() => setShowAddNote(!showAddNote)}
                        className="px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs font-semibold transition-colors">
                        {showAddNote ? 'Cancel' : '+ Add Note'}
                      </button>
                    </div>

                    {showAddNote && (
                      <div className="bg-gray-50 p-4 rounded-xl mb-5 border border-gray-200 space-y-3">
                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1.5">Text Note</label>
                          <textarea value={noteText} onChange={e => setNoteText(e.target.value)}
                            rows={4} placeholder="Type your note here... supports any plain text"
                            className="w-full p-3 border border-gray-200 rounded-lg text-sm outline-none resize-none focus:ring-2 focus:ring-green-400 bg-white" />
                        </div>
                        <div>
                          <label className="text-xs font-bold text-gray-700 block mb-1.5">Or Record a Voice Note</label>
                          <VoiceRecorder onRecordingComplete={blob => setNoteVoiceBlob(blob)} />
                        </div>
                        <div className="flex justify-end">
                          <button onClick={handleSubmitNote} disabled={savingNote || (!noteText.trim() && !noteVoiceBlob)}
                            className="px-5 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-green-700 disabled:opacity-50 transition-colors">
                            {savingNote ? 'Saving...' : 'Save Note'}
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
                      {!notes || notes.length === 0 ? (
                        <div className="text-center py-12">
                          <Edit3 size={36} className="mx-auto mb-3 text-gray-200" />
                          <p className="text-gray-400 text-sm">No notes yet. Add one above.</p>
                        </div>
                      ) : notes.map(note => (
                        <div key={note.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                          {note.content.startsWith('/uploads')
                            ? (
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-indigo-600 text-xs">🎙</span>
                                </div>
                                <audio
                                  src={`${import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'}${note.content}`}
                                  controls className="h-9 w-full max-w-xs" />
                              </div>
                            ) : (
                              <div className="text-gray-800 text-sm leading-relaxed whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(note.content) }} />
                            )
                          }
                          <div className="flex justify-between mt-3 text-xs text-gray-400 pt-2 border-t border-gray-100">
                            <span>By {note.createdBy?.firstName} {note.createdBy?.lastName}</span>
                            <span>{format(new Date(note.createdAt), 'MMM d, h:mm a')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ════ FOLLOW-UPS ════ */}
                {activeTab === 'followups' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-900">Follow-ups</h3>
                      <button onClick={() => setShowAddFollowUp(!showAddFollowUp)}
                        className="px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold transition-colors">
                        {showAddFollowUp ? 'Cancel' : '+ Schedule Follow-up'}
                      </button>
                    </div>

                    {showAddFollowUp && (
                      <form onSubmit={handleCreateFollowUp}
                        className="bg-blue-50 p-4 rounded-xl mb-5 border border-blue-200 space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-bold text-blue-900 block mb-1">Method</label>
                            <select value={followUpForm.type}
                              onChange={e => setFollowUpForm({ ...followUpForm, type: e.target.value })}
                              className="w-full text-sm p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                              <option value="CALL">Call</option>
                              <option value="WHATSAPP">WhatsApp</option>
                              <option value="MEETING">Meeting</option>
                              <option value="EMAIL">Email</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-xs font-bold text-blue-900 block mb-1">Date & Time *</label>
                            <input type="datetime-local" required value={followUpForm.scheduledAt}
                              onChange={e => setFollowUpForm({ ...followUpForm, scheduledAt: e.target.value })}
                              className="w-full text-sm p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-bold text-blue-900 block mb-1">Agenda / Reason *</label>
                          <input required value={followUpForm.description}
                            onChange={e => setFollowUpForm({ ...followUpForm, description: e.target.value })}
                            placeholder="e.g. Discuss Q3 Pricing"
                            className="w-full text-sm p-2 border rounded-lg outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                        </div>
                        <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 text-sm">
                          Confirm Schedule
                        </button>
                      </form>
                    )}

                    <div className="space-y-3">
                      {!followUps || followUps.length === 0 ? (
                        <div className="text-center py-12">
                          <Calendar size={36} className="mx-auto mb-3 text-gray-200" />
                          <p className="text-gray-400 text-sm">No follow-ups scheduled yet.</p>
                        </div>
                      ) : followUps.map(f => (
                        <div key={f.id} className="border border-gray-200 rounded-xl p-4 flex justify-between items-center hover:border-blue-200 hover:bg-blue-50/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold ${
                              f.type === 'CALL' ? 'bg-blue-100 text-blue-600' :
                              f.type === 'WHATSAPP' ? 'bg-green-100 text-green-600' :
                              f.type === 'MEETING' ? 'bg-purple-100 text-purple-600' :
                              'bg-amber-100 text-amber-600'
                            }`}>
                              {f.type === 'CALL' ? '📞' : f.type === 'WHATSAPP' ? '💬' : f.type === 'MEETING' ? '🤝' : '📧'}
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{f.description}</p>
                              <span className="text-[10px] uppercase font-bold text-gray-400">{f.type} · {f.status}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="block text-xs font-bold text-gray-700">
                              {format(new Date(f.scheduledAt), 'MMM d, yyyy')}
                            </span>
                            <span className="text-xs text-gray-400">{format(new Date(f.scheduledAt), 'h:mm a')}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ════ WHATSAPP / EMAIL SIMULATOR ════ */}
                {(activeTab === 'whatsapp' || activeTab === 'emails') && (
                  <div className="text-center py-6">
                    <div className={`mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                      activeTab === 'whatsapp' ? 'bg-green-100 text-green-600' : 'bg-purple-100 text-purple-600'
                    }`}>
                      {activeTab === 'whatsapp' ? <MessageCircle size={32} /> : <Mail size={32} />}
                    </div>
                    <h3 className="font-bold text-gray-900 text-lg mb-2">
                      Log a {activeTab === 'whatsapp' ? 'WhatsApp' : 'Email'} Interaction
                    </h3>
                    <p className="text-gray-500 text-sm max-w-md mx-auto mb-6">
                      Type what was communicated with the customer — this will be officially recorded in the Timeline.
                    </p>
                    <div className="max-w-xl mx-auto text-left bg-gray-50 p-4 rounded-xl border border-gray-200">
                      <label className="text-xs font-bold text-gray-600 block mb-2">Message Body</label>
                      <textarea value={simulatorMessage} onChange={e => setSimulatorMessage(e.target.value)}
                        rows={4} className="w-full p-3 border rounded-lg text-sm mb-3 outline-none focus:ring-2 focus:ring-green-400 bg-white resize-none"
                        placeholder={`Hi ${customer?.contactName}, ...`} />
                      <button onClick={() => handleSimulateMessage(activeTab === 'whatsapp' ? 'WhatsApp' : 'Email')}
                        className={`w-full py-2.5 text-white font-bold rounded-lg shadow text-sm transition-colors ${
                          activeTab === 'whatsapp' ? 'bg-green-600 hover:bg-green-700' : 'bg-purple-600 hover:bg-purple-700'
                        }`}>
                        Log to Timeline
                      </button>
                    </div>
                  </div>
                )}

                {/* ════ PRODUCTS ════ */}
                {activeTab === 'products' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-900">Interested Products</h3>
                      <button onClick={() => setShowAddProduct(!showAddProduct)}
                        className="px-3 py-1.5 bg-orange-600 text-white rounded-lg hover:bg-orange-700 text-xs font-semibold transition-colors">
                        {showAddProduct ? 'Cancel' : '+ Add Product'}
                      </button>
                    </div>

                    {showAddProduct && (
                      <form onSubmit={handleAddProduct}
                        className="bg-orange-50 p-4 rounded-xl mb-5 border border-orange-200 space-y-3">
                        <div>
                          <label className="text-xs font-bold text-orange-900 block mb-1">Search & Select Product</label>
                          <div className="relative mb-2">
                            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input value={productSearch} onChange={e => setProductSearch(e.target.value)}
                              placeholder="Search products..."
                              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                          </div>
                          <div className="max-h-36 overflow-y-auto border border-gray-200 rounded-lg bg-white">
                            {filteredProductOptions.length === 0 ? (
                              <p className="text-center text-gray-400 text-sm py-4">No products found</p>
                            ) : filteredProductOptions.map(p => (
                              <button key={p.id} type="button"
                                onClick={() => { setProductForm({ ...productForm, productId: p.id }); setProductSearch(p.name); }}
                                className={`w-full text-left px-3 py-2 text-sm flex justify-between hover:bg-orange-50 transition-colors border-b last:border-0 border-gray-50 ${
                                  productForm.productId === p.id ? 'bg-orange-100 font-semibold' : ''
                                }`}>
                                <span>{p.name}</span>
                                <span className="text-gray-400 text-xs">₹{Number(p.basePrice).toLocaleString()}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-orange-900 block mb-1">Quantity</label>
                            <input type="number" min={1} value={productForm.quantity}
                              onChange={e => setProductForm({ ...productForm, quantity: e.target.value })}
                              className="w-full text-sm p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-orange-900 block mb-1">Notes</label>
                            <input value={productForm.notes} onChange={e => setProductForm({ ...productForm, notes: e.target.value })}
                              placeholder="Optional notes..."
                              className="w-full text-sm p-2 border rounded-lg outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
                          </div>
                        </div>
                        <button type="submit" disabled={!productForm.productId}
                          className="w-full py-2 bg-orange-600 text-white rounded-lg font-bold hover:bg-orange-700 text-sm disabled:opacity-50 transition-colors">
                          Attach Product to Lead
                        </button>
                      </form>
                    )}

                    <div className="space-y-3">
                      {!leadProducts || leadProducts.length === 0 ? (
                        <div className="text-center py-12">
                          <PackagePlus size={36} className="mx-auto mb-3 text-gray-200" />
                          <p className="text-gray-400 text-sm">No products mapped to this lead yet.</p>
                        </div>
                      ) : leadProducts.map(lp => (
                        <div key={lp.id} className="border border-gray-100 rounded-xl p-4 flex justify-between items-center bg-white shadow-sm hover:shadow-md transition-shadow">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-100 text-orange-600 flex items-center justify-center rounded-xl">
                              <PackagePlus size={18} />
                            </div>
                            <div>
                              <p className="font-bold text-gray-900 text-sm">{lp.product?.name}</p>
                              <p className="text-xs text-gray-500">
                                Qty: {lp.quantity} · ₹{Number(lp.product?.basePrice || 0).toLocaleString()}
                                {lp.notes && ` · ${lp.notes}`}
                              </p>
                            </div>
                          </div>
                          <button onClick={() => handleRemoveProduct(lp.id)}
                            className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            title="Remove product">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ════ QUOTATIONS ════ */}
                {activeTab === 'quotations' && (
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-gray-900">Quotations</h3>
                      <button onClick={() => setShowQuotationForm(!showQuotationForm)}
                        className="px-3 py-1.5 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-xs font-semibold transition-colors">
                        {showQuotationForm ? 'Cancel' : '+ Create Quotation'}
                      </button>
                    </div>

                    {/* Existing Quotations */}
                    {leadQuotations.length > 0 && (
                      <div className="space-y-3 mb-6">
                        {leadQuotations.map(q => (
                          <div key={q.id} className="border border-gray-100 rounded-xl p-4 bg-white shadow-sm">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-mono font-bold text-gray-900 text-sm">{q.quotationNumber}</span>
                                <span className={`ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                                  q.status === 'DRAFT' ? 'bg-gray-100 text-gray-600' :
                                  q.status === 'SENT' ? 'bg-blue-100 text-blue-700' :
                                  q.status === 'CONVERTED_TO_SALE' ? 'bg-purple-100 text-purple-700' :
                                  'bg-green-100 text-green-700'
                                }`}>{q.status?.replace(/_/g,' ')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-green-600 text-sm">₹{Number(q.totalAmount || 0).toLocaleString()}</span>
                                <button onClick={() => downloadPDF(q.id, q.quotationNumber)}
                                  className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                  title="Download PDF">
                                  <Download size={14} />
                                </button>
                              </div>
                            </div>
                            <div className="flex gap-4 mt-2 text-xs text-gray-500">
                              <span>Created: {format(new Date(q.createdAt), 'MMM d, yyyy')}</span>
                              {q.validUntil && <span>Valid till: {format(new Date(q.validUntil), 'MMM d, yyyy')}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Create Quotation Form */}
                    {showQuotationForm && (
                      <form onSubmit={handleCreateQuotation} className="bg-violet-50 border border-violet-200 rounded-xl p-5 space-y-4">
                        <h4 className="font-bold text-violet-900 text-sm">New Quotation</h4>

                        {/* Line Items */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-xs font-bold text-violet-900">Line Items</label>
                            <button type="button" onClick={addQuotItem}
                              className="text-xs text-violet-700 hover:text-violet-900 font-semibold flex items-center gap-1">
                              <Plus size={12} /> Add Line
                            </button>
                          </div>
                          <div className="space-y-2">
                            {quotItems.map((item, idx) => (
                              <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3 space-y-2">
                                <div className="flex gap-2">
                                  <select value={item.productId} onChange={e => handleQuotProductSelect(idx, e.target.value)}
                                    className="flex-1 text-sm p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-violet-400">
                                    <option value="">-- Select Product --</option>
                                    {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                  </select>
                                  {quotItems.length > 1 && (
                                    <button type="button" onClick={() => removeQuotItem(idx)}
                                      className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                                      <X size={14} />
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-4 gap-2 text-sm">
                                  <div>
                                    <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Qty</label>
                                    <input type="number" min={1} value={item.quantity}
                                      onChange={e => updateQuotItem(idx, 'quantity', e.target.value)}
                                      className="w-full p-1.5 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-violet-400" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Unit Price ₹</label>
                                    <input type="number" min={0} value={item.unitPrice}
                                      onChange={e => updateQuotItem(idx, 'unitPrice', e.target.value)}
                                      className="w-full p-1.5 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-violet-400" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Disc %</label>
                                    <input type="number" min={0} max={100} value={item.discount}
                                      onChange={e => updateQuotItem(idx, 'discount', e.target.value)}
                                      className="w-full p-1.5 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-violet-400" />
                                  </div>
                                  <div>
                                    <label className="text-[10px] text-gray-500 font-semibold block mb-0.5">Tax %</label>
                                    <input type="number" min={0} value={item.taxRate}
                                      onChange={e => updateQuotItem(idx, 'taxRate', e.target.value)}
                                      className="w-full p-1.5 border border-gray-200 rounded text-sm outline-none focus:ring-1 focus:ring-violet-400" />
                                  </div>
                                </div>
                                <input value={item.description} onChange={e => updateQuotItem(idx, 'description', e.target.value)}
                                  placeholder="Custom description (optional)"
                                  className="w-full p-1.5 border border-gray-200 rounded text-xs outline-none focus:ring-1 focus:ring-violet-400" />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Meta fields */}
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <label className="text-xs font-bold text-violet-900 block mb-1">Valid Until</label>
                            <input type="date" value={quotMeta.validUntil}
                              onChange={e => setQuotMeta({ ...quotMeta, validUntil: e.target.value })}
                              className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-violet-400 bg-white text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-violet-900 block mb-1">Overall Discount %</label>
                            <input type="number" min={0} max={100} value={quotMeta.discountPercent}
                              onChange={e => setQuotMeta({ ...quotMeta, discountPercent: e.target.value })}
                              className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-violet-400 bg-white text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-violet-900 block mb-1">Payment Terms</label>
                            <input value={quotMeta.paymentTerms} onChange={e => setQuotMeta({ ...quotMeta, paymentTerms: e.target.value })}
                              placeholder="e.g. 50% advance, balance on delivery"
                              className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-violet-400 bg-white text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-violet-900 block mb-1">Delivery Terms</label>
                            <input value={quotMeta.deliveryTerms} onChange={e => setQuotMeta({ ...quotMeta, deliveryTerms: e.target.value })}
                              placeholder="e.g. Ex-works, within 7 days"
                              className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-violet-400 bg-white text-sm" />
                          </div>
                          <div className="col-span-2">
                            <label className="text-xs font-bold text-violet-900 block mb-1">Notes</label>
                            <textarea value={quotMeta.notes} onChange={e => setQuotMeta({ ...quotMeta, notes: e.target.value })}
                              rows={2} placeholder="Internal notes or additional remarks"
                              className="w-full p-2 border border-gray-200 rounded-lg outline-none focus:ring-1 focus:ring-violet-400 bg-white text-sm resize-none" />
                          </div>
                        </div>

                        {/* Totals Preview */}
                        <div className="bg-white border border-violet-200 rounded-xl p-3 text-sm space-y-1">
                          <div className="flex justify-between text-gray-600">
                            <span>Subtotal</span><span>₹{totals.sub.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                          </div>
                          {totals.discountAmt > 0 && (
                            <div className="flex justify-between text-red-500">
                              <span>Discount</span><span>-₹{totals.discountAmt.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-gray-600">
                            <span>GST (18%)</span><span>₹{totals.tax.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                          </div>
                          <div className="flex justify-between font-bold text-violet-800 pt-1 border-t border-violet-100">
                            <span>Grand Total</span><span>₹{totals.total.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                          </div>
                        </div>

                        <button type="submit" disabled={quotSubmitting}
                          className="w-full py-2.5 bg-violet-700 text-white rounded-xl font-bold hover:bg-violet-800 text-sm transition-colors disabled:opacity-50 shadow-sm">
                          {quotSubmitting ? 'Creating Quotation...' : 'Create & Save Quotation'}
                        </button>
                      </form>
                    )}

                    {!showQuotationForm && leadQuotations.length === 0 && (
                      <div className="text-center py-16">
                        <FileText size={40} className="mx-auto text-gray-200 mb-4" />
                        <h4 className="font-bold text-gray-700 mb-2">No Quotations Yet</h4>
                        <p className="text-gray-400 text-sm max-w-sm mx-auto mb-5">
                          Create a professional quotation for this lead directly from here.
                        </p>
                        <button onClick={() => setShowQuotationForm(true)}
                          className="px-6 py-2.5 bg-violet-700 text-white rounded-xl hover:bg-violet-800 font-bold text-sm shadow transition-colors">
                          + Create First Quotation
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          </div>
        </div>
      </main>
    </Layout>
  );
};

export default LeadDetail;