import { useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from './useLocalStorage';

export interface RecentFile {
  path: string;
  name: string;
  lastOpened: number;
}

const MAX_RECENT_FILES = 10;

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useLocalStorage<RecentFile[]>('gopilot_recent_files', []);

  const addRecentFile = useCallback((path: string, name: string) => {
    setRecentFiles((prev) => {
      // 移除已存在的相同文件
      const filtered = prev.filter((f) => f.path !== path);
      
      // 添加新文件到开头
      const updated = [
        { path, name, lastOpened: Date.now() },
        ...filtered,
      ];
      
      // 限制数量
      return updated.slice(0, MAX_RECENT_FILES);
    });
  }, [setRecentFiles]);

  const removeRecentFile = useCallback((path: string) => {
    setRecentFiles((prev) => prev.filter((f) => f.path !== path));
  }, [setRecentFiles]);

  const clearRecentFiles = useCallback(() => {
    setRecentFiles([]);
  }, [setRecentFiles]);

  return {
    recentFiles,
    addRecentFile,
    removeRecentFile,
    clearRecentFiles,
  };
}

