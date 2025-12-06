import React, { useState, useCallback, useEffect } from 'react';
import { Search, X, File, Folder } from 'lucide-react';
import { cn } from '@/utils/cn';
import { FileNode } from './FileTree';

interface FileSearchProps {
  files: FileNode[];
  onFileSelect: (file: FileNode) => void;
  onClose: () => void;
  isOpen: boolean;
}

const FileSearch: React.FC<FileSearchProps> = ({
  files,
  onFileSelect,
  onClose,
  isOpen,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<FileNode[]>([]);

  // 递归搜索文件
  const searchFiles = useCallback((nodes: FileNode[], query: string): FileNode[] => {
    const matches: FileNode[] = [];
    const lowerQuery = query.toLowerCase();

    const traverse = (node: FileNode) => {
      if (node.name.toLowerCase().includes(lowerQuery)) {
        matches.push(node);
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    nodes.forEach(traverse);
    return matches;
  }, []);

  useEffect(() => {
    if (searchQuery.trim()) {
      const matches = searchFiles(files, searchQuery);
      setResults(matches.slice(0, 20)); // 限制结果数量
    } else {
      setResults([]);
    }
  }, [searchQuery, files, searchFiles]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setResults([]);
    }
  }, [isOpen]);

  // 键盘快捷键
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />
      
      {/* 搜索对话框 */}
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-2xl mx-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border dark:border-gray-700">
          {/* 搜索输入框 */}
          <div className="flex items-center gap-3 px-4 py-3 border-b dark:border-gray-700">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索文件..."
              className="flex-1 bg-transparent outline-none text-gray-900 dark:text-gray-100"
              autoFocus
            />
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* 搜索结果 */}
          <div className="max-h-96 overflow-y-auto">
            {results.length > 0 ? (
              <div className="py-1">
                {results.map((file, index) => (
                  <button
                    key={file.path}
                    onClick={() => {
                      onFileSelect(file);
                      onClose();
                    }}
                    className={cn(
                      "w-full px-4 py-2.5 text-left hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-3 transition-colors",
                      "border-l-2 border-transparent hover:border-blue-500 dark:hover:border-blue-400"
                    )}
                  >
                    {file.type === 'directory' ? (
                      <Folder className="w-5 h-5 text-blue-500 flex-shrink-0" />
                    ) : (
                      <File className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                        {file.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5">
                        {file.path}
                      </div>
                    </div>
                    {file.type === 'file' && (
                      <span className="text-xs text-gray-400 dark:text-gray-500 px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded flex-shrink-0">
                        {file.path.split('.').pop()?.toUpperCase() || 'FILE'}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : searchQuery.trim() ? (
              <div className="px-4 py-12 text-center">
                <div className="text-gray-400 dark:text-gray-500 mb-2">
                  <Search className="w-8 h-8 mx-auto opacity-50" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  未找到匹配的文件
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  尝试使用不同的关键词
                </p>
              </div>
            ) : (
              <div className="px-4 py-12 text-center">
                <div className="text-gray-400 dark:text-gray-500 mb-2">
                  <Search className="w-8 h-8 mx-auto opacity-50" />
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  输入文件名进行搜索
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  支持模糊匹配
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default FileSearch;

