/**
 * 主题工具函数
 */

export type Theme = 'light' | 'dark' | 'system';

/**
 * 应用主题
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  
  if (theme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  } else if (theme === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * 获取当前主题
 */
export function getCurrentTheme(): Theme {
  const stored = localStorage.getItem('gopilot_app_settings');
  if (stored) {
    try {
      const settings = JSON.parse(stored);
      return settings.theme || 'dark';
    } catch {
      return 'dark';
    }
  }
  return 'dark';
}

/**
 * 初始化主题
 */
export function initTheme() {
  const theme = getCurrentTheme();
  applyTheme(theme);
  
  // 监听系统主题变化
  if (theme === 'system') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
      applyTheme('system');
    });
  }
}

