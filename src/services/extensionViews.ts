/**
 * Extension Views Service
 * 管理扩展贡献的视图和视图容器
 */

export interface ExtensionView {
  id: string;
  name: string;
  extensionId: string;
  viewContainerId: string;
  when?: string;
  icon?: string;
  contextualTitle?: string;
}

export interface ExtensionViewContainer {
  id: string;
  title: string;
  icon: string;
  extensionId: string;
  location: 'sidebar' | 'panel' | 'explorer';
  views: ExtensionView[];
}

class ExtensionViewsService {
  private viewContainers: Map<string, ExtensionViewContainer> = new Map();
  private views: Map<string, ExtensionView> = new Map();
  private listeners: Array<(containers: ExtensionViewContainer[]) => void> = [];

  constructor() {
    // 监听扩展视图注册事件
    window.addEventListener('extension-view-containers-registered', this.handleViewContainersRegistered.bind(this));
    window.addEventListener('extension-views-registered', this.handleViewsRegistered.bind(this));
  }

  /**
   * 处理视图容器注册
   */
  private handleViewContainersRegistered(event: CustomEvent) {
    const { extensionId, containers } = event.detail;
    
    for (const [location, containerList] of Object.entries(containers)) {
      for (const container of containerList as any[]) {
        const containerId = container.id;
        const viewContainer: ExtensionViewContainer = {
          id: containerId,
          title: container.title,
          icon: container.icon,
          extensionId,
          location: location as 'sidebar' | 'panel' | 'explorer',
          views: [],
        };
        
        this.viewContainers.set(containerId, viewContainer);
        console.log('注册视图容器:', viewContainer);
      }
    }
    
    this.notifyListeners();
  }

  /**
   * 处理视图注册
   */
  private handleViewsRegistered(event: CustomEvent) {
    const { extensionId, views } = event.detail;
    
    for (const [viewContainerId, viewList] of Object.entries(views)) {
      const container = this.viewContainers.get(viewContainerId);
      if (!container) {
        console.warn(`视图容器 ${viewContainerId} 未找到，跳过视图注册`);
        continue;
      }
      
      for (const view of viewList as any[]) {
        const extensionView: ExtensionView = {
          id: view.id,
          name: view.name,
          extensionId,
          viewContainerId,
          when: view.when,
          icon: view.icon,
          contextualTitle: view.contextualTitle,
        };
        
        this.views.set(view.id, extensionView);
        container.views.push(extensionView);
        console.log('注册视图:', extensionView);
      }
    }
    
    this.notifyListeners();
  }

  /**
   * 获取所有视图容器
   */
  getViewContainers(): ExtensionViewContainer[] {
    return Array.from(this.viewContainers.values());
  }

  /**
   * 获取侧边栏视图容器
   */
  getSidebarViewContainers(): ExtensionViewContainer[] {
    return Array.from(this.viewContainers.values()).filter(
      container => container.location === 'sidebar'
    );
  }

  /**
   * 获取面板视图容器
   */
  getPanelViewContainers(): ExtensionViewContainer[] {
    return Array.from(this.viewContainers.values()).filter(
      container => container.location === 'panel'
    );
  }

  /**
   * 获取视图容器
   */
  getViewContainer(containerId: string): ExtensionViewContainer | undefined {
    return this.viewContainers.get(containerId);
  }

  /**
   * 获取视图
   */
  getView(viewId: string): ExtensionView | undefined {
    return this.views.get(viewId);
  }

  /**
   * 订阅视图变化
   */
  subscribe(listener: (containers: ExtensionViewContainer[]) => void) {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * 通知监听器
   */
  private notifyListeners() {
    const containers = this.getViewContainers();
    this.listeners.forEach(listener => listener(containers));
  }
}

export const extensionViewsService = new ExtensionViewsService();

