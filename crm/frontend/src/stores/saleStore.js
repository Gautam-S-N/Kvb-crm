import { create } from 'zustand';
import api from '../services/api';
import useFYStore from './fyStore';

export const useSaleStore = create((set, get) => ({
  sales: [],
  productSummary: [],
  currentSale: null,
  isLoading: false,
  error: null,
  pagination: { page: 1, limit: 100, total: 0, pages: 0 },

  fetchSales: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { pagination } = get();
      const fy = useFYStore.getState().selectedFY;
      const query = new URLSearchParams({ page: pagination.page, limit: pagination.limit, fy, ...params });
      const res = await api.get(`/sales?${query}`);
      set({ sales: res.data.data, pagination: res.data.pagination, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
    }
  },

  fetchProductSummary: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/sales/product-summary');
      set({ productSummary: res.data.data, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
    }
  },

  getSale: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get(`/sales/${id}`);
      set({ currentSale: res.data.data, isLoading: false });
      return res.data.data;
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return null;
    }
  },

  createSale: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/sales', data);
      set(state => ({ sales: [res.data.data, ...state.sales], isLoading: false }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  updateSale: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.put(`/sales/${id}`, data);
      set(state => ({
        sales: state.sales.map(s => s.id === id ? res.data.data : s),
        currentSale: state.currentSale?.id === id ? res.data.data : state.currentSale,
        isLoading: false
      }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  recordPayment: async (saleId, paymentData) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post(`/sales/${saleId}/payments`, paymentData);
      // Refresh current sale
      const saleRes = await api.get(`/sales/${saleId}`);
      set({ currentSale: saleRes.data.data, isLoading: false });
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  clearError: () => set({ error: null }),
  clearCurrentSale: () => set({ currentSale: null })
}));
