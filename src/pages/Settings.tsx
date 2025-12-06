import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, X, Save, Palette, Code, Keyboard, FileText, Bell, Shield, Sparkles } from 'lucide-react';
import { LLMCompletionService, LLMConfig } from '@/services/llmCompletionService';
import { cn } from '@/utils/cn';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { showAlert } from '@/utils/notification';
import Input from '@/components/UI/Input';
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/UI/Select';
import { Switch } from '@/components/UI/Switch';
import { Slider } from '@/components/UI/Slider';
import Button from '@/components/UI/Button';

interface EditorSettings {
  theme: string;
  fontSize: number;
  fontFamily: string;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
  renderWhitespace: 'none' | 'boundary' | 'selection' | 'all';
  formatOnSave: boolean;
  formatOnPaste: boolean;
  autoSave: boolean;
  autoSaveDelay: number;
}

interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  accentColor: string;
  sidebarWidth: number;
  showLineNumbers: boolean;
  showMinimap: boolean;
  enableAnimations: boolean;
  notifications: boolean;
}

interface FileSettings {
  defaultEncoding: string;
  lineEnding: 'lf' | 'crlf' | 'auto';
  trimTrailingWhitespace: boolean;
  insertFinalNewline: boolean;
  confirmBeforeDelete: boolean;
  confirmBeforeClose: boolean;
  restoreOpenFiles: boolean;
  maxRecentFiles: number;
  goFormatOnSave: boolean;
  goLintOnSave: boolean;
  frontendFormatOnSave: boolean;
  frontendLintOnSave: boolean;
  fileAssociations: Record<string, string>;
}

interface NotificationSettings {
  enabled: boolean;
  showOnSave: boolean;
  showOnError: boolean;
  showOnSuccess: boolean;
  showOnWarning: boolean;
  soundEnabled: boolean;
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  duration: number;
}

interface SecuritySettings {
  confirmFileDelete: boolean;
  confirmFileClose: boolean;
  warnOnSensitiveFiles: boolean;
  allowedFileExtensions: string[];
  blockedFileExtensions: string[];
  maxFileSize: number;
  enableFileWatcher: boolean;
}

const Settings: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('editor');
  const [editorSettings, setEditorSettings] = useLocalStorage<EditorSettings>('gopilot_editor_settings', {
    theme: 'vs-dark',
    fontSize: 14,
    fontFamily: 'Monaco, "Courier New", monospace',
    tabSize: 4,
    wordWrap: true,
    minimap: true,
    lineNumbers: 'on',
    renderWhitespace: 'selection',
    formatOnSave: true,
    formatOnPaste: true,
    autoSave: false,
    autoSaveDelay: 1000,
  });

  const [appSettings, setAppSettings] = useLocalStorage<AppSettings>('gopilot_app_settings', {
    theme: 'dark',
    accentColor: '#3b82f6',
    sidebarWidth: 250,
    showLineNumbers: true,
    showMinimap: true,
    enableAnimations: true,
    notifications: true,
  });

  const editorThemes = [
    { value: 'vs', label: 'Light' },
    { value: 'vs-dark', label: 'Dark' },
    { value: 'hc-black', label: 'High Contrast Dark' },
  ];

  const [fileSettings, setFileSettings] = useLocalStorage<FileSettings>('gopilot_file_settings', {
    defaultEncoding: 'utf-8',
    lineEnding: 'auto',
    trimTrailingWhitespace: true,
    insertFinalNewline: true,
    confirmBeforeDelete: true,
    confirmBeforeClose: true,
    restoreOpenFiles: true,
    maxRecentFiles: 10,
    goFormatOnSave: true,
    goLintOnSave: true,
    frontendFormatOnSave: true,
    frontendLintOnSave: true,
    fileAssociations: {
      '.go': 'go',
      '.mod': 'go.mod',
      '.sum': 'plaintext',
      '.js': 'javascript',
      '.jsx': 'javascript',
      '.ts': 'typescript',
      '.tsx': 'typescript',
      '.json': 'json',
      '.html': 'html',
      '.css': 'css',
      '.scss': 'scss',
      '.vue': 'vue',
      '.svelte': 'svelte',
    },
  });

  const [notificationSettings, setNotificationSettings] = useLocalStorage<NotificationSettings>('gopilot_notification_settings', {
    enabled: true,
    showOnSave: true,
    showOnError: true,
    showOnSuccess: true,
    showOnWarning: true,
    soundEnabled: false,
    position: 'top-right',
    duration: 3000,
  });

  const [securitySettings, setSecuritySettings] = useLocalStorage<SecuritySettings>('gopilot_security_settings', {
    confirmFileDelete: true,
    confirmFileClose: true,
    warnOnSensitiveFiles: true,
    allowedFileExtensions: ['*'],
    blockedFileExtensions: [],
    maxFileSize: 10 * 1024 * 1024, // 10MB
    enableFileWatcher: true,
  });

  const accentColors = [
    { value: '#3b82f6', label: 'Blue', color: 'bg-blue-500' },
    { value: '#10b981', label: 'Green', color: 'bg-green-500' },
    { value: '#f59e0b', label: 'Amber', color: 'bg-amber-500' },
    { value: '#ef4444', label: 'Red', color: 'bg-red-500' },
    { value: '#8b5cf6', label: 'Purple', color: 'bg-purple-500' },
    { value: '#ec4899', label: 'Pink', color: 'bg-pink-500' },
  ];

  // 应用 Accent Color
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent-color', appSettings.accentColor);
    
    // 计算 accent color 的 RGB 和 HSL 值用于 CSS 变量
    const hex = appSettings.accentColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    
    root.style.setProperty('--accent-rgb', `${r}, ${g}, ${b}`);
    
    // 计算 HSL
    const rNorm = r / 255;
    const gNorm = g / 255;
    const bNorm = b / 255;
    
    const max = Math.max(rNorm, gNorm, bNorm);
    const min = Math.min(rNorm, gNorm, bNorm);
    let h = 0, s = 0, l = (max + min) / 2;
    
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rNorm: h = ((gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0)) / 6; break;
        case gNorm: h = ((bNorm - rNorm) / d + 2) / 6; break;
        case bNorm: h = ((rNorm - gNorm) / d + 4) / 6; break;
      }
    }
    
    root.style.setProperty('--accent-h', String(Math.round(h * 360)));
    root.style.setProperty('--accent-s', String(Math.round(s * 100)) + '%');
    root.style.setProperty('--accent-l', String(Math.round(l * 100)) + '%');
  }, [appSettings.accentColor]);

  const handleSave = () => {
    // 触发设置更新事件
    window.dispatchEvent(new CustomEvent('settings-updated', {
      detail: { editorSettings, appSettings, fileSettings, notificationSettings, securitySettings }
    }));
    showAlert('设置已保存', 'success');
    onClose?.();
  };

  const [llmConfig, setLLMConfig] = useState<LLMConfig>(() => {
    const stored = LLMCompletionService.getConfig();
    return stored || {
      provider: 'lmstudio',
      baseUrl: 'http://localhost:1234',
      model: '',
      temperature: 0.7,
      maxTokens: 100,
      enabled: false,
    };
  });

  const [testingConnection, setTestingConnection] = useState(false);

  const handleTestConnection = async () => {
    if (!llmConfig.baseUrl || !llmConfig.model) {
      showAlert('请先填写 API 地址和模型名称', 'warning');
      return;
    }
    
    setTestingConnection(true);
    try {
      const success = await LLMCompletionService.testConnection(llmConfig);
      if (success) {
        showAlert('连接成功！', 'success');
      } else {
        showAlert('连接失败，请检查配置', 'error');
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.toString() || '连接失败，请检查服务是否启动';
      showAlert(errorMessage, 'error');
      console.error('LLM 连接测试失败:', error);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveLLMConfig = () => {
    LLMCompletionService.setConfig(llmConfig);
    showAlert('LLM 配置已保存', 'success');
  };

  const tabs = [
    { id: 'editor', label: 'Editor', icon: Code },
    { id: 'appearance', label: 'Appearance', icon: Palette },
    { id: 'keybindings', label: 'Keybindings', icon: Keyboard },
    { id: 'files', label: 'Files', icon: FileText },
    { id: 'llm', label: 'AI Completion', icon: Sparkles },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'security', label: 'Security', icon: Shield },
  ];

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b dark:border-gray-700">
        <div className="flex items-center gap-3">
          <SettingsIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Settings</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            leftIcon={<Save className="w-4 h-4" />}
          >
            Save
          </Button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <div className="w-64 border-r dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-left transition-colors mb-1',
                    activeTab === tab.id
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'editor' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Editor Settings</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Editor Theme
                    </label>
                    <Select
                      value={editorSettings.theme}
                      onValueChange={(value) => setEditorSettings({ ...editorSettings, theme: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {editorThemes.map((theme) => (
                          <SelectItem key={theme.value} value={theme.value}>
                            {theme.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Font Size: {editorSettings.fontSize}px
                    </label>
                    <Slider
                      value={[editorSettings.fontSize]}
                      onValueChange={(value) => setEditorSettings({ ...editorSettings, fontSize: value[0] })}
                      min={10}
                      max={24}
                      step={1}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Font Family
                    </label>
                    <Input
                      value={editorSettings.fontFamily}
                      onValueChange={(value) => setEditorSettings({ ...editorSettings, fontFamily: value })}
                      placeholder="Monaco, 'Courier New', monospace"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tab Size: {editorSettings.tabSize}
                    </label>
                    <Slider
                      value={[editorSettings.tabSize]}
                      onValueChange={(value) => setEditorSettings({ ...editorSettings, tabSize: value[0] })}
                      min={2}
                      max={8}
                      step={1}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Word Wrap</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Wrap long lines</p>
                    </div>
                    <Switch
                      checked={editorSettings.wordWrap}
                      onCheckedChange={(checked) => setEditorSettings({ ...editorSettings, wordWrap: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Minimap</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Show code minimap</p>
                    </div>
                    <Switch
                      checked={editorSettings.minimap}
                      onCheckedChange={(checked) => setEditorSettings({ ...editorSettings, minimap: checked })}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Line Numbers
                    </label>
                    <Select
                      value={editorSettings.lineNumbers}
                      onValueChange={(value: any) => setEditorSettings({ ...editorSettings, lineNumbers: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="on">On</SelectItem>
                        <SelectItem value="off">Off</SelectItem>
                        <SelectItem value="relative">Relative</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Format on Save</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Automatically format on save</p>
                    </div>
                    <Switch
                      checked={editorSettings.formatOnSave}
                      onCheckedChange={(checked) => setEditorSettings({ ...editorSettings, formatOnSave: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Format on Paste</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Automatically format on paste</p>
                    </div>
                    <Switch
                      checked={editorSettings.formatOnPaste}
                      onCheckedChange={(checked) => setEditorSettings({ ...editorSettings, formatOnPaste: checked })}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Auto Save</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Automatically save files</p>
                    </div>
                    <Switch
                      checked={editorSettings.autoSave}
                      onCheckedChange={(checked) => setEditorSettings({ ...editorSettings, autoSave: checked })}
                    />
                  </div>

                  {editorSettings.autoSave && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Auto Save Delay: {editorSettings.autoSaveDelay}ms
                      </label>
                      <Slider
                        value={[editorSettings.autoSaveDelay]}
                        onValueChange={(value) => setEditorSettings({ ...editorSettings, autoSaveDelay: value[0] })}
                        min={500}
                        max={5000}
                        step={100}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'appearance' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Appearance</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Application Theme
                    </label>
                    <Select
                      value={appSettings.theme}
                      onValueChange={(value: any) => setAppSettings({ ...appSettings, theme: value })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="light">Light</SelectItem>
                        <SelectItem value="dark">Dark</SelectItem>
                        <SelectItem value="system">System</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Accent Color
                    </label>
                    <div className="grid grid-cols-6 gap-3">
                      {accentColors.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => setAppSettings({ ...appSettings, accentColor: color.value })}
                          className={cn(
                            'relative w-12 h-12 rounded-lg border-2 transition-all',
                            appSettings.accentColor === color.value
                              ? 'border-gray-900 dark:border-gray-100 scale-110'
                              : 'border-gray-300 dark:border-gray-600 hover:scale-105'
                          )}
                        >
                          <div className={cn('w-full h-full rounded-lg', color.color)} />
                          {appSettings.accentColor === color.value && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="w-6 h-6 bg-white rounded-full flex items-center justify-center">
                                <div className="w-3 h-3 bg-gray-900 rounded-full" />
                              </div>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Sidebar Width: {appSettings.sidebarWidth}px
                    </label>
                    <Slider
                      value={[appSettings.sidebarWidth]}
                      onValueChange={(value) => setAppSettings({ ...appSettings, sidebarWidth: value[0] })}
                      min={150}
                      max={400}
                      step={10}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Animations</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Smooth transitions and animations</p>
                    </div>
                    <Switch
                      checked={appSettings.enableAnimations}
                      onCheckedChange={(checked) => setAppSettings({ ...appSettings, enableAnimations: checked })}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'keybindings' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Keybindings</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Save File</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Save current file</div>
                    </div>
                    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
                      Cmd/Ctrl + S
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Search Files</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Quick file search</div>
                    </div>
                    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
                      Cmd/Ctrl + P
                    </kbd>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-gray-100">Open Settings</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Open settings panel</div>
                    </div>
                    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 dark:text-gray-200 bg-gray-200 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded">
                      Cmd/Ctrl + ,
                    </kbd>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'files' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">File Settings</h3>
                <div className="space-y-6">
                  {/* General File Settings */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">General</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Default Encoding
                        </label>
                        <Select
                          value={fileSettings.defaultEncoding}
                          onValueChange={(value) => setFileSettings({ ...fileSettings, defaultEncoding: value })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="utf-8">UTF-8</SelectItem>
                            <SelectItem value="utf-16">UTF-16</SelectItem>
                            <SelectItem value="utf-16le">UTF-16 LE</SelectItem>
                            <SelectItem value="utf-16be">UTF-16 BE</SelectItem>
                            <SelectItem value="latin1">Latin1</SelectItem>
                            <SelectItem value="ascii">ASCII</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Line Ending
                        </label>
                        <Select
                          value={fileSettings.lineEnding}
                          onValueChange={(value: any) => setFileSettings({ ...fileSettings, lineEnding: value })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">Auto (Detect)</SelectItem>
                            <SelectItem value="lf">LF (Unix/Linux/macOS)</SelectItem>
                            <SelectItem value="crlf">CRLF (Windows)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Trim Trailing Whitespace</label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Remove trailing spaces on save</p>
                        </div>
                        <Switch
                          checked={fileSettings.trimTrailingWhitespace}
                          onCheckedChange={(checked) => setFileSettings({ ...fileSettings, trimTrailingWhitespace: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Insert Final Newline</label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Add newline at end of file</p>
                        </div>
                        <Switch
                          checked={fileSettings.insertFinalNewline}
                          onCheckedChange={(checked) => setFileSettings({ ...fileSettings, insertFinalNewline: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Restore Open Files</label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Reopen files from last session</p>
                        </div>
                        <Switch
                          checked={fileSettings.restoreOpenFiles}
                          onCheckedChange={(checked) => setFileSettings({ ...fileSettings, restoreOpenFiles: checked })}
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Max Recent Files: {fileSettings.maxRecentFiles}
                        </label>
                        <Slider
                          value={[fileSettings.maxRecentFiles]}
                          onValueChange={(value) => setFileSettings({ ...fileSettings, maxRecentFiles: value[0] })}
                          min={5}
                          max={50}
                          step={5}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Go Project Settings */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Go Project</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Format on Save</label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Run gofmt on save</p>
                        </div>
                        <Switch
                          checked={fileSettings.goFormatOnSave}
                          onCheckedChange={(checked) => setFileSettings({ ...fileSettings, goFormatOnSave: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Lint on Save</label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Run golint on save</p>
                        </div>
                        <Switch
                          checked={fileSettings.goLintOnSave}
                          onCheckedChange={(checked) => setFileSettings({ ...fileSettings, goLintOnSave: checked })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Frontend Project Settings */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Frontend Project</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Format on Save</label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Run Prettier/ESLint on save</p>
                        </div>
                        <Switch
                          checked={fileSettings.frontendFormatOnSave}
                          onCheckedChange={(checked) => setFileSettings({ ...fileSettings, frontendFormatOnSave: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Lint on Save</label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Run ESLint on save</p>
                        </div>
                        <Switch
                          checked={fileSettings.frontendLintOnSave}
                          onCheckedChange={(checked) => setFileSettings({ ...fileSettings, frontendLintOnSave: checked })}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Confirmation Settings */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Confirmations</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Before Delete</label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Ask before deleting files</p>
                        </div>
                        <Switch
                          checked={fileSettings.confirmBeforeDelete}
                          onCheckedChange={(checked) => setFileSettings({ ...fileSettings, confirmBeforeDelete: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Before Close</label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Ask before closing modified files</p>
                        </div>
                        <Switch
                          checked={fileSettings.confirmBeforeClose}
                          onCheckedChange={(checked) => setFileSettings({ ...fileSettings, confirmBeforeClose: checked })}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'llm' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">AI Code Completion</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  配置本地 LLM 服务（LMStudio 或 Ollama）以启用 AI 代码补全功能
                </p>
                
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">启用 AI 代码补全</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">使用本地 LLM 提供智能代码补全</p>
                    </div>
                    <Switch
                      checked={llmConfig.enabled || false}
                      onCheckedChange={(checked) => setLLMConfig({ ...llmConfig, enabled: checked })}
                    />
                  </div>

                  {llmConfig.enabled && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          服务提供商
                        </label>
                        <Select
                          value={llmConfig.provider}
                          onValueChange={(value: 'lmstudio' | 'ollama') => {
                            setLLMConfig({
                              ...llmConfig,
                              provider: value,
                              baseUrl: value === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434',
                            });
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="lmstudio">LMStudio</SelectItem>
                            <SelectItem value="ollama">Ollama</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          API 地址
                        </label>
                        <Input
                          value={llmConfig.baseUrl}
                          onValueChange={(value) => setLLMConfig({ ...llmConfig, baseUrl: value })}
                          placeholder={llmConfig.provider === 'lmstudio' ? 'http://localhost:1234' : 'http://localhost:11434'}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {llmConfig.provider === 'lmstudio' 
                            ? 'LMStudio 默认端口: 1234' 
                            : 'Ollama 默认端口: 11434'}
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          模型名称
                        </label>
                        <Input
                          value={llmConfig.model}
                          onValueChange={(value) => setLLMConfig({ ...llmConfig, model: value })}
                          placeholder="例如: codellama, deepseek-coder, qwen-coder"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          请输入已下载并加载的模型名称
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          温度 (Temperature): {llmConfig.temperature || 0.7}
                        </label>
                        <Slider
                          value={[llmConfig.temperature || 0.7]}
                          onValueChange={(value) => setLLMConfig({ ...llmConfig, temperature: value[0] })}
                          min={0}
                          max={2}
                          step={0.1}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          控制输出的随机性，较低的值更保守，较高的值更有创造性
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          最大 Token 数: {llmConfig.maxTokens || 100}
                        </label>
                        <Slider
                          value={[llmConfig.maxTokens || 100]}
                          onValueChange={(value) => setLLMConfig({ ...llmConfig, maxTokens: value[0] })}
                          min={10}
                          max={500}
                          step={10}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          每次补全生成的最大 token 数量
                        </p>
                      </div>

                      <div className="flex gap-3 pt-4">
                        <Button
                          variant="primary"
                          onClick={handleSaveLLMConfig}
                        >
                          保存配置
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={handleTestConnection}
                          disabled={testingConnection}
                        >
                          {testingConnection ? '测试中...' : '测试连接'}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Notifications</h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable Notifications</label>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Show system notifications</p>
                    </div>
                    <Switch
                      checked={notificationSettings.enabled}
                      onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, enabled: checked })}
                    />
                  </div>

                  {notificationSettings.enabled && (
                    <>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Notification Types</h4>
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show on Save</label>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Notify when file is saved</p>
                            </div>
                            <Switch
                              checked={notificationSettings.showOnSave}
                              onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, showOnSave: checked })}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show on Error</label>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Notify on errors</p>
                            </div>
                            <Switch
                              checked={notificationSettings.showOnError}
                              onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, showOnError: checked })}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show on Success</label>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Notify on successful operations</p>
                            </div>
                            <Switch
                              checked={notificationSettings.showOnSuccess}
                              onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, showOnSuccess: checked })}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Show on Warning</label>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Notify on warnings</p>
                            </div>
                            <Switch
                              checked={notificationSettings.showOnWarning}
                              onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, showOnWarning: checked })}
                            />
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">Appearance</h4>
                        <div className="space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Position
                            </label>
                            <Select
                              value={notificationSettings.position}
                              onValueChange={(value: any) => setNotificationSettings({ ...notificationSettings, position: value })}
                            >
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="top-right">Top Right</SelectItem>
                                <SelectItem value="top-left">Top Left</SelectItem>
                                <SelectItem value="bottom-right">Bottom Right</SelectItem>
                                <SelectItem value="bottom-left">Bottom Left</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Duration: {notificationSettings.duration}ms
                            </label>
                            <Slider
                              value={[notificationSettings.duration]}
                              onValueChange={(value) => setNotificationSettings({ ...notificationSettings, duration: value[0] })}
                              min={1000}
                              max={10000}
                              step={500}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div>
                              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Sound Enabled</label>
                              <p className="text-xs text-gray-500 dark:text-gray-400">Play sound with notifications</p>
                            </div>
                            <Switch
                              checked={notificationSettings.soundEnabled}
                              onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, soundEnabled: checked })}
                            />
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="max-w-3xl space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Security</h3>
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">File Operations</h4>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm File Delete</label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Ask for confirmation before deleting files</p>
                        </div>
                        <Switch
                          checked={securitySettings.confirmFileDelete}
                          onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, confirmFileDelete: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Confirm File Close</label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Ask for confirmation before closing modified files</p>
                        </div>
                        <Switch
                          checked={securitySettings.confirmFileClose}
                          onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, confirmFileClose: checked })}
                        />
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Warn on Sensitive Files</label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Warn when opening sensitive files (.env, .key, etc.)</p>
                        </div>
                        <Switch
                          checked={securitySettings.warnOnSensitiveFiles}
                          onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, warnOnSensitiveFiles: checked })}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">File Restrictions</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Max File Size: {(securitySettings.maxFileSize / (1024 * 1024)).toFixed(0)}MB
                        </label>
                        <Slider
                          value={[securitySettings.maxFileSize / (1024 * 1024)]}
                          onValueChange={(value) => setSecuritySettings({ ...securitySettings, maxFileSize: value[0] * 1024 * 1024 })}
                          min={1}
                          max={100}
                          step={1}
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Files larger than this will show a warning
                        </p>
                      </div>

                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Enable File Watcher</label>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Watch for external file changes</p>
                        </div>
                        <Switch
                          checked={securitySettings.enableFileWatcher}
                          onCheckedChange={(checked) => setSecuritySettings({ ...securitySettings, enableFileWatcher: checked })}
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3">File Extensions</h4>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Allowed Extensions
                        </label>
                        <Input
                          value={securitySettings.allowedFileExtensions.join(', ')}
                          onValueChange={(value) => setSecuritySettings({ 
                            ...securitySettings, 
                            allowedFileExtensions: value.split(',').map(s => s.trim()).filter(Boolean) 
                          })}
                          placeholder="*.go, *.js, *.ts, * (all files)"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Comma-separated list (use * for all files)
                        </p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Blocked Extensions
                        </label>
                        <Input
                          value={securitySettings.blockedFileExtensions.join(', ')}
                          onValueChange={(value) => setSecuritySettings({ 
                            ...securitySettings, 
                            blockedFileExtensions: value.split(',').map(s => s.trim()).filter(Boolean) 
                          })}
                          placeholder="*.exe, *.dll, *.bat"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Files with these extensions will be blocked
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;

