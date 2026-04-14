import { create } from 'zustand';
import api from '../services/api';

export const useCampaignStore = create((set, get) => ({
  campaigns: [],
  isLoading: false,
  error: null,
  pagination: { page: 1, limit: 20, total: 0, pages: 0 },

  fetchCampaigns: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { pagination } = get();
      const query = new URLSearchParams({ page: pagination.page, limit: pagination.limit, ...params });
      const res = await api.get(`/bulk-messages?${query}`);
      set({ campaigns: res.data.data, pagination: res.data.pagination, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch campaigns', isLoading: false });
    }
  },

  createCampaign: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/bulk-messages', data);
      set(state => ({ campaigns: [res.data.data, ...state.campaigns], isLoading: false }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  }
}));
