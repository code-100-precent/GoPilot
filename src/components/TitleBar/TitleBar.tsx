import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Maximize2 } from 'lucide-react';
import { cn } from '@/utils/cn';

interface TitleBarProps {
  title?: string;
  className?: string;
}

const TitleBar: React.FC<TitleBarProps> = ({ title = 'GoPilot', className }) => {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    // 检查窗口是否最大化
    const checkMaximized = async () => {
      try {
        // 动态导入 Tauri API（仅在 Tauri 环境中可用）
        if (typeof window !== 'undefined' && (window as any).__TAURI__) {
          const windowApi = await import('@tauri-apps/api/window');
          // Tauri 1.x 使用 appWindow
          const appWindow = windowApi.appWindow || (windowApi as any).getCurrentWindow?.();
          if (appWindow) {
            const isMax = await appWindow.isMaximized();
            setIsMaximized(isMax);
          }
        }
      } catch (error) {
        console.error('检查窗口状态失败:', error);
      }
    };

    checkMaximized();

    // 监听窗口状态变化
    const handleResize = async () => {
      await checkMaximized();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleMinimize = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const windowApi = await import('@tauri-apps/api/window');
        const appWindow = (windowApi as any).default || windowApi.appWindow || windowApi;
        if (appWindow && typeof appWindow.minimize === 'function') {
          await appWindow.minimize();
        }
      }
    } catch (error) {
      console.error('最小化窗口失败:', error);
    }
  };

  const handleMaximize = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const windowApi = await import('@tauri-apps/api/window');
        const appWindow = (windowApi as any).default || windowApi.appWindow || windowApi;
        if (appWindow) {
          if (isMaximized) {
            if (typeof appWindow.unmaximize === 'function') {
              await appWindow.unmaximize();
            }
          } else {
            if (typeof appWindow.maximize === 'function') {
              await appWindow.maximize();
            }
          }
          setIsMaximized(!isMaximized);
        }
      }
    } catch (error) {
      console.error('最大化窗口失败:', error);
    }
  };

  const handleClose = async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        const windowApi = await import('@tauri-apps/api/window');
        const appWindow = (windowApi as any).default || windowApi.appWindow || windowApi;
        if (appWindow && typeof appWindow.close === 'function') {
          await appWindow.close();
        }
      }
    } catch (error) {
      console.error('关闭窗口失败:', error);
    }
  };

  return (
    <div
      data-tauri-drag-region
      className={cn(
        'h-8 flex items-center justify-between bg-white dark:bg-gray-800 border-b dark:border-gray-700 select-none',
        className
      )}
    >
      {/* Left side - App info */}
      <div className="flex items-center gap-2 px-3 h-full" data-tauri-drag-region>
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative w-4 h-4 flex-shrink-0">
            <img 
              src="/app-icon.png" 
              alt="GoPilot" 
              className="w-full h-full object-contain"
              onError={(e) => {
                // 如果图标加载失败，显示占位符
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                const placeholder = target.parentElement?.querySelector('.icon-placeholder') as HTMLElement;
                if (placeholder) {
                  placeholder.style.display = 'flex';
                }
              }}
            />
            <div className="icon-placeholder w-full h-full rounded bg-blue-600 flex items-center justify-center hidden absolute inset-0">
              <span className="text-white text-[10px] font-bold">G</span>
            </div>
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 truncate">{title}</span>
        </div>
      </div>

      {/* Right side - Window controls */}
      <div className="flex items-center h-full">
        {/* Minimize button */}
        <button
          onClick={handleMinimize}
          className="h-full w-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title="最小化"
        >
          <Minus className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>

        {/* Maximize/Restore button */}
        <button
          onClick={handleMaximize}
          className="h-full w-10 flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          title={isMaximized ? '还原' : '最大化'}
        >
          {isMaximized ? (
            <Maximize2 className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
          ) : (
            <Square className="w-3.5 h-3.5 text-gray-600 dark:text-gray-400" />
          )}
        </button>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="h-full w-10 flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors"
          title="关闭"
        >
          <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
        </button>
      </div>
    </div>
  );
};

export default TitleBar;

