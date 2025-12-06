import React, { useState, useEffect, useRef } from 'react';
import { 
  File, 
  Folder, 
  FolderOpen, 
  ChevronRight, 
  ChevronDown,
  Code,
  FileText,
  Settings,
  Package,
  FileCode,
  Image as ImageIcon,
  FileJson,
  Globe
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
  isOpen?: boolean;
}

interface FileTreeProps {
  files: FileNode[];
  onFileSelect?: (file: FileNode) => void;
  selectedFile?: string;
  className?: string;
  onContextMenu?: (e: React.MouseEvent, file: FileNode) => void;
  onCreateFile?: (filePath: string) => void;
  onCreateFolder?: (folderPath: string) => void;
  onRename?: (oldPath: string, newPath: string) => void;
}

interface EditingState {
  type: 'new-file' | 'new-folder' | 'rename';
  parentPath: string;
  oldPath?: string;
  oldName?: string;
}

const FileTree: React.FC<FileTreeProps> = ({
  files,
  onFileSelect,
  selectedFile,
  className,
  onContextMenu,
  onCreateFile,
  onCreateFolder,
  onRename,
}) => {
  // 使用 localStorage 持久化展开状态
  const [storedExpandedNodes, setStoredExpandedNodes] = useLocalStorage<string[]>(
    'gopilot_filetree_expanded_nodes',
    []
  );
  
  // 将存储的数组转换为 Set
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
    return new Set(storedExpandedNodes);
  });
  
  const expandedNodesRef = useRef<Set<string>>(new Set(expandedNodes));
  const prevFilesSignatureRef = useRef<string>('');

  // 内联编辑状态
  const [editingState, setEditingState] = useState<EditingState | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // 当 expandedNodes 改变时，保存到 localStorage
  useEffect(() => {
    const expandedArray = Array.from(expandedNodes);
    // 只在数组内容真正改变时才更新
    const currentArray = storedExpandedNodes;
    const arraysEqual = 
      expandedArray.length === currentArray.length &&
      expandedArray.every((val, idx) => val === currentArray[idx]);
    
    if (!arraysEqual) {
      setStoredExpandedNodes(expandedArray);
    }
    expandedNodesRef.current = new Set(expandedNodes);
  }, [expandedNodes, storedExpandedNodes, setStoredExpandedNodes]);

  // 保持展开状态：当文件树更新时，保留之前展开的节点
  const filesRef = useRef<FileNode[]>(files);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // 首次挂载时，从 localStorage 恢复展开状态
    if (isInitialMount.current) {
      isInitialMount.current = false;
      filesRef.current = files;
      // 从 localStorage 恢复展开状态
      if (storedExpandedNodes.length > 0) {
        const restoredSet = new Set(storedExpandedNodes);
        // 验证路径是否仍然存在
        const currentPaths = new Set<string>();
        const collectPaths = (nodes: FileNode[]) => {
          nodes.forEach(node => {
            currentPaths.add(node.path);
            if (node.children) {
              collectPaths(node.children);
            }
          });
        };
        collectPaths(files);
        
        // 只保留仍然存在的路径
        const validExpanded = new Set<string>();
        restoredSet.forEach(path => {
          if (currentPaths.has(path)) {
            validExpanded.add(path);
          }
        });
        
        setExpandedNodes(validExpanded);
        expandedNodesRef.current = validExpanded;
      }
      return;
    }

    // 生成文件树的唯一标识（基于路径的深度优先遍历）
    const getTreeSignature = (nodes: FileNode[]): string => {
      const paths: string[] = [];
      const traverse = (nodes: FileNode[]) => {
        nodes.forEach(node => {
          paths.push(node.path);
          if (node.children && node.children.length > 0) {
            traverse(node.children);
          }
        });
      };
      traverse(nodes);
      return paths.join('|');
    };

    const currentSignature = getTreeSignature(files);
    const prevSignature = getTreeSignature(filesRef.current);

    // 如果文件树结构没有变化（路径相同），完全保持展开状态
    if (currentSignature === prevSignature) {
      // 结构没变，不需要更新展开状态，但更新引用
      filesRef.current = files;
      return;
    }

    // 文件树结构改变了，保留仍然存在的节点的展开状态
    const currentPaths = new Set<string>();
    const collectPaths = (nodes: FileNode[]) => {
      nodes.forEach(node => {
        currentPaths.add(node.path);
        if (node.children) {
          collectPaths(node.children);
        }
      });
    };
    collectPaths(files);

    // 只保留仍然存在的路径的展开状态
    const preservedExpanded = new Set<string>();
    expandedNodesRef.current.forEach(path => {
      if (currentPaths.has(path)) {
        preservedExpanded.add(path);
      }
    });
    
    // 只有在展开状态真正改变时才更新
    const currentExpanded = expandedNodesRef.current;
    const hasChanged = 
      preservedExpanded.size !== currentExpanded.size ||
      Array.from(preservedExpanded).some(path => !currentExpanded.has(path)) ||
      Array.from(currentExpanded).some(path => !preservedExpanded.has(path));
    
    if (hasChanged) {
      setExpandedNodes(preservedExpanded);
    }
    
    filesRef.current = files;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]); // 移除 storedExpandedNodes 依赖，避免循环

  const toggleNode = (path: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedNodes(newExpanded);
  };

  // 开始编辑（新建文件/文件夹或重命名）
  const startEditing = (type: 'new-file' | 'new-folder' | 'rename', parentPath: string, oldPath?: string, oldName?: string) => {
    setEditingState({ type, parentPath, oldPath, oldName });
    setEditingValue(oldName || '');
    // 确保父目录展开
    if (parentPath) {
      setExpandedNodes(prev => new Set([...prev, parentPath]));
    }
  };

  // 取消编辑
  const cancelEditing = () => {
    setEditingState(null);
    setEditingValue('');
  };

  // 确认编辑
  const confirmEditing = async () => {
    if (!editingState || !editingValue.trim()) {
      cancelEditing();
      return;
    }

    const trimmedValue = editingValue.trim();
    if (!trimmedValue) {
      cancelEditing();
      return;
    }

    try {
      if (editingState.type === 'rename' && editingState.oldPath) {
        // 重命名
        const parentPath = editingState.oldPath.substring(0, editingState.oldPath.lastIndexOf('/'));
        const newPath = `${parentPath}/${trimmedValue}`;
        if (newPath !== editingState.oldPath && onRename) {
          onRename(editingState.oldPath, newPath);
        }
      } else {
        // 新建文件或文件夹
        const normalizedBase = editingState.parentPath.replace(/\/+$/, '');
        const newPath = `${normalizedBase}/${trimmedValue}`;
        
        if (editingState.type === 'new-file' && onCreateFile) {
          onCreateFile(newPath);
        } else if (editingState.type === 'new-folder' && onCreateFolder) {
          onCreateFolder(newPath);
        }
      }
    } catch (error) {
      console.error('编辑失败:', error);
    }
    
    cancelEditing();
  };

  // 监听来自父组件的编辑请求
  useEffect(() => {
    const handleStartEdit = (e: CustomEvent) => {
      const { type, parentPath, oldPath, oldName } = e.detail;
      startEditing(type, parentPath, oldPath, oldName);
    };

    window.addEventListener('filetree-start-edit', handleStartEdit as EventListener);
    return () => {
      window.removeEventListener('filetree-start-edit', handleStartEdit as EventListener);
    };
  }, []);

  // 当开始编辑时，聚焦输入框
  useEffect(() => {
    if (editingState && inputRef.current) {
      inputRef.current.focus();
      // 如果是重命名，选中文件名（不含扩展名）
      if (editingState.type === 'rename' && editingState.oldName) {
        const nameWithoutExt = editingState.oldName.split('.').slice(0, -1).join('.');
        if (nameWithoutExt) {
          inputRef.current.setSelectionRange(0, nameWithoutExt.length);
        } else {
          inputRef.current.select();
        }
      }
    }
  }, [editingState]);

  const getFileIcon = (node: FileNode) => {
    if (node.type === 'directory') {
      return expandedNodes.has(node.path) ? (
        <FolderOpen className="w-4 h-4 text-blue-500" />
      ) : (
        <Folder className="w-4 h-4 text-blue-400" />
      );
    }

    const ext = node.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      // Go 语言
      case 'go':
        return <Code className="w-4 h-4 text-cyan-500" />;
      case 'mod':
        return <Package className="w-4 h-4 text-purple-500" />;
      
      // Web 前端
      case 'html':
      case 'htm':
        return <Globe className="w-4 h-4 text-orange-500" />;
      case 'css':
        return <FileCode className="w-4 h-4 text-blue-500" />;
      case 'js':
      case 'jsx':
        return <FileCode className="w-4 h-4 text-yellow-500" />;
      case 'ts':
      case 'tsx':
        return <FileCode className="w-4 h-4 text-blue-600" />;
      case 'vue':
        return <FileCode className="w-4 h-4 text-green-500" />;
      
      // 配置文件
      case 'json':
        return <FileJson className="w-4 h-4 text-yellow-500" />;
      case 'yaml':
      case 'yml':
        return <Settings className="w-4 h-4 text-yellow-500" />;
      
      // 文档
      case 'md':
      case 'txt':
        return <FileText className="w-4 h-4 text-gray-400" />;
      
      // 图片
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif':
      case 'svg':
      case 'webp':
        return <ImageIcon className="w-4 h-4 text-purple-500" />;
      
      default:
        return <File className="w-4 h-4 text-gray-400" />;
    }
  };

  const renderNode = (node: FileNode, level: number = 0): React.ReactNode => {
    const isExpanded = expandedNodes.has(node.path);
    const isSelected = selectedFile === node.path;
    const hasChildren = node.children && node.children.length > 0;
    
    // 检查是否正在编辑此节点
    const isEditingThis = editingState && (
      (editingState.type === 'rename' && editingState.oldPath === node.path)
    );

    // 检查是否应该在此节点下显示新建输入框
    const showNewItemInput = editingState && 
      editingState.parentPath === node.path && 
      node.type === 'directory' &&
      (editingState.type === 'new-file' || editingState.type === 'new-folder') &&
      isExpanded;

    return (
      <div key={node.path}>
        {isEditingThis && editingState?.type === 'rename' ? (
          // 重命名模式：显示输入框代替文件名
          <div
            className="flex items-center gap-1 px-2 py-1"
            style={{ paddingLeft: `${level * 16 + 8}px` }}
          >
            <div className="w-4" />
            {getFileIcon(node)}
            <input
              ref={inputRef}
              type="text"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmEditing();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEditing();
                }
              }}
              onBlur={() => {
                // 延迟执行，以便点击确认按钮时不会立即取消
                setTimeout(() => {
                  if (editingState) {
                    confirmEditing();
                  }
                }, 200);
              }}
              className="ml-1 flex-1 px-2 py-0.5 text-xs border border-blue-400 dark:border-blue-500 rounded-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 shadow-sm"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        ) : (
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 rounded',
              isSelected && 'bg-blue-100 dark:bg-blue-900/30',
              'transition-colors',
              editingState && 'pointer-events-none opacity-50'
            )}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            onClick={() => {
              if (editingState) return; // 编辑模式下禁用点击
              if (node.type === 'directory') {
                toggleNode(node.path);
              } else {
                onFileSelect?.(node);
              }
            }}
            onContextMenu={(e) => {
              if (editingState) return; // 编辑模式下禁用右键菜单
              onContextMenu?.(e, node);
            }}
          >
            {node.type === 'directory' ? (
              <button
                className="flex items-center justify-center w-4 h-4"
                onClick={(e) => {
                  e.stopPropagation();
                  if (editingState) return;
                  toggleNode(node.path);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3 text-gray-500" />
                ) : (
                  <ChevronRight className="w-3 h-3 text-gray-500" />
                )}
              </button>
            ) : (
              <div className="w-4" />
            )}
            {getFileIcon(node)}
            <span className="ml-1 text-sm text-gray-700 dark:text-gray-300 truncate">
              {node.name}
            </span>
          </div>
        )}
        
        {/* 在目录下显示新建输入框 */}
        {showNewItemInput && (
          <div
            className="flex items-center gap-1 px-2 py-1"
            style={{ paddingLeft: `${(level + 1) * 16 + 8}px` }}
          >
            <div className="w-4" />
            {editingState.type === 'new-folder' ? (
              <Folder className="w-4 h-4 text-blue-400" />
            ) : (
              <File className="w-4 h-4 text-gray-400" />
            )}
            <input
              ref={inputRef}
              type="text"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  confirmEditing();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  cancelEditing();
                }
              }}
              onBlur={() => {
                setTimeout(() => {
                  if (editingState) {
                    confirmEditing();
                  }
                }, 200);
              }}
              placeholder={editingState.type === 'new-folder' ? '文件夹名' : '文件名'}
              className="ml-1 flex-1 px-2 py-0.5 text-xs border border-blue-400 dark:border-blue-500 rounded-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500 focus:border-blue-500 dark:focus:border-blue-400 shadow-sm"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
        
        {node.type === 'directory' && isExpanded && hasChildren && (
          <div>
            {node.children!.map((child) => renderNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={cn('h-full overflow-y-auto bg-gray-50 dark:bg-gray-900', className)}>
      <div className="p-2">
        {files.map((file) => renderNode(file))}
      </div>
    </div>
  );
};

export { FileTree };
export default FileTree;
