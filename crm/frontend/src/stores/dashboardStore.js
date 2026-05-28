import { create } from 'zustand';
import api from '../services/api';

export const useDashboardStore = create((set, get) => ({
  metrics: {
    leads: {
      totalLeads: 0,
      openLeads: 0,
      wonLeads: 0,
      lostLeads: 0,
      totalLeadValue: 0,
      openLeadValue: 0,
      wonLeadValue: 0,
      lostLeadValue: 0
    },
    sales: {
      count: 0,
      revenue: 0
    },
    tasks: {
      pending: 0
    }
  },
  activities: [],
  isLoading: false,
  error: null,

  fetchMetrics: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get('/dashboard/metrics');
      set({ metrics: response.data.data, isLoading: false });
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
    }
  },

  fetchActivities: async () => {
    try {
      const response = await api.get('/dashboard/activities');
      set({ activities: response.data.data });
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    }
  },

  clearError: () => set({ error: null })
}));