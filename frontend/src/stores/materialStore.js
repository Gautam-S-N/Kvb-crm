import { create } from 'zustand';
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true
});

// Add interceptor for token — check both the standalone key and Zustand persist storage
api.interceptors.request.use((config) => {
  let token = localStorage.getItem('token');
  if (!token) {
    try {
      const authStorage = JSON.parse(localStorage.getItem('auth-storage') || '{}');
      token = authStorage?.state?.token;
    } catch (e) {}
  }
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const useMaterialStore = create((set, get) => ({
  materials: [],
  isLoading: false,
  error: null,
  pagination: { page: 1, limit: 100, total: 0, pages: 1 },

  fetchMaterials: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.get('/materials', { params });
      set({ 
        materials: data.data, 
        pagination: data.pagination,
        isLoading: false 
      });
    } catch (err) {
      set({ 
        error: err.response?.data?.message || 'Failed to fetch materials', 
        isLoading: false 
      });
    }
  },

  createMaterial: async (materialData) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/materials', materialData);
      set((state) => ({ 
        materials: [data.data, ...state.materials],
        isLoading: false 
      }));
      return { success: true, data: data.data };
    } catch (err) {
      set({ 
        error: err.response?.data?.message || 'Failed to create material', 
        isLoading: false 
      });
      return { success: false, error: err.response?.data?.message };
    }
  },

  updateMaterial: async (id, materialData) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.put(`/materials/${id}`, materialData);
      set((state) => ({
        materials: state.materials.map(m => m.id === id ? data.data : m),
        isLoading: false
      }));
      return { success: true, data: data.data };
    } catch (err) {
      set({ 
        error: err.response?.data?.message || 'Failed to update material', 
        isLoading: false 
      });
      return { success: false, error: err.response?.data?.message };
    }
  },

  deleteMaterial: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/materials/${id}`);
      set((state) => ({
        materials: state.materials.filter(m => m.id !== id),
        isLoading: false
      }));
      return { success: true };
    } catch (err) {
      set({ 
        error: err.response?.data?.message || 'Failed to delete material', 
        isLoading: false 
      });
      return { success: false, error: err.response?.data?.message };
    }
  },

  updateStock: async (id, amount, type) => {
    try {
      const { data } = await api.patch(`/materials/${id}/stock`, { amount, type });
      set((state) => ({
        materials: state.materials.map(m => m.id === id ? data.data : m),
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.message };
    }
  }
}));
