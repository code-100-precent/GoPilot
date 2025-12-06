/**
 * Monaco Editor Inline Completion Provider
 * 提供浮现代码提示功能（类似 GitHub Copilot）
 */
import * as monaco from 'monaco-editor';
import { LLMCompletionService, CompletionRequest } from '@/services/llmCompletionService';

export class InlineCompletionProvider implements monaco.languages.InlineCompletionsProvider {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private language: string;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(editor: monaco.editor.IStandaloneCodeEditor, language: string) {
    this.editor = editor;
    this.language = language;
  }

  async provideInlineCompletions(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    context: monaco.languages.InlineCompletionContext,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.InlineCompletions<monaco.languages.InlineCompletion>> {
    const config = LLMCompletionService.getConfig();
    
    // 如果未启用或没有配置，返回空
    if (!config || !config.enabled) {
      return { items: [] };
    }

    // 获取当前行的文本
    const lineText = model.getLineContent(position.lineNumber);
    const textUntilPosition = model.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

    // 获取上下文（当前文件的前20行和后5行）
    const lines = model.getLinesContent();
    const contextStart = Math.max(0, position.lineNumber - 20);
    const contextEnd = Math.min(lines.length, position.lineNumber + 5);
    const fileContext = lines.slice(contextStart, contextEnd).join('\n');

    // 构建请求
    const request: CompletionRequest = {
      prompt: lineText.substring(0, position.column - 1),
      context: fileContext,
      language: this.language,
      position: {
        line: position.lineNumber,
        column: position.column,
      },
    };

    try {
      // 使用防抖，避免频繁请求
      return new Promise((resolve) => {
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(async () => {
          if (token.isCancellationRequested) {
            resolve({ items: [] });
            return;
          }

          // 检查 model 是否已销毁
          if (model.isDisposed()) {
            resolve({ items: [] });
            return;
          }

          try {
            const suggestions = await LLMCompletionService.getCompletions(request);
            
            // 再次检查 model 是否已销毁
            if (model.isDisposed()) {
              resolve({ items: [] });
              return;
            }
            
            if (suggestions.length === 0) {
              resolve({ items: [] });
              return;
            }

            // 取第一个建议作为 inline completion
            const suggestion = suggestions[0];
            const word = model.getWordUntilPosition(position);
            
            // 计算插入范围
            const range = new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              position.column
            );

            // 创建 inline completion
            const inlineCompletion: monaco.languages.InlineCompletion = {
              insertText: suggestion.insertText || suggestion.label,
              range: range,
              command: {
                id: 'editor.action.inlineSuggest.commit',
                title: 'Accept inline suggestion',
              },
            };

            resolve({ items: [inlineCompletion] });
          } catch (error) {
            console.error('Inline completion error:', error);
            resolve({ items: [] });
          }
        }, 300); // 300ms 防抖，给用户更多输入时间
      });
    } catch (error) {
      console.error('Inline completion provider error:', error);
      return { items: [] };
    }
  }

  freeInlineCompletions(completions: monaco.languages.InlineCompletions<monaco.languages.InlineCompletion>): void {
    // 清理资源（如果需要）
  }

  // Monaco Editor 期望这个方法
  disposeInlineCompletions(
    completions: monaco.languages.InlineCompletions<monaco.languages.InlineCompletion>,
    reason?: any
  ): void {
    // 清理资源（如果需要）
    this.freeInlineCompletions(completions);
  }
}

