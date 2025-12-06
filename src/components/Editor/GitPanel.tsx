import React, { useState, useEffect, useCallback } from 'react';
import { GitBranch, GitCommit, Plus, RefreshCw, Upload, Download, Check, X, AlertCircle, Eye, GitMerge, Trash2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import { GitService, GitStatus, GitBranch as GitBranchType, GitCommit as GitCommitType, GitDiff } from '@/services/gitService';
import { FileSystemService } from '@/services/fileSystem';
import { showAlert } from '@/utils/notification';

interface GitPanelProps {
  workspaceRoot: string | null;
  onClose?: () => void;
}

const GitPanel: React.FC<GitPanelProps> = ({ workspaceRoot, onClose }) => {
  const [isGitRepo, setIsGitRepo] = useState(false);
  const [currentBranch, setCurrentBranch] = useState<string | null>(null);
  const [branches, setBranches] = useState<GitBranchType[]>([]);
  const [status, setStatus] = useState<GitStatus[]>([]);
  const [commits, setCommits] = useState<GitCommitType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'branches' | 'commits' | 'graph'>('status');
  const [commitMessage, setCommitMessage] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [newBranchName, setNewBranchName] = useState('');
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<GitDiff | null>(null);
  const [branchGraph, setBranchGraph] = useState<{
    commits: Array<{
      graph: string;
      hash: string;
      message: string;
      author: string;
      date: string;
      refs: string;
    }>;
  }>({ commits: [] });

  const loadGitInfo = useCallback(async () => {
    if (!workspaceRoot) return;

    setIsLoading(true);
    try {
      const isRepo = await GitService.isGitRepository(workspaceRoot);
      setIsGitRepo(isRepo);

      if (isRepo) {
        const [branch, branchList, gitStatus, gitCommits, graph] = await Promise.all([
          GitService.getCurrentBranch(workspaceRoot),
          GitService.getBranches(workspaceRoot),
          GitService.getStatus(workspaceRoot),
          GitService.getCommits(workspaceRoot, 20),
          GitService.getBranchGraph(workspaceRoot),
        ]);

        setCurrentBranch(branch);
        setBranches(branchList);
        setStatus(gitStatus);
        setCommits(gitCommits);
        setBranchGraph(graph);
      }
    } catch (error: any) {
      console.error('加载 Git 信息失败:', error);
      showAlert('加载 Git 信息失败: ' + (error.message || error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceRoot]);

  useEffect(() => {
    loadGitInfo();
  }, [loadGitInfo]);

  const handleAddFiles = useCallback(async () => {
    if (!workspaceRoot || selectedFiles.size === 0) return;

    try {
      setIsLoading(true);
      await GitService.addFiles(workspaceRoot, Array.from(selectedFiles));
      showAlert('文件已添加到暂存区', 'success');
      setSelectedFiles(new Set());
      await loadGitInfo();
    } catch (error: any) {
      showAlert('添加文件失败: ' + (error.message || error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceRoot, selectedFiles, loadGitInfo]);

  const handleCommit = useCallback(async () => {
    if (!workspaceRoot || !commitMessage.trim()) {
      showAlert('请输入提交信息', 'warning');
      return;
    }

    try {
      setIsLoading(true);
      await GitService.commit(workspaceRoot, commitMessage);
      showAlert('提交成功', 'success');
      setCommitMessage('');
      setSelectedFiles(new Set());
      await loadGitInfo();
    } catch (error: any) {
      showAlert('提交失败: ' + (error.message || error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceRoot, commitMessage, loadGitInfo]);

  const handleCheckout = useCallback(async (branchName: string) => {
    if (!workspaceRoot) return;

    try {
      setIsLoading(true);
      await GitService.checkoutBranch(workspaceRoot, branchName);
      showAlert(`已切换到分支: ${branchName}`, 'success');
      await loadGitInfo();
    } catch (error: any) {
      showAlert('切换分支失败: ' + (error.message || error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceRoot, loadGitInfo]);

  const handleCreateBranch = useCallback(async () => {
    if (!workspaceRoot || !newBranchName.trim()) {
      showAlert('请输入分支名称', 'warning');
      return;
    }

    try {
      setIsLoading(true);
      await GitService.createBranch(workspaceRoot, newBranchName);
      showAlert(`已创建并切换到分支: ${newBranchName}`, 'success');
      setNewBranchName('');
      await loadGitInfo();
    } catch (error: any) {
      showAlert('创建分支失败: ' + (error.message || error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceRoot, newBranchName, loadGitInfo]);

  const handlePull = useCallback(async () => {
    if (!workspaceRoot) return;

    try {
      setIsLoading(true);
      await GitService.pull(workspaceRoot);
      showAlert('拉取成功', 'success');
      await loadGitInfo();
    } catch (error: any) {
      showAlert('拉取失败: ' + (error.message || error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceRoot, loadGitInfo]);

  const handlePush = useCallback(async () => {
    if (!workspaceRoot) return;

    try {
      setIsLoading(true);
      await GitService.push(workspaceRoot);
      showAlert('推送成功', 'success');
      await loadGitInfo();
    } catch (error: any) {
      showAlert('推送失败: ' + (error.message || error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceRoot, loadGitInfo]);

  const handleDiscard = useCallback(async (filePath: string) => {
    if (!workspaceRoot) return;
    if (!confirm(`确定要撤销 ${filePath} 的更改吗？此操作不可撤销。`)) {
      return;
    }

    try {
      setIsLoading(true);
      await GitService.discardChanges(workspaceRoot, filePath);
      showAlert('已撤销更改', 'success');
      await loadGitInfo();
    } catch (error: any) {
      showAlert('撤销失败: ' + (error.message || error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceRoot, loadGitInfo]);

  const handleDeleteFile = useCallback(async (filePath: string) => {
    if (!workspaceRoot) return;
    if (!confirm(`确定要删除文件 ${filePath} 吗？此操作不可撤销。`)) {
      return;
    }

    try {
      setIsLoading(true);
      const fullPath = workspaceRoot + '/' + filePath;
      await FileSystemService.deleteFile(fullPath);
      showAlert('文件已删除', 'success');
      await loadGitInfo();
    } catch (error: any) {
      showAlert('删除失败: ' + (error.message || error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceRoot, loadGitInfo]);

  const handleViewDiff = useCallback(async (filePath: string) => {
    if (!workspaceRoot) return;
    
    try {
      setIsLoading(true);
      const diff = await GitService.getDiff(workspaceRoot, filePath);
      if (diff) {
        setSelectedFile(filePath);
        setFileDiff(diff);
      } else {
        showAlert('无法获取文件差异', 'warning');
      }
    } catch (error: any) {
      showAlert('获取差异失败: ' + (error.message || error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceRoot]);

  const toggleFileSelection = (filePath: string) => {
    setSelectedFiles(prev => {
      const newSet = new Set(prev);
      if (newSet.has(filePath)) {
        newSet.delete(filePath);
      } else {
        newSet.add(filePath);
      }
      return newSet;
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'modified':
        return 'text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20';
      case 'added':
        return 'text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20';
      case 'deleted':
        return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20';
      case 'untracked':
        return 'text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20';
      default:
        return 'text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'modified':
        return '已修改';
      case 'added':
        return '新增';
      case 'deleted':
        return '已删除';
      case 'untracked':
        return '未跟踪';
      case 'renamed':
        return '已重命名';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'modified':
        return 'M';
      case 'added':
        return 'A';
      case 'deleted':
        return 'D';
      case 'untracked':
        return '?';
      default:
        return '•';
    }
  };

  if (!workspaceRoot) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center text-gray-500 dark:text-gray-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p>请先打开工作区</p>
        </div>
      </div>
    );
  }

  const handleInitGit = useCallback(async () => {
    if (!workspaceRoot) return;
    if (!confirm(`确定要在 ${workspaceRoot} 初始化 Git 仓库吗？`)) {
      return;
    }

    try {
      setIsLoading(true);
      await GitService.initGit(workspaceRoot);
      showAlert('Git 仓库初始化成功', 'success');
      await loadGitInfo();
    } catch (error: any) {
      showAlert('初始化失败: ' + (error.message || error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [workspaceRoot, loadGitInfo]);

  if (!isGitRepo) {
    return (
      <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Header with close button */}
        <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
          <div className="flex items-center gap-2">
            <GitBranch className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <span className="font-semibold text-gray-900 dark:text-white">Git</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        
        {/* Content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500 dark:text-gray-400">
            <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p className="mb-2 text-lg font-medium">当前目录不是 Git 仓库</p>
            <p className="text-sm mb-6">初始化 Git 仓库以开始版本控制</p>
            <button
              onClick={handleInitGit}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>初始化中...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>初始化 Git 仓库</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <div className="flex items-center gap-2">
          <GitBranch className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="font-semibold text-gray-900 dark:text-white">Git</span>
          {currentBranch && (
            <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
              {currentBranch}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadGitInfo}
            disabled={isLoading}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
            title="刷新"
          >
            <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              title="关闭"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 bg-white dark:bg-gray-800 border-b dark:border-gray-700">
        <button
          onClick={() => setActiveTab('status')}
          className={cn(
            "px-3 py-1.5 text-sm rounded transition-colors",
            activeTab === 'status'
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          状态
        </button>
        <button
          onClick={() => setActiveTab('branches')}
          className={cn(
            "px-3 py-1.5 text-sm rounded transition-colors",
            activeTab === 'branches'
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          分支
        </button>
        <button
          onClick={() => setActiveTab('commits')}
          className={cn(
            "px-3 py-1.5 text-sm rounded transition-colors",
            activeTab === 'commits'
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          提交历史
        </button>
        <button
          onClick={() => setActiveTab('graph')}
          className={cn(
            "px-3 py-1.5 text-sm rounded transition-colors",
            activeTab === 'graph'
              ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
              : "text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
          )}
        >
          <GitMerge className="w-4 h-4 inline mr-1" />
          分支图
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'status' && (
          <div className="space-y-4">
            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handlePull}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
              >
                <Download className="w-4 h-4" />
                拉取
              </button>
              <button
                onClick={handlePush}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                推送
              </button>
            </div>

            {/* File Status */}
            {status.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                    更改的文件 ({status.length})
                  </h3>
                  {selectedFiles.size > 0 && (
                    <button
                      onClick={handleAddFiles}
                      className="flex items-center gap-1 px-2 py-1 text-xs bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                    >
                      <Check className="w-3 h-3" />
                      添加到暂存区 ({selectedFiles.size})
                    </button>
                  )}
                </div>
                {status.map((item) => (
                  <div
                    key={item.path}
                    className="flex items-center gap-3 p-2 bg-white dark:bg-gray-800 rounded border dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => handleViewDiff(item.path)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedFiles.has(item.path)}
                      onChange={(e) => {
                        e.stopPropagation();
                        toggleFileSelection(item.path);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-4 h-4"
                    />
                    <span className={cn("text-xs font-mono w-6 text-center px-1 py-0.5 rounded", getStatusColor(item.status))}>
                      {getStatusIcon(item.status)}
                    </span>
                    <span className="flex-1 text-sm text-gray-900 dark:text-gray-100 truncate">
                      {item.path}
                    </span>
                    <span className={cn("text-xs px-2 py-0.5 rounded font-medium", getStatusColor(item.status))}>
                      {getStatusLabel(item.status)}
                    </span>
                    {item.staged && (
                      <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                        已暂存
                      </span>
                    )}
                    {item.status !== 'untracked' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDiff(item.path);
                        }}
                        className="p-1 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded transition-colors"
                        title="查看差异"
                      >
                        <Eye className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      </button>
                    )}
                    {item.status === 'untracked' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFile(item.path);
                        }}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="删除文件"
                      >
                        <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </button>
                    )}
                    {(item.status === 'modified' || item.status === 'added') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDiscard(item.path);
                        }}
                        className="p-1 hover:bg-red-100 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="撤销更改"
                      >
                        <X className="w-4 h-4 text-red-600 dark:text-red-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Check className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>工作区干净，没有更改</p>
              </div>
            )}

            {/* Commit */}
            {status.length > 0 && (
              <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded border dark:border-gray-700">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">提交更改</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                    placeholder="输入提交信息..."
                    className="flex-1 px-3 py-2 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleCommit();
                      }
                    }}
                  />
                  <button
                    onClick={handleCommit}
                    disabled={!commitMessage.trim() || isLoading}
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <GitCommit className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'branches' && (
          <div className="space-y-4">
            {/* Create Branch */}
            <div className="p-4 bg-white dark:bg-gray-800 rounded border dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2">创建新分支</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  placeholder="分支名称..."
                  className="flex-1 px-3 py-2 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateBranch();
                    }
                  }}
                />
                <button
                  onClick={handleCreateBranch}
                  disabled={!newBranchName.trim() || isLoading}
                  className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  创建
                </button>
              </div>
            </div>

            {/* Branches List */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">分支列表</h3>
              {branches.map((branch) => (
                <div
                  key={branch.name}
                  className={cn(
                    "flex items-center justify-between p-3 rounded border transition-colors",
                    branch.isCurrent
                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                      : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {branch.name}
                    </span>
                    {branch.isCurrent && (
                      <span className="px-2 py-0.5 text-xs bg-blue-600 text-white rounded">
                        当前
                      </span>
                    )}
                    {branch.isRemote && (
                      <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                        远程
                      </span>
                    )}
                  </div>
                  {!branch.isCurrent && !branch.isRemote && (
                    <button
                      onClick={() => handleCheckout(branch.name)}
                      disabled={isLoading}
                      className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors disabled:opacity-50"
                    >
                      切换
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'commits' && (
          <div className="space-y-2">
            {commits.length > 0 ? (
              commits.map((commit) => (
                <div
                  key={commit.hash}
                  className="p-3 bg-white dark:bg-gray-800 rounded border dark:border-gray-700"
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {commit.message}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {commit.author} • {(() => {
                          let dateStr = '未知日期';
                          try {
                            if (commit.date) {
                              const date = new Date(commit.date);
                              if (!isNaN(date.getTime())) {
                                dateStr = date.toLocaleString('zh-CN', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                });
                              }
                            }
                          } catch (e) {
                            console.error('日期解析失败:', e);
                          }
                          return dateStr;
                        })()}
                      </p>
                    </div>
                    <code className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                      {commit.hash.substring(0, 7)}
                    </code>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <GitCommit className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>暂无提交历史</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'graph' && (
          <div className="space-y-4">
            <div className="p-4 bg-white dark:bg-gray-800 rounded border dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">分支关系图</h3>
              {branchGraph?.commits && branchGraph.commits.length > 0 ? (
                <div className="space-y-1 font-mono text-xs">
                  {branchGraph.commits.map((commit, index) => {
                    // 解析图形字符，添加颜色
                    const graphDisplay = commit.graph.split('').map((char, i) => {
                      if (char === '*') {
                        return <span key={i} className="text-blue-600 dark:text-blue-400 font-bold">●</span>;
                      } else if (char === '|') {
                        return <span key={i} className="text-gray-400 dark:text-gray-600">│</span>;
                      } else if (char === '/') {
                        return <span key={i} className="text-gray-400 dark:text-gray-600">╱</span>;
                      } else if (char === '\\') {
                        return <span key={i} className="text-gray-400 dark:text-gray-600">╲</span>;
                      } else {
                        return <span key={i} className="text-gray-300 dark:text-gray-700">{char}</span>;
                      }
                    });
                    
                    let dateStr = '未知日期';
                    try {
                      if (commit.date && commit.date.trim()) {
                        // 尝试解析 ISO 8601 格式
                        const date = new Date(commit.date);
                        if (!isNaN(date.getTime()) && date.getTime() > 0) {
                          dateStr = date.toLocaleString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit'
                          });
                        } else {
                          console.warn('日期解析失败，无效的日期值:', commit.date, '解析结果:', date);
                        }
                      } else {
                        console.warn('日期字段为空:', commit);
                      }
                    } catch (e) {
                      console.error('日期解析异常:', e, 'commit.date:', commit.date, '完整 commit:', commit);
                    }
                    
                    return (
                      <div
                        key={index}
                        className="flex items-start gap-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-700/50 rounded transition-colors"
                      >
                        <div className="flex-shrink-0 text-gray-400 dark:text-gray-600">
                          {graphDisplay}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <code className="text-blue-600 dark:text-blue-400 font-semibold">
                              {commit.hash}
                            </code>
                            <span className="text-gray-900 dark:text-gray-100 font-medium truncate">
                              {commit.message}
                            </span>
                            {commit.refs && commit.refs.trim() && (
                              <span className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded whitespace-nowrap">
                                {commit.refs.trim()}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {commit.author} • {dateStr}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <GitMerge className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>暂无分支图数据</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Diff Viewer Modal */}
      {selectedFile && fileDiff && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full h-full max-w-5xl max-h-[90vh] bg-white dark:bg-gray-900 rounded-lg shadow-2xl overflow-hidden flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b dark:border-gray-700">
              <div className="flex items-center gap-3">
                <h3 className="font-semibold text-gray-900 dark:text-white">{selectedFile}</h3>
                <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                  +{fileDiff.additions}
                </span>
                <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded">
                  -{fileDiff.deletions}
                </span>
              </div>
              <button
                onClick={() => {
                  setSelectedFile(null);
                  setFileDiff(null);
                }}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Diff Content */}
            <div className="flex-1 overflow-y-auto p-4">
              {fileDiff.hunks.map((hunk, hunkIndex) => (
                <div key={hunkIndex} className="mb-4">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                  </div>
                  <div className="space-y-0.5">
                    {hunk.lines.map((line, lineIndex) => (
                      <div
                        key={lineIndex}
                        className={cn(
                          "flex items-start font-mono text-sm",
                          line.type === 'added' && "bg-green-50 dark:bg-green-900/20",
                          line.type === 'deleted' && "bg-red-50 dark:bg-red-900/20",
                          line.type === 'context' && "bg-white dark:bg-gray-900"
                        )}
                      >
                        <div className="flex-shrink-0 w-16 text-right px-2 py-1 text-xs text-gray-500 dark:text-gray-400 border-r dark:border-gray-700">
                          {line.oldLineNumber || ' '}
                        </div>
                        <div className="flex-shrink-0 w-16 text-right px-2 py-1 text-xs text-gray-500 dark:text-gray-400 border-r dark:border-gray-700">
                          {line.newLineNumber || ' '}
                        </div>
                        <div className="flex-shrink-0 w-4 text-center py-1">
                          {line.type === 'added' && (
                            <span className="text-green-600 dark:text-green-400">+</span>
                          )}
                          {line.type === 'deleted' && (
                            <span className="text-red-600 dark:text-red-400">-</span>
                          )}
                          {line.type === 'context' && (
                            <span className="text-gray-400"> </span>
                          )}
                        </div>
                        <div className="flex-1 px-2 py-1 text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">
                          {line.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitPanel;

