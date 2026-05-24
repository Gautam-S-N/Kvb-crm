import { create } from 'zustand';
import api from '../services/api';

export const useTargetStore = create((set) => ({
  targets: [],
  isLoading: false,
  error: null,

  fetchTargets: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const query = new URLSearchParams(params);
      const res = await api.get(`/targets?${query}`);
      set({ targets: res.data.data, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch targets', isLoading: false });
    }
  },

  createTarget: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/targets', data);
      set(state => ({ targets: [res.data.data, ...state.targets], isLoading: false }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  updateTarget: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.put(`/targets/${id}`, data);
      set(state => ({
        targets: state.targets.map(t => t.id === id ? { ...t, ...res.data.data } : t),
        isLoading: false
      }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  deleteTarget: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/targets/${id}`);
      set(state => ({
        targets: state.targets.filter(t => t.id !== id),
        isLoading: false
      }));
      return { success: true };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  refreshAttainment: async () => {
    set({ isLoading: true, error: null });
    try {
      await api.post('/targets/refresh');
      // Re-fetch everything to show updated targets
      const res = await api.get('/targets');
      set({ targets: res.data.data, isLoading: false });
      return { success: true };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  }
}));
