import { io, Socket } from 'socket.io-client';

interface Robot {
  id: string;
  name: string;
  status: string;
  battery: number;
  position: { x: number; y: number };
  orientation: number;
  currentTask: string;
  speed: number;
  temperature: number;
  capabilities: {
    maxSpeed: number;
    maxPayload: number;
    sensors: string[];
  };
}

interface RobotChangeEvent {
  operationType: 'insert' | 'update' | 'delete' | 'replace';
  documentKey: any;
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

    console.log('Connecting to WebSocket...');
    this.socket = io('http://localhost:3000', {
      transports: ['websocket'],
      upgrade: true,
      autoConnect: true,
    });

    this.socket.on('connect', () => {
      console.log('Connected to WebSocket server');
      this.reconnectAttempts = 0;
    });

    this.socket.on('disconnect', (reason) => {
      console.log('Disconnected from WebSocket server:', reason);
      
      // Otomatik yeniden bağlanma
      if (reason === 'io server disconnect') {
        // Sunucu tarafından kapatıldıysa manuel yeniden bağlan
        this.reconnect(onRobotsData, onError);
      }
    });

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      onError('Failed to connect to real-time updates');
      this.reconnect(onRobotsData, onError);
    });

    // Robot verilerini dinle
    this.socket.on('robots-data', (robots: Robot[]) => {
      console.log('Received robot data via WebSocket:', robots.length, 'robots');
      
      // Debug: Robot pozisyonlarını logla
      robots.forEach(robot => {
        console.log(`Robot ${robot.id} from backend:`, {
          position: robot.position,
          orientation: robot.orientation,
          status: robot.status
        });
      });
      
      onRobotsData(robots);
    });

    // Robot değişikliklerini dinle (opsiyonel, daha detaylı bilgi için)
    this.socket.on('robots-change', (change: RobotChangeEvent) => {
      console.log('Robot change detected:', change.operationType);
      // Bu event'i istersen daha spesifik aksiyonlar için kullanabilirsin
    });

    // Hata mesajlarını dinle
    this.socket.on('robots-error', (error: RobotErrorEvent) => {
      console.error('Robot data error:', error.message);
      onError(error.message);
    });

    return this.socket;
  }

  private reconnect(onRobotsData: (robots: Robot[]) => void, onError: (error: string) => void) {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      onError('Unable to establish real-time connection. Please refresh the page.');
      return;
    }

    this.reconnectAttempts++;
    console.log(`Attempting to reconnect... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.connect(onRobotsData, onError);
    }, this.reconnectInterval);
  }

  disconnect() {
    if (this.socket) {
      console.log('Disconnecting from WebSocket...');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }

  // Manuel olarak robot verilerini isteme (fallback için)
  requestRobotData() {
    if (this.socket?.connected) {
      this.socket.emit('get-robots');
    }
  }
}

// Singleton instance
export const robotWebSocketService = new RobotWebSocketService();

export default robotWebSocketService;