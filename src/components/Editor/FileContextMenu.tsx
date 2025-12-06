import React from 'react';
import { FilePlus, FolderPlus, Trash2, Edit2, Copy, File, Terminal, Play } from 'lucide-react';
import { cn } from '@/utils/cn';

interface FileContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onNewFile?: () => void;
  onNewFolder?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  onCopy?: () => void;
  onRun?: () => void;
  onOpenTerminal?: () => void;
  isDirectory?: boolean;
  hasMainFunction?: boolean;
}

const FileContextMenu: React.FC<FileContextMenuProps> = ({
  x,
  y,
  onClose,
  onNewFile,
  onNewFolder,
  onRename,
  onDelete,
  onCopy,
  onRun,
  onOpenTerminal,
  isDirectory = false,
  hasMainFunction = false,
}) => {
  // 调试日志
  console.log('[FileContextMenu] 渲染，hasMainFunction:', hasMainFunction, 'isDirectory:', isDirectory);
  
  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />
      
      {/* 菜单 */}
      <div
        className="fixed z-50 bg-white dark:bg-gray-800 border dark:border-gray-700 rounded-lg shadow-lg py-1 min-w-[160px]"
        style={{ left: `${x}px`, top: `${y}px` }}
        onClick={(e) => e.stopPropagation()}
      >
        {isDirectory && (
          <>
            <button
              onClick={() => {
                onNewFile?.();
                onClose();
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <FilePlus className="w-4 h-4" />
              <span>新建文件</span>
            </button>
            <button
              onClick={() => {
                onNewFolder?.();
                onClose();
              }}
              className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              <span>新建文件夹</span>
            </button>
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
          </>
        )}
        
        <button
          onClick={() => {
            onRename?.();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
        >
          <Edit2 className="w-4 h-4" />
          <span>重命名</span>
        </button>
        
        {!isDirectory && (
          <button
            onClick={() => {
              onCopy?.();
              onClose();
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Copy className="w-4 h-4" />
            <span>复制路径</span>
          </button>
        )}
        
        {!isDirectory && hasMainFunction && (
          <>
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
            <button
              onClick={() => {
                console.log('[FileContextMenu] 运行按钮被点击');
                onRun?.();
                onClose();
              }}
              className="w-full px-4 py-2.5 text-left text-sm font-medium bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center gap-2 border-l-2 border-green-500 shadow-sm"
            >
              <Play className="w-5 h-5 fill-green-600 dark:fill-green-400 text-green-600 dark:text-green-400" />
              <span className="font-semibold">运行</span>
            </button>
            <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
          </>
        )}
        
        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
        
        {isDirectory && (
          <button
            onClick={() => {
              onOpenTerminal?.();
              onClose();
            }}
            className="w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
          >
            <Terminal className="w-4 h-4" />
            <span>在此路径打开终端</span>
          </button>
        )}
        
        <div className="h-px bg-gray-200 dark:bg-gray-700 my-1" />
        
        <button
          onClick={() => {
            onDelete?.();
            onClose();
          }}
          className="w-full px-4 py-2 text-left text-sm hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          <span>删除</span>
        </button>
      </div>
    </>
  );
};

export default FileContextMenu;

