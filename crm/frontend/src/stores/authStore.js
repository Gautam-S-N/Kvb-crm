import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, token } = response.data.data;
          
          localStorage.setItem('token', token);
          localStorage.setItem('user', JSON.stringify(user));
          
          set({ user, token, isAuthenticated: true, isLoading: false });
          return { success: true };
        } catch (error) {
          set({ 
            error: error.response?.data?.message || 'Login failed', 
            isLoading: false 
          });
          return { success: false, error: error.response?.data?.message };
        }
      },

      logout: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({ user: null, token: null, isAuthenticated: false });
      },

      // Called on every app startup — first restores session from localStorage,
      // then refreshes the user object from the server so permissions are always fresh.
      checkAuth: async () => {
        const token = localStorage.getItem('token');
        const cachedUser = localStorage.getItem('user');
        if (!token || !cachedUser) return;

        // Immediately restore session so the app doesn't flash to /login
        set({ token, user: JSON.parse(cachedUser), isAuthenticated: true });

        // Then fetch the latest user data (with up-to-date permissions) from the server
        try {
          const res = await api.get('/auth/me');
          if (res.data?.data) {
            const freshUser = res.data.data;
            localStorage.setItem('user', JSON.stringify(freshUser));
            set({ user: freshUser });
          }
        } catch {
          // If /me fails (e.g. token expired), log out
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          set({ user: null, token: null, isAuthenticated: false });
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);