import { create } from 'zustand';
import { io } from 'socket.io-client';
import api from '../services/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const SOCKET_URL = API_URL.replace('/api', '');

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isOpen: false,
  activeToast: null,

  initSocket: () => {
    const token = localStorage.getItem('token');
    if (!token || get().socket) return;

    const socket = io(SOCKET_URL, { auth: { token } });

    socket.on('connect', () => {
      console.log('🔔 Notification socket connected');
      // Ask for native notification permission
      if (Notification.permission === 'default') {
        Notification.requestPermission();
      }
    });

    // ── Generic 'notification' event (used by todo reminders, task events, etc.) ──
    socket.on('notification', (data) => {
      // If we are broadcasting globally but it's meant for a specific user, filter it:
      const authUserObj = JSON.parse(localStorage.getItem('auth-storage') || '{}');
      const currentUserId = authUserObj?.state?.user?.id;
      if (data.targetUserId && data.targetUserId !== currentUserId) {
        return; // Skip if not meant for this user
      }

      const typeIcons = {
        TASK_ASSIGNED:    '📋',
        TASK_COMPLETED:   '✅',
        PAYMENT_RECEIVED: '💰',
        SALE_STATUS_CHANGED: '🔄',
      };
      const icon = typeIcons[data.type] || '🔔';
      const link =
        data.entityType === 'sale'    ? `/sales/${data.entityId}` :
        data.entityType === 'task'    ? '/tasks' :
        data.entityType === 'todo'    ? '/todo-list' : '/';

      const notif = {
        id: Date.now(),
        title: data.title || `${icon} Notification`,
        body:  data.body  || '',
        link,
        isRead: false,
        createdAt: new Date().toISOString(),
      };

      // 1. Send native OS notification safely
      try {
        if (window.Notification && window.Notification.permission === 'granted') {
          new window.Notification(notif.title, { body: notif.body, icon: '/vite.svg' });
        }
      } catch (err) {
        console.warn("Native notification blocked:", err);
      }

      // 2. Play a subtle synthesized "ding" safely
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
      } catch (e) {
        console.warn("Audio play blocked", e);
      }

      // 3. Add to dropdown and show toast pop-up
      get().addNotification(notif);
      set({ activeToast: notif });

      // Auto-hide toast after 5s
      setTimeout(() => {
        if (get().activeToast?.id === notif.id) {
          set({ activeToast: null });
        }
      }, 5500);
    });

    set({ socket });
  },

  clearToast: () => set({ activeToast: null }),

  addNotification: (notification) => {
    set(state => ({
      notifications: [notification, ...state.notifications].slice(0, 20),
      unreadCount: state.unreadCount + 1,
    }));
  },

  markAllRead: () => {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, isRead: true })),
      unreadCount: 0,
    }));
  },

  markRead: (id) => {
    set(state => ({
      notifications: state.notifications.map(n =>
        n.id === id ? { ...n, isRead: true } : n
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  toggleOpen: () => set(state => ({ isOpen: !state.isOpen })),
  close: () => set({ isOpen: false }),

  destroy: () => {
    const { socket } = get();
    if (socket) socket.disconnect();
    set({ socket: null });
  },
}));
