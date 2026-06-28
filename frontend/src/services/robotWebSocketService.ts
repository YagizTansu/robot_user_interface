import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from '../config';
import type { Robot } from '../types';

export type { Robot };

interface RobotChangeEvent {
  operationType: 'insert' | 'update' | 'delete' | 'replace';
  documentKey: unknown;
  fullDocument?: Robot;
}

interface RobotErrorEvent {
  message: string;
}

class RobotWebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;

  connect(onRobotsData: (robots: Robot[]) => void, onError: (error: string) => void) {
    if (this.socket) {
      this.disconnect();
    }

    this.socket = io(BACKEND_URL, {
      transports: ['websocket'],
      upgrade: true,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        this.reconnect(onRobotsData, onError);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      onError('Failed to connect to real-time updates');
      this.reconnect(onRobotsData, onError);
    });

    this.socket.on('robots-data', (robots: Robot[]) => {
      onRobotsData(robots);
    });

    this.socket.on('robots-change', (_change: RobotChangeEvent) => {
      // Optional fine-grained updates; full list comes via robots-data.
    });

    this.socket.on('robots-error', (error: RobotErrorEvent) => {
      console.error('Robot data error:', error.message);
      onError(error.message);
    });

    return this.socket;
  }

  private reconnect(onRobotsData: (robots: Robot[]) => void, onError: (error: string) => void) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      onError('Unable to establish real-time connection. Please refresh the page.');
      return;
    }

    this.reconnectAttempts++;
    setTimeout(() => {
      this.connect(onRobotsData, onError);
    }, this.reconnectInterval);
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const robotWebSocketService = new RobotWebSocketService();

export default robotWebSocketService;
