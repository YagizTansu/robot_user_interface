import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import robotWebSocketService from '../services/robotWebSocketService';
import type { Robot } from '../types';

interface RobotWebSocketContextValue {
  robots: Robot[];
  isConnected: boolean;
  connectionError: string | null;
  clientLastSeen: Record<string, number>;
}

const RobotWebSocketContext = createContext<RobotWebSocketContextValue | null>(null);

export function RobotWebSocketProvider({ children }: { children: ReactNode }) {
  const [robots, setRobots] = useState<Robot[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [clientLastSeen, setClientLastSeen] = useState<Record<string, number>>({});

  useEffect(() => {
    return robotWebSocketService.subscribe(
      (robotsData) => {
        const now = Date.now();
        setIsConnected(true);
        setConnectionError(null);
        setRobots(robotsData);
        setClientLastSeen((prev) => {
          const next = { ...prev };
          robotsData.forEach((robot) => {
            next[robot.id] = now;
          });
          return next;
        });
      },
      (message) => {
        setConnectionError(message);
      },
    );
  }, []);

  const value = useMemo(
    () => ({ robots, isConnected, connectionError, clientLastSeen }),
    [robots, isConnected, connectionError, clientLastSeen],
  );

  return (
    <RobotWebSocketContext.Provider value={value}>
      {children}
    </RobotWebSocketContext.Provider>
  );
}

export function useRobotWebSocket(): RobotWebSocketContextValue {
  const ctx = useContext(RobotWebSocketContext);
  if (!ctx) {
    throw new Error('useRobotWebSocket must be used within RobotWebSocketProvider');
  }
  return ctx;
}
