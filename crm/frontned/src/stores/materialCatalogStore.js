import { create } from 'zustand';
import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  withCredentials: true
});

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

export const useMaterialCatalogStore = create((set, get) => ({
  materials: [],
  isLoading: false,
  error: null,
  pagination: { page: 1, limit: 1000, total: 0, pages: 1 },

  fetchMaterials: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { pagination } = get();
      const { data } = await api.get('/material-catalog', { params: { limit: pagination.limit, page: pagination.page, ...params } });
      set({ 
        materials: data.data, 
        pagination: data.pagination,
        isLoading: false 
      });
    } catch (err) {
      set({ 
        error: err.response?.data?.message || 'Failed to fetch catalog materials', 
        isLoading: false 
      });
    }
  },

  createMaterial: async (materialData) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.post('/material-catalog', materialData);
      set((state) => ({ 
        materials: [data.data, ...state.materials],
        isLoading: false 
      }));
      return { success: true, data: data.data };
    } catch (err) {
      set({ 
        error: err.response?.data?.message || 'Failed to create catalog material', 
        isLoading: false 
      });
      return { success: false, error: err.response?.data?.message };
    }
  },

  updateMaterial: async (id, materialData) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await api.put(`/material-catalog/${id}`, materialData);
      set((state) => ({
        materials: state.materials.map(m => m.id === id ? data.data : m),
        isLoading: false
      }));
      return { success: true, data: data.data };
    } catch (err) {
      set({ 
        error: err.response?.data?.message || 'Failed to update catalog material', 
        isLoading: false 
      });
      return { success: false, error: err.response?.data?.message };
    }
  },

  deleteMaterial: async (id) => {
    set({ isLoading: true, error: null });
    try {
      await api.delete(`/material-catalog/${id}`);
      set((state) => ({
        materials: state.materials.filter(m => m.id !== id),
        isLoading: false
      }));
      return { success: true };
    } catch (err) {
      set({ 
        error: err.response?.data?.message || 'Failed to delete catalog material', 
        isLoading: false 
      });
      return { success: false, error: err.response?.data?.message };
    }
  }
}));
