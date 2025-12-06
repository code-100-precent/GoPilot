import React, { useState, useCallback, useEffect, useRef } from 'react';
import { FileTree, FileNode } from '@/components/Editor/FileTree';
import CodeEditor from '@/components/Editor/CodeEditor';
import TabBar, { Tab } from '@/components/Editor/TabBar';
import FileContextMenu from '@/components/Editor/FileContextMenu';
import FileSearch from '@/components/Editor/FileSearch';
import { FileSystemService, FileSystemEntry } from '@/services/fileSystem';
import { useRecentFiles } from '@/hooks/useRecentFiles';
import { 
  Play, 
  FolderOpen, 
  Settings as SettingsIcon, 
  Search,
  GitBranch,
  Terminal as TerminalIcon,
  Save,
  FilePlus,
  History,
  FileText,
  Clock,
  X
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { showAlert } from '@/utils/notification';
import TerminalPanel, { TerminalPanelRef } from '@/components/Editor/TerminalPanel';
import { DialogService } from '@/services/dialog';
import Settings from '@/pages/Settings';
import ReferencesPanel from '@/components/Editor/ReferencesPanel';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import MarkdownPreview from '@/components/Editor/MarkdownPreview';
import ImagePreview from '@/components/Editor/ImagePreview';
import AudioPlayer from '@/components/Editor/AudioPlayer';
import TitleBar from '@/components/TitleBar/TitleBar';
import { Eye, EyeOff } from 'lucide-react';
import RunConfigurations, { RunConfiguration } from '@/components/Editor/RunConfigurations';
import { ProjectStateService, ProjectState } from '@/services/projectState';
import GitPanel from '@/components/Editor/GitPanel';
import { hasMainFunction } from '@/services/goMainDetector';

interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  sidebarWidth: number;
  enableAnimations: boolean;
}

const Editor: React.FC = () => {
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);
  const [files, setFiles] = useState<FileNode[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [fileContent, setFileContent] = useState<Record<string, string>>({});
  const [isFileModified, setIsFileModified] = useState<Record<string, boolean>>({});
  const [showTerminal, setShowTerminal] = useState(false);
  const [terminalWorkingDir, setTerminalWorkingDir] = useState<string | null>(null);
  const terminalPanelRef = React.useRef<TerminalPanelRef | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showGit, setShowGit] = useState(false);
  const [showReferences, setShowReferences] = useState(false);
  const [references, setReferences] = useState<Array<{
    filePath: string;
    fileName: string;
    line: number;
    column: number;
    preview: string;
  }>>([]);
  const [referenceSymbol, setReferenceSymbol] = useState<string>('');
  const [isResizing, setIsResizing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showMarkdownPreview, setShowMarkdownPreview] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    file: FileNode | null;
  } | null>(null);
  const [fileHasMain, setFileHasMain] = useState<boolean>(false);

  const [appSettings, setAppSettings] = useLocalStorage<AppSettings>('gopilot_app_settings', {
    theme: 'dark',
    accentColor: '#3b82f6',
    sidebarWidth: 250,
    enableAnimations: true,
  });

  const { recentFiles, addRecentFile, removeRecentFile } = useRecentFiles();
  const fileTreeRef = useRef<HTMLDivElement>(null);
  const lastShiftPressTime = useRef<number>(0);
  const loadWorkspaceRef = useRef<((rootPath: string) => Promise<void>) | null>(null);
  const handleFileSelectRef = useRef<((file: FileNode) => Promise<void>) | null>(null);

  // 双击 Shift 打开搜索框
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !e.repeat) {
        const now = Date.now();
        const timeSinceLastPress = now - lastShiftPressTime.current;
        
        // 如果两次 Shift 按下间隔小于 500ms，打开搜索框
        if (timeSinceLastPress > 0 && timeSinceLastPress < 500) {
          setShowSearch(true);
          lastShiftPressTime.current = 0; // 重置
        } else {
          lastShiftPressTime.current = now;
        }
      } else if (e.key !== 'Shift') {
        // 如果按下其他键，重置计时
        lastShiftPressTime.current = 0;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // 保存项目状态
  const saveProjectState = useCallback(async () => {
    if (!workspaceRoot) return;
    
    try {
      const state: ProjectState = {
        workspaceRoot,
        openFiles: tabs.map(tab => ({
          path: tab.path,
          name: tab.name,
        })),
        activeFile: activeTabId || undefined,
        lastOpened: Date.now(),
      };
      
      await ProjectStateService.saveProjectState(state);
    } catch (error) {
      console.error('Failed to save project state:', error);
    }
  }, [workspaceRoot, tabs, activeTabId]);

  // 应用启动时，尝试恢复最近打开的项目
  useEffect(() => {
    const restoreLastProject = async () => {
      const lastWorkspace = localStorage.getItem('gopilot_workspace_root');
      if (lastWorkspace) {
        // 检查工作区是否仍然存在
        const exists = await FileSystemService.pathExists(lastWorkspace);
        if (exists) {
          // 检查是否有保存的项目状态
          const hasState = await ProjectStateService.hasProjectState(lastWorkspace);
          if (hasState) {
            // 询问用户是否要恢复
            const shouldRestore = confirm(
              `检测到上次打开的项目：\n${lastWorkspace}\n\n是否要恢复上次的工作状态？`
            );
            if (shouldRestore) {
              await loadWorkspace(lastWorkspace);
            }
          }
        } else {
          // 工作区不存在，清除记录
          localStorage.removeItem('gopilot_workspace_root');
        }
      }
    };
    
    restoreLastProject();
  }, []); // 只在组件挂载时执行一次

  // 监听从桌面拖放到应用图标的文件
  useEffect(() => {
    let isMounted = true;
    
    const setupTauriEventListeners = async () => {
      // 检查是否在 Tauri 环境中
      if (typeof window !== 'undefined' && (window as any).__TAURI__) {
        try {
          const { listen } = await import('@tauri-apps/api/event');
          
          // 监听 open-files 事件
          console.log('设置 open-files 事件监听器');
          const unlisten = await listen<string[]>('open-files', async (event) => {
            if (!isMounted) return;
            
            console.log('收到 open-files 事件:', event.payload);
            const filePaths = event.payload;
            if (filePaths && filePaths.length > 0) {
              console.log(`准备处理 ${filePaths.length} 个文件/文件夹`);
              // 处理每个文件/文件夹路径
              for (const path of filePaths) {
                console.log(`处理路径: ${path}`);
                try {
                  // 检查路径是否存在
                  const exists = await FileSystemService.pathExists(path);
                  if (!exists) {
                    console.warn(`路径不存在: ${path}`);
                    continue;
                  }

                  // 检查是文件还是文件夹
                  const isDirectory = await FileSystemService.readDirectory(path)
                    .then(() => true)
                    .catch(() => false);

                  if (isDirectory) {
                    // 如果是文件夹，打开为工作区
                    // 使用 ref 来访问最新的 loadWorkspace
                    if (loadWorkspaceRef.current) {
                      loadWorkspaceRef.current(path).catch((error) => {
                        console.error(`打开工作区失败: ${path}`, error);
                        showAlert(`无法打开工作区: ${path}`, 'error');
                      });
                    }
                  } else {
                    // 如果是文件，创建 FileNode 并打开
                    const fileName = path.split(/[/\\]/).pop() || 'untitled';
                    const fileNode: FileNode = {
                      name: fileName,
                      path: path,
                      type: 'file',
                    };
                    // 使用 ref 来访问最新的 handleFileSelect
                    if (handleFileSelectRef.current) {
                      handleFileSelectRef.current(fileNode).catch((error) => {
                        console.error(`打开文件失败: ${path}`, error);
                        showAlert(`无法打开文件: ${path}`, 'error');
                      });
                    }
                  }
                } catch (error) {
                  console.error(`处理文件路径失败: ${path}`, error);
                  showAlert(`无法打开: ${path}`, 'error');
                }
              }
            }
          });

          // 返回清理函数
          return () => {
            isMounted = false;
            unlisten();
          };
        } catch (error) {
          console.warn('无法设置 Tauri 事件监听器:', error);
        }
      }
    };

    const cleanup = setupTauriEventListeners();
    return () => {
      isMounted = false;
      cleanup.then(cleanupFn => cleanupFn?.());
    };
  }, []); // 空依赖数组，使用 ref 或函数式更新来访问最新值

  // 查找所有引用
  const handleFindReferences = useCallback(async (
    symbolName: string,
    packageName: string | null,
    position: { line: number; column: number }
  ) => {
    if (!workspaceRoot) {
      showAlert('请先打开工作区', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      const { findAllReferences } = await import('@/utils/goNavigation');
      
      // 获取所有 Go 文件
      const getAllGoFiles = async (dir: string, depth: number = 0): Promise<string[]> => {
        if (depth > 5) return []; // 限制深度
        
        const files: string[] = [];
        try {
          const entries = await FileSystemService.readDirectoryTree(dir, 1);
          
          for (const entry of entries) {
            if (entry.type === 'file' && entry.path.endsWith('.go')) {
              files.push(entry.path);
            } else if (entry.type === 'directory') {
              const subFiles = await getAllGoFiles(entry.path, depth + 1);
              files.push(...subFiles);
            }
          }
        } catch (error) {
          console.error('Error reading directory:', error);
        }
        
        return files;
      };

      const allFiles = await getAllGoFiles(workspaceRoot);
      console.log('Searching in', allFiles.length, 'files');
      
      const refs = await findAllReferences(symbolName, packageName, activeTabId || '', workspaceRoot, allFiles);
      
      setReferences(refs);
      setReferenceSymbol(symbolName);
      setShowReferences(true);
      
      if (refs.length === 0) {
        showAlert(`未找到 ${symbolName} 的引用`, 'info');
      }
    } catch (error: any) {
      console.error('查找引用失败:', error);
      showAlert(error?.message || '查找引用失败', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceRoot, activeTabId]);

  // 将 FileSystemEntry 转换为 FileNode
  const convertToFileNode = (entry: FileSystemEntry): FileNode => {
    return {
      name: entry.name,
      path: entry.path,
      type: entry.type,
      children: entry.children?.map(convertToFileNode),
    };
  };

  // 刷新文件树
  const refreshFileTree = useCallback(async () => {
    if (!workspaceRoot) return;
    
    try {
      const entries = await FileSystemService.readDirectoryTree(workspaceRoot, 5);
      const fileNodes = entries.map(convertToFileNode);
      
      // 创建根节点，以打开的文件夹作为根
      const rootName = workspaceRoot.split(/[/\\]/).pop() || workspaceRoot;
      const rootNode: FileNode = {
        name: rootName,
        path: workspaceRoot,
        type: 'directory',
        children: fileNodes,
      };
      
      setFiles([rootNode]);
    } catch (error: any) {
      console.error('刷新文件树失败:', error);
    }
  }, [workspaceRoot]);

  // 加载工作区
  const loadWorkspace = useCallback(async (rootPath: string) => {
    setIsLoading(true);
    try {
      const entries = await FileSystemService.readDirectoryTree(rootPath, 5);
      const fileNodes = entries.map(convertToFileNode);
      
      // 创建根节点，以打开的文件夹作为根
      const rootName = rootPath.split(/[/\\]/).pop() || rootPath;
      const rootNode: FileNode = {
        name: rootName,
        path: rootPath,
        type: 'directory',
        children: fileNodes,
      };
      
      setFiles([rootNode]);
      setWorkspaceRoot(rootPath);
      
      // 保存工作区路径到 localStorage（用于快速访问）
      localStorage.setItem('gopilot_workspace_root', rootPath);
      
      // 立即初始化项目目录（创建 .pilot 文件夹）
      await ProjectStateService.initializeProject(rootPath);
      
      // 立即保存一个初始的项目状态（即使没有打开的文件）
      try {
        const initialState: ProjectState = {
          workspaceRoot: rootPath,
          openFiles: [],
          lastOpened: Date.now(),
        };
        await ProjectStateService.saveProjectState(initialState);
        console.log('Initial project state saved');
      } catch (error) {
        console.error('Failed to save initial project state:', error);
      }
      
      // 尝试加载项目状态
      const savedState = await ProjectStateService.loadProjectState(rootPath);
      if (savedState && savedState.openFiles && savedState.openFiles.length > 0) {
        // 恢复打开的文件
        const restoredTabs: Tab[] = [];
        const restoredContent: Record<string, string> = {};
        
        for (const file of savedState.openFiles) {
          try {
            // 检查文件是否仍然存在
            const exists = await FileSystemService.pathExists(file.path);
            if (exists) {
              // 对于图片和音频文件，不需要读取文本内容
              if (FileSystemService.isImageFile(file.path) || FileSystemService.isAudioFile(file.path)) {
                restoredContent[file.path] = ''; // 二进制文件不需要文本内容
              } else {
                // 读取文件内容，如果是二进制文件则跳过
                try {
                  const content = await FileSystemService.readFileContent(file.path);
                  restoredContent[file.path] = content;
                } catch (error: any) {
                  // 如果读取失败（可能是二进制文件），跳过
                  console.warn(`跳过二进制文件 ${file.path}:`, error.message);
                  continue;
                }
              }
              
              // 创建标签页
              restoredTabs.push({
                id: file.path,
                name: file.name,
                path: file.path,
                isModified: false,
              });
              
              addRecentFile(file.path, file.name);
            }
          } catch (error) {
            console.warn(`Failed to restore file ${file.path}:`, error);
          }
        }
        
        if (restoredTabs.length > 0) {
          setTabs(restoredTabs);
          setFileContent(restoredContent);
          setIsFileModified({});
          
          // 恢复活动文件
          if (savedState.activeFile && restoredTabs.find(t => t.id === savedState.activeFile)) {
            setActiveTabId(savedState.activeFile);
          } else {
            setActiveTabId(restoredTabs[0].id);
          }
          
          showAlert(`已恢复 ${restoredTabs.length} 个打开的文件`, 'success');
        } else {
          showAlert('工作区加载成功', 'success');
        }
      } else {
        showAlert('工作区加载成功', 'success');
      }
    } catch (error: any) {
      console.error('加载工作区失败:', error);
      showAlert(error?.message || '加载工作区失败', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [addRecentFile]);

  // 选择文件
  const handleFileSelect = useCallback(async (file: FileNode) => {
    if (file.type === 'file') {
      // 添加到标签页
      const tabId = file.path;
      const existingTab = tabs.find(t => t.id === tabId);
      
      if (!existingTab) {
        const newTab: Tab = {
          id: tabId,
          path: file.path,
          name: file.name,
          isModified: isFileModified[file.path] || false,
        };
        setTabs(prev => [...prev, newTab]);
      }
      
      setActiveTabId(tabId);
      
      // 如果文件内容已加载，直接显示
      if (fileContent[file.path]) {
        addRecentFile(file.path, file.name);
        // 保存项目状态
        setTimeout(() => saveProjectState(), 100);
        return;
      }

      // 否则从文件系统读取
      try {
        setIsLoading(true);
        // 对于图片和音频文件，不需要读取文本内容
        if (FileSystemService.isImageFile(file.path) || FileSystemService.isAudioFile(file.path)) {
          setFileContent((prev) => ({
            ...prev,
            [file.path]: '', // 二进制文件不需要文本内容
          }));
        } else {
          // 读取文件内容，如果是二进制文件则跳过
          try {
            const content = await FileSystemService.readFileContent(file.path);
            setFileContent((prev) => ({
              ...prev,
              [file.path]: content,
            }));
          } catch (error: any) {
            // 如果读取失败（可能是二进制文件），跳过
            console.warn(`跳过二进制文件 ${file.path}:`, error.message);
            showAlert(`文件 ${file.name} 是二进制文件，无法以文本形式打开`, 'warning');
            return;
          }
        }
        setIsFileModified((prev) => ({
          ...prev,
          [file.path]: false,
        }));
        addRecentFile(file.path, file.name);
        // 保存项目状态
        setTimeout(() => saveProjectState(), 100);
      } catch (error: any) {
        console.error('读取文件失败:', error);
        showAlert(error?.message || '读取文件失败', 'error');
        setFileContent((prev) => ({
          ...prev,
          [file.path]: '',
        }));
      } finally {
        setIsLoading(false);
      }
    }
  }, [fileContent, tabs, isFileModified, addRecentFile, saveProjectState]);

  // 使用 ref 存储函数引用，以便在 useEffect 中访问最新版本
  useEffect(() => {
    loadWorkspaceRef.current = loadWorkspace;
  }, [loadWorkspace]);

  useEffect(() => {
    handleFileSelectRef.current = handleFileSelect;
  }, [handleFileSelect]);

  // 打开文件夹 - 使用 Tauri 文件对话框
  const handleOpenFolder = useCallback(async () => {
    try {
      console.log('Opening folder dialog...');
      const folderPath = await DialogService.openFolder();
      console.log('Selected folder:', folderPath);
      if (folderPath) {
        await loadWorkspace(folderPath);
      } else {
        console.log('No folder selected');
      }
    } catch (error) {
      console.error('Failed to open folder:', error);
      showAlert('打开文件夹失败: ' + (error instanceof Error ? error.message : String(error)), 'error');
    }
  }, [loadWorkspace]);

  // 根据路径打开文件（用于拖放功能）
  const openFile = useCallback(async (filePath: string) => {
    try {
      // 检查文件是否存在
      const exists = await FileSystemService.pathExists(filePath);
      if (!exists) {
        showAlert(`文件不存在: ${filePath}`, 'error');
        return;
      }

      const fileName = filePath.split(/[/\\]/).pop() || 'untitled';
      const fileNode: FileNode = {
        name: fileName,
        path: filePath,
        type: 'file',
      };
      await handleFileSelect(fileNode);
    } catch (error: any) {
      console.error('打开文件失败:', error);
      showAlert(error?.message || '打开文件失败', 'error');
    }
  }, [handleFileSelect]);

  // 打开文件 - 使用 Tauri 文件对话框
  const handleOpenFile = useCallback(async () => {
    const filePath = await DialogService.openFile();
    if (filePath) {
      await openFile(filePath);
    }
  }, [openFile]);

  // 切换标签页
  const handleTabSelect = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    // 保存项目状态
    setTimeout(() => saveProjectState(), 100);
  }, [saveProjectState]);

  // 关闭标签页
  const handleTabClose = useCallback((tabId: string) => {
    setTabs(prev => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTabId === tabId && newTabs.length > 0) {
        setActiveTabId(newTabs[newTabs.length - 1].id);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }
      return newTabs;
    });
    // 保存项目状态
    setTimeout(() => saveProjectState(), 100);
    
    // 如果文件已修改，可以选择提示保存
    if (isFileModified[tabId]) {
      // 这里可以添加保存提示逻辑
    }
  }, [activeTabId, isFileModified, saveProjectState]);

  // 关闭所有标签页
  const handleCloseAllTabs = useCallback(() => {
    // 检查是否有未保存的文件
    const hasModifiedFiles = tabs.some(tab => isFileModified[tab.id]);
    
    if (hasModifiedFiles) {
      if (!confirm('有未保存的文件，确定要关闭所有标签页吗？')) {
        return;
      }
    }
    
    setTabs([]);
    setActiveTabId(null);
    // 保存项目状态
    setTimeout(() => saveProjectState(), 100);
  }, [tabs, isFileModified, saveProjectState]);

  // 保存文件
  const handleSaveFile = useCallback(async (filePath?: string) => {
    const pathToSave = filePath || activeTabId;
    if (!pathToSave) {
      showAlert('请先选择一个文件', 'warning');
      return;
    }

    try {
      setIsLoading(true);
      const content = fileContent[pathToSave] || '';
      await FileSystemService.writeFileContent(pathToSave, content);
      setIsFileModified((prev) => ({
        ...prev,
        [pathToSave]: false,
      }));
      
      // 更新标签页状态
      setTabs(prev => prev.map(t => 
        t.id === pathToSave ? { ...t, isModified: false } : t
      ));
      
      showAlert('文件保存成功', 'success');
    } catch (error: any) {
      console.error('保存文件失败:', error);
      showAlert(error?.message || '保存文件失败', 'error');
    } finally {
      setIsLoading(false);
    }
  }, [activeTabId, fileContent]);

  // 创建文件
  const handleCreateFile = useCallback(async (filePath: string) => {
    if (!filePath || !filePath.trim()) {
      return;
    }

    console.log('[Editor] 创建文件:', filePath);
    try {
      await FileSystemService.createFile(filePath);
      showAlert('文件创建成功', 'success');
      await refreshFileTree();
    } catch (error: any) {
      console.error('创建文件失败:', error);
      showAlert(error?.message || '创建文件失败', 'error');
    }
  }, [refreshFileTree]);

  // 创建文件夹
  const handleCreateFolder = useCallback(async (folderPath: string) => {
    if (!folderPath || !folderPath.trim()) {
      return;
    }

    console.log('[Editor] 创建文件夹:', folderPath);
    try {
      await FileSystemService.createDirectory(folderPath);
      showAlert('文件夹创建成功', 'success');
      await refreshFileTree();
    } catch (error: any) {
      console.error('创建文件夹失败:', error);
      showAlert(error?.message || '创建文件夹失败', 'error');
    }
  }, [refreshFileTree]);

  // 删除文件/文件夹
  const handleDeleteFile = useCallback(async (filePath: string) => {
    try {
      await FileSystemService.deleteFile(filePath);
      showAlert('删除成功', 'success');
      
      // 如果删除的是当前打开的文件，关闭标签页
      if (activeTabId === filePath) {
        handleTabClose(filePath);
      }
      
      await refreshFileTree();
    } catch (error: any) {
      console.error('删除失败:', error);
      showAlert(error?.message || '删除失败', 'error');
    }
  }, [activeTabId, handleTabClose, refreshFileTree]);

  // 重命名文件/文件夹
  const handleRenameFile = useCallback(async (oldPath: string, newPath: string) => {
    if (!newPath || newPath === oldPath) return;

    const newName = newPath.split(/[/\\]/).pop() || '';

    try {
      await FileSystemService.renameFile(oldPath, newPath);
      showAlert('重命名成功', 'success');
      
      // 如果重命名的是当前打开的文件，更新标签页
      if (activeTabId === oldPath) {
        setTabs(prev => prev.map(t => 
          t.id === oldPath ? { ...t, id: newPath, path: newPath, name: newName } : t
        ));
        setActiveTabId(newPath);
        setFileContent(prev => {
          const newContent = { ...prev };
          newContent[newPath] = newContent[oldPath];
          delete newContent[oldPath];
          return newContent;
        });
      }
      
      await refreshFileTree();
    } catch (error: any) {
      console.error('重命名失败:', error);
      showAlert(error?.message || '重命名失败', 'error');
    }
  }, [activeTabId, refreshFileTree]);

  // 内容变化处理
  const handleContentChange = useCallback((value: string) => {
    if (activeTabId) {
      setFileContent((prev) => ({
        ...prev,
        [activeTabId]: value,
      }));
      setIsFileModified((prev) => ({
        ...prev,
        [activeTabId]: true,
      }));
      
      // 更新标签页状态
      setTabs(prev => prev.map(t => 
        t.id === activeTabId ? { ...t, isModified: true } : t
      ));
    }
  }, [activeTabId]);

  // 文件树右键菜单
  const handleFileTreeContextMenu = useCallback(async (e: React.MouseEvent, file: FileNode) => {
    e.preventDefault();
    
    console.log('[Editor] 右键菜单触发:', file.path, 'type:', file.type);
    
    // 检测文件是否包含 main 函数（先检测，再显示菜单）
    let hasMain = false;
    if (file.type === 'file' && file.path.endsWith('.go')) {
      console.log('[Editor] 开始检测 main 函数:', file.path);
      try {
        // 如果文件已经在编辑器中打开，使用同步检测（更快）
        if (fileContent[file.path]) {
          console.log('[Editor] 使用同步检测（文件已打开）');
          const { hasMainFunctionSync } = await import('@/services/goMainDetector');
          hasMain = hasMainFunctionSync(fileContent[file.path]);
        } else {
          console.log('[Editor] 使用异步检测（文件未打开）');
          // 否则异步读取文件内容
          hasMain = await hasMainFunction(file.path);
        }
        console.log('[Editor] 检测完成，hasMain:', hasMain);
      } catch (error) {
        console.error('[Editor] 检测 main 函数失败:', error);
      }
    } else {
      console.log('[Editor] 跳过检测（不是 .go 文件或不是文件类型）');
    }
    
    // 设置菜单和检测结果
    console.log('[Editor] 设置菜单，hasMain:', hasMain);
    setFileHasMain(hasMain);
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      file,
    });
  }, [fileContent]);

  // 调整侧边栏宽度
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizing) {
      const newWidth = Math.max(150, Math.min(500, e.clientX));
      setAppSettings({ ...appSettings, sidebarWidth: newWidth });
    }
  }, [isResizing, appSettings, setAppSettings]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, handleMouseMove, handleMouseUp]);

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSaveFile();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault();
        setShowSearch(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === ',') {
        e.preventDefault();
        setShowSettings(true);
      } else if (e.key === 'Escape') {
        setContextMenu(null);
        setShowSearch(false);
        setShowSettings(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveFile]);

  // 监听设置更新
  useEffect(() => {
    const handleSettingsUpdate = () => {
      const settings = JSON.parse(localStorage.getItem('gopilot_app_settings') || '{}');
      setAppSettings(settings);
      
      // 应用主题
      if (settings.theme === 'dark' || (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    window.addEventListener('settings-updated', handleSettingsUpdate);
    
    // 初始化主题
    if (appSettings.theme === 'dark' || (appSettings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    return () => window.removeEventListener('settings-updated', handleSettingsUpdate);
  }, [appSettings]);

  // 获取当前文件的语言类型
  const currentLanguage = activeTabId
    ? FileSystemService.getLanguageFromPath(activeTabId)
    : 'plaintext';
  
  const isMarkdownFile = currentLanguage === 'markdown' || (activeTabId && activeTabId.toLowerCase().endsWith('.md'));
  const isImageFile = activeTabId ? FileSystemService.isImageFile(activeTabId) : false;
  const isAudioFile = activeTabId ? FileSystemService.isAudioFile(activeTabId) : false;

  // 获取当前文件内容
  const currentFileContent = activeTabId ? fileContent[activeTabId] || '' : '';

  // 获取当前文件名
  const currentFileName = activeTabId
    ? activeTabId.split(/[/\\]/).pop() || 'untitled'
    : 'untitled';

  // 检查当前文件是否已修改
  const isCurrentFileModified = activeTabId
    ? isFileModified[activeTabId] || false
    : false;

  // 生成标题栏显示文本
  const titleBarText = React.useMemo(() => {
    if (workspaceRoot) {
      const rootName = workspaceRoot.split(/[/\\]/).pop() || workspaceRoot;
      if (activeTabId) {
        const fileName = activeTabId.split(/[/\\]/).pop() || activeTabId;
        return `${fileName} - ${rootName} - GoPilot`;
      }
      return `${rootName} - GoPilot`;
    }
    if (activeTabId) {
      const fileName = activeTabId.split(/[/\\]/).pop() || activeTabId;
      return `${fileName} - GoPilot`;
    }
    return 'GoPilot';
  }, [workspaceRoot, activeTabId]);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Custom Title Bar */}
      <TitleBar title={titleBarText} />
      
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={handleOpenFolder}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="打开文件夹"
          >
            <FolderOpen className="w-5 h-5" />
          </button>
          <button
            onClick={handleOpenFile}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="打开文件"
          >
            <FilePlus className="w-5 h-5" />
          </button>
          <button
            onClick={() => handleSaveFile()}
            disabled={!activeTabId || isLoading}
            className={cn(
              "p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded flex items-center gap-2",
              isCurrentFileModified && "bg-yellow-100 dark:bg-yellow-900/30",
              (!activeTabId || isLoading) && "opacity-50 cursor-not-allowed"
            )}
            title="保存文件 (Ctrl/Cmd + S)"
          >
            <Save className="w-5 h-5" />
            {isCurrentFileModified && <span className="text-xs text-yellow-600 dark:text-yellow-400">*</span>}
          </button>
          <div className="w-px h-6 bg-gray-300 dark:bg-gray-600" />
          <button
            onClick={() => setShowSearch(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="搜索文件 (Ctrl/Cmd + P)"
          >
            <Search className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowGit(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="Git 管理"
          >
            <GitBranch className="w-5 h-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {workspaceRoot && (
            <span className="text-sm text-gray-600 dark:text-gray-400 mr-4 truncate max-w-xs">
              {workspaceRoot}
            </span>
          )}
          <RunConfigurations
            onRun={async (config: RunConfiguration) => {
              // 确保终端面板打开
              if (!showTerminal) {
                setShowTerminal(true);
                // 等待终端面板挂载完成
                await new Promise<void>(resolve => {
                  const checkReady = () => {
                    if (terminalPanelRef.current) {
                      resolve();
                    } else {
                      setTimeout(checkReady, 50);
                    }
                  };
                  checkReady();
                });
              }
              
              // 确保 ref 已准备好
              if (terminalPanelRef.current) {
                const workingDir = config.workingDirectory || workspaceRoot || '';
                const command = config.command + (config.arguments?.length ? ' ' + config.arguments.join(' ') : '');
                
                // 在终端中执行命令
                await terminalPanelRef.current.executeCommand(command, workingDir, config.environment);
              } else {
                // 如果还是没准备好，等待一下再试
                setTimeout(async () => {
                  if (terminalPanelRef.current) {
                    const workingDir = config.workingDirectory || workspaceRoot || '';
                    const command = config.command + (config.arguments?.length ? ' ' + config.arguments.join(' ') : '');
                    await terminalPanelRef.current.executeCommand(command, workingDir, config.environment);
                  }
                }, 100);
              }
            }}
          />
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
            title="设置 (Ctrl/Cmd + ,)"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - File Tree (在外层) */}
        {workspaceRoot && (
          <div
            ref={fileTreeRef}
            className="bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col flex-shrink-0"
            style={{ width: `${appSettings.sidebarWidth || 250}px` }}
          >
            <div className="flex-1 overflow-hidden">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : (
                <FileTree
                  files={files}
                  onFileSelect={handleFileSelect}
                  selectedFile={activeTabId || undefined}
                  onContextMenu={handleFileTreeContextMenu}
                  onCreateFile={handleCreateFile}
                  onCreateFolder={handleCreateFolder}
                  onRename={handleRenameFile}
                />
              )}
            </div>
            {/* Resize Handle */}
            <div
              className="w-1 cursor-col-resize hover:bg-blue-500 transition-colors"
              onMouseDown={handleMouseDown}
            />
          </div>
        )}

        {/* Editor Area (包含 TabBar) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Bar (在编辑器区域内部) */}
          {tabs.length > 0 && (
            <TabBar
              tabs={tabs}
              activeTabId={activeTabId || undefined}
              onTabSelect={handleTabSelect}
              onTabClose={handleTabClose}
              onCloseAll={handleCloseAllTabs}
            />
          )}
          {activeTabId ? (
            isLoading ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600 dark:text-gray-400">加载中...</p>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Markdown 预览切换按钮 */}
                {isMarkdownFile && (
                  <div className="flex items-center justify-end px-4 py-2 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                    <button
                      onClick={() => setShowMarkdownPreview(!showMarkdownPreview)}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                      title={showMarkdownPreview ? "切换到编辑模式" : "切换到预览模式"}
                    >
                      {showMarkdownPreview ? (
                        <>
                          <EyeOff className="w-4 h-4" />
                          <span>编辑</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-4 h-4" />
                          <span>预览</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
                
                {/* 编辑器或预览 */}
                {isImageFile ? (
                  <ImagePreview
                    filePath={activeTabId || ''}
                    fileName={currentFileName || ''}
                  />
                ) : isAudioFile ? (
                  <AudioPlayer
                    filePath={activeTabId || ''}
                    fileName={currentFileName || ''}
                  />
                ) : isMarkdownFile && showMarkdownPreview ? (
                  <MarkdownPreview 
                    content={currentFileContent} 
                    filePath={activeTabId || undefined}
                    workspaceRoot={workspaceRoot || undefined}
                  />
                ) : (
                  <CodeEditor
                    value={currentFileContent}
                    language={currentLanguage}
                    onChange={handleContentChange}
                    fileName={activeTabId || undefined}
                    onNavigateToFile={async (filePath: string, line: number, column: number) => {
                      // 打开目标文件
                      const targetFileName = filePath.split(/[/\\]/).pop() || 'untitled';
                      const fileNode: FileNode = {
                        name: targetFileName,
                        path: filePath,
                        type: 'file',
                      };
                      
                      // 选择文件（会打开新标签页）
                      await handleFileSelect(fileNode);
                      
                      // 等待文件加载后跳转到指定位置
                      setTimeout(() => {
                        // 通过事件通知 CodeEditor 跳转
                        window.dispatchEvent(new CustomEvent('navigate-to-position', {
                          detail: { filePath, line, column }
                        }));
                      }, 500);
                    }}
                    onFindReferences={handleFindReferences}
                  />
                )}
              </div>
            )
          ) : (
            <div className="flex-1 flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
              <div className="text-center max-w-xl mx-auto px-6">
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-md">
                    <img 
                      src="/app-icon.png" 
                      alt="GoPilot" 
                      className="w-12 h-12 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Welcome to GoPilot
                  </h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <button
                    onClick={handleOpenFolder}
                    className="group flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-md"
                  >
                    <div className="w-10 h-10 mb-2 bg-blue-100 dark:bg-blue-900/30 rounded-md flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                      <FolderOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">
                      打开文件夹
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      打开项目文件夹开始编辑
                    </p>
                  </button>
                  
                  <button
                    onClick={handleOpenFile}
                    className="group flex flex-col items-center justify-center p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all hover:shadow-md"
                  >
                    <div className="w-10 h-10 mb-2 bg-gray-100 dark:bg-gray-700 rounded-md flex items-center justify-center group-hover:bg-gray-200 dark:group-hover:bg-gray-600 transition-colors">
                      <FilePlus className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-0.5">
                      打开文件
                    </h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      打开单个文件进行编辑
                    </p>
                  </button>
                </div>

                {recentFiles.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400" />
                        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                          最近打开的文件
                        </h3>
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {recentFiles.length} 个文件
                      </span>
                    </div>
                    <div className="space-y-1">
                      {recentFiles.slice(0, 5).map((file, index) => (
                        <div
                          key={file.path}
                          onClick={async () => {
                            const fileNode: FileNode = {
                              name: file.name,
                              path: file.path,
                              type: 'file',
                            };
                            await handleFileSelect(fileNode);
                          }}
                          className="group w-full flex items-center gap-2 px-3 py-2 text-left bg-white dark:bg-gray-800 rounded-md border border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 hover:shadow-sm transition-all cursor-pointer"
                        >
                          <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                            <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-900 dark:text-white truncate">
                              {file.name}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              {file.path}
                            </div>
                          </div>
                          <div className="flex-shrink-0 flex items-center gap-1.5">
                            <span className="text-[10px] text-gray-400 dark:text-gray-500 font-mono">
                              #{index + 1}
                            </span>
                            <div
                              onClick={async (e) => {
                                e.stopPropagation();
                                // 从最近文件中移除
                                removeRecentFile(file.path);
                              }}
                              className="opacity-0 group-hover:opacity-100 p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-all cursor-pointer"
                              title="从最近文件中移除"
                            >
                              <X className="w-3 h-3 text-red-600 dark:text-red-400" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {recentFiles.length > 5 && (
                      <div className="mt-2 text-center">
                        <button
                          onClick={() => {
                            // 可以添加一个"查看全部"的功能
                            showAlert(`还有 ${recentFiles.length - 5} 个文件`, 'info');
                          }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          查看全部 ({recentFiles.length} 个文件)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Terminal Panel */}
      {showTerminal && (
        <div className="border-t dark:border-gray-700">
          <TerminalPanel 
            ref={terminalPanelRef}
            onClose={() => setShowTerminal(false)}
          />
        </div>
      )}

      {/* Terminal Toggle Button */}
      {!showTerminal && (
        <button
          onClick={() => setShowTerminal(true)}
          className="absolute bottom-4 right-4 p-3 bg-blue-600 text-white rounded-full shadow-lg hover:bg-blue-700 transition-colors z-10"
        >
          <TerminalIcon className="w-5 h-5" />
        </button>
      )}

      {/* Context Menu */}
      {contextMenu && contextMenu.file && (
        <FileContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onNewFile={() => {
            if (contextMenu.file) {
              let parentPath: string;
              if (contextMenu.file.type === 'directory') {
                parentPath = contextMenu.file.path;
              } else {
                // 如果是文件，获取文件所在目录
                const lastSlash = Math.max(
                  contextMenu.file.path.lastIndexOf('/'),
                  contextMenu.file.path.lastIndexOf('\\')
                );
                parentPath = lastSlash > 0 
                  ? contextMenu.file.path.substring(0, lastSlash)
                  : workspaceRoot || '';
              }
              // 触发文件树内联编辑
              window.dispatchEvent(new CustomEvent('filetree-start-edit', {
                detail: { type: 'new-file', parentPath }
              }));
            }
          }}
          onNewFolder={() => {
            if (contextMenu.file) {
              let parentPath: string;
              if (contextMenu.file.type === 'directory') {
                parentPath = contextMenu.file.path;
              } else {
                // 如果是文件，获取文件所在目录
                const lastSlash = Math.max(
                  contextMenu.file.path.lastIndexOf('/'),
                  contextMenu.file.path.lastIndexOf('\\')
                );
                parentPath = lastSlash > 0 
                  ? contextMenu.file.path.substring(0, lastSlash)
                  : workspaceRoot || '';
              }
              // 触发文件树内联编辑
              window.dispatchEvent(new CustomEvent('filetree-start-edit', {
                detail: { type: 'new-folder', parentPath }
              }));
            }
          }}
          onRename={() => {
            if (contextMenu.file) {
              const oldName = contextMenu.file.path.split(/[/\\]/).pop() || '';
              // 触发文件树内联编辑
              window.dispatchEvent(new CustomEvent('filetree-start-edit', {
                detail: { 
                  type: 'rename', 
                  parentPath: contextMenu.file.path,
                  oldPath: contextMenu.file.path,
                  oldName
                }
              }));
            }
          }}
          onDelete={() => {
            if (contextMenu.file) {
              handleDeleteFile(contextMenu.file.path);
            }
          }}
          onCopy={() => {
            if (contextMenu.file) {
              navigator.clipboard.writeText(contextMenu.file.path);
              showAlert('路径已复制到剪贴板', 'success');
            }
          }}
          onOpenTerminal={() => {
            if (contextMenu.file) {
              let targetDir: string;
              if (contextMenu.file.type === 'directory') {
                targetDir = contextMenu.file.path;
              } else {
                // 如果是文件，使用文件所在目录
                const lastSlash = Math.max(
                  contextMenu.file.path.lastIndexOf('/'),
                  contextMenu.file.path.lastIndexOf('\\')
                );
                targetDir = contextMenu.file.path.substring(0, lastSlash);
              }
              
              // 如果终端面板已打开，创建新终端
              if (showTerminal && terminalPanelRef.current) {
                terminalPanelRef.current.createTerminal(targetDir);
              } else {
                // 否则打开终端面板并创建终端
                setTerminalWorkingDir(targetDir);
                setShowTerminal(true);
                // 延迟创建终端，等待面板渲染
                setTimeout(() => {
                  if (terminalPanelRef.current) {
                    terminalPanelRef.current.createTerminal(targetDir);
                  }
                }, 100);
              }
            }
          }}
          onRun={async () => {
            if (!contextMenu.file || !workspaceRoot) return;
            
            const filePath = contextMenu.file.path;
            const fileName = contextMenu.file.name;
            
            // 获取文件所在目录
            const lastSlash = Math.max(
              filePath.lastIndexOf('/'),
              filePath.lastIndexOf('\\')
            );
            const fileDir = filePath.substring(0, lastSlash);
            
            // 创建运行配置
            const config: RunConfiguration = {
              id: `run-${Date.now()}`,
              name: `运行 ${fileName}`,
              command: 'go run',
              workingDirectory: fileDir,
              arguments: [fileName],
              environment: {},
              description: `运行 ${filePath}`,
            };
            
            // 添加到运行配置
            const existingConfigs = JSON.parse(localStorage.getItem('gopilot_run_configurations') || '[]');
            // 检查是否已存在相同配置
            const existingConfig = existingConfigs.find((c: RunConfiguration) => 
              c.command === config.command && 
              c.workingDirectory === config.workingDirectory &&
              JSON.stringify(c.arguments) === JSON.stringify(config.arguments)
            );
            
            if (!existingConfig) {
              existingConfigs.push(config);
              localStorage.setItem('gopilot_run_configurations', JSON.stringify(existingConfigs));
            }
            
            // 确保终端面板打开
            if (!showTerminal) {
              setShowTerminal(true);
              // 等待终端面板挂载完成
              await new Promise<void>(resolve => {
                const checkReady = () => {
                  if (terminalPanelRef.current) {
                    resolve();
                  } else {
                    setTimeout(checkReady, 50);
                  }
                };
                checkReady();
              });
            }
            
            // 在终端中执行命令
            if (terminalPanelRef.current) {
              const command = `go run ${fileName}`;
              await terminalPanelRef.current.executeCommand(command, fileDir, {});
              showAlert(`已运行 ${fileName} 并添加到运行配置`, 'success');
            }
          }}
          hasMainFunction={fileHasMain}
          isDirectory={contextMenu.file.type === 'directory'}
        />
      )}

      {/* File Search */}
      <FileSearch
        files={files}
        onFileSelect={handleFileSelect}
        onClose={() => setShowSearch(false)}
        isOpen={showSearch}
      />

      {/* Git Panel */}
      {showGit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full h-full max-w-4xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden">
            <GitPanel workspaceRoot={workspaceRoot} onClose={() => setShowGit(false)} />
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full h-full max-w-6xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden">
            <Settings onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}

      {/* References Panel */}
      {showReferences && (
        <ReferencesPanel
          references={references}
          symbolName={referenceSymbol}
          onClose={() => setShowReferences(false)}
          onNavigate={async (filePath: string, line: number, column: number) => {
            // 关闭引用面板
            setShowReferences(false);
            
            // 打开目标文件
            const targetFileName = filePath.split(/[/\\]/).pop() || 'untitled';
            const fileNode: FileNode = {
              name: targetFileName,
              path: filePath,
              type: 'file',
            };
            
            // 选择文件（会打开新标签页）
            await handleFileSelect(fileNode);
            
            // 等待文件加载后跳转到指定位置
            setTimeout(() => {
              window.dispatchEvent(new CustomEvent('navigate-to-position', {
                detail: { filePath, line, column }
              }));
            }, 500);
          }}
        />
      )}
    </div>
  );
};

export default Editor;
