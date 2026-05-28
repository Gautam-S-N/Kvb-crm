import { create } from 'zustand';
import api from '../services/api';
import useFYStore from './fyStore';

export const useLeadStore = create((set, get) => ({
  leads: [],
  currentLead: null,
  isLoading: false,
  error: null,
  filters: { status: '', source: '', search: '' },
  pagination: { page: 1, limit: 100, total: 0, pages: 0 },

  fetchLeads: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { filters, pagination } = get();
      const fy = useFYStore.getState().selectedFY;
      const queryParams = new URLSearchParams({ page: pagination.page, limit: pagination.limit, fy, ...filters, ...params });
      const response = await api.get(`/leads?${queryParams}`);
      set({ leads: response.data.data, pagination: response.data.pagination, isLoading: false });
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
    }
  },

  getLead: async (id) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.get(`/leads/${id}`);
      set({ currentLead: response.data.data, isLoading: false });
      return response.data.data;
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
      return null;
    }
  },

  // Internal helper — re-fetches the current lead to sync all tabs
  _refetchLead: async (id) => {
    const response = await api.get(`/leads/${id}`);
    set({ currentLead: response.data.data, isLoading: false });
    return response.data.data;
  },

  createLead: async (leadData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post('/leads', leadData);
      set(state => ({ leads: [response.data.data, ...state.leads], isLoading: false }));
      return { success: true, data: response.data.data };
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
      return { success: false, error: error.response?.data?.message };
    }
  },

  updateLead: async (id, updateData) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.put(`/leads/${id}`, updateData);
      set(state => ({
        leads: state.leads.map(l => l.id === id ? response.data.data : l),
        currentLead: state.currentLead?.id === id ? response.data.data : state.currentLead,
        isLoading: false
      }));
      return { success: true, data: response.data.data };
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
      return { success: false, error: error.response?.data?.message };
    }
  },

  assignLead: async (id, assignedToId) => {
    set({ isLoading: true, error: null });
    try {
      const response = await api.post(`/leads/${id}/assign`, { assignedToId });
      set(state => ({
        leads: state.leads.map(l => l.id === id ? response.data.data : l),
        currentLead: state.currentLead?.id === id ? response.data.data : state.currentLead,
        isLoading: false
      }));
      return { success: true };
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
      return { success: false, error: error.response?.data?.message };
    }
  },

  addNote: async (id, content, voiceBlob) => {
    set({ isLoading: true, error: null });
    try {
      let noteContent = content;
      // If a voice blob is provided, upload it first
      if (voiceBlob) {
        const formData = new FormData();
        formData.append('voice', voiceBlob, 'note.webm');
        const uploadRes = await api.post(`/upload/voice/lead_${id}/note`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        noteContent = uploadRes.data.filePath;
      }
      await api.post(`/leads/${id}/notes`, { content: noteContent });
      await get()._refetchLead(id);
      return { success: true };
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
      return { success: false, error: error.response?.data?.message };
    }
  },

  addFollowUp: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/leads/${id}/followups`, data);
      await get()._refetchLead(id);
      return { success: true };
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
      return { success: false };
    }
  },

  logInteraction: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/leads/${id}/interactions`, data);
      await get()._refetchLead(id);
      return { success: true };
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
      return { success: false };
    }
  },

  addLeadProduct: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/leads/${id}/products`, data);
      await get()._refetchLead(id);
      return { success: true };
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
      return { success: false };
    }
  },

  removeLeadProduct: async (leadId, productRecordId) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/leads/${leadId}/products/${productRecordId}`);
      await get()._refetchLead(leadId);
      return { success: true };
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
      return { success: false };
    }
  },

  addTimelineEvent: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      await api.post(`/leads/${id}/timeline`, data);
      await get()._refetchLead(id);
      return { success: true };
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
      return { success: false };
    }
  },

  checkDuplicate: async (phone, email) => {
    try {
      const params = new URLSearchParams();
      if (phone) params.append('phone', phone);
      if (email) params.append('email', email);
      await api.get(`/leads/check-duplicate?${params}`);
      return { exists: false };
    } catch (error) {
      if (error.response?.status === 409) {
        return { exists: true, data: error.response.data.data };
      }
      return { exists: false, error: error.response?.data?.message };
    }
  },

  setFilters: (filters) => set({ filters: { ...get().filters, ...filters } }),
  clearError: () => set({ error: null }),
  clearCurrentLead: () => set({ currentLead: null })
}));