import React, { useState } from 'react';
import { X, Circle } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface Tab {
  id: string;
  path: string;
  name: string;
  isModified?: boolean;
}

interface TabBarProps {
  tabs: Tab[];
  activeTabId?: string;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onCloseAll?: () => void;
  className?: string;
}

const TabBar: React.FC<TabBarProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  onCloseAll,
  className,
}) => {
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setContextMenu(null);
      }
    };

    if (contextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [contextMenu]);

  // 关闭菜单
  const handleCloseMenu = () => {
    setContextMenu(null);
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <>
      <div 
        className={cn('flex items-center bg-gray-100 dark:bg-gray-800 border-b dark:border-gray-700 overflow-x-auto relative', className)}
        onContextMenu={(e) => {
          e.preventDefault();
          if (onCloseAll && tabs.length > 0) {
            setContextMenu({
              x: e.clientX,
              y: e.clientY,
            });
          }
        }}
      >
        {tabs.map((tab) => {
          const isActive = tab.id === activeTabId;
          return (
            <div
              key={tab.id}
              className={cn(
                'flex items-center gap-2 px-4 py-2 border-r dark:border-gray-700 cursor-pointer group min-w-[120px] max-w-[200px]',
                isActive
                  ? 'bg-white dark:bg-gray-900 border-b-2 border-b-blue-600'
                  : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
              )}
              onClick={() => onTabSelect(tab.id)}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (onCloseAll && tabs.length > 0) {
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                  });
                }
              }}
            >
              <span
                className={cn(
                  'text-sm truncate flex-1',
                  isActive
                    ? 'text-gray-900 dark:text-gray-100'
                    : 'text-gray-600 dark:text-gray-400'
                )}
              >
                {tab.name}
                {tab.isModified && (
                  <Circle className="w-2 h-2 inline-block ml-1 fill-current" />
                )}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className={cn(
                  'opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-300 dark:hover:bg-gray-600 rounded',
                  isActive && 'opacity-100'
                )}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
      
      {/* 右键菜单 */}
      {contextMenu && onCloseAll && (
        <div
          ref={menuRef}
          className="fixed bg-white dark:bg-gray-800 border dark:border-gray-700 rounded shadow-lg z-50 min-w-[180px] py-1"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`,
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              onCloseAll();
              handleCloseMenu();
            }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            关闭所有标签页
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              // 关闭其他标签页
              tabs.forEach(tab => {
                if (tab.id !== activeTabId) {
                  onTabClose(tab.id);
                }
              });
              handleCloseMenu();
            }}
            className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            关闭其他标签页
          </button>
        </div>
      )}
    </>
  );
};

export default TabBar;

