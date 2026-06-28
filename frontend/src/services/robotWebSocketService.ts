import { io, Socket } from 'socket.io-client';
import { BACKEND_URL } from '../config';
import type { Robot, RobotCommand } from '../types';

export type { Robot };

type RobotsListener = (robots: Robot[]) => void;
type ErrorListener = (message: string) => void;
type CommandListener = (command: RobotCommand) => void;

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
  private robotsSubscriberCount = 0;
  private commandSubscriberCount = 0;
  private robotsListeners = new Set<RobotsListener>();
  private commandListeners = new Set<CommandListener>();
  private errorListeners = new Set<ErrorListener>();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private lastRobots: Robot[] = [];

  subscribe(onRobotsData: RobotsListener, onError?: ErrorListener): () => void {
    this.robotsSubscriberCount += 1;
    this.robotsListeners.add(onRobotsData);
    if (onError) this.errorListeners.add(onError);

    if (this.lastRobots.length > 0) {
      onRobotsData(this.lastRobots);
    }

    this.ensureConnected();

    return () => {
      this.robotsSubscriberCount = Math.max(0, this.robotsSubscriberCount - 1);
      this.robotsListeners.delete(onRobotsData);
      if (onError) this.errorListeners.delete(onError);
      this.disconnectIfIdle();
    };
  }

  subscribeCommandUpdates(listener: CommandListener): () => void {
    this.commandSubscriberCount += 1;
    this.commandListeners.add(listener);
    this.ensureConnected();

    return () => {
      this.commandSubscriberCount = Math.max(0, this.commandSubscriberCount - 1);
      this.commandListeners.delete(listener);
      this.disconnectIfIdle();
    };
  }

  private disconnectIfIdle() {
    if (this.robotsSubscriberCount === 0 && this.commandSubscriberCount === 0) {
      this.disconnect();
    }
  }

  private ensureConnected() {
    if (this.socket) return;

    this.socket = io(BACKEND_URL, {
      transports: ['websocket'],
      upgrade: true,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect' && this.hasSubscribers()) {
        this.scheduleReconnect();
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      this.emitError('Failed to connect to real-time updates');
      this.scheduleReconnect();
    });

    this.socket.on('robots-data', (robots: Robot[]) => {
      this.lastRobots = robots;
      this.robotsListeners.forEach((listener) => listener(robots));
    });

    this.socket.on('robots-change', (_change: RobotChangeEvent) => {
      // Full list is broadcast via robots-data.
    });

    this.socket.on('robots-error', (error: RobotErrorEvent) => {
      console.error('Robot data error:', error.message);
      this.emitError(error.message);
    });

    this.socket.on('command-update', (command: RobotCommand) => {
      this.commandListeners.forEach((listener) => listener(command));
    });
  }

  private hasSubscribers() {
    return this.robotsSubscriberCount > 0 || this.commandSubscriberCount > 0;
  }

  private scheduleReconnect() {
    if (!this.hasSubscribers()) return;
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.emitError('Unable to establish real-time connection. Please refresh the page.');
      return;
    }

    this.reconnectAttempts += 1;
    this.disconnectSocketOnly();
    setTimeout(() => {
      if (this.hasSubscribers()) this.ensureConnected();
    }, this.reconnectInterval);
  }

  private emitError(message: string) {
    this.errorListeners.forEach((listener) => listener(message));
  }

  private disconnectSocketOnly() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  disconnect() {
    this.disconnectSocketOnly();
    this.reconnectAttempts = 0;
    this.lastRobots = [];
  }

  isConnected(): boolean {
    return this.socket?.connected ?? false;
  }
}

export const robotWebSocketService = new RobotWebSocketService();

export default robotWebSocketService;
