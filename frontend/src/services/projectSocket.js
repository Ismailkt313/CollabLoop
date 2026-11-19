import { io } from 'socket.io-client';

class ProjectSocketService {
  constructor() {
    this.socket = null;
    this.currentProjectId = null;
    this.currentChannelId = null;
    this.listeners = new Map();
  }

  /**
   * Connect to the Socket.IO server with session cookies or auth token.
   */
  connect() {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    // Connect to backend server (or same origin via Vite proxy in development)
    const socketUrl =
      import.meta.env.VITE_SOCKET_URL ||
      import.meta.env.VITE_BACKEND_URL ||
      (import.meta.env.VITE_API_BASE_URL ? import.meta.env.VITE_API_BASE_URL.replace(/\/api\/?$/, '') : null) ||
      (import.meta.env.PROD ? 'https://collabloop-zov6.onrender.com' : undefined);
    this.socket = io(socketUrl || undefined, {
      withCredentials: true,
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      // Re-join project and channel rooms if previously connected
      if (this.currentProjectId) {
        this.joinProject(this.currentProjectId);
      }
      if (this.currentProjectId && this.currentChannelId) {
        this.joinChannel(this.currentProjectId, this.currentChannelId);
      }
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.currentProjectId = null;
    this.currentChannelId = null;
  }

  joinProject(projectId) {
    if (!this.socket) this.connect();
    this.currentProjectId = projectId;
    this.socket.emit('project:join', { projectId });
  }

  leaveProject(projectId) {
    if (this.socket) {
      this.socket.emit('project:leave', { projectId });
    }
    if (this.currentProjectId === projectId) {
      this.currentProjectId = null;
    }
  }

  joinChannel(projectId, channelId) {
    if (!this.socket) this.connect();
    if (this.currentChannelId && this.currentChannelId !== channelId) {
      this.leaveChannel(projectId, this.currentChannelId);
    }
    this.currentChannelId = channelId;
    this.socket.emit('channel:join', { projectId, channelId });
  }

  leaveChannel(projectId, channelId) {
    if (this.socket) {
      this.socket.emit('channel:leave', { projectId, channelId });
    }
    if (this.currentChannelId === channelId) {
      this.currentChannelId = null;
    }
  }

  sendMessage({ projectId, channelId, text, attachments = [], mentions = [], replyTo = null, messageType = 'text' }) {
    return new Promise((resolve, reject) => {
      if (!this.socket) this.connect();
      this.socket.emit(
        'message:send',
        {
          projectId,
          channelId,
          message: {
            text,
            attachments,
            mentions,
            replyTo,
            messageType,
          },
        },
        (response) => {
          if (response?.error) {
            reject(new Error(response.error));
          } else {
            resolve(response?.message);
          }
        }
      );
    });
  }

  editMessage({ projectId, channelId, messageId, text }) {
    return new Promise((resolve, reject) => {
      if (!this.socket) this.connect();
      this.socket.emit(
        'message:edit',
        { projectId, channelId, messageId, text },
        (response) => {
          if (response?.error) {
            reject(new Error(response.error));
          } else {
            resolve(response?.message);
          }
        }
      );
    });
  }

  deleteMessage({ projectId, channelId, messageId }) {
    return new Promise((resolve, reject) => {
      if (!this.socket) this.connect();
      this.socket.emit(
        'message:delete',
        { projectId, channelId, messageId },
        (response) => {
          if (response?.error) {
            reject(new Error(response.error));
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  startTyping({ projectId, channelId, name, username }) {
    if (this.socket) {
      this.socket.emit('typing:start', { projectId, channelId, name, username });
    }
  }

  stopTyping({ projectId, channelId }) {
    if (this.socket) {
      this.socket.emit('typing:stop', { projectId, channelId });
    }
  }

  markAsRead({ projectId, channelId }) {
    if (this.socket) {
      this.socket.emit('messages:read', { projectId, channelId });
    }
  }

  on(event, handler) {
    if (!this.socket) this.connect();
    this.socket.on(event, handler);
  }

  off(event, handler) {
    if (this.socket) {
      this.socket.off(event, handler);
    }
  }
}

export const projectSocket = new ProjectSocketService();
export default projectSocket;
