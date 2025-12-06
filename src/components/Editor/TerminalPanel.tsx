import React, { useState, useCallback, useImperativeHandle, forwardRef, useEffect } from 'react';
import { Plus, X } from 'lucide-react';
import { cn } from '@/utils/cn';
import Terminal from './Terminal';

export interface TerminalInstance {
  id: string;
  name: string;
  workingDirectory?: string;
  processIds?: string[]; // 该终端中运行的进程ID列表
}

interface TerminalPanelProps {
  className?: string;
  onClose?: () => void;
}

export interface TerminalPanelRef {
  createTerminal: (workingDirectory?: string) => void;
  executeCommand: (command: string, workingDirectory?: string, environment?: Record<string, string>) => Promise<void>;
}

const TerminalPanel = forwardRef<TerminalPanelRef, TerminalPanelProps>(({ className, onClose }, ref) => {
  const [terminals, setTerminals] = useState<TerminalInstance[]>([
    { id: '1', name: 'Terminal 1', processIds: [] }
  ]);
  const [activeTerminalId, setActiveTerminalId] = useState<string>('1');
  
  // 监听终端进程ID变化
  useEffect(() => {
    const handleProcessStart = (e: CustomEvent) => {
      const { terminalId, processId } = e.detail;
      setTerminals(prev => prev.map(t => 
        t.id === terminalId 
          ? { ...t, processIds: [...(t.processIds || []), processId] }
          : t
      ));
    };
    
    const handleProcessEnd = (e: CustomEvent) => {
      const { terminalId, processId } = e.detail;
      setTerminals(prev => prev.map(t => 
        t.id === terminalId 
          ? { ...t, processIds: (t.processIds || []).filter(id => id !== processId) }
          : t
      ));
    };
    
    window.addEventListener('terminal-process-start', handleProcessStart as EventListener);
    window.addEventListener('terminal-process-end', handleProcessEnd as EventListener);
    
    return () => {
      window.removeEventListener('terminal-process-start', handleProcessStart as EventListener);
      window.removeEventListener('terminal-process-end', handleProcessEnd as EventListener);
    };
  }, []);

  const createTerminal = useCallback((workingDirectory?: string) => {
    const newId = `terminal-${Date.now()}`;
    const dirName = workingDirectory?.split(/[/\\]/).pop() || 'Terminal';
    const newTerminal: TerminalInstance = {
      id: newId,
      name: `${dirName} (${terminals.length + 1})`,
      workingDirectory,
    };
    setTerminals(prev => [...prev, newTerminal]);
    setActiveTerminalId(newId);
  }, [terminals.length]);

  const closeTerminal = useCallback(async (id: string) => {
    const terminalToClose = terminals.find(t => t.id === id);
    
    // 检查是否有正在运行的进程
    if (terminalToClose?.processIds && terminalToClose.processIds.length > 0) {
      // 弹出确认对话框
      const confirmed = window.confirm(
        `终端 "${terminalToClose.name}" 中有 ${terminalToClose.processIds.length} 个进程正在运行。\n\n关闭终端将终止所有正在运行的进程。\n\n确定要关闭吗？`
      );
      
      if (!confirmed) {
        return; // 用户取消，不关闭终端
      }
      
      // 用户确认，停止所有进程
      const { TerminalService } = await import('@/services/terminal');
      for (const processId of terminalToClose.processIds) {
        try {
          await TerminalService.killCommand(processId);
        } catch (error) {
          console.error(`Failed to kill process ${processId}:`, error);
        }
      }
    }
    
    // 通知终端组件清理
    window.dispatchEvent(new CustomEvent('terminal-close', {
      detail: { terminalId: id }
    }));
    
    setTerminals(prev => {
      const newTerminals = prev.filter(t => t.id !== id);
      if (newTerminals.length === 0) {
        // 如果关闭了所有终端，延迟调用 onClose 以避免在渲染期间更新父组件
        setTimeout(() => {
          onClose?.();
        }, 0);
        return [{ id: '1', name: 'Terminal 1', processIds: [] }];
      }
      // 如果关闭的是当前激活的终端，切换到其他终端
      if (id === activeTerminalId) {
        const index = prev.findIndex(t => t.id === id);
        const newActiveId = index > 0 
          ? prev[index - 1].id 
          : newTerminals[0]?.id || '1';
        setActiveTerminalId(newActiveId);
      }
      return newTerminals;
    });
  }, [activeTerminalId, onClose, terminals]);

  const activeTerminal = terminals.find(t => t.id === activeTerminalId);

  const executeCommand = useCallback(async (command: string, workingDirectory?: string, environment?: Record<string, string>) => {
    // 如果指定了工作目录，创建一个新的终端或切换到对应目录的终端
    let targetTerminalId = activeTerminalId;
    
    if (workingDirectory) {
      const existingTerminal = terminals.find(t => t.workingDirectory === workingDirectory);
      if (existingTerminal) {
        targetTerminalId = existingTerminal.id;
        setActiveTerminalId(existingTerminal.id);
      } else {
        createTerminal(workingDirectory);
        // 等待终端创建完成，获取新创建的终端 ID
        await new Promise(resolve => setTimeout(resolve, 200));
        // 获取最新创建的终端
        const newTerminals = [...terminals];
        const newTerminal = newTerminals[newTerminals.length - 1];
        if (newTerminal) {
          targetTerminalId = newTerminal.id;
          setActiveTerminalId(newTerminal.id);
        }
      }
    }
    
    // 通过事件通知 Terminal 组件执行命令
    window.dispatchEvent(new CustomEvent('terminal-execute-command', {
      detail: { command, workingDirectory, environment, terminalId: targetTerminalId }
    }));
  }, [terminals, activeTerminalId, createTerminal]);

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    createTerminal: (workingDirectory?: string) => {
      createTerminal(workingDirectory);
    },
    executeCommand,
  }), [createTerminal, executeCommand]);

  return (
    <div className={cn('flex flex-col bg-gray-900 h-64 border-t dark:border-gray-700', className)}>
      {/* Terminal Tabs */}
      <div className="flex items-center gap-1 px-2 py-1 bg-gray-800 border-b dark:border-gray-700 overflow-x-auto">
        {terminals.map(terminal => (
          <div
            key={terminal.id}
            className={cn(
              'flex items-center gap-2 px-3 py-1 rounded-t cursor-pointer transition-colors',
              activeTerminalId === terminal.id
                ? 'bg-gray-900 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            )}
            onClick={() => setActiveTerminalId(terminal.id)}
          >
            <span className="text-xs font-medium whitespace-nowrap">{terminal.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeTerminal(terminal.id);
              }}
              className="hover:bg-gray-500 rounded p-0.5 transition-colors"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button
          onClick={() => createTerminal()}
          className="ml-1 p-1 hover:bg-gray-700 rounded transition-colors"
          title="新建终端"
        >
          <Plus className="w-4 h-4 text-gray-300" />
        </button>
      </div>

      {/* All Terminals - Keep them mounted to preserve state */}
      <div className="flex-1 overflow-hidden relative">
        {terminals.map(terminal => (
          <div
            key={terminal.id}
            className={cn(
              'absolute inset-0',
              activeTerminalId === terminal.id ? 'block' : 'hidden'
            )}
          >
            <Terminal
              terminalId={terminal.id}
              workingDirectory={terminal.workingDirectory}
              onClose={() => closeTerminal(terminal.id)}
            />
          </div>
        ))}
      </div>
    </div>
  );
});

TerminalPanel.displayName = 'TerminalPanel';

export default TerminalPanel;

