import { create } from 'zustand';
import api from '../services/api';

export const useMaterialRequestStore = create((set, get) => ({
  requests: [],
  loading:  false,
  error:    null,

  fetchRequests: async (params = {}) => {
    set({ loading: true });
    try {
      const q = new URLSearchParams(params).toString();
      const { data } = await api.get(`/material-requests?${q}`);
      set({ requests: data.data, loading: false });
    } catch (e) {
      set({ error: e.message, loading: false });
    }
  },

  createRequest: async (payload) => {
    const { data } = await api.post('/material-requests', payload);
    await get().fetchRequests();
    return data;
  },

  updateRequest: async (id, payload) => {
    const { data } = await api.put(`/material-requests/${id}`, payload);
    await get().fetchRequests();
    return data;
  },

  updateStatus: async (id, statusPayload, voiceFile) => {
    const form = new FormData();
    Object.entries(statusPayload).forEach(([k, v]) => v && form.append(k, v));
    if (voiceFile) form.append('voiceNote', voiceFile, 'recording.webm');
    const { data } = await api.patch(`/material-requests/${id}/status`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await get().fetchRequests();
    return data;
  },

  toggleItemPurchased: async (requestId, itemId, isPurchased, purchaseNote) => {
    const { data } = await api.patch(
      `/material-requests/${requestId}/items/${itemId}/purchased`,
      { isPurchased, purchaseNote }
    );
    await get().fetchRequests();
    return data;
  },

  deleteRequest: async (id) => {
    await api.delete(`/material-requests/${id}`);
    await get().fetchRequests();
  },
}));
