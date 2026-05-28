import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useProjectPlanStore, { getFYOptions, getCurrentFY } from '../stores/projectPlanStore';
import useFYStore from '../stores/fyStore';
import { useAuthStore } from '../stores/authStore';
import Layout from '../components/Layout';
import api from '../services/api';
import toast from 'react-hot-toast';

const STATUS_COLORS = {
  ACTIVE:       'bg-blue-100 text-blue-800',
  COMPLETE:     'bg-green-100 text-green-800',
  NOT_COMPLETE: 'bg-red-100 text-red-800',
};

const FULFILLMENT_COLORS = {
  PENDING:       'bg-gray-100 text-gray-600',
  INVENTORY:     'bg-blue-100 text-blue-700',
  PURCHASE_ORDER:'bg-amber-100 text-amber-700',
};

// ── FY Selector Banner ────────────────────────────────────────────────────────
function FYBanner({ fy, onChange }) {
  const options = getFYOptions();
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500 font-medium">Financial Year:</span>
      <select
        value={fy}
        onChange={e => onChange(e.target.value)}
        className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500"
      >
        <option value="ALL">All Years</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

// ── Item Table Component for Modal ───────────────────────────────────────────
function ItemTable({ label, items, setter, onUpdateRow, onAddRow, onRemoveRow }) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-semibold text-gray-700">{label}</h4>
        <button type="button" onClick={() => onAddRow(setter)} className="text-xs text-blue-600 hover:underline">+ Add Row</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-gray-200 rounded">
          <thead className="bg-gray-50">
            <tr>
              {['Item Name', 'Size', 'Qty', 'Supplier', 'Remarks', ''].map(h => (
                <th key={h} className="px-2 py-1 text-left text-gray-600 border-b">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map((row, i) => (
              <tr key={i}>
                {['itemName', 'size', 'quantity', 'supplierName', 'remarks'].map(f => (
                  <td key={f} className="border-b px-1 py-0.5">
                    <input
                      value={row[f]}
                      onChange={e => onUpdateRow(setter, i, f, e.target.value)}
                      className="w-full border-0 outline-none text-xs bg-transparent"
                      placeholder={f === 'quantity' ? '0' : '—'}
                      type={f === 'quantity' ? 'number' : 'text'}
                    />
                  </td>
                ))}
                <td className="border-b px-1">
                  <button type="button" onClick={() => onRemoveRow(setter, i)} className="text-red-400 hover:text-red-600 text-xs">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Create Plan Modal ─────────────────────────────────────────────────────────
function CreatePlanModal({ onClose, onCreated }) {
  const { createPlan } = useProjectPlanStore();
  const [form, setForm] = useState({ projectName: '', place: '' });
  const [rawMaterials, setRawMaterials] = useState([{ itemName: '', size: '', quantity: '', supplierName: '', remarks: '' }]);
  const [bopItems, setBopItems] = useState([{ itemName: '', size: '', quantity: '', supplierName: '', remarks: '' }]);
  const [saving, setSaving] = useState(false);

  const updateRow = (setter, idx, field, val) =>
    setter(prev => prev.map((r, i) => i === idx ? { ...r, [field]: val } : r));

  const addRow = (setter) => setter(prev => [...prev, { itemName: '', size: '', quantity: '', supplierName: '', remarks: '' }]);
  const removeRow = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.projectName.trim() || !form.place.trim()) return toast.error('Project name and place are required');
    setSaving(true);
    try {
      await createPlan({ ...form, rawMaterials, bopItems });
      toast.success('Project plan created');
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create plan');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold text-gray-800">New Project Plan</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Project Name *</label>
              <input value={form.projectName} onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" required />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Place / Location *</label>
              <input value={form.place} onChange={e => setForm(f => ({ ...f, place: e.target.value }))}
                className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" required />
            </div>
          </div>
          <ItemTable label="Raw Materials" items={rawMaterials} setter={setRawMaterials} onUpdateRow={updateRow} onAddRow={addRow} onRemoveRow={removeRow} />
          <ItemTable label="BOP Items" items={bopItems} setter={setBopItems} onUpdateRow={updateRow} onAddRow={addRow} onRemoveRow={removeRow} />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {saving ? 'Creating...' : 'Create Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Edit Plan Modal ───────────────────────────────────────────────────────────
function EditPlanModal({ plan, onClose, onUpdated }) {
  const { updatePlan } = useProjectPlanStore();
  const [form, setForm] = useState({ projectName: plan.projectName || '', place: plan.place || '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.projectName.trim() || !form.place.trim()) return toast.error('Project name and place are required');
    setSaving(true);
    try {
      await updatePlan(plan.id, form);
      toast.success('Project details updated');
      onUpdated();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update plan');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-base font-bold text-gray-800">Edit Project Details</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-650 block mb-1">Project Name *</label>
            <input
              value={form.projectName}
              onChange={e => setForm(f => ({ ...f, projectName: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-gray-650 block mb-1">Place / Location *</label>
            <input
              value={form.place}
              onChange={e => setForm(f => ({ ...f, place: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2 border-t mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-bold disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Plan Detail Drawer ─────────────────────────────────────────────────────────
function PlanDetailDrawer({ plan, onClose, onRefresh }) {
  const navigate = useNavigate();
  const {
    updatePlanStatus,
    reserveFromInventory,
    markPO,
    assignCollectionTask,
    fetchPlanHistory,
    removeItem,
    addItems
  } = useProjectPlanStore();
  const { user } = useAuthStore();
  const canCreate = user?.role === 'ADMIN' || user?.canCreateProjectPlans === true;
  const isCreatorOrAdmin = user?.role === 'ADMIN' || plan.createdById === user?.id;
  const [showEditPlan, setShowEditPlan] = useState(false);

  const [history, setHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('items');
  const [assigning, setAssigning] = useState(null); // itemId
  const [taskForm, setTaskForm] = useState({ assignedToId: '', qtyToCollect: '', note: '' });
  const [employees, setEmployees] = useState([]);

  // Local state for adding items dynamically
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItem, setNewItem] = useState({ category: 'RAW_MATERIAL', itemName: '', size: '', quantity: '', supplierName: '', remarks: '' });

  const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Are you sure you want to delete this item from the project plan?')) return;
    try {
      await removeItem(plan.id, itemId);
      toast.success('Item deleted');
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete item');
    }
  };

  const handleAddNewItem = async (e) => {
    e.preventDefault();
    if (!newItem.itemName.trim() || !newItem.quantity) {
      return toast.error('Item name and quantity are required');
    }
    try {
      await addItems(plan.id, [newItem]);
      toast.success('Item added to plan');
      setNewItem({ category: 'RAW_MATERIAL', itemName: '', size: '', quantity: '', supplierName: '', remarks: '' });
      setShowAddForm(false);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add item');
    }
  };

  const allItems = [...(plan.rawMaterials || []), ...(plan.bopItems || [])];

  function isPoEligible(item) {
    if (plan.status !== 'ACTIVE') return false;
    if (item.fulfillmentType === 'PENDING') return true;
    const plannedVal = Number(item.quantity || 0);
    const reservedVal = Number(item.reservedQty || 0);
    return plannedVal - reservedVal > 0 && !item.purchaseOrderId && item.fulfillmentType !== 'PURCHASE_ORDER';
  }

  // Checkbox select states for bulk POs
  const [selectedItemIds, setSelectedItemIds] = useState(new Set());
  const [poConfirmGroup, setPoConfirmGroup] = useState(null);

  // States for the Smart Vendor PO Planner Modal
  const [activePlannerVendor, setActivePlannerVendor] = useState('');
  const [plannerCheckedIds, setPlannerCheckedIds] = useState(new Set());
  const [plannerQuantities, setPlannerQuantities] = useState({});

  useEffect(() => {
    setSelectedItemIds(new Set());
    setPoConfirmGroup(null);
  }, [plan.id]);

  // Clean up selected items that are no longer eligible (e.g., PO raised)
  useEffect(() => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      let changed = false;
      for (const id of next) {
        const item = allItems.find(i => i.id === id);
        if (!item || !isPoEligible(item)) {
          next.delete(id);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [plan, activeTab]);

  // Initialize PO Planner Modal states when opened
  useEffect(() => {
    if (poConfirmGroup) {
      const initialVendor = poConfirmGroup.suppliers[0] || '';
      setActivePlannerVendor(initialVendor);

      const initialChecked = new Set(poConfirmGroup.items.map(i => i.id));
      setPlannerCheckedIds(initialChecked);

      const initialQty = {};
      poConfirmGroup.items.forEach(i => {
        const planned = Number(i.quantity || 0);
        const reserved = Number(i.reservedQty || 0);
        initialQty[i.id] = String(Math.max(0, planned - reserved));
      });
      setPlannerQuantities(initialQty);
    }
  }, [poConfirmGroup]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchPlanHistory(plan.id).then(setHistory).catch(() => {});
    }
  }, [activeTab, plan.id]);

  useEffect(() => {
    // Fetch all active users (any role) so admins + employees can be assigned collection tasks
    api.get('/users?status=ACTIVE&limit=200').then(r => setEmployees(r.data.data || [])).catch(() => {});
  }, []);

  const handleStatusUpdate = async (status) => {
    if (!window.confirm(`Mark project as ${status}?`)) return;
    try {
      await updatePlanStatus(plan.id, status);
      toast.success('Status updated');
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const handleReserve = async (item) => {
    try {
      await reserveFromInventory(plan.id, item.id);
      toast.success('Reserved from inventory');
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Insufficient stock'); }
  };

  const handleMarkPO = (item) => {
    const plannedVal = Number(item.quantity || 0);
    const reservedVal = Number(item.reservedQty || 0);
    const purchaseQty = Math.max(0, plannedVal - reservedVal);

    navigate('/purchase/new', {
      state: {
        projectName: plan.projectName,
        vendorName: item.supplierName || '',
        prefilledItems: [
          {
            projectPlanItemId: item.id,
            itemName: item.itemName,
            quantity: purchaseQty,
            unitPrice: ''
          }
        ]
      }
    });
  };

  const handleAssignTask = async (itemId) => {
    if (!taskForm.assignedToId || !taskForm.qtyToCollect) return toast.error('Assignee and qty required');
    try {
      await assignCollectionTask(plan.id, itemId, taskForm);
      toast.success('Collection task assigned');
      setAssigning(null);
      setTaskForm({ assignedToId: '', qtyToCollect: '', note: '' });
      onRefresh();
    } catch (err) { toast.error(err.response?.data?.message || 'Error'); }
  };

  const toggleSelectItem = (itemId) => {
    setSelectedItemIds(prev => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const executePORedirection = (itemsToProcess, supplierName, customQuantities = {}) => {
    if (itemsToProcess.length === 0) {
      return toast.error('No items selected for this Purchase Order');
    }
    const prefilledItems = itemsToProcess.map(it => {
      const plannedVal = Number(it.quantity || 0);
      const reservedVal = Number(it.reservedQty || 0);
      const defaultQty = Math.max(0, plannedVal - reservedVal);
      const customVal = customQuantities[it.id];
      const purchaseQty = customVal !== undefined && customVal !== '' ? Number(customVal) : defaultQty;

      return {
        projectPlanItemId: it.id,
        itemName: it.itemName,
        quantity: purchaseQty,
        unitPrice: ''
      };
    });

    setSelectedItemIds(prev => {
      const next = new Set(prev);
      itemsToProcess.forEach(it => next.delete(it.id));
      return next;
    });
    setPoConfirmGroup(null);

    navigate('/purchase/new', {
      state: {
        projectName: plan.projectName,
        vendorName: supplierName || '',
        prefilledItems
      }
    });
  };

  const handleBulkRaisePO = () => {
    const selectedItems = allItems.filter(item => selectedItemIds.has(item.id) && isPoEligible(item));
    if (selectedItems.length === 0) return toast.error('No eligible items selected');

    const uniqueSuppliers = Array.from(
      new Set(selectedItems.map(i => i.supplierName?.trim() || ''))
    );

    setPoConfirmGroup({
      suppliers: uniqueSuppliers,
      items: selectedItems
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-2xl h-full flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="p-5 border-b flex items-start justify-between bg-gradient-to-r from-blue-50 to-white flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-800">{plan.projectName}</h2>
            <p className="text-sm text-gray-500">{plan.place} · FY {plan.financialYear}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[plan.status] || 'bg-gray-100 text-gray-600'}`}>{plan.status}</span>
              {isCreatorOrAdmin && (
                <button
                  onClick={() => setShowEditPlan(true)}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold underline ml-2"
                >
                  Edit Details
                </button>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        {showEditPlan && (
          <EditPlanModal
            plan={plan}
            onClose={() => setShowEditPlan(false)}
            onUpdated={() => {
              setShowEditPlan(false);
              onRefresh();
            }}
          />
        )}

        {/* Status actions — only for users with project plan create/manage permission */}
        {plan.status === 'ACTIVE' && canCreate && (
          <div className="px-5 pt-4 flex gap-2 flex-shrink-0">
            <button onClick={() => handleStatusUpdate('COMPLETE')} className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700">Mark Complete</button>
            <button onClick={() => handleStatusUpdate('NOT_COMPLETE')} className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700">Mark Not Complete</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b mx-5 mt-4 flex-shrink-0">
          {['items', 'history'].map(t => (
            <button key={t} onClick={() => setActiveTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px ${activeTab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500'}`}>
              {t}
            </button>
          ))}
        </div>

        {/* Smart Vendor PO Planner Modal */}
        {poConfirmGroup && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden border border-gray-150 animate-fade-in">
              {/* Modal Header */}
              <div className="p-5 border-b flex justify-between items-center bg-gray-50/50">
                <div>
                  <h3 className="text-base font-bold text-gray-800 flex items-center gap-1.5">
                    <span>🛒</span> Smart Vendor PO Planner
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5">Customize selected items and purchase quantities before creating the Purchase Order</p>
                </div>
                <button onClick={() => setPoConfirmGroup(null)} className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1">✕</button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 flex overflow-hidden min-h-0">
                {/* Left Sidebar: Suppliers List */}
                <div className="w-1/3 border-r bg-gray-50/50 p-4 overflow-y-auto space-y-2">
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Select Supplier</label>
                  {poConfirmGroup.suppliers.map(sup => {
                    const count = poConfirmGroup.items.filter(i => (i.supplierName?.trim() || '') === sup).length;
                    const isActive = activePlannerVendor === sup;
                    return (
                      <button
                        key={sup || 'no-supplier'}
                        onClick={() => setActivePlannerVendor(sup)}
                        className={`w-full text-left p-3 rounded-xl border text-xs transition-all flex items-center justify-between ${
                          isActive
                            ? 'bg-blue-50 border-blue-200 text-blue-700 font-semibold shadow-sm'
                            : 'bg-white border-gray-250 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        <span className="truncate pr-2 font-medium">
                          {sup ? sup : <em className="text-gray-400">Blank Supplier</em>}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                          isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
                        }`}>{count} items</span>
                      </button>
                    );
                  })}
                </div>

                {/* Right Content: Selected Vendor Items */}
                <div className="w-2/3 p-5 overflow-y-auto flex flex-col">
                  <div className="flex items-center justify-between border-b pb-2.5 mb-4">
                    <span className="text-xs font-semibold text-gray-700">
                      Items for: <span className="text-blue-600 font-extrabold">{activePlannerVendor || 'Blank Vendor'}</span>
                    </span>
                    <span className="text-[10px] text-gray-450">Check items to include in this PO</span>
                  </div>

                  <div className="space-y-2.5">
                    {poConfirmGroup.items
                      .filter(i => (i.supplierName?.trim() || '') === activePlannerVendor)
                      .map(item => {
                        const planned = Number(item.quantity || 0);
                        const reserved = Number(item.reservedQty || 0);
                        const shortage = Math.max(0, planned - reserved);
                        const isChecked = plannerCheckedIds.has(item.id);

                        return (
                          <div key={item.id} className={`p-3 border rounded-xl flex items-center gap-4 transition-all ${
                            isChecked ? 'border-blue-100 bg-blue-50/20' : 'border-gray-200 bg-white opacity-60'
                          }`}>
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setPlannerCheckedIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(item.id)) next.delete(item.id);
                                  else next.add(item.id);
                                  return next;
                                });
                              }}
                              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold text-gray-800 truncate">{item.itemName}</p>
                              <p className="text-[10px] text-gray-500 mt-0.5">
                                Planned: {item.quantity} · Reserved: {item.reservedQty} · Shortage: <strong className="text-amber-600 font-semibold">{shortage}</strong>
                              </p>
                            </div>
                            <div className="w-24">
                              <label className="block text-[9px] font-semibold text-gray-400 uppercase tracking-wide mb-0.5">Order Qty</label>
                              <input
                                type="number"
                                value={plannerQuantities[item.id] || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  setPlannerQuantities(prev => ({ ...prev, [item.id]: val }));
                                }}
                                className="w-full text-xs font-bold border border-gray-300 rounded px-2.5 py-1 focus:ring-2 focus:ring-blue-500 bg-white text-gray-800"
                                disabled={!isChecked}
                              />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t bg-gray-50/50 flex items-center justify-between flex-shrink-0">
                <button
                  onClick={() => executePORedirection(poConfirmGroup.items.filter(i => plannerCheckedIds.has(i.id)), '', plannerQuantities)}
                  className="px-4 py-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 transition-all"
                >
                  Combine Checked items into Blank PO ({poConfirmGroup.items.filter(i => plannerCheckedIds.has(i.id)).length} items)
                </button>
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setPoConfirmGroup(null)}
                    className="px-4 py-2 text-xs text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const checkedItemsForVendor = poConfirmGroup.items.filter(
                        i => (i.supplierName?.trim() || '') === activePlannerVendor && plannerCheckedIds.has(i.id)
                      );
                      if (checkedItemsForVendor.length === 0) {
                        return toast.error('No items selected for this supplier');
                      }
                      executePORedirection(checkedItemsForVendor, activePlannerVendor, plannerQuantities);
                    }}
                    className="px-5 py-2 text-xs bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md transition-all"
                  >
                    Raise PO for {activePlannerVendor || 'Vendor'} ({poConfirmGroup.items.filter(i => (i.supplierName?.trim() || '') === activePlannerVendor && plannerCheckedIds.has(i.id)).length} items)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {activeTab === 'items' && (
            <div className="p-5 space-y-3">
              {plan.status === 'ACTIVE' && isCreatorOrAdmin && (
                <div className="border border-dashed border-blue-200 rounded-xl p-3 bg-blue-50/20 mb-2">
                  {!showAddForm ? (
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="w-full text-center py-1.5 text-xs text-blue-600 hover:text-blue-800 font-bold flex items-center justify-center gap-1"
                    >
                      ➕ Add Item to Project Plan
                    </button>
                  ) : (
                    <form onSubmit={handleAddNewItem} className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500">Category</label>
                          <select
                            value={newItem.category}
                            onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                            className="w-full border border-gray-300 rounded p-1 text-xs bg-white focus:outline-none"
                          >
                            <option value="RAW_MATERIAL">Raw Material</option>
                            <option value="BOP">BOP Item</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500">Item Name *</label>
                          <input
                            placeholder="e.g. DC Cable"
                            value={newItem.itemName}
                            onChange={e => setNewItem({ ...newItem, itemName: e.target.value })}
                            className="w-full border border-gray-350 rounded p-1 text-xs focus:outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500">Size / Spec</label>
                          <input
                            placeholder="e.g. 4 sq mm"
                            value={newItem.size}
                            onChange={e => setNewItem({ ...newItem, size: e.target.value })}
                            className="w-full border border-gray-350 rounded p-1 text-xs focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500">Planned Qty *</label>
                          <input
                            type="number"
                            placeholder="0"
                            value={newItem.quantity}
                            onChange={e => setNewItem({ ...newItem, quantity: e.target.value })}
                            className="w-full border border-gray-350 rounded p-1 text-xs focus:outline-none"
                            required
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500">Supplier Name</label>
                          <input
                            placeholder="Supplier"
                            value={newItem.supplierName}
                            onChange={e => setNewItem({ ...newItem, supplierName: e.target.value })}
                            className="w-full border border-gray-350 rounded p-1 text-xs focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-gray-500">Remarks</label>
                          <input
                            placeholder="Remarks"
                            value={newItem.remarks}
                            onChange={e => setNewItem({ ...newItem, remarks: e.target.value })}
                            className="w-full border border-gray-350 rounded p-1 text-xs focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-1 border-t">
                        <button
                          type="button"
                          onClick={() => setShowAddForm(false)}
                          className="px-2 py-1 text-[10px] text-gray-500 font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="px-3 py-1 text-[10px] bg-blue-600 hover:bg-blue-700 text-white rounded font-bold"
                        >
                          Add Item
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              )}
              {allItems.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No items in this plan.</p>}
              {allItems.map(item => {
                const inv = plan.inventoryMap?.[item.itemName.toLowerCase()];
                const plannedVal = Number(item.quantity || 0);
                const reservedVal = Number(item.reservedQty || 0);
                const shortageVal = plannedVal - reservedVal;
                const isEligible = isPoEligible(item);
                const isChecked = selectedItemIds.has(item.id);

                return (
                  <div key={item.id} className="border border-gray-200 rounded-lg p-3 flex gap-3 items-start hover:border-gray-300 transition-all">
                    {isEligible && (
                      <input type="checkbox" checked={isChecked} onChange={() => toggleSelectItem(item.id)}
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{item.itemName} {item.size ? `(${item.size})` : ''}</p>
                          <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-2">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${item.category === 'RAW_MATERIAL' ? 'bg-orange-50 text-orange-700' : 'bg-purple-50 text-purple-700'}`}>{item.category}</span>
                            <span>Qty: <strong>{item.quantity}</strong></span>
                            {inv ? (
                              <span className="text-green-600 bg-green-50 px-1.5 py-0.5 rounded font-medium">Stock: {inv.effectiveBalance ?? inv.balance}</span>
                            ) : (
                              <span className="text-red-600 bg-red-50 px-1.5 py-0.5 rounded font-medium">❌ Not in Inventory</span>
                            )}
                          </div>
                          {item.supplierName && <p className="text-xs text-gray-400 mt-0.5">Supplier: {item.supplierName}</p>}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FULFILLMENT_COLORS[item.fulfillmentType] || 'bg-gray-100 text-gray-500'}`}>{item.fulfillmentType}</span>
                          {item.purchaseOrderId && (
                            <a href={`/purchase/edit/${item.purchaseOrderId}`}
                              onClick={e => e.stopPropagation()}
                              className="text-[10px] text-blue-600 hover:text-blue-800 underline font-semibold">
                              PO: {item.poNumber || 'Link'}
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Reservation details & shortage handling */}
                      {reservedVal > 0 && (
                        <div className="mt-2 p-2 bg-blue-50/50 border border-blue-100 rounded-lg">
                          <div className="text-xs text-gray-700 flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-blue-700">🔒 Reserved: {item.reservedQty} units</span>
                            {shortageVal > 0 && (
                              <div className="flex items-center gap-2">
                                <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-medium">
                                  ⚠️ Shortage: {shortageVal} units
                                </span>
                                {item.purchaseOrderId || item.fulfillmentType === 'PURCHASE_ORDER' ? (
                                  <a href={`/purchase/edit/${item.purchaseOrderId}`}
                                    onClick={e => e.stopPropagation()}
                                    className="text-blue-700 bg-blue-50 hover:bg-blue-100 px-1.5 py-0.5 rounded font-semibold underline transition-all">
                                    🛒 PO {item.poNumber || 'Raised'}
                                  </a>
                                ) : (
                                  <button onClick={() => handleMarkPO(item)}
                                    className="px-2 py-0.5 text-[10px] bg-amber-500 text-white rounded hover:bg-amber-600 font-semibold transition-colors">
                                    Raise PO for Shortage
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Action buttons (only when completely pending, and user has permission) */}
                      {plan.status === 'ACTIVE' && item.fulfillmentType === 'PENDING' && (canCreate || isCreatorOrAdmin) && (
                        <div className="flex gap-2 mt-2">
                          {canCreate && (
                            <>
                              <button onClick={() => handleReserve(item)}
                                className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                                Reserve from Inventory
                              </button>
                              <button onClick={() => handleMarkPO(item)}
                                className="px-2 py-1 text-xs bg-amber-500 text-white rounded hover:bg-amber-600 transition-colors">
                                Raise PO
                              </button>
                            </>
                          )}
                          {isCreatorOrAdmin && (
                            <button onClick={() => handleDeleteItem(item.id)}
                              className="px-2 py-1 text-xs bg-red-50 text-red-650 hover:bg-red-100 text-red-700 border border-red-200 rounded font-semibold transition-colors">
                              Delete Item
                            </button>
                          )}
                        </div>
                      )}

                      {/* Assign collection task — only for INVENTORY-reserved items */}
                      {plan.status === 'ACTIVE' && item.fulfillmentType === 'INVENTORY' && (
                        <div className="mt-2 border-t pt-2">
                          {/* Show existing tasks for this item (visible to all) */}
                          {(plan.collectionTasks || []).filter(t => t.projectItemId === item.id).map(task => (
                            <div key={task.id} className={`mb-2 p-2 rounded-lg text-xs flex items-center justify-between gap-2 ${
                              task.status === 'COLLECTED' ? 'bg-green-50 border border-green-200' : 'bg-blue-50 border border-blue-200'
                            }`}>
                              <span>
                                <span className={`font-bold mr-1 ${task.status === 'COLLECTED' ? 'text-green-700' : 'text-blue-700'}`}>
                                  {task.status === 'COLLECTED' ? '✅' : '⏳'}
                                </span>
                                <span className="font-medium text-gray-700">
                                  {task.assignedTo ? `${task.assignedTo.firstName} ${task.assignedTo.lastName}` : 'Unknown'}
                                </span>
                                {' — '}
                                <span>{task.qtyToCollect} units</span>
                                {task.status === 'COLLECTED' && (
                                  <span className="text-green-600 ml-1">(Collected: {task.qtyCollected})</span>
                                )}
                                {task.note && <span className="text-gray-400 ml-1 italic">· {task.note}</span>}
                              </span>
                              <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                task.status === 'COLLECTED' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                              }`}>{task.status}</span>
                            </div>
                          ))}

                          {/* Assignment form — only for users with canCreate */}
                          {canCreate && (
                            assigning === item.id ? (
                              <div className="bg-blue-50/70 rounded-lg p-3 space-y-2">
                                <label className="block text-[10px] font-semibold text-gray-600">Assign Material Collection Task</label>
                                <select value={taskForm.assignedToId} onChange={e => setTaskForm(f => ({ ...f, assignedToId: e.target.value }))}
                                  className="w-full border border-gray-300 rounded text-xs px-2 py-1 bg-white">
                                  <option value="">Select Assignee</option>
                                  {employees.map(u => <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>)}
                                </select>
                                <input type="number" placeholder={`Qty to collect (reserved: ${item.reservedQty})`} value={taskForm.qtyToCollect}
                                  onChange={e => setTaskForm(f => ({ ...f, qtyToCollect: e.target.value }))}
                                  max={item.reservedQty}
                                  className="w-full border border-gray-300 rounded text-xs px-2 py-1" />
                                <input placeholder="Note (optional)" value={taskForm.note}
                                  onChange={e => setTaskForm(f => ({ ...f, note: e.target.value }))}
                                  className="w-full border border-gray-300 rounded text-xs px-2 py-1" />
                                <div className="flex gap-2 pt-1">
                                  <button onClick={() => handleAssignTask(item.id)} className="px-2 py-1 text-xs bg-blue-600 text-white rounded font-medium">Assign</button>
                                  <button onClick={() => setAssigning(null)} className="px-2 py-1 text-xs text-gray-600">Cancel</button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => { setAssigning(item.id); setTaskForm({ assignedToId: '', qtyToCollect: String(item.reservedQty || ''), note: '' }); }}
                                className="px-2 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 mt-1 font-semibold transition-colors">
                                + Assign Collection Task
                              </button>
                            )
                          )}
                        </div>
                      )}

                      {/* Show hint when item is PENDING (not yet reserved) */}
                      {plan.status === 'ACTIVE' && item.fulfillmentType === 'PENDING' && (
                        <p className="text-[10px] text-gray-400 mt-2 italic">Reserve from inventory first to assign a collection task.</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'history' && (
            <div className="p-5 space-y-2">
              {history.length === 0 && <p className="text-sm text-gray-400 text-center py-8">No history yet.</p>}
              {history.map(h => (
                <div key={h.id} className="flex items-start gap-3 text-sm">
                  <span className={`mt-0.5 px-1.5 py-0.5 text-xs rounded font-medium ${h.action === 'COLLECTED' ? 'bg-green-100 text-green-700' : h.action === 'RESERVED' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{h.action}</span>
                  <div>
                    <p className="text-gray-800">{h.itemName || 'Material'} — <strong>{h.qty}</strong> units</p>
                    <p className="text-xs text-gray-400">{h.note} · {new Date(h.createdAt).toLocaleString('en-IN')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sticky Bulk Action Footer Bar */}
        {selectedItemIds.size > 0 && activeTab === 'items' && (
          <div className="bg-blue-50 border-t border-blue-200 p-4 flex items-center justify-between flex-shrink-0 animate-fade-in">
            <div className="text-xs text-blue-800">
              Selected <strong className="text-blue-900">{selectedItemIds.size}</strong> items for PO
            </div>
            <div className="flex gap-2">
              <button onClick={() => setSelectedItemIds(new Set())}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 font-semibold bg-white border rounded-lg transition-all">
                Deselect
              </button>
              <button onClick={handleBulkRaisePO}
                className="px-4 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-all">
                Raise PO for Selected
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── My Collection Tasks Tab ───────────────────────────────────────────────────
function MyCollectionTasks() {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [collectingId, setCollectingId] = useState(null);
  const [collectForm, setCollectForm] = useState({ actualQty: '', note: '' });
  const [statusFilter, setStatusFilter] = useState('');

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const params = statusFilter ? `?status=${statusFilter}` : '';
      const res = await api.get(`/collection-tasks${params}`);
      setTasks(res.data.data || []);
    } catch {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTasks(); }, [statusFilter]);

  const handleMarkCollected = async (taskId) => {
    const qty = Number(collectForm.actualQty);
    if (!qty || qty <= 0) return toast.error('Enter a valid quantity');
    try {
      await api.patch(`/collection-tasks/${taskId}/collect`, {
        actualQty: qty,
        note: collectForm.note || undefined,
      });
      toast.success('Marked as collected! Inventory updated.');
      setCollectingId(null);
      setCollectForm({ actualQty: '', note: '' });
      fetchTasks();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to mark collected');
    }
  };

  const pending = tasks.filter(t => t.status === 'PENDING');
  const collected = tasks.filter(t => t.status === 'COLLECTED');

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <div className="w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-16 text-gray-400">
        <div className="text-5xl mb-3">📦</div>
        <p className="text-lg font-medium">No collection tasks assigned to you</p>
        <p className="text-sm mt-1">When a manager assigns you a material collection task, it will appear here.</p>
      </div>
    );
  }

  const TaskCard = ({ task }) => (
    <div className={`bg-white border rounded-xl p-4 shadow-sm transition-all ${
      task.status === 'COLLECTED' ? 'border-green-200 opacity-75' : 'border-gray-200 hover:border-green-300 hover:shadow-md'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Project & Item */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
              📋 {task.projectName || 'Unknown Project'}
            </span>
            {task.place && (
              <span className="text-[10px] text-gray-400">📍 {task.place}</span>
            )}
          </div>
          <p className="text-sm font-bold text-gray-800">
            {task.itemName}
            {task.size ? <span className="font-normal text-gray-500 ml-1">({task.size})</span> : null}
          </p>
          {task.category && (
            <span className={`mt-1 inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded ${
              task.category === 'RAW_MATERIAL' ? 'bg-orange-50 text-orange-700' : 'bg-purple-50 text-purple-700'
            }`}>{task.category}</span>
          )}
        </div>

        {/* Status badge */}
        <span className={`shrink-0 text-xs px-2 py-1 rounded-full font-semibold ${
          task.status === 'COLLECTED'
            ? 'bg-green-100 text-green-700'
            : 'bg-amber-100 text-amber-700'
        }`}>
          {task.status === 'COLLECTED' ? '✅ Collected' : '⏳ Pending'}
        </span>
      </div>

      {/* Qty details */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-gray-600">
        <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg">
          <span className="text-gray-400">To Collect:</span>
          <span className="font-bold text-gray-800">{task.qtyToCollect} units</span>
        </div>
        {task.status === 'COLLECTED' && (
          <div className="flex items-center gap-1 bg-green-50 px-2 py-1 rounded-lg">
            <span className="text-green-600">Actually Collected:</span>
            <span className="font-bold text-green-700">{task.qtyCollected} units</span>
          </div>
        )}
      </div>

      {/* Note */}
      {task.note && (
        <p className="mt-2 text-xs text-gray-400 italic">Note: {task.note}</p>
      )}

      {/* Assigned date */}
      <p className="mt-1 text-[10px] text-gray-300">
        Assigned: {new Date(task.createdAt).toLocaleString('en-IN')}
        {task.collectedAt && ` · Collected: ${new Date(task.collectedAt).toLocaleString('en-IN')}`}
      </p>

      {/* Mark Collected Action */}
      {task.status === 'PENDING' && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          {collectingId === task.id ? (
            <div className="bg-green-50 rounded-lg p-3 space-y-2">
              <p className="text-[10px] font-bold text-green-700 uppercase tracking-wide">Mark as Collected</p>
              <input
                type="number"
                placeholder={`Actual qty collected (planned: ${task.qtyToCollect})`}
                value={collectForm.actualQty}
                onChange={e => setCollectForm(f => ({ ...f, actualQty: e.target.value }))}
                className="w-full border border-green-200 rounded-lg text-xs px-3 py-2 focus:ring-2 focus:ring-green-400 outline-none bg-white"
              />
              <input
                placeholder="Note (optional)"
                value={collectForm.note}
                onChange={e => setCollectForm(f => ({ ...f, note: e.target.value }))}
                className="w-full border border-green-200 rounded-lg text-xs px-3 py-2 focus:ring-2 focus:ring-green-400 outline-none bg-white"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => handleMarkCollected(task.id)}
                  className="flex-1 py-1.5 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors"
                >
                  ✅ Confirm Collection
                </button>
                <button
                  onClick={() => { setCollectingId(null); setCollectForm({ actualQty: '', note: '' }); }}
                  className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => { setCollectingId(task.id); setCollectForm({ actualQty: String(task.qtyToCollect || ''), note: '' }); }}
              className="w-full py-2 text-xs bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors shadow-sm"
            >
              📦 Mark as Collected
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-gray-500 font-medium">Filter:</span>
        {['', 'PENDING', 'COLLECTED'].map(s => (
          <button key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
              statusFilter === s
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s === '' ? `All (${tasks.length})` : s === 'PENDING' ? `⏳ Pending (${pending.length})` : `✅ Collected (${collected.length})`}
          </button>
        ))}
      </div>

      {/* Task grid */}
      {tasks.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-8">No tasks match this filter.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tasks.map(task => <TaskCard key={task.id} task={task} />)}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProjectPlanning() {
  const { plans, loading, fetchPlans } = useProjectPlanStore();
  const { setSelectedFY: setGlobalFY } = useFYStore();
  const { user } = useAuthStore();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const isAdmin = user?.role === 'ADMIN';
  const canCreate = isAdmin || user?.canCreateProjectPlans;

  const [mainTab, setMainTab] = useState(() => canCreate ? 'projects' : 'my-tasks');

  // Use local FY state for project planning — default 'ALL' so plans from all years are visible
  const [localFY, setLocalFY] = useState('ALL');

  useEffect(() => {
    if (mainTab === 'projects') {
      fetchPlans({ fy: localFY === 'ALL' ? undefined : localFY, status: statusFilter || undefined });
    }
  }, [localFY, statusFilter, mainTab]);

  const handleFYChange = (fy) => {
    setLocalFY(fy);
    setGlobalFY(fy);
  };

  const handleCreated = () => {
    setShowCreate(false);
    fetchPlans({ fy: localFY === 'ALL' ? undefined : localFY });
  };

  const handlePlanRefresh = async () => {
    if (selectedPlan) {
      try {
        const res = await api.get(`/project-plans/${selectedPlan.id}`);
        setSelectedPlan(res.data.data);
      } catch {}
    }
    fetchPlans({ fy: localFY === 'ALL' ? undefined : localFY });
  };

  const handlePlanClick = async (plan) => {
    setSelectedPlan(plan);
    try {
      const res = await api.get(`/project-plans/${plan.id}`);
      setSelectedPlan(res.data.data);
    } catch (err) {
      toast.error('Failed to load project details');
    }
  };

  return (
    <Layout>
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Project Planning</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage material requirements and inventory for projects</p>
        </div>
        {canCreate && mainTab === 'projects' && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 shadow">
            + New Project Plan
          </button>
        )}
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-5">
        {canCreate && (
          <button
            onClick={() => setMainTab('projects')}
            className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
              mainTab === 'projects'
                ? 'border-blue-600 text-blue-700 bg-blue-50/50'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            📋 Project Plans
          </button>
        )}
        <button
          onClick={() => setMainTab('my-tasks')}
          className={`px-4 py-2.5 text-sm font-semibold rounded-t-lg transition-colors border-b-2 -mb-px ${
            mainTab === 'my-tasks'
              ? 'border-green-600 text-green-700 bg-green-50/50'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          📦 My Collection Tasks
        </button>
      </div>

      {/* Projects Tab */}
      {mainTab === 'projects' && (
        <>
          {/* FY + filter bar */}
          <div className="flex flex-wrap items-center gap-4 mb-5 bg-gray-50/50 border border-gray-150 p-3 rounded-xl">
            <FYBanner fy={localFY} onChange={handleFYChange} />
            <div className="h-4 w-px bg-gray-300 hidden md:block"></div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 font-medium">Status:</span>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-2 py-1 bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none">
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="COMPLETE">Complete</option>
                <option value="NOT_COMPLETE">Not Complete</option>
              </select>
            </div>
          </div>

          {/* Plans list */}
          {loading ? (
            <div className="flex justify-center py-16"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
          ) : plans.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">📋</div>
              <p className="text-lg font-medium">No project plans found{localFY !== 'ALL' ? ` for FY ${localFY}` : ''}</p>
              <p className="text-sm mt-1">Create a new plan to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {plans.map(plan => (
                <div key={plan.id} onClick={() => handlePlanClick(plan)}
                  className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm hover:shadow-md cursor-pointer transition-all hover:border-blue-300 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-gray-800 truncate">{plan.projectName}</h3>
                        <p className="text-xs text-gray-500 truncate">{plan.place}</p>
                      </div>
                      <span className={`ml-2 shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[plan.status] || 'bg-gray-100 text-gray-600'}`}>{plan.status}</span>
                    </div>
                    <div className="flex items-center justify-between mt-3 text-xs text-gray-400">
                      <span>{plan.itemCount || 0} items</span>
                      <span>FY {plan.financialYear}</span>
                    </div>
                  </div>

                  {/* Visual Fulfillment Progress Bar */}
                  <div className="mt-4 pt-3 border-t border-gray-100">
                    <div className="flex justify-between items-center text-[10px] text-gray-500 mb-1.5">
                      <span className="font-medium">Fulfillment Status</span>
                      <span className="font-bold text-blue-600 bg-blue-50 px-1 rounded">{plan.progressPercent || 0}%</span>
                    </div>
                    <div className="w-full bg-gray-250 h-2 rounded-full overflow-hidden relative" style={{ backgroundColor: '#f3f4f6' }}>
                      <div
                        className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${plan.progressPercent || 0}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-3 text-xs text-gray-400">
                    By {plan.createdBy ? `${plan.createdBy.firstName} ${plan.createdBy.lastName}` : '—'} · {new Date(plan.createdAt).toLocaleDateString('en-IN')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* My Collection Tasks Tab */}
      {mainTab === 'my-tasks' && <MyCollectionTasks />}

      {/* Modals */}
      {showCreate && <CreatePlanModal onClose={() => setShowCreate(false)} onCreated={handleCreated} />}
      {selectedPlan && (
        <PlanDetailDrawer
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onRefresh={handlePlanRefresh}
        />
      )}
    </Layout>
  );
}
