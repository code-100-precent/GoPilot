import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.tsx'
import { initTheme } from '@/utils/theme'
import './index.css'

// 配置 Monaco Editor Worker
// @ts-ignore
self.MonacoEnvironment = {
  getWorkerUrl: function (_moduleId: string, label: string) {
    const baseUrl = import.meta.env.DEV 
      ? '/node_modules/monaco-editor/esm/vs'
      : '/vs';
    
    if (label === 'json') {
      return `${baseUrl}/language/json/json.worker.js`;
    }
    if (label === 'css' || label === 'scss' || label === 'less') {
      return `${baseUrl}/language/css/css.worker.js`;
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return `${baseUrl}/language/html/html.worker.js`;
    }
    if (label === 'typescript' || label === 'javascript') {
      return `${baseUrl}/language/typescript/ts.worker.js`;
    }
    return `${baseUrl}/editor/editor.worker.js`;
  }
};

// 初始化主题
initTheme();

// 加载扩展系统
if (window.__TAURI__) {
  import('@/services/extensionLoader').then(({ ExtensionLoader }) => {
    ExtensionLoader.loadAllExtensions().catch((error) => {
      console.error('加载扩展失败:', error);
    });
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
