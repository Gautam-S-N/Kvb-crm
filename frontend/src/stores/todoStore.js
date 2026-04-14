import { create } from 'zustand';
import api from '../services/api';

export const useTodoStore = create((set, get) => ({
  todos: [],
  isLoading: false,
  error: null,

  fetchTodos: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const res = await api.get('/todos', { params });
      set({ todos: res.data.data, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch todos', isLoading: false });
    }
  },

  createTodo: async (data) => {
    try {
      const res = await api.post('/todos', data);
      set((s) => ({ todos: [res.data.data, ...s.todos] }));
      return { success: true, data: res.data.data };
    } catch (err) {
      return { success: false, error: err.response?.data?.message };
    }
  },

  updateTodo: async (id, data) => {
    try {
      const res = await api.put(`/todos/${id}`, data);
      set((s) => ({
        todos: s.todos.map((t) => (t.id === id ? res.data.data : t)),
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.message };
    }
  },

  completeTodo: async (id) => {
    try {
      const res = await api.put(`/todos/${id}/complete`);
      set((s) => ({
        todos: s.todos.map((t) => (t.id === id ? res.data.data : t)),
      }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.message };
    }
  },

  deleteTodo: async (id) => {
    try {
      await api.delete(`/todos/${id}`);
      set((s) => ({ todos: s.todos.filter((t) => t.id !== id) }));
      return { success: true };
    } catch (err) {
      return { success: false, error: err.response?.data?.message };
    }
  },

  toggleChecklist: async (todoId, itemId) => {
    try {
      const res = await api.put(`/todos/${todoId}/checklist/${itemId}/toggle`);
      set((s) => ({
        todos: s.todos.map((t) => {
          if (t.id !== todoId) return t;
          return {
            ...t,
            checklist: t.checklist.map((c) =>
              c.id === itemId ? res.data.data : c
            ),
          };
        }),
      }));
      return { success: true };
    } catch (err) {
      return { success: false };
    }
  },
}));
