import { invoke } from '@tauri-apps/api/tauri';

/**
 * 对话框服务 - 使用 Tauri Rust 后端命令
 */
export class DialogService {
  /**
   * 打开文件夹选择对话框
   */
  static async openFolder(): Promise<string | null> {
    try {
      const result = await invoke<string | null>('open_folder_dialog');
      return result;
    } catch (error) {
      console.error('打开文件夹对话框失败:', error);
      return null;
    }
  }

  /**
   * 打开文件选择对话框
   */
  static async openFile(): Promise<string | null> {
    try {
      const result = await invoke<string | null>('open_file_dialog');
      return result;
    } catch (error) {
      console.error('打开文件对话框失败:', error);
      return null;
    }
  }
}
