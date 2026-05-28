import { create } from 'zustand';
import api from '../services/api';
import useFYStore from './fyStore';

export const useTaskStore = create((set, get) => ({
  tasks: [],
  isLoading: false,
  error: null,
  pagination: { page: 1, limit: 100, total: 0, pages: 0 },

  fetchTasks: async (params = {}) => {
    set({ isLoading: true, error: null });
    try {
      const { pagination } = get();
      const fy = useFYStore.getState().selectedFY;
      const query = new URLSearchParams({ page: pagination.page, limit: pagination.limit, fy, ...params });
      const res = await api.get(`/tasks?${query}`);
      set({ tasks: res.data.data, pagination: res.data.pagination, isLoading: false });
    } catch (err) {
      set({ error: err.response?.data?.message || 'Failed to fetch tasks', isLoading: false });
    }
  },

  createTask: async (data, voiceBlob) => {
    set({ isLoading: true, error: null });
    try {
      let assignmentVoiceUrl = null;
      if (voiceBlob) {
        const formData = new FormData();
        formData.append('voice', voiceBlob, 'assignment.webm');
        const uploadRes = await api.post('/upload/voice/new/assignment', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        assignmentVoiceUrl = uploadRes.data.filePath;
      }
      const res = await api.post('/tasks', { ...data, assignmentVoiceUrl });
      set(state => ({ tasks: [res.data.data, ...state.tasks], isLoading: false }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  completeTask: async (id, voiceBlob, textNote, imageFile) => {
    set({ isLoading: true, error: null });
    try {
      let completionVoiceUrl = null;
      let attachmentUrl = null;

      if (voiceBlob) {
        const formData = new FormData();
        formData.append('voice', voiceBlob, 'completion.webm');
        const uploadRes = await api.post(`/upload/voice/${id}/completion`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        completionVoiceUrl = uploadRes.data.filePath;
      }

      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        const uploadRes = await api.post(`/upload/image/${id}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        attachmentUrl = uploadRes.data.filePath;
      }

      const res = await api.put(`/tasks/${id}/complete`, {
        completionVoiceUrl,
        completionVoiceNote: textNote,
        attachmentUrl
      });

      set(state => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, ...res.data.data } : t),
        isLoading: false
      }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  failTask: async (id, reason, voiceBlob) => {
    set({ isLoading: true, error: null });
    try {
      let completionVoiceUrl = null;

      if (voiceBlob) {
        const formData = new FormData();
        formData.append('voice', voiceBlob, 'failure.webm');
        const uploadRes = await api.post(`/upload/voice/${id}/failure`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        completionVoiceUrl = uploadRes.data.filePath;
      }

      const res = await api.put(`/tasks/${id}/fail`, {
        failureReason: reason,
        completionVoiceUrl
      });

      set(state => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, ...res.data.data } : t),
        isLoading: false
      }));
      return { success: true, data: res.data.data };
    } catch (err) {
      set({ error: err.response?.data?.message, isLoading: false });
      return { success: false, error: err.response?.data?.message };
    }
  },

  toggleChecklist: async (taskId, itemId) => {
    try {
      const res = await api.put(`/tasks/${taskId}/checklist/${itemId}`);
      set(state => ({
        tasks: state.tasks.map(t => {
          if (t.id === taskId) {
            return { ...t, checklist: t.checklist.map(c => c.id === itemId ? res.data.data : c) };
          }
          return t;
        })
      }));
    } catch (err) {
      console.error(err);
    }
  }
}));
