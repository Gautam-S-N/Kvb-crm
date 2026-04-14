import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useAuthStore } from '../stores/authStore';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export const useSocket = () => {
  const socketRef = useRef(null);
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token) return;

    // Initialize socket connection
    socketRef.current = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current.id);
    });

    socketRef.current.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socketRef.current.on('error', (error) => {
      console.error('Socket error:', error);
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [token]);

  const subscribeToNotifications = (callback) => {
    if (!socketRef.current) return;
    
    socketRef.current.on('notification', (data) => {
      callback(data);
    });
  };

  const unsubscribeFromNotifications = () => {
    if (!socketRef.current) return;
    socketRef.current.off('notification');
  };

  return {
    socket: socketRef.current,
    subscribeToNotifications,
    unsubscribeFromNotifications,
  };
};