import { useCallback, useEffect, useState } from 'react';
import { apiFetch, apiFetchNullable } from '../api';
import robotWebSocketService from '../services/robotWebSocketService';
import type { RobotCommand } from '../types';
import { ACTIVE_COMMAND_STATUS_SET } from '../types';

function applyCommandUpdate(
  prev: RobotCommand | null,
  cmd: RobotCommand,
  robotName: string,
): RobotCommand | null {
  if (cmd.robot_name !== robotName) return prev;
  if (ACTIVE_COMMAND_STATUS_SET.has(cmd.status)) return cmd;
  if (prev?._id === cmd._id) return null;
  return prev;
}

/** Active command for a single robot — initial REST load + WebSocket push. */
export function useActiveCommand(robotName: string | null | undefined) {
  const [activeCommand, setActiveCommand] = useState<RobotCommand | null>(null);

  const refreshActiveCommand = useCallback(async () => {
    if (!robotName) {
      setActiveCommand(null);
      return;
    }
    try {
      const cmd = await apiFetchNullable<RobotCommand>(
        `/commands/active/${encodeURIComponent(robotName)}`,
      );
      if (cmd && ACTIVE_COMMAND_STATUS_SET.has(cmd.status)) {
        setActiveCommand(cmd);
      } else {
        setActiveCommand(null);
      }
    } catch {
      /* ignore */
    }
  }, [robotName]);

  useEffect(() => {
    if (!robotName) {
      setActiveCommand(null);
      return;
    }

    void refreshActiveCommand();

    return robotWebSocketService.subscribeCommandUpdates((cmd) => {
      setActiveCommand((prev) => applyCommandUpdate(prev, cmd, robotName));
    });
  }, [robotName, refreshActiveCommand]);

  return { activeCommand, setActiveCommand, refreshActiveCommand };
}

/** Latest command per robot — initial batch load + WebSocket push. */
export function useLatestCommands(robotNames: string[]) {
  const [latestCommands, setLatestCommands] = useState<Record<string, RobotCommand | null>>({});
  const namesKey = robotNames.join(',');

  useEffect(() => {
    if (!robotNames.length) {
      setLatestCommands({});
      return;
    }

    const load = async () => {
      const entries = await Promise.all(
        robotNames.map(async (name) => {
          try {
            const cmd = await apiFetchNullable<RobotCommand>(
              `/commands/latest/${encodeURIComponent(name)}`,
            );
            return [name, cmd] as const;
          } catch {
            return [name, null] as const;
          }
        }),
      );
      setLatestCommands(Object.fromEntries(entries));
    };

    void load();

    return robotWebSocketService.subscribeCommandUpdates((cmd) => {
      setLatestCommands((prev) => ({
        ...prev,
        [cmd.robot_name]: cmd,
      }));
    });
  }, [namesKey]);

  return latestCommands;
}

/** Command detail panel: active command + history with WebSocket refresh. */
export function useRobotCommandDetail(robotName: string | null) {
  const { activeCommand, refreshActiveCommand } = useActiveCommand(robotName);
  const [commandHistory, setCommandHistory] = useState<RobotCommand[]>([]);

  const refreshHistory = useCallback(async () => {
    if (!robotName) {
      setCommandHistory([]);
      return;
    }
    try {
      const history = await apiFetch<RobotCommand[]>(
        `/commands?robot_name=${encodeURIComponent(robotName)}`,
      );
      setCommandHistory(history);
    } catch {
      /* ignore */
    }
  }, [robotName]);

  useEffect(() => {
    if (!robotName) {
      setCommandHistory([]);
      return;
    }
    void refreshHistory();
  }, [robotName, refreshHistory]);

  useEffect(() => {
    if (!robotName) return;
    return robotWebSocketService.subscribeCommandUpdates((cmd) => {
      if (cmd.robot_name !== robotName) return;
      setCommandHistory((prev) => {
        const idx = prev.findIndex((c) => c._id === cmd._id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = cmd;
          return next;
        }
        return [cmd, ...prev];
      });
    });
  }, [robotName]);

  return {
    activeCommand,
    commandHistory,
    refreshActiveCommand,
    refreshHistory,
  };
}
