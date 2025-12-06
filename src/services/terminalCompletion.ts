import { FileSystemService } from './fileSystem';

/**
 * 终端补全服务
 */
export class TerminalCompletionService {
  /**
   * 获取补全建议
   */
  static async getCompletions(
    input: string,
    currentDir: string
  ): Promise<string[]> {
    if (!input || !currentDir) return [];

    // 解析输入，获取最后一个词（可能是文件/目录名）
    const parts = input.trim().split(/\s+/);
    const lastPart = parts[parts.length - 1] || '';
    
    // 如果最后一部分是空的，或者以空格结尾，返回空
    if (!lastPart) return [];

    // 提取路径部分和前缀
    const pathMatch = lastPart.match(/^(.+?\/)?([^\/]*)$/);
    if (!pathMatch) return [];

    const [, dirPart = '', prefix = ''] = pathMatch;
    const searchDir = dirPart 
      ? `${currentDir}/${dirPart}`.replace(/\/+/g, '/')
      : currentDir;

    try {
      // 读取目录内容
      const entries = await FileSystemService.readDirectory(searchDir);
      
      // 过滤匹配的文件/目录
      const matches = entries
        .filter(entry => entry.name.startsWith(prefix))
        .map(entry => {
          const suffix = entry.type === 'directory' ? '/' : '';
          return dirPart ? `${dirPart}${entry.name}${suffix}` : `${entry.name}${suffix}`;
        })
        .sort((a, b) => {
          // 目录优先
          const aIsDir = a.endsWith('/');
          const bIsDir = b.endsWith('/');
          if (aIsDir && !bIsDir) return -1;
          if (!aIsDir && bIsDir) return 1;
          return a.localeCompare(b);
        });

      return matches;
    } catch (error) {
      console.error('Tab completion error:', error);
      return [];
    }
  }

  /**
   * 获取最长公共前缀
   */
  static getCommonPrefix(strings: string[]): string {
    if (strings.length === 0) return '';
    if (strings.length === 1) return strings[0];

    let prefix = strings[0];
    for (let i = 1; i < strings.length; i++) {
      while (!strings[i].startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
        if (!prefix) return '';
      }
    }
    return prefix;
  }
}

