import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';

export interface CommandOutput {
  line: string;
  is_error: boolean;
}

/**
 * 终端服务 - 使用 Tauri Rust 后端命令
 */
export class TerminalService {
  /**
   * 执行命令（阻塞式，等待完成）
   */
  static async executeCommand(command: string, workingDir?: string): Promise<string> {
    try {
      return await invoke<string>('execute_command', { 
        command,
        workingDir: workingDir || null,
      });
    } catch (error: any) {
      throw new Error(error || '执行命令失败');
    }
  }

  /**
   * 执行命令（流式输出，实时显示）
   */
  static async executeCommandStream(
    command: string,
    workingDir: string | undefined,
    onOutput: (line: string, isError: boolean) => void,
    onFinished: (exitCode: number) => void
  ): Promise<{ processId: string; kill: () => Promise<void> }> {
    try {
      // 生成进程 ID
      const processId = `process-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // 启动流式命令执行
      await invoke('execute_command_stream', {
        command,
        workingDir: workingDir || null,
        processId,
      });

      // 监听输出事件
      const outputUnlisten = await listen<CommandOutput>('command-output', (event) => {
        onOutput(event.payload.line, event.payload.is_error);
      });

      // 监听完成事件
      const finishedUnlisten = await listen<number>('command-finished', (event) => {
        onFinished(event.payload);
        // 清理监听器
        outputUnlisten();
        finishedUnlisten();
      });

      // 返回进程 ID 和 kill 函数
      return {
        processId,
        kill: async () => {
          try {
            await invoke('kill_command', { processId });
            outputUnlisten();
            finishedUnlisten();
          } catch (error) {
            console.error('Failed to kill process:', error);
          }
        },
      };
    } catch (error: any) {
      throw new Error(error || '执行命令失败');
    }
  }

  /**
   * 获取当前工作目录
   */
  static async getCurrentDirectory(): Promise<string> {
    try {
      return await invoke<string>('get_current_directory');
    } catch (error) {
      console.error('获取当前目录失败:', error);
      throw error;
    }
  }

  /**
   * 切换工作目录
   */
  static async changeDirectory(path: string): Promise<string> {
    try {
      return await invoke<string>('change_directory', { path });
    } catch (error) {
      console.error('切换目录失败:', error);
      throw error;
    }
  }

  /**
   * 终止正在运行的命令
   */
  static async killCommand(processId: string): Promise<void> {
    try {
      console.log('TerminalService.killCommand called with processId:', processId);
      await invoke('kill_command', { processId });
      console.log('TerminalService.killCommand succeeded');
    } catch (error: any) {
      console.error('TerminalService.killCommand failed:', error);
      throw new Error(error || '终止命令失败');
    }
  }
}

