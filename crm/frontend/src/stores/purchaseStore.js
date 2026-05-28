import { create } from 'zustand';
import api from '../services/api';
import useFYStore from './fyStore';

export const usePurchaseStore = create((set, get) => ({
  vendors: [],
  purchaseOrders: [],
  currentPO: null,
  isLoading: false,
  error: null,
  vendorPagination: { page: 1, limit: 100, total: 0, pages: 0 },
  poPagination: { page: 1, limit: 100, total: 0, pages: 0 },

  // --- Vendors ---
  fetchVendors: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { vendorPagination } = get();
      const query = new URLSearchParams({ page: vendorPagination.page, limit: vendorPagination.limit, ...params });
      const res = await api.get(`/vendors?${query}`);
      set({ vendors: res.data.data, vendorPagination: res.data.pagination, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch vendors', isLoading: false });
    }
  },

  createVendor: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/vendors', data);
      set(state => ({ vendors: [res.data.data, ...state.vendors], isLoading: false }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  updateVendor: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.put(`/vendors/${id}`, data);
      set(state => ({
        vendors: state.vendors.map(v => v.id === id ? res.data.data : v),
        isLoading: false
      }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  deleteVendor: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/vendors/${id}`);
      set(state => ({
        vendors: state.vendors.filter(v => v.id !== id),
        isLoading: false
      }));
      return { success: true };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  // --- Purchase Orders ---
  fetchPurchaseOrders: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { poPagination } = get();
      const fy = useFYStore.getState().selectedFY;
      const query = new URLSearchParams({ page: poPagination.page, limit: poPagination.limit, fy, ...params });
      const res = await api.get(`/purchase?${query}`);
      set({ purchaseOrders: res.data.data, poPagination: res.data.pagination, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch purchase orders', isLoading: false });
    }
  },

  getPurchaseOrder: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get(`/purchase/${id}`);
      set({ currentPO: res.data.data, isLoading: false });
      return res.data.data;
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return null;
    }
  },

  createPurchaseOrder: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/purchase', data);
      set(state => ({ purchaseOrders: [res.data.data, ...state.purchaseOrders], isLoading: false }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  updatePurchaseOrder: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.put(`/purchase/${id}`, data);
      set(state => ({
        purchaseOrders: state.purchaseOrders.map(po => po.id === id ? { ...po, ...res.data.data } : po),
        currentPO: state.currentPO?.id === id ? { ...state.currentPO, ...res.data.data } : state.currentPO,
        isLoading: false
      }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  downloadPOPDF: async (id, poNumber) => {
    try {
      const res = await api.get(`/purchase/${id}/pdf`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const a = document.createElement('a');
      a.href = url; a.download = `PO-${poNumber}.pdf`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert('Failed to download PDF'); }
  },

  downloadPODOCX: async (id, poNumber) => {
    try {
      const res = await api.get(`/purchase/${id}/docx`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }));
      const a = document.createElement('a');
      a.href = url; a.download = `PO-${poNumber}.docx`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert('Failed to download DOCX'); }
  },

  downloadPOXLSX: async (id, poNumber) => {
    try {
      const res = await api.get(`/purchase/${id}/xlsx`, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
      const a = document.createElement('a');
      a.href = url; a.download = `PO-${poNumber}.xlsx`; a.click();
      URL.revokeObjectURL(url);
    } catch (err) { alert('Failed to download XLSX'); }
  },

  clearError: () => set({ error: null }),
  clearCurrentPO: () => set({ currentPO: null })
}));
