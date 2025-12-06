import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Package, Search, Download, Star, CheckCircle, Upload, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '@/utils/cn';
import { ExtensionService, VSCodeExtension, InstalledExtension } from '@/services/extensionService';
import { showAlert } from '@/utils/notification';

interface ExtensionsPanelProps {
  onClose?: () => void;
  className?: string;
}

const ExtensionsPanel: React.FC<ExtensionsPanelProps> = ({ onClose, className }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'installed' | 'marketplace'>('installed');
  const [marketplaceExtensions, setMarketplaceExtensions] = useState<VSCodeExtension[]>([]);
  const [installedExtensions, setInstalledExtensions] = useState<InstalledExtension[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchDebounceTimer, setSearchDebounceTimer] = useState<NodeJS.Timeout | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [installingExtensionId, setInstallingExtensionId] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<{ stage: string; progress: number } | null>(null);

  // 加载已安装的扩展
  const loadInstalledExtensions = useCallback(async () => {
    try {
      const installed = await ExtensionService.getInstalledExtensions();
      setInstalledExtensions(installed);
    } catch (error: any) {
      console.error('加载已安装扩展失败:', error);
      showAlert('加载已安装扩展失败', 'error');
    }
  }, []);

  // 搜索扩展
  const searchExtensions = useCallback(async (query: string, page: number = 1, append: boolean = false) => {
    if (!query.trim()) {
      // 如果没有搜索词，加载热门扩展
      try {
        if (page === 1) {
          setIsSearching(true);
        } else {
          setIsLoadingMore(true);
        }
        const popular = await ExtensionService.getPopularExtensions(20);
        if (append) {
          setMarketplaceExtensions(prev => [...prev, ...popular]);
        } else {
          setMarketplaceExtensions(popular);
        }
        setHasMore(popular.length === 20); // 如果返回的数量等于请求的数量，可能还有更多
      } catch (error: any) {
        console.error('加载热门扩展失败:', error);
        showAlert('加载扩展失败: ' + (error.message || error), 'error');
      } finally {
        setIsSearching(false);
        setIsLoadingMore(false);
      }
      return;
    }

    try {
      if (page === 1) {
        setIsSearching(true);
      } else {
        setIsLoadingMore(true);
      }
      const results = await ExtensionService.searchExtensions(query, 20, page);
      if (append) {
        setMarketplaceExtensions(prev => [...prev, ...results]);
      } else {
        setMarketplaceExtensions(results);
      }
      setHasMore(results.length === 20); // 如果返回的数量等于请求的数量，可能还有更多
    } catch (error: any) {
      console.error('搜索扩展失败:', error);
      showAlert('搜索扩展失败: ' + (error.message || error), 'error');
    } finally {
      setIsSearching(false);
      setIsLoadingMore(false);
    }
  }, []);

  // 加载更多扩展
  const loadMoreExtensions = useCallback(() => {
    if (!isLoadingMore && hasMore && activeTab === 'marketplace') {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      searchExtensions(searchQuery, nextPage, true);
    }
  }, [isLoadingMore, hasMore, activeTab, currentPage, searchQuery, searchExtensions]);

  // 滚动监听
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || activeTab !== 'marketplace') return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      // 当滚动到距离底部 100px 时加载更多
      if (scrollHeight - scrollTop - clientHeight < 100) {
        loadMoreExtensions();
      }
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, [activeTab, loadMoreExtensions]);

  // 搜索防抖
  useEffect(() => {
    if (searchDebounceTimer) {
      clearTimeout(searchDebounceTimer);
    }

    const timer = setTimeout(() => {
      if (activeTab === 'marketplace') {
        setCurrentPage(1);
        setHasMore(true);
        searchExtensions(searchQuery, 1, false);
      }
    }, 500);

    setSearchDebounceTimer(timer);

    return () => {
      if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
      }
    };
  }, [searchQuery, activeTab, searchExtensions]);

  // 初始加载
  useEffect(() => {
    loadInstalledExtensions();
    if (activeTab === 'marketplace' && marketplaceExtensions.length === 0) {
      setCurrentPage(1);
      setHasMore(true);
      searchExtensions('', 1, false);
    }
  }, []);

  // 切换标签页
  const handleTabChange = (tab: 'installed' | 'marketplace') => {
    setActiveTab(tab);
    if (tab === 'marketplace') {
      setCurrentPage(1);
      setHasMore(true);
      if (marketplaceExtensions.length === 0) {
        searchExtensions(searchQuery || '', 1, false);
      }
    }
  };

  // 安装扩展
  const handleInstall = useCallback(async (extension: VSCodeExtension) => {
    const extensionId = `${extension.publisher.publisherName}.${extension.extensionName}`;
    try {
      setIsLoading(true);
      setInstallingExtensionId(extensionId);
      setInstallProgress({ stage: '准备安装...', progress: 0 });
      
      console.log('开始安装扩展:', extensionId);
      
      try {
        await ExtensionService.installExtension(extension, (stage, progress) => {
          console.log('安装进度:', stage, progress);
          setInstallProgress({ stage, progress });
        });
      } catch (installError: any) {
        console.error('安装扩展时出错:', installError);
        throw installError;
      }
      
      console.log('扩展安装成功:', extensionId);
      showAlert('扩展安装成功', 'success');
      await loadInstalledExtensions();
    } catch (error: any) {
      console.error('安装扩展失败:', error);
      const errorMessage = error?.message || error?.toString() || '未知错误';
      showAlert(`安装失败: ${errorMessage}`, 'error');
    } finally {
      setIsLoading(false);
      setInstallingExtensionId(null);
      setInstallProgress(null);
    }
  }, [loadInstalledExtensions]);

  // 卸载扩展
  const handleUninstall = useCallback(async (extensionId: string) => {
    if (!confirm('确定要卸载此扩展吗？')) {
      return;
    }

    try {
      setIsLoading(true);
      await ExtensionService.uninstallExtension(extensionId);
      showAlert('扩展已卸载', 'success');
      await loadInstalledExtensions();
    } catch (error: any) {
      showAlert('卸载失败: ' + (error.message || error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [loadInstalledExtensions]);

  // 导出 VSIX 文件
  const handleExportVSIX = useCallback(async (extension: InstalledExtension) => {
    try {
      setIsLoading(true);
      const savedPath = await ExtensionService.exportVSIX(extension);
      showAlert(`扩展已导出: ${savedPath}`, 'success');
    } catch (error: any) {
      showAlert('导出失败: ' + (error.message || error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 导入 VSIX 文件
  const handleImportVSIX = useCallback(async () => {
    try {
      if (window.__TAURI__) {
        const { open } = await import('@tauri-apps/api/dialog');
        const selected = await open({
          filters: [{
            name: 'VSIX',
            extensions: ['vsix']
          }],
          multiple: false
        });

        if (selected && typeof selected === 'string') {
          setIsLoading(true);
          const installed = await ExtensionService.installFromVSIX(selected);
          showAlert(`扩展 "${installed.displayName}" 安装成功`, 'success');
          await loadInstalledExtensions();
        }
      } else {
        // 浏览器环境：使用文件输入
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.vsix';
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            showAlert('浏览器环境暂不支持 VSIX 导入，请在 Tauri 应用中使用', 'warning');
          }
        };
        input.click();
      }
    } catch (error: any) {
      showAlert('导入失败: ' + (error.message || error), 'error');
    } finally {
      setIsLoading(false);
    }
  }, [loadInstalledExtensions]);

  // 检查扩展是否已安装
  const isInstalled = (extension: VSCodeExtension): boolean => {
    const extensionId = `${extension.publisher.publisherName}.${extension.extensionName}`;
    return installedExtensions.some(ext => ext.id === extensionId);
  };

  // 获取扩展统计信息
  const getExtensionStats = (extension: VSCodeExtension) => {
    return ExtensionService.getExtensionStats(extension);
  };

  // 格式化下载量
  const formatDownloads = (count: number) => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`;
    }
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}K`;
    }
    return count.toString();
  };

  // 扩展图标组件
  const ExtensionIcon: React.FC<{ extension: VSCodeExtension }> = ({ extension }) => {
    const iconUrl = ExtensionService.getExtensionIconUrl(extension);
    const [imageError, setImageError] = useState(false);

    if (iconUrl && !imageError) {
      return (
        <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <img
            src={iconUrl}
            alt={extension.extensionName}
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
          />
        </div>
      );
    }

    // 默认图标
    return (
      <div className="flex-shrink-0 w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded flex items-center justify-center">
        <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
      </div>
    );
  };

  // 渲染扩展图标
  const renderExtensionIcon = (extension: VSCodeExtension) => {
    return <ExtensionIcon extension={extension} />;
  };
  // 渲染市场扩展
  const renderMarketplaceExtension = (extension: VSCodeExtension) => {
    const stats = getExtensionStats(extension);
    const installed = isInstalled(extension);
    const extensionId = `${extension.publisher.publisherName}.${extension.extensionName}`;
    const isInstalling = installingExtensionId === extensionId;

    return (
      <div
        key={extensionId}
        className="p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex gap-4">
          {renderExtensionIcon(extension)}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {extension.extensionName}
                  </h3>
                  {installed && (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                  {extension.shortDescription || extension.extensionName}
                </p>
                
                {/* 安装进度条 */}
                {isInstalling && installProgress && (
                  <div className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {installProgress.stage}
                      </span>
                      <span className="text-xs text-gray-600 dark:text-gray-400">
                        {Math.round(installProgress.progress)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${installProgress.progress}%` }}
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                  <span>{extension.publisher.publisherName}</span>
                  {stats.downloads > 0 && (
                    <span className="flex items-center gap-1">
                      <Download className="w-3 h-3" />
                      {formatDownloads(stats.downloads)}
                    </span>
                  )}
                  {stats.rating > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                      {stats.rating.toFixed(1)} ({stats.ratingCount})
                    </span>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0">
                {installed ? (
                  <button
                    onClick={() => handleUninstall(extensionId)}
                    disabled={isLoading}
                    className="px-3 py-1.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                  >
                    卸载
                  </button>
                ) : (
                  <button
                    onClick={() => handleInstall(extension)}
                    disabled={isLoading || isInstalling}
                    className="px-3 py-1.5 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {isInstalling ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        安装中...
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4" />
                        安装
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // 已安装扩展图标组件
  const InstalledExtensionIcon: React.FC<{ extension: InstalledExtension }> = ({ extension }) => {
    const [imageError, setImageError] = useState(false);

    if (extension.iconUrl && !imageError) {
      return (
        <div className="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <img
            src={extension.iconUrl}
            alt={extension.displayName || extension.name}
            className="w-full h-full object-contain"
            onError={() => setImageError(true)}
          />
        </div>
      );
    }

    // 默认图标
    return (
      <div className="flex-shrink-0 w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded flex items-center justify-center">
        <Package className="w-6 h-6 text-green-600 dark:text-green-400" />
      </div>
    );
  };

  // 渲染已安装扩展
  const renderInstalledExtension = (extension: InstalledExtension) => {
    return (
      <div
        key={extension.id}
        className="p-4 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex gap-4">
          <InstalledExtensionIcon extension={extension} />
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {extension.displayName || extension.name}
                  </h3>
                  {extension.enabled && (
                    <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />
                  )}
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                  {extension.description || '无描述'}
                </p>
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                  <span>{extension.publisher}</span>
                  <span>v{extension.version}</span>
                </div>
              </div>
              <div className="flex-shrink-0 flex gap-2">
                <button
                  onClick={() => handleExportVSIX(extension)}
                  disabled={isLoading}
                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors disabled:opacity-50"
                  title="导出 VSIX"
                >
                  <Download className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleUninstall(extension.id)}
                  disabled={isLoading}
                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
                  title="卸载"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={cn("h-full flex flex-col bg-white dark:bg-gray-800", className)}>
      {/* 头部 */}
      <div className="border-b dark:border-gray-700">
        <div className="flex items-center justify-between p-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">扩展</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleImportVSIX}
              disabled={isLoading}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
              title="导入 VSIX"
            >
              <Upload className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                if (activeTab === 'installed') {
                  loadInstalledExtensions();
                } else {
                  setCurrentPage(1);
                  setHasMore(true);
                  searchExtensions(searchQuery || '', 1, false);
                }
              }}
              disabled={isLoading || isSearching}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors disabled:opacity-50"
              title="刷新"
            >
              <RefreshCw className={cn("w-4 h-4", (isLoading || isSearching) && "animate-spin")} />
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
        
        {/* 全局安装进度条 */}
        {installingExtensionId && installProgress && (
          <div className="px-4 pb-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  正在安装扩展...
                </span>
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  {Math.round(installProgress.progress)}%
                </span>
              </div>
              <div className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                {installProgress.stage}
              </div>
              <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
                <div
                  className="bg-blue-600 dark:bg-blue-400 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${installProgress.progress}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 标签页 */}
      <div className="flex border-b dark:border-gray-700">
        <button
          onClick={() => handleTabChange('installed')}
          className={cn(
            "flex-1 px-4 py-2 text-sm font-medium transition-colors",
            activeTab === 'installed'
              ? "border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          )}
        >
          已安装 ({installedExtensions.length})
        </button>
        <button
          onClick={() => handleTabChange('marketplace')}
          className={cn(
            "flex-1 px-4 py-2 text-sm font-medium transition-colors",
            activeTab === 'marketplace'
              ? "border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400"
              : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          )}
        >
          市场
        </button>
      </div>

      {/* 搜索框（仅在市场标签页显示） */}
      {activeTab === 'marketplace' && (
        <div className="p-4 border-b dark:border-gray-700">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索扩展..."
              className="w-full pl-10 pr-4 py-2 border dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
            />
          </div>
        </div>
      )}

      {/* 内容区域 */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
        {isLoading && activeTab === 'installed' ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500 dark:text-gray-400">
              <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
              <p>加载中...</p>
            </div>
          </div>
        ) : activeTab === 'installed' ? (
          installedExtensions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <Package className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg mb-2">暂无已安装的扩展</p>
              <p className="text-sm">前往"市场"标签页安装扩展</p>
            </div>
          ) : (
            <div>
              {installedExtensions.map(renderInstalledExtension)}
            </div>
          )
        ) : (
          <>
            {isSearching ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500 dark:text-gray-400">
                  <RefreshCw className="w-8 h-8 mx-auto mb-2 animate-spin" />
                  <p>搜索中...</p>
                </div>
              </div>
            ) : marketplaceExtensions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
                <Search className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg mb-2">未找到扩展</p>
                <p className="text-sm">尝试使用不同的搜索词</p>
              </div>
            ) : (
              <div>
                {marketplaceExtensions.map(renderMarketplaceExtension)}
                {isLoadingMore && (
                  <div className="flex items-center justify-center p-4 text-gray-500 dark:text-gray-400">
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    <span className="text-sm">加载更多...</span>
                  </div>
                )}
                {!hasMore && marketplaceExtensions.length > 0 && (
                  <div className="flex items-center justify-center p-4 text-gray-500 dark:text-gray-400">
                    <span className="text-sm">没有更多扩展了</span>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ExtensionsPanel;