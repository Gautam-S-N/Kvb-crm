import { create } from 'zustand';
import api from '../services/api';

export const usePurchaseItemStore = create((set, get) => ({
  items: [],
  isLoading: false,
  error: null,

  fetchItems: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const query = new URLSearchParams(params);
      const res = await api.get(`/purchase-items?${query}`);
      set({ items: res.data.data, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.error || 'Failed to fetch items', isLoading: false });
    }
  },

  createItem: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/purchase-items', data);
      set(state => ({ items: [...state.items, res.data.data], isLoading: false }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.error, isLoading: false });
      return { success: false, error: err.response?.data?.error };
    }
  },

  updateItem: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.put(`/purchase-items/${id}`, data);
      set(state => ({
        items: state.items.map(it => it.id === id ? res.data.data : it),
        isLoading: false
      }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.error, isLoading: false });
      return { success: false, error: err.response?.data?.error };
    }
  },

  deleteItem: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/purchase-items/${id}`);
      set(state => ({ items: state.items.filter(it => it.id !== id), isLoading: false }));
      return { success: true };
    } catch (err) {
      set({ error: err.response?.data?.error, isLoading: false });
      return { success: false, error: err.response?.data?.error };
    }
  },

  clearError: () => set({ error: null }),
}));
