import { create } from 'zustand';
import { io } from 'socket.io-client';
import api from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_URL.replace('/api', '');

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  
  // Queue system for toasts
  toastQueue: [],
  activeToast: null,
  toastTimeoutId: null,

  fetchNotifications: async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data?.success) {
        const notifs = res.data.data.map(n => ({
          id: n.id,
          title: n.title,
          body: n.body,
          link: n.entityType === 'sale' ? `/sales/${n.entityId}` :
                n.entityType === 'task' ? '/tasks' :
                n.entityType === 'lead' ? `/leads/${n.entityId}` :
                n.entityType === 'todo' ? '/todo-list' : '/',
          isRead: n.isRead,
          createdAt: n.createdAt,
          type: n.type
        }));
        
        set({ 
          notifications: notifs,
          unreadCount: notifs.filter(n => !n.isRead).length
        });
      }
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    }
  },

  initSocket: () => {
    const token = localStorage.getItem('token');
    if (!token || get().socket) return;

    // Fetch initial state first
    get().fetchNotifications();

    // Fallback polling every 30s
    if (!get().pollingInterval) {
      const interval = setInterval(() => {
        get().fetchNotifications();
      }, 30000);
      set({ pollingInterval: interval });
    }

    const socket = io(SOCKET_URL, { auth: { token } });

    socket.on('connect', () => {
      console.log('🔔 Notification socket connected');
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
      // Fetch latest on reconnect
      get().fetchNotifications();
    });

    // Handle generic data refresh
    socket.on('REFRESH_DATA', (data) => {
      console.log('🔄 Live UI Refresh triggered:', data);
      window.dispatchEvent(new CustomEvent('REFRESH_DATA', { detail: data }));
    });

    socket.on('notification', (data) => {
      console.log('🔔 Received notification event:', data);
      
      const authUserObj = JSON.parse(localStorage.getItem('auth-storage') || '{}');
      const currentUserId = authUserObj?.state?.user?.id;
      if (data.targetUserId && data.targetUserId !== currentUserId) {
        return; 
      }

      const typeIcons = {
        TASK_ASSIGNED:    '📋',
        TASK_COMPLETED:   '✅',
        PAYMENT_RECEIVED: '💰',
        SALE_STATUS_CHANGED: '🔄',
        LEAD_ASSIGNED:    '👤',
        LEAD_STATUS_CHANGED: '🔄'
      };
      
      const icon = typeIcons[data.type] || '🔔';
      const link =
        data.entityType === 'sale'    ? `/sales/${data.entityId}` :
        data.entityType === 'task'    ? '/tasks' :
        data.entityType === 'lead'    ? `/leads/${data.entityId}` :
        data.entityType === 'todo'    ? '/todo-list' : '/';

      const notif = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        title: data.title || `${icon} Notification`,
        body:  data.body  || '',
        link,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      try {
        if (window.Notification && window.Notification.permission === 'granted') {
          new window.Notification(notif.title, { body: notif.body, icon: '/vite.svg' });
        }
      } catch (err) {}

      try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(800, audioCtx.currentTime); 
          oscillator.frequency.exponentialRampToValueAtTime(1200, audioCtx.currentTime + 0.1); 
          gainNode.gain.setValueAtTime(0.4, audioCtx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.5);
        }
      } catch (e) {}

      // Add to list and unread count
      set(state => ({
        notifications: [notif, ...state.notifications].slice(0, 50),
        unreadCount: state.unreadCount + 1
      }));

      // Queue the toast
      get().queueToast(notif);
    });

    socket.on('permission_updated', async (data) => {
      try {
        const { useAuthStore } = await import('./authStore');
        await useAuthStore.getState().checkAuth();
      } catch (e) {}

      const notif = {
        id: Date.now() + 'perm',
        title: '🔐 Permissions Updated',
        body: data.body || 'Your access permissions have been updated. Changes are now active.',
        link: '/',
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      set(state => ({
        notifications: [notif, ...state.notifications].slice(0, 50),
        unreadCount: state.unreadCount + 1
      }));
      get().queueToast(notif);
    });

    set({ socket });
  },

  queueToast: (notif) => {
    set(state => {
      const newQueue = [...state.toastQueue, notif];
      return { toastQueue: newQueue };
    });
    get().processToastQueue();
  },

  processToastQueue: () => {
    const state = get();
    if (state.activeToast || state.toastQueue.length === 0) return;

    const nextToast = state.toastQueue[0];
    set({ 
      activeToast: nextToast,
      toastQueue: state.toastQueue.slice(1)
    });

    const timeoutId = setTimeout(() => {
      get().clearToast(nextToast.id);
    }, 5500);

    set({ toastTimeoutId: timeoutId });
  },

  clearToast: (id = null) => {
    const state = get();
    // If id is provided, only clear if it matches the active toast
    if (id && state.activeToast?.id !== id) return;

    if (state.toastTimeoutId) {
      clearTimeout(state.toastTimeoutId);
    }
    
    set({ activeToast: null, toastTimeoutId: null });
    
    // Process next toast after a tiny delay for animation
    setTimeout(() => {
      get().processToastQueue();
    }, 300);
  },

  markAllRead: async () => {
    try {
      await api.put('/notifications/read-all');
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, isRead: true })),
        unreadCount: 0,
      }));
    } catch (e) {
      console.error(e);
    }
  },

  markRead: async (id) => {
    // Optimistic update
    set(state => ({
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
    try {
      // Backend update is usually ID but we mapped local IDs slightly differently for socket ones
      // We should really only update backend if it's a UUID from db.
      if (typeof id === 'string' && id.includes('-')) {
        await api.put(`/notifications/${id}/read`);
      }
    } catch (e) {
      console.error(e);
    }
  },

  toggleOpen: () => set(state => ({ isOpen: !state.isOpen })),
  close: () => set({ isOpen: false }),

  destroy: () => {
    const state = get();
    if (state.socket) state.socket.disconnect();
    if (state.pollingInterval) clearInterval(state.pollingInterval);
    if (state.toastTimeoutId) clearTimeout(state.toastTimeoutId);
    set({ socket: null, pollingInterval: null, toastTimeoutId: null });
  },
}));
