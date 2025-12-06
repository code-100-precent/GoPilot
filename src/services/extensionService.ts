/**
 * VSCode Extension Marketplace Service
 * 从 VSCode Marketplace API 获取扩展数据
 */

export interface VSCodeExtension {
  extensionId: string;
  extensionName: string;
  publisher: {
    publisherName: string;
    displayName: string;
    flags: string;
  };
  shortDescription: string;
  versions: Array<{
    version: string;
    flags: string;
    lastUpdated: string;
    files: Array<{
      assetType: string;
      source: string;
    }>;
    properties?: Array<{
      key: string;
      value: string;
    }>;
  }>;
  statistics: Array<{
    statisticName: string;
    value: number;
  }>;
  categories: string[];
  tags: string[];
  releaseDate: string;
  publishedDate: string;
  flags: string;
  installationTargets?: Array<{
    target: string;
    targetVersion: string;
  }>;
  deploymentType?: number;
}

export interface ExtensionSearchResult {
  results: Array<{
    extensions: VSCodeExtension[];
    resultMetadata: Array<{
      metadataType: string;
      metadataItems: Array<{
        name: string;
        count: number;
      }>;
    }>;
  }>;
}

export interface InstalledExtension {
  id: string;
  name: string;
  publisher: string;
  version: string;
  displayName: string;
  description: string;
  installedPath: string;
  enabled: boolean;
  iconUrl?: string; // 扩展图标 URL
}

/**
 * VSCode Extension Marketplace Service
 */
export class ExtensionService {
  private static readonly MARKETPLACE_API = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';
  private static readonly API_VERSION = '3.0-preview.1';

  /**
   * 搜索扩展
   */
  static async searchExtensions(
    query: string = '',
    pageSize: number = 20,
    pageNumber: number = 1
  ): Promise<VSCodeExtension[]> {
    try {
      // 构建 criteria 数组
      const criteria: Array<{ filterType: number; value: string }> = [
        { filterType: 8, value: 'Microsoft.VisualStudio.Code' }, // 目标平台
      ];

      // 如果有搜索词，添加搜索条件
      if (query && query.trim()) {
        criteria.push({ filterType: 10, value: query.trim() }); // 搜索文本
      }

      // 添加发布状态条件 - 尝试不同的值
      // filterType 12: 1 = 已发布, 4 = 已验证, 8 = 已弃用
      // 不添加此条件，让 API 返回所有状态的扩展
      // criteria.push({ filterType: 12, value: '1' });

      const requestBody = {
        filters: [
          {
            criteria,
            pageNumber,
            pageSize,
            sortBy: 4, // 4 = 按下载量排序
            sortOrder: 0, // 0 = 降序
          },
        ],
        flags: 914, // 914 = 包含统计信息、版本信息等
      };

      // 调试日志
      console.log('Marketplace API 请求:', JSON.stringify(requestBody, null, 2));

      const response = await fetch(this.MARKETPLACE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': `application/json;api-version=${this.API_VERSION}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Marketplace API error: ${response.status} ${response.statusText}`);
      }

      const data: ExtensionSearchResult = await response.json();
      
      // 调试日志
      console.log('Marketplace API 响应:', {
        resultsCount: data.results?.length || 0,
        extensionsCount: data.results?.[0]?.extensions?.length || 0,
        sample: data.results?.[0]?.extensions?.[0] || null,
      });
      
      if (data.results && data.results.length > 0 && data.results[0].extensions) {
        return data.results[0].extensions;
      }
      
      return [];
    } catch (error: any) {
      console.error('搜索扩展失败:', error);
      throw new Error(`搜索扩展失败: ${error.message || error}`);
    }
  }

  /**
   * 获取热门扩展
   */
  static async getPopularExtensions(pageSize: number = 20): Promise<VSCodeExtension[]> {
    try {
      // 获取热门扩展，使用不同的排序方式
      const criteria: Array<{ filterType: number; value: string }> = [
        { filterType: 8, value: 'Microsoft.VisualStudio.Code' },
        // 暂时移除 filterType 12，看看是否能获取结果
        // { filterType: 12, value: '1' }, // 已发布的扩展
      ];

      const requestBody = {
        filters: [
          {
            criteria,
            pageNumber: 1,
            pageSize,
            sortBy: 4, // 按下载量排序
            sortOrder: 0, // 降序
          },
        ],
        flags: 914,
      };

      const response = await fetch(this.MARKETPLACE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': `application/json;api-version=${this.API_VERSION}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Marketplace API error: ${response.status} ${response.statusText}`);
      }

      const data: ExtensionSearchResult = await response.json();
      
      // 调试日志
      console.log('获取热门扩展 API 响应:', {
        resultsCount: data.results?.length || 0,
        extensionsCount: data.results?.[0]?.extensions?.length || 0,
      });
      
      if (data.results && data.results.length > 0 && data.results[0].extensions) {
        return data.results[0].extensions;
      }
      
      return [];
    } catch (error: any) {
      console.error('获取热门扩展失败:', error);
      throw new Error(`获取热门扩展失败: ${error.message || error}`);
    }
  }

  /**
   * 根据 ID 获取扩展详情
   */
  static async getExtensionById(publisher: string, extensionName: string): Promise<VSCodeExtension | null> {
    try {
      const requestBody = {
        filters: [
          {
            criteria: [
              { filterType: 8, value: 'Microsoft.VisualStudio.Code' },
              { filterType: 4, value: `${publisher}.${extensionName}` },
            ],
            pageNumber: 1,
            pageSize: 1,
          },
        ],
        flags: 914,
      };

      const response = await fetch(this.MARKETPLACE_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': `application/json;api-version=${this.API_VERSION}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Marketplace API error: ${response.status} ${response.statusText}`);
      }

      const data: ExtensionSearchResult = await response.json();
      
      if (data.results && data.results.length > 0 && data.results[0].extensions && data.results[0].extensions.length > 0) {
        return data.results[0].extensions[0];
      }
      
      return null;
    } catch (error: any) {
      console.error('获取扩展详情失败:', error);
      throw new Error(`获取扩展详情失败: ${error.message || error}`);
    }
  }

  /**
   * 下载扩展的 VSIX 文件
   */
  static async downloadVSIX(
    extension: VSCodeExtension,
    onProgress?: (loaded: number, total: number) => void
  ): Promise<Blob | { _isFileReference: true; path: string }> {
    try {
      // 获取最新版本的下载链接
      const latestVersion = extension.versions[0];
      if (!latestVersion) {
        throw new Error('扩展没有可用版本');
      }

      const vsixFile = latestVersion.files.find(f => f.assetType === 'Microsoft.VisualStudio.Services.VSIXPackage');
      if (!vsixFile) {
        throw new Error('找不到 VSIX 文件');
      }

      // 在 Tauri 环境中，使用后端命令下载文件以避免 CORS 问题
      if (window.__TAURI__) {
        try {
          const { invoke } = await import('@tauri-apps/api/tauri');
          const path = await import('@tauri-apps/api/path');
          const fs = await import('@tauri-apps/api/fs');
          
          // 创建临时文件路径
          const appData = await path.appDataDir();
          const tempDir = await path.join(appData, 'temp');
          
          try {
            await fs.createDir(tempDir, { recursive: true });
          } catch (e: any) {
            // 目录可能已存在，忽略错误
            if (!e.message?.includes('already exists')) {
              console.warn('创建临时目录失败:', e);
            }
          }
          
          const tempPath = await path.join(tempDir, `temp-${Date.now()}.vsix`);
          
          console.log('开始下载 VSIX 文件:', {
            url: vsixFile.source,
            savePath: tempPath,
          });
          
          // 使用 Rust 后端下载（目前不支持进度，但可以模拟）
          onProgress?.(0, 100);
          
          try {
            await invoke('download_file', {
              url: vsixFile.source,
              savePath: tempPath,
            });
          } catch (error: any) {
            console.error('下载文件失败:', error);
            throw new Error(`下载失败: ${error.message || error}`);
          }
          
          onProgress?.(100, 100);
          
          // 检查文件是否存在
          try {
            const exists = await fs.exists(tempPath);
            if (!exists) {
              throw new Error('下载的文件不存在');
            }
          } catch (e: any) {
            console.error('检查文件存在性失败:', e);
            throw new Error(`验证下载文件失败: ${e.message || e}`);
          }
          
          // 对于 Tauri 环境，我们不需要将整个文件读入内存
          // 直接返回一个特殊的标记，表示文件已经下载到临时路径
          // 在安装时直接使用文件路径，而不是 Blob
          return {
            _isFileReference: true,
            path: tempPath,
          } as any;
        } catch (error: any) {
          console.error('Tauri 下载过程出错:', error);
          throw error;
        }
      }

      // 浏览器环境：使用 XMLHttpRequest 以获取下载进度
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', vsixFile.source, true);
        xhr.responseType = 'blob';

        xhr.onprogress = (event) => {
          if (event.lengthComputable && onProgress) {
            onProgress(event.loaded, event.total);
          }
        };

        xhr.onload = () => {
          if (xhr.status === 200) {
            resolve(xhr.response);
          } else {
            reject(new Error(`下载失败: ${xhr.status} ${xhr.statusText}`));
          }
        };

        xhr.onerror = () => {
          reject(new Error('下载失败: 网络错误'));
        };

        xhr.send();
      });
    } catch (error: any) {
      console.error('下载 VSIX 失败:', error);
      throw new Error(`下载 VSIX 失败: ${error.message || error}`);
    }
  }

  /**
   * 从 VSIX 文件安装扩展
   */
  static async installFromVSIX(vsixPath: string): Promise<InstalledExtension> {
    try {
      // 在 Tauri 环境中，读取 VSIX 文件
      if (window.__TAURI__) {
        const { readBinaryFile } = await import('@tauri-apps/api/fs');
        const vsixData = await readBinaryFile(vsixPath);
        
        // TODO: 解析 VSIX 文件（ZIP 格式），提取 package.json
        // 目前先创建一个基本的扩展信息
        const fileName = vsixPath.split(/[/\\]/).pop() || 'extension.vsix';
        const extensionId = fileName.replace('.vsix', '');
        
        const installedExtension: InstalledExtension = {
          id: extensionId,
          name: extensionId,
          publisher: 'Unknown',
          version: '1.0.0',
          displayName: extensionId,
          description: '从 VSIX 文件安装的扩展',
          installedPath: vsixPath,
          enabled: true,
        };

        const installed = await this.getInstalledExtensions();
        installed.push(installedExtension);
        await this.saveInstalledExtensions(installed);
        
        return installedExtension;
      } else {
        throw new Error('VSIX 导入功能仅在 Tauri 环境中可用');
      }
    } catch (error: any) {
      console.error('从 VSIX 安装扩展失败:', error);
      throw new Error(`从 VSIX 安装扩展失败: ${error.message || error}`);
    }
  }

  /**
   * 获取扩展的统计信息
   */
  static getExtensionStats(extension: VSCodeExtension): {
    downloads: number;
    rating: number;
    ratingCount: number;
  } {
    const stats: Record<string, number> = {};
    extension.statistics?.forEach(stat => {
      stats[stat.statisticName] = stat.value;
    });

    return {
      downloads: stats['install'] || stats['installCount'] || 0,
      rating: stats['averagerating'] || 0,
      ratingCount: stats['ratingcount'] || 0,
    };
  }

  /**
   * 获取扩展的图标 URL
   */
  static getExtensionIconUrl(extension: VSCodeExtension): string | null {
    try {
      // 获取最新版本
      const latestVersion = extension.versions?.[0];
      if (!latestVersion) {
        return null;
      }

      // 查找图标文件
      // VSCode 扩展的图标 assetType 通常是 "Microsoft.VisualStudio.Services.Icons.Default"
      const iconFile = latestVersion.files?.find(
        f => f.assetType === 'Microsoft.VisualStudio.Services.Icons.Default' ||
             f.assetType === 'Microsoft.VisualStudio.Services.Icons.Small' ||
             f.assetType === 'Microsoft.VisualStudio.Services.Icons'
      );

      return iconFile?.source || null;
    } catch (error) {
      console.error('获取扩展图标失败:', error);
      return null;
    }
  }

  /**
   * 获取已安装的扩展列表
   */
  static async getInstalledExtensions(): Promise<InstalledExtension[]> {
    // TODO: 从本地存储或文件系统读取已安装的扩展
    // 目前返回空数组，后续可以实现从文件系统读取
    try {
      const stored = localStorage.getItem('gopilot_installed_extensions');
      if (stored) {
        return JSON.parse(stored);
      }
      return [];
    } catch (error) {
      console.error('获取已安装扩展失败:', error);
      return [];
    }
  }

  /**
   * 保存已安装的扩展列表
   */
  static async saveInstalledExtensions(extensions: InstalledExtension[]): Promise<void> {
    try {
      localStorage.setItem('gopilot_installed_extensions', JSON.stringify(extensions));
    } catch (error) {
      console.error('保存已安装扩展失败:', error);
      throw error;
    }
  }

  /**
   * 安装扩展
   */
  static async installExtension(
    extension: VSCodeExtension,
    onProgress?: (stage: string, progress: number) => void
  ): Promise<void> {
    try {
      const installed = await this.getInstalledExtensions();
      const extensionId = `${extension.publisher.publisherName}.${extension.extensionName}`;
      
      // 检查是否已安装
      if (installed.some(ext => ext.id === extensionId)) {
        throw new Error('扩展已安装');
      }

      // 下载 VSIX 文件（带进度回调）
      let downloadProgress = 0;
      let downloadResult: Blob | { _isFileReference: true; path: string };
      
      try {
        downloadResult = await this.downloadVSIX(extension, (loaded, total) => {
          downloadProgress = Math.round((loaded / total) * 40); // 下载占 40%
          onProgress?.(`正在下载扩展... (${Math.round((loaded / total) * 100)}%)`, 10 + downloadProgress);
        });
      } catch (downloadError: any) {
        console.error('下载扩展失败:', downloadError);
        throw new Error(`下载扩展失败: ${downloadError.message || downloadError}`);
      }
      
      onProgress?.('下载完成，正在保存...', 50);
      
      // 保存 VSIX 文件到本地
      let vsixPath = '';
      if (window.__TAURI__) {
        try {
          const path = await import('@tauri-apps/api/path');
          const fs = await import('@tauri-apps/api/fs');
          
          const appData = await path.appDataDir();
          const extensionsDir = await path.join(appData, 'extensions');
          
          // 确保扩展目录存在
          try {
            await fs.createDir(extensionsDir, { recursive: true });
          } catch (e: any) {
            // 目录可能已存在，忽略错误
            if (!e.message?.includes('already exists')) {
              console.warn('创建扩展目录时出错:', e);
            }
          }
          
          // 保存 VSIX 文件 - 使用 join 来构建路径
          const fileName = `${extensionId}-${extension.versions[0].version}.vsix`;
          vsixPath = await path.join(extensionsDir, fileName);
          
          onProgress?.('正在保存文件...', 70);
          
          // 检查下载结果是否是文件引用（Tauri 环境）
          if (downloadResult && typeof downloadResult === 'object' && (downloadResult as any)._isFileReference) {
            // 直接移动文件，而不是读取到内存
            const tempPath = (downloadResult as any).path;
            try {
              // 使用 Rust 命令移动文件（更高效）
              const { invoke } = await import('@tauri-apps/api/tauri');
              await invoke('rename_file', {
                oldPath: tempPath,
                newPath: vsixPath,
              });
              console.log('文件已移动到:', vsixPath);
            } catch (moveError: any) {
              console.warn('移动文件失败，尝试复制:', moveError);
              // 如果移动失败，尝试复制（需要读取文件，但这是备用方案）
              try {
                const fileData = await fs.readBinaryFile(tempPath);
                await fs.writeBinaryFile(vsixPath, fileData);
                console.log('文件已复制到:', vsixPath);
              } catch (copyError: any) {
                console.error('复制文件失败:', copyError);
                throw new Error(`保存文件失败: ${copyError.message || copyError}`);
              }
              // 删除临时文件（不阻塞主流程）
              fs.removeFile(tempPath).catch((e) => {
                console.warn('删除临时文件失败:', e);
              });
            }
          } else {
            // 浏览器环境或 Blob 结果
            const blob = downloadResult as Blob;
            const arrayBuffer = await blob.arrayBuffer();
            await fs.writeBinaryFile(vsixPath, new Uint8Array(arrayBuffer));
          }
          
          onProgress?.('文件保存完成，正在解压扩展...', 75);
          
          // 解压 VSIX 并加载扩展（异步执行，不阻塞安装流程）
          // 使用 Promise.resolve().then() 确保异步执行，不会阻塞主流程
          Promise.resolve().then(async () => {
            try {
              // 添加小延迟，确保文件写入完成
              await new Promise(resolve => setTimeout(resolve, 200));
              
              const { ExtensionLoader } = await import('./extensionLoader');
              console.log('开始解压扩展:', vsixPath);
              const loaded = await ExtensionLoader.loadFromVSIX(vsixPath);
              
              console.log('扩展解压完成:', loaded.id);
              
              // 尝试激活扩展
              try {
                await ExtensionLoader.activateExtension(loaded.id);
                console.log(`扩展 ${loaded.id} 安装并激活成功`);
              } catch (activateError: any) {
                console.warn(`激活扩展 ${loaded.id} 失败:`, activateError);
                // 不影响安装流程
              }
            } catch (loadError: any) {
              console.warn('加载扩展失败（扩展已安装，但未激活）:', loadError);
              // 不影响安装流程，扩展已保存
            }
          }).catch((error: any) => {
            console.error('异步解压扩展时发生未捕获的错误:', error);
            // 确保错误不会导致应用退出
          });
          
        } catch (saveError: any) {
          console.error('保存扩展文件失败:', saveError);
          throw new Error(`保存扩展文件失败: ${saveError.message || saveError}`);
        }
      } else {
        // 浏览器环境：保存到 IndexedDB 或 localStorage
        // TODO: 实现浏览器环境的扩展存储
        console.warn('浏览器环境暂不支持扩展安装，请在 Tauri 应用中使用');
        throw new Error('浏览器环境暂不支持扩展安装');
      }
      
      const iconUrl = this.getExtensionIconUrl(extension);
      const installedExtension: InstalledExtension = {
        id: extensionId,
        name: extension.extensionName,
        publisher: extension.publisher.publisherName,
        version: extension.versions[0].version,
        displayName: extension.extensionName,
        description: extension.shortDescription,
        installedPath: vsixPath,
        enabled: true,
        iconUrl, // 保存图标 URL
      };

      onProgress?.('正在注册扩展...', 90);
      
      installed.push(installedExtension);
      await this.saveInstalledExtensions(installed);
      
      onProgress?.('安装完成！', 100);
      
      // 扩展已经在异步流程中加载和激活了（在解压阶段）
      // 这里不需要重复加载
    } catch (error: any) {
      console.error('安装扩展失败:', error);
      throw new Error(`安装扩展失败: ${error.message || error}`);
    }
  }

  /**
   * 卸载扩展
   */
  static async uninstallExtension(extensionId: string): Promise<void> {
    try {
      const installed = await this.getInstalledExtensions();
      const filtered = installed.filter(ext => ext.id !== extensionId);
      await this.saveInstalledExtensions(filtered);
    } catch (error: any) {
      console.error('卸载扩展失败:', error);
      throw new Error(`卸载扩展失败: ${error.message || error}`);
    }
  }

  /**
   * 导出扩展为 VSIX 文件
   */
  static async exportVSIX(extension: InstalledExtension, savePath?: string): Promise<string> {
    try {
      if (window.__TAURI__) {
        const { save } = await import('@tauri-apps/api/dialog');
        const { writeBinaryFile } = await import('@tauri-apps/api/fs');
        
        let targetPath = savePath;
        
        // 如果没有指定保存路径，打开保存对话框
        if (!targetPath) {
          const selected = await save({
            filters: [{
              name: 'VSIX',
              extensions: ['vsix']
            }],
            defaultPath: `${extension.id}-${extension.version}.vsix`
          });
          
          if (!selected || typeof selected !== 'string') {
            throw new Error('未选择保存路径');
          }
          
          targetPath = selected;
        }

        let vsixData: Uint8Array;

        // 如果扩展有已安装路径，尝试从该路径读取
        if (extension.installedPath && extension.installedPath.endsWith('.vsix')) {
          const { readBinaryFile } = await import('@tauri-apps/api/fs');
          vsixData = await readBinaryFile(extension.installedPath);
        } else {
          // 否则，尝试从市场重新下载
          // 解析扩展 ID (格式: publisher.name)
          const [publisher, name] = extension.id.split('.');
          if (!publisher || !name) {
            throw new Error('无法解析扩展 ID');
          }

          const marketplaceExtension = await this.getExtensionById(publisher, name);
          if (!marketplaceExtension) {
            throw new Error('无法从市场获取扩展信息');
          }

          const blob = await this.downloadVSIX(marketplaceExtension);
          const arrayBuffer = await blob.arrayBuffer();
          vsixData = new Uint8Array(arrayBuffer);
        }

        // 保存 VSIX 文件
        await writeBinaryFile(targetPath, vsixData);
        
        return targetPath;
      } else {
        // 浏览器环境：下载文件
        const [publisher, name] = extension.id.split('.');
        if (!publisher || !name) {
          throw new Error('无法解析扩展 ID');
        }

        const marketplaceExtension = await this.getExtensionById(publisher, name);
        if (!marketplaceExtension) {
          throw new Error('无法从市场获取扩展信息');
        }

        const blob = await this.downloadVSIX(marketplaceExtension);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${extension.id}-${extension.version}.vsix`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        return `${extension.id}-${extension.version}.vsix`;
      }
    } catch (error: any) {
      console.error('导出 VSIX 失败:', error);
      throw new Error(`导出 VSIX 失败: ${error.message || error}`);
    }
  }
}

