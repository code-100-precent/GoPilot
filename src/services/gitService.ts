import { invoke } from '@tauri-apps/api/tauri';

export interface GitStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'staged';
  staged?: boolean;
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
  timestamp?: number;
}

export interface GitDiff {
  file: string;
  additions: number;
  deletions: number;
  hunks: Array<{
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: Array<{
      type: 'added' | 'deleted' | 'context';
      content: string;
      oldLineNumber?: number;
      newLineNumber?: number;
    }>;
  }>;
}

/**
 * Git 服务 - 使用 Tauri 后端执行 Git 命令
 */
export class GitService {
  /**
   * 检查目录是否是 Git 仓库
   */
  static async isGitRepository(path: string): Promise<boolean> {
    try {
      return await invoke<boolean>('is_git_repository', { path });
    } catch (error) {
      console.error('检查 Git 仓库失败:', error);
      return false;
    }
  }

  /**
   * 初始化 Git 仓库
   */
  static async initGit(path: string): Promise<void> {
    try {
      await invoke('git_init', { path });
    } catch (error) {
      console.error('初始化 Git 仓库失败:', error);
      throw error;
    }
  }

  /**
   * 获取 Git 状态
   */
  static async getStatus(path: string): Promise<GitStatus[]> {
    try {
      return await invoke<GitStatus[]>('git_status', { path });
    } catch (error) {
      console.error('获取 Git 状态失败:', error);
      return [];
    }
  }

  /**
   * 获取当前分支
   */
  static async getCurrentBranch(path: string): Promise<string | null> {
    try {
      return await invoke<string | null>('git_current_branch', { path });
    } catch (error) {
      console.error('获取当前分支失败:', error);
      return null;
    }
  }

  /**
   * 获取所有分支
   */
  static async getBranches(path: string): Promise<GitBranch[]> {
    try {
      return await invoke<GitBranch[]>('git_branches', { path });
    } catch (error) {
      console.error('获取分支列表失败:', error);
      return [];
    }
  }

  /**
   * 切换分支
   */
  static async checkoutBranch(path: string, branchName: string): Promise<void> {
    try {
      await invoke('git_checkout', { path, branch: branchName });
    } catch (error) {
      console.error('切换分支失败:', error);
      throw error;
    }
  }

  /**
   * 创建新分支
   */
  static async createBranch(path: string, branchName: string): Promise<void> {
    try {
      await invoke('git_create_branch', { path, branch: branchName });
    } catch (error) {
      console.error('创建分支失败:', error);
      throw error;
    }
  }

  /**
   * 添加文件到暂存区
   */
  static async addFiles(path: string, files: string[]): Promise<void> {
    try {
      await invoke('git_add', { path, files });
    } catch (error) {
      console.error('添加文件失败:', error);
      throw error;
    }
  }

  /**
   * 提交更改
   */
  static async commit(path: string, message: string): Promise<void> {
    try {
      await invoke('git_commit', { path, message });
    } catch (error) {
      console.error('提交失败:', error);
      throw error;
    }
  }

  /**
   * 获取提交历史
   */
  static async getCommits(path: string, limit: number = 20): Promise<GitCommit[]> {
    try {
      return await invoke<GitCommit[]>('git_log', { path, limit });
    } catch (error) {
      console.error('获取提交历史失败:', error);
      return [];
    }
  }

  /**
   * 拉取远程更改
   */
  static async pull(path: string): Promise<void> {
    try {
      await invoke('git_pull', { path });
    } catch (error) {
      console.error('拉取失败:', error);
      throw error;
    }
  }

  /**
   * 推送到远程
   */
  static async push(path: string): Promise<void> {
    try {
      await invoke('git_push', { path });
    } catch (error) {
      console.error('推送失败:', error);
      throw error;
    }
  }

  /**
   * 撤销更改
   */
  static async discardChanges(path: string, filePath: string): Promise<void> {
    try {
      await invoke('git_discard', { path, file: filePath });
    } catch (error) {
      console.error('撤销更改失败:', error);
      throw error;
    }
  }

  /**
   * 获取文件差异
   */
  static async getDiff(path: string, filePath: string): Promise<GitDiff | null> {
    try {
      return await invoke<GitDiff>('git_diff', { path, file: filePath });
    } catch (error) {
      console.error('获取差异失败:', error);
      return null;
    }
  }

  /**
   * 获取分支图
   */
  static async getBranchGraph(path: string): Promise<{
    commits: Array<{
      graph: string;
      hash: string;
      message: string;
      author: string;
      date: string;
      refs: string;
    }>;
  }> {
    try {
      const result = await invoke<{
        lines?: Array<{
          graph: string;
          hash: string;
          message: string;
          author: string;
          timestamp: number;
          refs: string;
        }>;
        commits?: Array<{
          graph: string;
          hash: string;
          message: string;
          author: string;
          date: string;
          refs: string;
        }>;
      }>('git_branch_graph', { path });
      
      // 兼容两种返回格式
      if (result.lines) {
        return {
          commits: result.lines.map(line => {
            // 转换时间戳为 ISO 8601 格式
            let dateStr = '';
            if (line.timestamp && typeof line.timestamp === 'number' && line.timestamp > 0) {
              try {
                // 时间戳是秒，需要转换为毫秒
                const date = new Date(line.timestamp * 1000);
                if (!isNaN(date.getTime()) && date.getTime() > 0) {
                  dateStr = date.toISOString();
                } else {
                  console.warn('无效的时间戳转换结果:', {
                    timestamp: line.timestamp,
                    date: date,
                    time: date.getTime()
                  });
                }
              } catch (e) {
                console.error('日期转换异常:', e, '时间戳:', line.timestamp);
              }
            } else {
              console.warn('时间戳无效:', {
                timestamp: line.timestamp,
                type: typeof line.timestamp,
                line: line
              });
            }
            return {
              graph: line.graph || '',
              hash: line.hash || '',
              message: line.message || '',
              author: line.author || '',
              date: dateStr,
              refs: line.refs || '',
            };
          }),
        };
      }
      
      return result.commits ? { commits: result.commits } : { commits: [] };
    } catch (error) {
      console.error('获取分支图失败:', error);
      return { commits: [] };
    }
  }
}

