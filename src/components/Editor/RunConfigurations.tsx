import React, { useState, useEffect } from 'react';
import { Play, Plus, Edit2, Trash2, Settings, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export interface RunConfiguration {
  id: string;
  name: string;
  command: string;
  workingDirectory?: string;
  arguments?: string[];
  environment?: Record<string, string>;
  description?: string;
}

interface RunConfigurationsProps {
  onRun?: (config: RunConfiguration) => void;
  className?: string;
}

const RunConfigurations: React.FC<RunConfigurationsProps> = ({ onRun, className }) => {
  const [configurations, setConfigurations] = useLocalStorage<RunConfiguration[]>('gopilot_run_configurations', []);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [showConfigDialog, setShowConfigDialog] = useState(false);
  const [editingConfig, setEditingConfig] = useState<RunConfiguration | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const selectedConfig = configurations.find(c => c.id === selectedConfigId) || configurations[0] || null;

  const handleAdd = () => {
    const newConfig: RunConfiguration = {
      id: `config-${Date.now()}`,
      name: 'New Configuration',
      command: '',
      workingDirectory: '',
      arguments: [],
      environment: {},
      description: '',
    };
    setEditingConfig(newConfig);
    setShowConfigDialog(true);
  };

  const handleEdit = (config: RunConfiguration) => {
    setEditingConfig({ ...config });
    setShowConfigDialog(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('确定要删除此配置吗？')) {
      setConfigurations(configurations.filter(c => c.id !== id));
      if (selectedConfigId === id) {
        setSelectedConfigId(null);
      }
    }
  };

  const handleSave = (config: RunConfiguration) => {
    if (editingConfig?.id && configurations.find(c => c.id === editingConfig.id)) {
      // 更新现有配置
      setConfigurations(configurations.map(c => c.id === editingConfig.id ? config : c));
    } else {
      // 添加新配置
      setConfigurations([...configurations, config]);
    }
    setShowConfigDialog(false);
    setEditingConfig(null);
    if (!selectedConfigId) {
      setSelectedConfigId(config.id);
    }
  };

  const handleRun = () => {
    if (selectedConfig && onRun) {
      onRun(selectedConfig);
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Configuration Selector */}
      <div className="relative">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-sm"
        >
          <Settings className="w-4 h-4" />
          <span className="min-w-[120px] text-left">
            {selectedConfig ? selectedConfig.name : '选择配置...'}
          </span>
          <ChevronDown className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-180')} />
        </button>

        {/* Dropdown Menu */}
        {isExpanded && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsExpanded(false)}
            />
            <div className="absolute top-full left-0 mt-1 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg z-20 max-h-96 overflow-y-auto">
              {configurations.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  暂无配置
                </div>
              ) : (
                <div className="py-1">
                  {configurations.map((config) => (
                    <div
                      key={config.id}
                      className={cn(
                        'flex items-center justify-between px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer',
                        selectedConfigId === config.id && 'bg-blue-50 dark:bg-blue-900/20'
                      )}
                      onClick={() => {
                        setSelectedConfigId(config.id);
                        setIsExpanded(false);
                      }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {config.name}
                        </div>
                        {config.description && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {config.description}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEdit(config);
                          }}
                          className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                          title="编辑"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(config.id);
                          }}
                          className="p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                          title="删除"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 p-1">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleAdd();
                    setIsExpanded(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                >
                  <Plus className="w-4 h-4" />
                  添加新配置
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Run Button */}
      <button
        onClick={handleRun}
        disabled={!selectedConfig}
        className={cn(
          'flex items-center gap-2 px-4 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
          !selectedConfig && 'opacity-50 cursor-not-allowed'
        )}
        title={selectedConfig ? `运行: ${selectedConfig.name}` : '请先选择配置'}
      >
        <Play className="w-4 h-4" />
        <span>运行</span>
      </button>

      {/* Configuration Dialog */}
      {showConfigDialog && editingConfig && (
        <RunConfigurationDialog
          config={editingConfig}
          onSave={handleSave}
          onCancel={() => {
            setShowConfigDialog(false);
            setEditingConfig(null);
          }}
          isNew={!configurations.find(c => c.id === editingConfig.id)}
        />
      )}
    </div>
  );
};

interface RunConfigurationDialogProps {
  config: RunConfiguration;
  onSave: (config: RunConfiguration) => void;
  onCancel: () => void;
  isNew?: boolean;
}

const RunConfigurationDialog: React.FC<RunConfigurationDialogProps> = ({ config, onSave, onCancel, isNew = false }) => {
  const [formData, setFormData] = useState<RunConfiguration>(config);
  const [workspaceRoot, setWorkspaceRoot] = useState<string | null>(null);

  useEffect(() => {
    // 获取当前工作区根目录
    const root = localStorage.getItem('gopilot_workspace_root');
    if (root) {
      setWorkspaceRoot(root);
      if (!formData.workingDirectory) {
        setFormData(prev => ({ ...prev, workingDirectory: root }));
      }
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.command.trim()) {
      alert('请填写配置名称和命令');
      return;
    }
    onSave(formData);
  };

  const handleAddArg = () => {
    setFormData(prev => ({
      ...prev,
      arguments: [...(prev.arguments || []), ''],
    }));
  };

  const handleRemoveArg = (index: number) => {
    setFormData(prev => ({
      ...prev,
      arguments: prev.arguments?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleArgChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      arguments: prev.arguments?.map((arg, i) => i === index ? value : arg) || [],
    }));
  };

  const handleAddEnv = () => {
    setFormData(prev => ({
      ...prev,
      environment: { ...(prev.environment || {}), '': '' },
    }));
  };

  const handleRemoveEnv = (key: string) => {
    setFormData(prev => {
      const env = { ...(prev.environment || {}) };
      delete env[key];
      return { ...prev, environment: env };
    });
  };

  const handleEnvChange = (oldKey: string, newKey: string, value: string) => {
    setFormData(prev => {
      const env = { ...(prev.environment || {}) };
      if (oldKey !== newKey) {
        delete env[oldKey];
      }
      env[newKey] = value;
      return { ...prev, environment: env };
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            {isNew ? '新建运行配置' : '编辑运行配置'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              配置名称 *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="例如: 启动开发服务器"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              描述
            </label>
            <input
              type="text"
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="配置的简要说明"
            />
          </div>

          {/* Command */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              命令 *
            </label>
            <input
              type="text"
              value={formData.command}
              onChange={(e) => setFormData(prev => ({ ...prev, command: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
              placeholder="例如: go run main.go 或 npm start"
              required
            />
          </div>

          {/* Working Directory */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              工作目录
            </label>
            <input
              type="text"
              value={formData.workingDirectory || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, workingDirectory: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              placeholder="留空则使用项目根目录"
            />
          </div>

          {/* Arguments */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                参数
              </label>
              <button
                type="button"
                onClick={handleAddArg}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                + 添加参数
              </button>
            </div>
            <div className="space-y-2">
              {formData.arguments?.map((arg, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={arg}
                    onChange={(e) => handleArgChange(index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                    placeholder="参数值"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveArg(index)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(!formData.arguments || formData.arguments.length === 0) && (
                <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                  暂无参数
                </div>
              )}
            </div>
          </div>

          {/* Environment Variables */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                环境变量
              </label>
              <button
                type="button"
                onClick={handleAddEnv}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                + 添加变量
              </button>
            </div>
            <div className="space-y-2">
              {Object.entries(formData.environment || {}).map(([key, value], index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={key}
                    onChange={(e) => handleEnvChange(key, e.target.value, value)}
                    className="w-1/3 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                    placeholder="变量名"
                  />
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => handleEnvChange(key, key, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 font-mono text-sm"
                    placeholder="变量值"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveEnv(key)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              {(!formData.environment || Object.keys(formData.environment).length === 0) && (
                <div className="text-sm text-gray-500 dark:text-gray-400 italic">
                  暂无环境变量
                </div>
              )}
            </div>
          </div>
        </form>

        <div className="px-6 py-4 border-t dark:border-gray-700 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
          >
            取消
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};

export default RunConfigurations;

