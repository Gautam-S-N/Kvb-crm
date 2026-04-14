import { create } from 'zustand';
import api from '../services/api';

export const useProductStore = create((set, get) => ({
  products: [],
  currentProduct: null,
  isLoading: false,
  error: null,

  fetchProducts: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const queryParams = new URLSearchParams(params);
      const response = await api.get(`/products?${queryParams}`);
      set({ products: response.data.data, isLoading: false });
    } catch (error) {
      set({ error: error.response?.data?.message, isLoading: false });
    }
  },

  getProduct: async (id) => {
    try {
      const response = await api.get(`/products/${id}`);
      set({ currentProduct: response.data.data });
      return response.data.data;
    } catch (error) {
      console.error('Failed to fetch product:', error);
      return null;
    }
  },

  clearError: () => set({ error: null })
}));