import { create } from 'zustand';
import api from '../services/api';

export const useSettingStore = create((set) => ({
  settings: [],
  invoiceCounter: null,   // { currentCount, counterOffset, nextNumber, prefix, dateStr }
  isLoading: false,
  error: null,

  fetchSettings: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/settings');
      set({ settings: res.data.data, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch settings', isLoading: false });
    }
  },

  updateSetting: async (key, data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.put(`/settings/${key}`, data);
      set(state => {
        // If it exists update it, otherwise push
        const exists = state.settings.find(s => s.key === key);
        if (exists) {
          return { settings: state.settings.map(s => s.key === key ? res.data.data : s), isLoading: false };
        }
        return { settings: [...state.settings, res.data.data], isLoading: false };
      });
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  fetchInvoiceCounter: async () => {
    try {
      const res = await api.get('/settings/invoice-counter');
      set({ invoiceCounter: res.data.data });
      return { success: true, data: res.data.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.message };
    }
  },

  setInvoiceCounter: async (nextValue) => {
    try {
      const res = await api.put('/settings/invoice-counter', { nextValue });
      return { success: true, data: res.data.data, message: res.data.data.message };
    } catch (err) {
      return { success: false, error: err.response?.data?.message };
    }
  },
}));
