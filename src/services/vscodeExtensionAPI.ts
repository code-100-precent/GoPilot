/**
 * VSCode Extension API 实现
 * 提供类似 VSCode 的扩展 API，让扩展能够与编辑器交互
 */

import * as monaco from 'monaco-editor';

// VSCode Extension API 类型定义
export interface ExtensionContext {
  subscriptions: Array<{ dispose(): void }>;
  extensionPath: string;
  globalState: Memento;
  workspaceState: Memento;
  extensionUri: string;
}

export interface Memento {
  get<T>(key: string): T | undefined;
  get<T>(key: string, defaultValue: T): T;
  update(key: string, value: any): Promise<void>;
}

export interface Command {
  command: string;
  title: string;
  category?: string;
  icon?: string;
}

export interface Disposable {
  dispose(): void;
}

export interface TextEditor {
  document: TextDocument;
  selection: Selection;
  edit(callback: (editBuilder: TextEditorEdit) => void): Promise<boolean>;
}

export interface TextDocument {
  uri: string;
  fileName: string;
  languageId: string;
  getText(): string;
  getText(range: Range): string;
  lineCount: number;
}

export interface Selection {
  start: Position;
  end: Position;
  isEmpty: boolean;
}

export interface Position {
  line: number;
  character: number;
}

export interface Range {
  start: Position;
  end: Position;
}

export interface TextEditorEdit {
  replace(location: Position | Range, value: string): void;
  insert(location: Position, value: string): void;
  delete(location: Range): void;
}

export interface TreeView<T> {
  onDidChangeSelection: {
    event: (listener: (e: any) => void) => Disposable;
  };
  onDidChangeVisibility: {
    event: (listener: (e: any) => void) => Disposable;
  };
  reveal(element: T, options?: any): Promise<void>;
  dispose(): void;
}

// 全局扩展 API 实例
class VSCodeExtensionAPI {
  private commands: Map<string, (...args: any[]) => any> = new Map();
  private subscriptions: Array<{ dispose(): void }> = [];
  private globalState: Map<string, any> = new Map();
  private workspaceState: Map<string, any> = new Map();
  private activeEditor: monaco.editor.IStandaloneCodeEditor | null = null;
  private editorModels: Map<string, monaco.editor.ITextModel> = new Map();

  /**
   * 设置当前活动的编辑器
   */
  setActiveEditor(editor: monaco.editor.IStandaloneCodeEditor | null) {
    this.activeEditor = editor;
  }

  /**
   * 注册编辑器模型
   */
  registerModel(uri: string, model: monaco.editor.ITextModel) {
    this.editorModels.set(uri, model);
  }

  /**
   * 创建扩展上下文
   */
  createExtensionContext(extensionPath: string): ExtensionContext {
    return {
      subscriptions: this.subscriptions,
      extensionPath,
      globalState: this.createMemento(this.globalState),
      workspaceState: this.createMemento(this.workspaceState),
      extensionUri: extensionPath,
    };
  }

  /**
   * 创建 Memento
   */
  private createMemento(storage: Map<string, any>): Memento {
    return {
      get<T>(key: string, defaultValue?: T): T | undefined {
        return (storage.get(key) as T) ?? defaultValue;
      },
      async update(key: string, value: any): Promise<void> {
        storage.set(key, value);
        // TODO: 持久化到本地存储
      },
    };
  }

  /**
   * 注册命令
   */
  registerCommand(command: string, callback: (...args: any[]) => any): Disposable {
    this.commands.set(command, callback);
    
    const disposable = {
      dispose: () => {
        this.commands.delete(command);
      },
    };
    
    this.subscriptions.push(disposable);
    return disposable;
  }

  /**
   * 执行命令
   */
  async executeCommand(command: string, ...args: any[]): Promise<any> {
    const handler = this.commands.get(command);
    if (!handler) {
      throw new Error(`命令 "${command}" 未找到`);
    }
    return handler(...args);
  }

  /**
   * 获取活动文本编辑器
   */
  getActiveTextEditor(): TextEditor | undefined {
      if (!this.activeEditor) {
        return undefined;
      }

      const model = this.activeEditor.getModel();
      if (!model) {
        return undefined;
      }

      const selection = this.activeEditor.getSelection();
      if (!selection) {
        return undefined;
      }

      return {
        document: {
          uri: model.uri.toString(),
          fileName: model.uri.path.split('/').pop() || '',
          languageId: model.getLanguageId(),
          getText: (range?: Range) => {
            if (range) {
              return model.getValueInRange({
                startLineNumber: range.start.line + 1,
                startColumn: range.start.character + 1,
                endLineNumber: range.end.line + 1,
                endColumn: range.end.character + 1,
              });
            }
            return model.getValue();
          },
          lineCount: model.getLineCount(),
        },
        selection: {
          start: {
            line: selection.startLineNumber - 1,
            character: selection.startColumn - 1,
          },
          end: {
            line: selection.endLineNumber - 1,
            character: selection.endColumn - 1,
          },
          isEmpty: selection.isEmpty(),
        },
        async edit(callback: (editBuilder: TextEditorEdit) => void): Promise<boolean> {
          if (!this.activeEditor || !model) {
            return false;
          }

          const editBuilder: TextEditorEdit = {
            replace: (location: Position | Range, value: string) => {
              if ('line' in location && 'character' in location) {
                // Position
                const pos = location as Position;
                const range = {
                  startLineNumber: pos.line + 1,
                  startColumn: pos.character + 1,
                  endLineNumber: pos.line + 1,
                  endColumn: pos.character + 1,
                };
                this.activeEditor!.executeEdits('extension', [{
                  range,
                  text: value,
                }]);
              } else {
                // Range
                const r = location as Range;
                const range = {
                  startLineNumber: r.start.line + 1,
                  startColumn: r.start.character + 1,
                  endLineNumber: r.end.line + 1,
                  endColumn: r.end.character + 1,
                };
                this.activeEditor!.executeEdits('extension', [{
                  range,
                  text: value,
                }]);
              }
            },
            insert: (location: Position, value: string) => {
              const range = {
                startLineNumber: location.line + 1,
                startColumn: location.character + 1,
                endLineNumber: location.line + 1,
                endColumn: location.character + 1,
              };
              this.activeEditor!.executeEdits('extension', [{
                range,
                text: value,
              }]);
            },
            delete: (location: Range) => {
              const range = {
                startLineNumber: location.start.line + 1,
                startColumn: location.start.character + 1,
                endLineNumber: location.end.line + 1,
                endColumn: location.end.character + 1,
              };
              this.activeEditor!.executeEdits('extension', [{
                range,
                text: '',
              }]);
            },
          };

          callback(editBuilder);
          return true;
        },
      } as TextEditor;
  }

  /**
   * 创建树形视图
   */
  createTreeView<T>(viewId: string, options: any): TreeView<T> {
    // TODO: 实现树形视图
    console.log('创建树形视图:', viewId);
    return {
      onDidChangeSelection: {
        event: () => ({ dispose: () => {} }),
      },
      onDidChangeVisibility: {
        event: () => ({ dispose: () => {} }),
      },
      reveal: () => Promise.resolve(),
      dispose: () => {},
    } as any;
  }

  /**
   * 显示信息消息
   */
  showInformationMessage(message: string, ...items: string[]): Promise<string | undefined> {
    // TODO: 集成到通知系统
    console.log('[Extension]', message);
    return Promise.resolve(undefined);
  }

  showWarningMessage(message: string, ...items: string[]): Promise<string | undefined> {
    console.warn('[Extension]', message);
    return Promise.resolve(undefined);
  }

  showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
    console.error('[Extension]', message);
    return Promise.resolve(undefined);
  }

  /**
   * 清理所有订阅
   */
  dispose() {
    this.subscriptions.forEach(sub => sub.dispose());
    this.subscriptions = [];
    this.commands.clear();
  }
}

// 导出全局 API 实例
export const vscode = new VSCodeExtensionAPI();

// 导出 API 对象（模拟 VSCode 的 vscode 模块）
export default {
  commands: {
    registerCommand: (command: string, callback: (...args: any[]) => any) => {
      return vscode.registerCommand(command, callback);
    },
    executeCommand: (command: string, ...args: any[]) => {
      return vscode.executeCommand(command, ...args);
    },
  },
  window: {
    activeTextEditor: () => vscode.getActiveTextEditor(),
    createTreeView: <T>(viewId: string, options: any) => {
      return vscode.createTreeView<T>(viewId, options);
    },
    showInformationMessage: (message: string, ...items: string[]) => {
      return vscode.showInformationMessage(message, ...items);
    },
    showWarningMessage: (message: string, ...items: string[]) => {
      return vscode.showWarningMessage(message, ...items);
    },
    showErrorMessage: (message: string, ...items: string[]) => {
      return vscode.showErrorMessage(message, ...items);
    },
  },
  ExtensionContext: {} as any,
};

