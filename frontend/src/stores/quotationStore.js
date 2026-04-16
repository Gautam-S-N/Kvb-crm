import { create } from 'zustand';
import api from '../services/api';

export const useQuotationStore = create((set, get) => ({
  quotations: [],
  leadQuotations: [],
  isLoading: false,
  error: null,
  pagination: { page: 1, limit: 20, total: 0, pages: 0 },

  fetchQuotations: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { pagination } = get();
      const queryParams = new URLSearchParams({ page: pagination.page, limit: pagination.limit, ...params });
      const res = await api.get(`/quotations?${queryParams}`);
      set({ quotations: res.data.data, pagination: res.data.pagination, isLoading: false });
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
    }
  },

  fetchLeadQuotations: async (leadId) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get(`/quotations?leadId=${leadId}&limit=50`);
      set({ leadQuotations: res.data.data, isLoading: false });
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
    }
  },

  fetchQuotation: async (id) => {
    try {
      const res = await api.get(`/quotations/${id}`);
      return { success: true, data: res.data.data || res.data };
    } catch (error) {
      return { success: false, error: error.response?.data?.message };
    }
  },

  createQuotation: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/quotations', data);
      // Refresh lead quotations
      if (data.leadId) {
        const listRes = await api.get(`/quotations?leadId=${data.leadId}&limit=50`);
        set({ leadQuotations: listRes.data.data, isLoading: false });
      } else {
        set({ isLoading: false });
      }
      return { success: true, data: res.data.data };
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
      return { success: false, error: error.response?.data?.message };
    }
  },

  downloadPDF: async (id, quotationNumber) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/quotations/${id}/pdf`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quotation-${quotationNumber}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      return { success: true };
    } catch {
      return { success: false, error: 'Failed to download PDF' };
    }
  },

  convertToSale: async (id) => {
    try {
      const res = await api.post(`/quotations/${id}/convert`);
      const saleId = res.data.saleId;
      set(state => ({
        quotations: state.quotations.map(q => q.id === id ? { ...q, status: 'CONVERTED_TO_SALE' } : q),
        leadQuotations: state.leadQuotations.map(q => q.id === id ? { ...q, status: 'CONVERTED_TO_SALE' } : q),
      }));
      return { success: true, saleId };
    } catch (error) {
      return { success: false, error: error.response?.data?.message };
    }
  },
}));
