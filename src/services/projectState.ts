import { FileSystemService } from './fileSystem';

export interface ProjectState {
  workspaceRoot: string;
  openFiles: Array<{
    path: string;
    name: string;
  }>;
  activeFile?: string;
  lastOpened: number;
}

const PILOT_DIR = '.pilot';
const STATE_FILE = 'project.json';

/**
 * 项目状态管理服务
 */
export class ProjectStateService {
  /**
   * 获取项目状态文件路径
   */
  static getStateFilePath(workspaceRoot: string): string {
    return `${workspaceRoot}/${PILOT_DIR}/${STATE_FILE}`;
  }

  /**
   * 保存项目状态
   */
  static async saveProjectState(state: ProjectState): Promise<void> {
    try {
      const stateFilePath = this.getStateFilePath(state.workspaceRoot);
      const pilotDir = `${state.workspaceRoot}/${PILOT_DIR}`;
      
      // 确保 .pilot 目录存在
      // 先检查目录是否存在，如果不存在则创建
      const dirExists = await FileSystemService.pathExists(pilotDir);
      if (!dirExists) {
        try {
          await FileSystemService.createDirectory(pilotDir);
          console.log('Created .pilot directory:', pilotDir);
        } catch (error: any) {
          // 如果创建失败，可能是权限问题或其他原因
          console.error('Failed to create .pilot directory:', error);
          throw new Error(`无法创建项目状态目录: ${error.message || error}`);
        }
      }
      
      // 保存状态到 JSON 文件
      const stateJson = JSON.stringify(state, null, 2);
      await FileSystemService.writeFileContent(stateFilePath, stateJson);
      
      console.log('Project state saved:', stateFilePath);
    } catch (error) {
      console.error('Failed to save project state:', error);
      throw error;
    }
  }

  /**
   * 加载项目状态
   */
  static async loadProjectState(workspaceRoot: string): Promise<ProjectState | null> {
    try {
      const stateFilePath = this.getStateFilePath(workspaceRoot);
      
      // 检查文件是否存在
      const exists = await FileSystemService.pathExists(stateFilePath);
      if (!exists) {
        return null;
      }
      
      // 读取状态文件
      const stateJson = await FileSystemService.readFileContent(stateFilePath);
      const state = JSON.parse(stateJson) as ProjectState;
      
      // 验证状态有效性
      if (state.workspaceRoot !== workspaceRoot) {
        console.warn('Workspace root mismatch, ignoring saved state');
        return null;
      }
      
      return state;
    } catch (error) {
      console.error('Failed to load project state:', error);
      return null;
    }
  }

  /**
   * 检查项目是否有保存的状态
   */
  static async hasProjectState(workspaceRoot: string): Promise<boolean> {
    try {
      const stateFilePath = this.getStateFilePath(workspaceRoot);
      return await FileSystemService.pathExists(stateFilePath);
    } catch (error) {
      return false;
    }
  }

  /**
   * 初始化项目目录（创建 .pilot 文件夹）
   */
  static async initializeProject(workspaceRoot: string): Promise<void> {
    try {
      const pilotDir = `${workspaceRoot}/${PILOT_DIR}`;
      
      // 检查目录是否存在
      const dirExists = await FileSystemService.pathExists(pilotDir);
      if (!dirExists) {
        try {
          await FileSystemService.createDirectory(pilotDir);
          console.log('Created .pilot directory:', pilotDir);
        } catch (error: any) {
          console.error('Failed to create .pilot directory:', error);
          // 不抛出错误，因为目录可能已经存在（并发创建的情况）
        }
      }
    } catch (error) {
      console.error('Failed to initialize project:', error);
      // 不抛出错误，允许继续执行
    }
  }

  /**
   * 删除项目状态
   */
  static async deleteProjectState(workspaceRoot: string): Promise<void> {
    try {
      const stateFilePath = this.getStateFilePath(workspaceRoot);
      
      // 删除状态文件
      try {
        await FileSystemService.deleteFile(stateFilePath);
      } catch (error) {
        console.log('State file may not exist:', error);
      }
    } catch (error) {
      console.error('Failed to delete project state:', error);
    }
  }
}

