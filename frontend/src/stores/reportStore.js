import { create } from 'zustand';
import api from '../services/api';

export const useReportStore = create((set, get) => ({
  reports: [],
  todayStats: null,
  isLoading: false,
  error: null,
  pagination: { page: 1, limit: 100, total: 0, pages: 0 },

  fetchReports: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { pagination } = get();
      const query = new URLSearchParams({ page: pagination.page, limit: pagination.limit, ...params });
      const res = await api.get(`/daily-reports?${query}`);
      set({ reports: res.data.data, pagination: res.data.pagination, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch reports', isLoading: false });
    }
  },

  fetchTodayStats: async () => {
    try {
      const res = await api.get('/daily-reports/today');
      set({ todayStats: res.data.data });
    } catch (err) {
      console.error(err);
    }
  },

  submitReport: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/daily-reports', data);
      
      set(state => {
        // If updating an existing today's report
        const isExisting = state.reports.find(r => r.id === res.data.data.id);
        if (isExisting) {
          return { reports: state.reports.map(r => r.id === isExisting.id ? res.data.data : r), isLoading: false };
        }
        return { reports: [res.data.data, ...state.reports], isLoading: false };
      });
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  }
}));
