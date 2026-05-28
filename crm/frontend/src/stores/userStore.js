import { create } from 'zustand';
import api from '../services/api';

export const useUserStore = create((set, get) => ({
  users: [],
  isLoading: false,
  error: null,

  fetchUsers: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const query = new URLSearchParams(params).toString();
      const res = await api.get(`/users?${query}`);
      set({ users: res.data.data, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch users', isLoading: false });
    }
  },

  createUser: async (data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.post('/users', data);
      set(state => ({ users: [res.data.data, ...state.users], isLoading: false }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  updateUser: async (id, data) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.put(`/users/${id}`, data);
      set(state => ({
        users: state.users.map(u => u.id === id ? { ...u, ...res.data.data } : u),
        isLoading: false
      }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ isLoading: false });
      // Surface the full error payload so UI can detect MANAGER_HAS_SUBORDINATES (409)
      return {
        success: false,
        error: err.response?.data?.message,
        code: err.response?.data?.code,
        subordinateCount: err.response?.data?.subordinateCount,
        status: err.response?.status
      };
    }
  },

  transferSubordinates: async (managerId, newManagerId) => {
    set({ isLoading: true });
    try {
      const res = await api.post(`/users/${managerId}/transfer-subordinates`, { newManagerId });
      // Update the suspended manager in the local store
      set(state => ({
        users: state.users.map(u => u.id === managerId ? { ...u, ...res.data.data } : u),
        isLoading: false
      }));
      return { success: true };
    } catch (err) {
      set({ isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  fetchSubordinates: async () => {
    try {
      const res = await api.get('/users/subordinates/list');
      return res.data.data || [];
    } catch (err) {
      return [];
    }
  },

  deleteUser: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/users/${id}`);
      set(state => ({
        users: state.users.filter(u => u.id !== id),
        isLoading: false
      }));
      return { success: true };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  fetchPermissionAuditLogs: async (userId) => {
    try {
      const res = await api.get(`/users/${userId}/audit`);
      return res.data.data || [];
    } catch (err) {
      return [];
    }
  },
}));
