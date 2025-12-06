import { useState, useEffect, useCallback } from 'react';

const HISTORY_KEY = 'gopilot_terminal_history';
const MAX_HISTORY_SIZE = 1000;

export interface TerminalHistory {
  commands: string[];
}

export const useTerminalHistory = () => {
  const [history, setHistory] = useState<string[]>([]);

  // 加载历史记录
  useEffect(() => {
    try {
      const stored = localStorage.getItem(HISTORY_KEY);
      if (stored) {
        const parsed: TerminalHistory = JSON.parse(stored);
        setHistory(parsed.commands || []);
      }
    } catch (error) {
      console.error('Failed to load terminal history:', error);
    }
  }, []);

  // 添加命令到历史
  const addCommand = useCallback((command: string) => {
    if (!command.trim()) return;

    setHistory(prev => {
      // 移除重复的命令（如果存在）
      const filtered = prev.filter(cmd => cmd !== command);
      // 添加到开头，限制大小
      const newHistory = [command, ...filtered].slice(0, MAX_HISTORY_SIZE);
      
      // 保存到 localStorage
      try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify({ commands: newHistory }));
      } catch (error) {
        console.error('Failed to save terminal history:', error);
      }
      
      return newHistory;
    });
  }, []);

  // 清空历史
  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (error) {
      console.error('Failed to clear terminal history:', error);
    }
  }, []);

  return {
    history,
    addCommand,
    clearHistory,
  };
};

