import { create } from 'zustand';
import api from '../services/api';

export const useUserStore = create((set) => ({
  users: [],
  isLoading: false,
  error: null,

  fetchUsers: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/users');
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
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  }
}));
