/**
 * Extension View Panel
 * 显示扩展贡献的视图
 */

import React from 'react';
import { X } from 'lucide-react';
import { extensionViewsService, ExtensionViewContainer } from '@/services/extensionViews';

interface ExtensionViewPanelProps {
  container: ExtensionViewContainer;
  onClose?: () => void;
}

const ExtensionViewPanel: React.FC<ExtensionViewPanelProps> = ({ container, onClose }) => {
  const [activeViewId, setActiveViewId] = React.useState<string | null>(
    container.views.length > 0 ? container.views[0].id : null
  );

  const activeView = container.views.find(v => v.id === activeViewId);

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800 border-l dark:border-gray-700">
      {/* 头部 */}
      <div className="flex items-center justify-between p-3 border-b dark:border-gray-700">
        <div className="flex items-center gap-2">
          {container.icon && (
            <img 
              src={container.icon} 
              alt={container.title}
              className="w-5 h-5"
              onError={(e) => {
                // 如果图标加载失败，隐藏图片
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
            {container.title}
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            title="关闭"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 视图标签页 */}
      {container.views.length > 1 && (
        <div className="flex border-b dark:border-gray-700 overflow-x-auto">
          {container.views.map((view) => (
            <button
              key={view.id}
              onClick={() => setActiveViewId(view.id)}
              className={`
                px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap
                ${activeViewId === view.id
                  ? 'border-b-2 border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700'
                }
              `}
            >
              {view.name}
            </button>
          ))}
        </div>
      )}

      {/* 视图内容 */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeView ? (
          <ExtensionViewContent viewId={activeView.id} extensionId={container.extensionId} />
        ) : (
          <div className="text-center text-gray-500 dark:text-gray-400 py-8">
            <p>没有可用的视图</p>
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * 扩展视图内容组件
 */
interface ExtensionViewContentProps {
  viewId: string;
  extensionId: string;
}

const ExtensionViewContent: React.FC<ExtensionViewContentProps> = ({ viewId, extensionId }) => {
  const [content, setContent] = React.useState<React.ReactNode>(null);

  React.useEffect(() => {
    // 触发扩展视图渲染事件
    const event = new CustomEvent('extension-view-render', {
      detail: {
        viewId,
        extensionId,
        container: document.createElement('div'),
      },
    });
    
    window.dispatchEvent(event);
    
    // 扩展应该通过事件监听器来渲染内容
    // 这里我们提供一个占位符
    setContent(
      <div className="text-gray-500 dark:text-gray-400">
        <p className="mb-2">扩展视图: {viewId}</p>
        <p className="text-sm">扩展正在加载视图内容...</p>
      </div>
    );
  }, [viewId, extensionId]);

  return <div>{content}</div>;
};

export default ExtensionViewPanel;

