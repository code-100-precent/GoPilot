import { invoke } from '@tauri-apps/api/tauri';

export interface FileSystemEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileSystemEntry[];
}

/**
 * 文件系统服务 - 使用 Tauri 后端命令
 */
export class FileSystemService {
  /**
   * 读取文件内容
   */
  static async readFileContent(filePath: string): Promise<string> {
    try {
      return await invoke<string>('read_file', { path: filePath });
    } catch (error) {
      console.error('读取文件失败:', error);
      throw error;
    }
  }

  /**
   * 读取二进制文件（返回 base64 编码）
   */
  static async readBinaryFile(filePath: string): Promise<string> {
    try {
      return await invoke<string>('read_binary_file', { path: filePath });
    } catch (error) {
      console.error('读取二进制文件失败:', error);
      throw error;
    }
  }

  /**
   * 写入文件内容
   */
  static async writeFileContent(filePath: string, content: string): Promise<void> {
    try {
      await invoke('write_file', { path: filePath, content });
    } catch (error) {
      console.error('写入文件失败:', error);
      throw error;
    }
  }

  /**
   * 读取目录内容
   */
  static async readDirectory(dirPath: string): Promise<FileSystemEntry[]> {
    try {
      const entries = await invoke<FileSystemEntry[]>('read_directory', { path: dirPath });
      return entries;
    } catch (error) {
      console.error('读取目录失败:', error);
      throw error;
    }
  }

  /**
   * 递归读取目录树
   */
  static async readDirectoryTree(dirPath: string, maxDepth: number = 5): Promise<FileSystemEntry[]> {
    try {
      const entries = await invoke<FileSystemEntry[]>('read_directory_tree', {
        path: dirPath,
        maxDepth,
      });
      return entries;
    } catch (error) {
      console.error('读取目录树失败:', error);
      throw error;
    }
  }

  /**
   * 创建文件
   */
  static async createFile(filePath: string): Promise<void> {
    try {
      await invoke('create_file', { path: filePath });
    } catch (error) {
      console.error('创建文件失败:', error);
      throw error;
    }
  }

  /**
   * 创建目录
   */
  static async createDirectory(dirPath: string): Promise<void> {
    try {
      await invoke('create_directory', { path: dirPath });
    } catch (error) {
      console.error('创建目录失败:', error);
      throw error;
    }
  }

  /**
   * 删除文件或目录
   */
  static async deleteFile(path: string): Promise<void> {
    try {
      await invoke('delete_file', { path });
    } catch (error) {
      console.error('删除文件失败:', error);
      throw error;
    }
  }

  /**
   * 重命名文件或目录
   */
  static async renameFile(oldPath: string, newPath: string): Promise<void> {
    try {
      await invoke('rename_file', { oldPath, newPath });
    } catch (error) {
      console.error('重命名文件失败:', error);
      throw error;
    }
  }

  /**
   * 检查路径是否存在
   */
  static async pathExists(path: string): Promise<boolean> {
    try {
      return await invoke<boolean>('path_exists', { path });
    } catch (error) {
      console.error('检查路径失败:', error);
      return false;
    }
  }

  /**
   * 获取文件的语言类型（用于代码高亮）
   */
  static getLanguageFromPath(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase();
    
    const languageMap: Record<string, string> = {
      'go': 'go',
      'mod': 'go.mod',
      'sum': 'go.sum',
      'js': 'javascript',
      'ts': 'typescript',
      'tsx': 'typescript',
      'jsx': 'javascript',
      'json': 'json',
      'yaml': 'yaml',
      'yml': 'yaml',
      'md': 'markdown',
      'html': 'html',
      'css': 'css',
      'scss': 'scss',
      'sass': 'sass',
      'less': 'less',
      'py': 'python',
      'java': 'java',
      'c': 'c',
      'cpp': 'cpp',
      'cc': 'cpp',
      'cxx': 'cpp',
      'h': 'c',
      'hpp': 'cpp',
      'rs': 'rust',
      'php': 'php',
      'rb': 'ruby',
      'sh': 'shell',
      'bash': 'shell',
      'zsh': 'shell',
      'sql': 'sql',
      'xml': 'xml',
      'toml': 'toml',
      'ini': 'ini',
      'cfg': 'ini',
      'conf': 'ini',
    };
    
    return languageMap[ext || ''] || 'plaintext';
  }

  /**
   * 检查是否为图片文件
   */
  static isImageFile(filePath: string): boolean {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp', 'svg', 'ico', 'tiff', 'tif'];
    return imageExtensions.includes(ext || '');
  }

  /**
   * 检查是否为音频文件
   */
  static isAudioFile(filePath: string): boolean {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const audioExtensions = ['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a', 'wma', 'opus', 'pcm'];
    return audioExtensions.includes(ext || '');
  }

  /**
   * 检查是否为视频文件
   */
  static isVideoFile(filePath: string): boolean {
    const ext = filePath.split('.').pop()?.toLowerCase();
    const videoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm', 'mkv', 'm4v'];
    return videoExtensions.includes(ext || '');
  }
}
