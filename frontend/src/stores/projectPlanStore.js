import { create } from 'zustand';
import api from '../services/api';

// ── Helper: compute current FY client-side ────────────────────────────────────
export function getCurrentFY() {
  const now  = new Date();
  const month = now.getMonth(); // 0 = Jan, 3 = April
  const year  = now.getFullYear();
  return month >= 3
    ? `${year}-${String(year + 1).slice(2)}`
    : `${year - 1}-${String(year).slice(2)}`;
}

// ── Build a sorted list of FY options (last 3 years + current + next) ─────────
export function getFYOptions() {
  const now    = new Date();
  const month  = now.getMonth();
  const year   = now.getFullYear();
  const curStart = month >= 3 ? year : year - 1;

  const options = [];
  for (let y = curStart - 2; y <= curStart + 1; y++) {
    options.push(`${y}-${String(y + 1).slice(2)}`);
  }
  return options.reverse(); // newest first
}

const useProjectPlanStore = create((set, get) => ({
  plans: [],
  pagination: { total: 0, page: 1, limit: 100 },
  selectedFY: getCurrentFY(),
  loading: false,
  error: null,

  // ── Selected plan detail ──────────────────────────────────────────────────
  currentPlan: null,
  currentPlanLoading: false,

  setSelectedFY: (fy) => set({ selectedFY: fy }),

  fetchPlans: async (params = {}) => {
    set({ loading: true, error: null });
    try {
      const fy     = params.fy || get().selectedFY;
      const status = params.status || undefined;
      const page   = params.page   || 1;
      const limit  = params.limit  || 100;

      const query = new URLSearchParams({ fy, page, limit });
      if (status) query.set('status', status);

      const res = await api.get(`/project-plans?${query.toString()}`);
      set({
        plans:      res.data.data,
        pagination: res.data.pagination,
        loading:    false,
      });
    } catch (err) {
      set({ error: err.response?.data?.message || err.message, loading: false });
    }
  },

  fetchPlanById: async (id) => {
    set({ currentPlanLoading: true, error: null });
    try {
      const res = await api.get(`/project-plans/${id}`);
      set({ currentPlan: res.data.data, currentPlanLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || err.message, currentPlanLoading: false });
    }
  },

  createPlan: async (data) => {
    const res = await api.post('/project-plans', data);
    return res.data;
  },

  updatePlan: async (id, data) => {
    const res = await api.put(`/project-plans/${id}`, data);
    return res.data;
  },

  deletePlan: async (id) => {
    const res = await api.delete(`/project-plans/${id}`);
    return res.data;
  },

  updatePlanStatus: async (id, status) => {
    const res = await api.patch(`/project-plans/${id}/status`, { status });
    return res.data;
  },

  // ── Item actions ──────────────────────────────────────────────────────────
  addItems: async (planId, items) => {
    const res = await api.post(`/project-plans/${planId}/items`, { items });
    return res.data;
  },

  updateItem: async (planId, itemId, data) => {
    const res = await api.put(`/project-plans/${planId}/items/${itemId}`, data);
    return res.data;
  },

  removeItem: async (planId, itemId) => {
    const res = await api.delete(`/project-plans/${planId}/items/${itemId}`);
    return res.data;
  },

  // ── Fulfillment ───────────────────────────────────────────────────────────
  reserveFromInventory: async (planId, itemId) => {
    const res = await api.post(`/project-plans/${planId}/items/${itemId}/reserve`);
    return res.data;
  },

  markPO: async (planId, itemId, purchaseOrderId = null) => {
    const res = await api.post(`/project-plans/${planId}/items/${itemId}/po`, { purchaseOrderId });
    return res.data;
  },

  assignCollectionTask: async (planId, itemId, data) => {
    const res = await api.post(`/project-plans/${planId}/items/${itemId}/collection-tasks`, data);
    return res.data;
  },

  // ── History ───────────────────────────────────────────────────────────────
  fetchPlanHistory: async (planId) => {
    const res = await api.get(`/project-plans/${planId}/history`);
    return res.data.data;
  },

  clearCurrentPlan: () => set({ currentPlan: null }),
}));

export default useProjectPlanStore;
