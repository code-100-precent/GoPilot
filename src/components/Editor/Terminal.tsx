import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, Square } from 'lucide-react';
import { cn } from '@/utils/cn';
import { TerminalService } from '@/services/terminal';
import { useTerminalHistory } from '@/hooks/useTerminalHistory';
import { TerminalCompletionService } from '@/services/terminalCompletion';
import { parseAnsi, styleToCss } from '@/utils/ansiParser';

interface TerminalProps {
  className?: string;
  onClose?: () => void;
  workingDirectory?: string;
  terminalId?: string; // 终端唯一ID
}

const Terminal: React.FC<TerminalProps> = ({ className, onClose, workingDirectory, terminalId }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [isMaximized, setIsMaximized] = useState(false);
  const [currentDir, setCurrentDir] = useState<string>('');
  const [output, setOutput] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isComposing, setIsComposing] = useState(false); // 用于检测输入法状态
  const [compositionValue, setCompositionValue] = useState(''); // 保存输入法组合时的值
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);
  const { history, addCommand } = useTerminalHistory();

  // 监听外部命令执行请求
  useEffect(() => {
    const handleExecuteCommand = async (e: CustomEvent) => {
      const { command, workingDirectory: cmdWorkingDir, environment, terminalId: targetTerminalId } = e.detail;
      
      // 只处理当前终端的命令
      if (terminalId && targetTerminalId !== terminalId) {
        return; // 不是这个终端的命令，忽略
      }
      
      // 如果指定了工作目录，先切换目录
      if (cmdWorkingDir && cmdWorkingDir !== currentDir) {
        try {
          await TerminalService.changeDirectory(cmdWorkingDir);
          const newDir = await TerminalService.getCurrentDirectory();
          setCurrentDir(newDir);
        } catch (error: any) {
          setOutput((prev) => [...prev, `Error changing directory: ${error.message}`, '']);
          return;
        }
      }
      
      // 直接执行命令（复用 handleCommand 的逻辑）
      if (!command.trim()) {
        setOutput((prev) => [...prev, '']);
        return;
      }

      const cmd = command.trim();
      setOutput((prev) => [...prev, `$ ${cmd}`]);
      addCommand(cmd);
      setHistoryIndex(-1);
      setIsExecuting(true);

      try {
        // 处理特殊命令
        if (cmd.toLowerCase() === 'clear') {
          setOutput([]);
          setIsExecuting(false);
          return;
        }

        if (cmd.toLowerCase().startsWith('cd ')) {
          const path = cmd.substring(3).trim();
          if (path) {
            const newDir = await TerminalService.changeDirectory(path);
            setCurrentDir(newDir);
            setOutput((prev) => [...prev, newDir, '']);
          }
          setIsExecuting(false);
          return;
        }

        // 判断是否应该使用流式输出
        const isLongRunningCommand = 
          cmd.includes('go run') ||
          cmd.includes('npm start') ||
          cmd.includes('npm run') ||
          (cmd.includes('python') && (cmd.includes('server') || cmd.includes('app'))) ||
          (cmd.includes('node') && (cmd.includes('server') || cmd.includes('app'))) ||
          cmd.includes('cargo run');

        if (isLongRunningCommand) {
          // 使用流式输出
          const { processId } = await TerminalService.executeCommandStream(
            cmd,
            currentDir,
            (line, isError) => {
              setOutput((prev) => [...prev, line]);
            },
            (exitCode) => {
              if (exitCode !== 0) {
                setOutput((prev) => [...prev, `Process exited with code ${exitCode}`, '']);
              } else {
                setOutput((prev) => [...prev, '']);
              }
              setIsExecuting(false);
              setCurrentProcessId(null);
              
              // 通知进程结束
              if (terminalId) {
                window.dispatchEvent(new CustomEvent('terminal-process-end', {
                  detail: { terminalId, processId }
                }));
              }
              
              TerminalService.getCurrentDirectory()
                .then(setCurrentDir)
                .catch(() => {});
            }
          );
          setCurrentProcessId(processId);
          setIsExecuting(false);
          
          // 通知进程开始
          if (terminalId) {
            window.dispatchEvent(new CustomEvent('terminal-process-start', {
              detail: { terminalId, processId }
            }));
          }
        } else {
          // 使用阻塞式输出
          const result = await TerminalService.executeCommand(cmd, currentDir);
          setOutput((prev) => [...prev, result, '']);
          setIsExecuting(false);
          
          // 更新当前目录
          TerminalService.getCurrentDirectory()
            .then(setCurrentDir)
            .catch(() => {});
        }
      } catch (error: any) {
        setOutput((prev) => [...prev, `Error: ${error.message || error}`, '']);
        setIsExecuting(false);
      }
    };

    window.addEventListener('terminal-execute-command', handleExecuteCommand as EventListener);
    return () => {
      window.removeEventListener('terminal-execute-command', handleExecuteCommand as EventListener);
    };
  }, [currentDir, addCommand]);

  // 监听终端关闭事件，清理进程
  useEffect(() => {
    const handleTerminalClose = (e: CustomEvent) => {
      const { terminalId: closingTerminalId } = e.detail;
      if (closingTerminalId === terminalId && currentProcessId) {
        // 停止当前运行的进程
        TerminalService.killCommand(currentProcessId)
          .then(() => {
            setOutput((prev) => [...prev, '终端已关闭，进程已停止', '']);
          })
          .catch((error: any) => {
            console.error('Failed to kill process on terminal close:', error);
          });
        setCurrentProcessId(null);
        setIsExecuting(false);
      }
    };
    
    window.addEventListener('terminal-close', handleTerminalClose as EventListener);
    return () => {
      window.removeEventListener('terminal-close', handleTerminalClose as EventListener);
    };
  }, [terminalId, currentProcessId]);

  // 初始化终端（只在首次挂载时执行）
  useEffect(() => {
    // 如果已经有输出，说明已经初始化过，不重复初始化
    if (output.length > 0) {
      return;
    }
    
    const initTerminal = async () => {
      try {
        if (workingDirectory) {
          await TerminalService.changeDirectory(workingDirectory);
        }
        const dir = await TerminalService.getCurrentDirectory();
        setCurrentDir(dir);
        setOutput([`GoPilot Terminal`, `Current directory: ${dir}`, '']);
      } catch (error: any) {
        setOutput([`GoPilot Terminal`, `Error: ${error.message}`, '']);
      }
    };
    initTerminal();
  }, []); // 只在组件挂载时执行一次

  // 自动滚动到底部
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  // 聚焦输入框
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  // 全局键盘监听器，用于捕获 Ctrl+C
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 检测 Ctrl+C 或 Cmd+C
      // 注意：在 Mac 上，Cmd+C 是复制，Ctrl+C 才是中断信号
      // 但在浏览器中，我们需要捕获 Ctrl+C (Windows/Linux) 或 Cmd+C (Mac，如果用户想要)
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const isInterrupt = isMac 
        ? (e.ctrlKey && (e.key === 'c' || e.key === 'C' || e.keyCode === 67))
        : ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.keyCode === 67));
      
      if (isInterrupt) {
        // 检查是否在终端区域内（通过检查焦点或点击位置）
        const isInTerminal = 
          document.activeElement === inputRef.current ||
          terminalRef.current?.contains(document.activeElement) ||
          terminalRef.current?.contains(e.target as Node);
        
        if (!isInTerminal) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        if (currentProcessId) {
          console.log('Ctrl+C detected, killing process:', currentProcessId);
          // 立即显示中断信号
          setOutput((prev) => [...prev, '^C', '']);
          // 立即清除 processId，防止重复调用
          const processIdToKill = currentProcessId;
          setCurrentProcessId(null);
          setIsExecuting(false);
          
          // 异步处理，但不阻塞
          TerminalService.killCommand(processIdToKill)
            .then(() => {
              console.log('Process killed successfully:', processIdToKill);
              setOutput((prev) => [...prev, '进程已停止', '']);
            })
            .catch((error: any) => {
              console.error('Failed to kill process:', error);
              setOutput((prev) => [...prev, `Failed to interrupt: ${error.message || error}`, '']);
            });
        } else {
          console.log('Ctrl+C pressed but no process running. currentProcessId:', currentProcessId);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
    };
  }, [currentProcessId]);

  const handleCommand = async (cmd: string) => {
    if (!cmd.trim()) {
      setOutput((prev) => [...prev, '']);
      return;
    }

    const command = cmd.trim();
    setOutput((prev) => [...prev, `$ ${command}`]);
    addCommand(command);
    setHistoryIndex(-1);
    setIsExecuting(true);

    try {
      // 处理特殊命令
      if (command.toLowerCase() === 'clear') {
        setOutput([]);
        setIsExecuting(false);
        return;
      }

      if (command.toLowerCase().startsWith('cd ')) {
        const path = command.substring(3).trim();
        if (path) {
          const newDir = await TerminalService.changeDirectory(path);
          setCurrentDir(newDir);
          setOutput((prev) => [...prev, newDir, '']);
        } else {
          // cd without arguments - go to home directory
          try {
            const homeCmd = navigator.platform.toLowerCase().includes('win') 
              ? 'echo %USERPROFILE%' 
              : 'echo $HOME';
            const homeDir = await TerminalService.executeCommand(homeCmd, currentDir);
            const homePath = homeDir.trim();
            if (homePath) {
              const newDir = await TerminalService.changeDirectory(homePath);
              setCurrentDir(newDir);
              setOutput((prev) => [...prev, newDir, '']);
            }
          } catch (error: any) {
            setOutput((prev) => [...prev, `Error: ${error.message}`, '']);
          }
        }
        setIsExecuting(false);
        return;
      }

      // 判断是否应该使用流式输出
      // 对于长时间运行的命令（如 go run, npm start, python server.py 等），使用流式输出
      const isLongRunningCommand = 
        command.includes('go run') ||
        command.includes('npm start') ||
        command.includes('npm run') ||
        (command.includes('python') && (command.includes('server') || command.includes('app'))) ||
        (command.includes('node') && (command.includes('server') || command.includes('app'))) ||
        command.includes('cargo run');

      if (isLongRunningCommand) {
        // 使用流式输出
        const { processId } = await TerminalService.executeCommandStream(
          command,
          currentDir,
          (line, isError) => {
            // 实时接收输出
            setOutput((prev) => [...prev, line]);
          },
          (exitCode) => {
            // 命令完成
            if (exitCode !== 0) {
              setOutput((prev) => [...prev, `Process exited with code ${exitCode}`, '']);
            } else {
              setOutput((prev) => [...prev, '']);
            }
            setIsExecuting(false);
            setCurrentProcessId(null);
            
            // 更新当前目录
            TerminalService.getCurrentDirectory()
              .then(setCurrentDir)
              .catch(() => {});
          }
        );
        console.log('Process started with ID:', processId);
        setCurrentProcessId(processId);
        // 对于长时间运行的命令，不阻塞输入框，允许继续输入
        setIsExecuting(false);
      } else {
        // 使用阻塞式执行（快速命令）
        const result = await TerminalService.executeCommand(command, currentDir);
        if (result && result.trim()) {
          // 按行分割输出，保留所有行
          const lines = result.split('\n');
          // 移除最后的空行（如果有）
          const filteredLines = lines[lines.length - 1] === '' 
            ? lines.slice(0, -1) 
            : lines;
          setOutput((prev) => [...prev, ...filteredLines, '']);
        } else {
          // 没有输出，但命令可能成功执行了
          setOutput((prev) => [...prev, '']);
        }
        setIsExecuting(false);

        // 更新当前目录（某些命令可能会改变目录）
        try {
          const newDir = await TerminalService.getCurrentDirectory();
          setCurrentDir(newDir);
        } catch (error) {
          // 忽略获取目录失败
        }
      }
    } catch (error: any) {
      // 如果命令执行失败，显示错误信息
      const errorMsg = error.message || String(error);
      // 错误信息可能包含多行
      const errorLines = errorMsg.split('\n').filter((line: string) => line.trim());
      setOutput((prev) => [...prev, ...errorLines, '']);
      setIsExecuting(false);
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    // 如果正在输入中文，不处理特殊按键（除了Tab，因为Tab补全应该在输入法状态下也能工作）
    if (isComposing && e.key !== 'Tab') {
      // Enter键在输入法状态下不应该执行命令
      if (e.key === 'Enter') {
        e.preventDefault();
        return;
      }
      return;
    }

    // 优先处理 Ctrl+C / Cmd+C（在任何其他按键之前）
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C' || e.keyCode === 67)) {
      e.preventDefault();
      e.stopPropagation();
      if (currentProcessId) {
        // 异步处理，但不阻塞
        TerminalService.killCommand(currentProcessId)
          .then(() => {
            setOutput((prev) => [...prev, '^C', '']);
            setIsExecuting(false);
            setCurrentProcessId(null);
          })
          .catch((error: any) => {
            setOutput((prev) => [...prev, `Failed to interrupt: ${error.message || error}`, '']);
            setIsExecuting(false);
            setCurrentProcessId(null);
          });
      } else {
        // 如果没有正在运行的进程，Ctrl+C 清空输入
        setInput('');
      }
      return;
    }

    if (e.key === 'Enter') {
      // 再次检查输入法状态，防止在compositionEnd之前就执行
      if (isComposing) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      handleCommand(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex = historyIndex === -1 
          ? history.length - 1 
          : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setInput(history[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex >= 0) {
        const newIndex = historyIndex + 1;
        if (newIndex >= history.length) {
          setHistoryIndex(-1);
          setInput('');
        } else {
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Tab 补全功能
      const handleTabCompletion = async () => {
        try {
          const completions = await TerminalCompletionService.getCompletions(input, currentDir);
          if (completions.length === 0) {
            return; // 没有补全选项
          }
          
          if (completions.length === 1) {
            // 只有一个选项，直接补全
            const parts = input.trim().split(/\s+/);
            const lastPart = parts[parts.length - 1] || '';
            const prefix = lastPart.split('/').slice(0, -1).join('/');
            const newLastPart = prefix ? `${prefix}/${completions[0]}` : completions[0];
            parts[parts.length - 1] = newLastPart;
            setInput(parts.join(' '));
          } else {
            // 多个选项，找到公共前缀
            const parts = input.trim().split(/\s+/);
            const lastPart = parts[parts.length - 1] || '';
            const commonPrefix = TerminalCompletionService.getCommonPrefix(completions);
            if (commonPrefix && commonPrefix.length > lastPart.length) {
              const prefix = lastPart.split('/').slice(0, -1).join('/');
              const newLastPart = prefix ? `${prefix}/${commonPrefix}` : commonPrefix;
              parts[parts.length - 1] = newLastPart;
              setInput(parts.join(' '));
            } else {
              // 显示所有选项
              setOutput((prev) => [...prev, ...completions.map(c => `  ${c}`), '']);
            }
          }
        } catch (error) {
          console.error('Tab completion error:', error);
        }
      };
      handleTabCompletion();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setInput('');
      setHistoryIndex(-1);
    }
  }, [input, history, historyIndex, isComposing, currentProcessId, handleCommand]);

  // 处理输入法开始
  const handleCompositionStart = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(true);
    setCompositionValue(e.currentTarget.value);
  }, []);

  // 处理输入法更新
  const handleCompositionUpdate = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    setCompositionValue(e.currentTarget.value);
  }, []);

  // 处理输入法结束
  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLInputElement>) => {
    setIsComposing(false);
    setCompositionValue('');
    // 确保输入值正确更新
    setInput(e.currentTarget.value);
  }, []);

  return (
    <div
      className={cn(
        'flex flex-col bg-gray-900 text-green-400 font-mono text-sm h-full',
        isMaximized ? 'fixed inset-0 z-50' : '',
        className
      )}
    >
      {/* Terminal Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <TerminalIcon className="w-4 h-4 flex-shrink-0" />
          <span className="text-gray-300 flex-shrink-0">Terminal</span>
          {currentDir && (
            <span className="text-xs text-gray-500 truncate max-w-md">
              {currentDir}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setIsMaximized(!isMaximized)}
            className="p-1 hover:bg-gray-700 rounded transition-colors"
            title={isMaximized ? '最小化' : '最大化'}
          >
            {isMaximized ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
          {onClose && (
            <button 
              onClick={onClose} 
              className="p-1 hover:bg-gray-700 rounded transition-colors"
              title="关闭终端"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Terminal Output */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-y-auto p-4 space-y-0.5 scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
        style={{ 
          scrollBehavior: 'smooth',
          fontFamily: 'Monaco, "Courier New", monospace',
          fontSize: '13px',
          lineHeight: '1.5',
        }}
      >
        {output.map((line, index) => {
          // 解析 ANSI 颜色代码
          const segments = parseAnsi(line);
          
          return (
            <div 
              key={index} 
              className="whitespace-pre-wrap break-words"
              style={{ wordBreak: 'break-word' }}
            >
              {segments.map((segment, segIndex) => (
                <span
                  key={segIndex}
                  style={styleToCss(segment.style)}
                >
                  {segment.text}
                </span>
              ))}
            </div>
          );
        })}
        {currentProcessId && (
          <div className="flex items-center gap-2 text-yellow-500 text-xs mb-2">
            <span className="animate-pulse">●</span>
            <span>进程运行中... (按 Ctrl+C 或 Cmd+C 停止)</span>
          </div>
        )}
      </div>

      {/* Terminal Input */}
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-800 border-t border-gray-700 flex-shrink-0">
        <span className="text-green-400 flex-shrink-0">
          {currentDir ? (
            <>
              <span className="text-blue-400">{currentDir.split(/[/\\]/).pop() || currentDir}</span>
              <span className="text-gray-500">:</span>
            </>
          ) : null}
        </span>
        <span className="text-green-400 flex-shrink-0">$</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onCompositionStart={handleCompositionStart}
          onCompositionUpdate={handleCompositionUpdate}
          onCompositionEnd={handleCompositionEnd}
          className="flex-1 bg-transparent text-green-400 outline-none caret-green-400"
          placeholder={currentProcessId ? "进程运行中... (按 Ctrl+C 停止)" : "输入命令..."}
          disabled={false}
          spellCheck={false}
          autoComplete="off"
          style={{ fontFamily: 'Monaco, "Courier New", monospace' }}
        />
        {currentProcessId && (
          <button
            onClick={async () => {
              try {
                await TerminalService.killCommand(currentProcessId);
                setOutput((prev) => [...prev, '^C', '']);
                setIsExecuting(false);
                setCurrentProcessId(null);
              } catch (error: any) {
                setOutput((prev) => [...prev, `Failed to interrupt: ${error.message || error}`, '']);
                setIsExecuting(false);
                setCurrentProcessId(null);
              }
            }}
            className="p-1 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
            title="停止进程 (Ctrl+C)"
          >
            <Square className="w-4 h-4 text-red-400" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Terminal;
