/**
 * Monaco Editor LLM 代码补全提供者
 */
import * as monaco from 'monaco-editor';
import { LLMCompletionService, CompletionRequest } from '@/services/llmCompletionService';

export class LLMCompletionProvider implements monaco.languages.CompletionItemProvider {
  private editor: monaco.editor.IStandaloneCodeEditor;
  private language: string;
  private debounceTimer: NodeJS.Timeout | null = null;

  constructor(editor: monaco.editor.IStandaloneCodeEditor, language: string) {
    this.editor = editor;
    this.language = language;
  }

  triggerCharacters = ['.', '(', ' ', '\n'];

  async provideCompletionItems(
    model: monaco.editor.ITextModel,
    position: monaco.Position,
    completionContext: monaco.languages.CompletionContext,
    token: monaco.CancellationToken
  ): Promise<monaco.languages.ProviderResult<monaco.languages.CompletionList>> {
    const config = LLMCompletionService.getConfig();
    
    // 如果未启用或没有配置，返回空
    if (!config || !config.enabled) {
      return { suggestions: [] };
    }

    // 获取当前行的文本
    const lineText = model.getLineContent(position.lineNumber);
    const textUntilPosition = model.getValueInRange({
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: position.lineNumber,
      endColumn: position.column,
    });

    // 获取上下文（当前文件的前500行）
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
          try {
            const suggestions = await LLMCompletionService.getCompletions(request);
            
            // 转换为 Monaco Editor 的 CompletionItem 格式
            const monacoSuggestions: monaco.languages.CompletionItem[] = suggestions.map((s, index) => {
              const word = model.getWordUntilPosition(position);
              const range: monaco.Range = s.range ? 
                new monaco.Range(
                  s.range.startLine || position.lineNumber,
                  s.range.startColumn || position.column,
                  s.range.endLine || position.lineNumber,
                  s.range.endColumn || position.column
                ) :
                new monaco.Range(
                  position.lineNumber,
                  word.startColumn,
                  position.lineNumber,
                  word.endColumn
                );
              
              return {
                label: s.label,
                kind: s.kind,
                detail: s.detail,
                documentation: s.documentation ? {
                  value: s.documentation,
                  isTrusted: true,
                } : undefined,
                insertText: s.insertText,
                range: range,
                sortText: s.sortText || `zzz_${index}`,
                preselect: false,
              };
            });
            
            resolve({
              suggestions: monacoSuggestions,
              incomplete: false,
            });
          } catch (error) {
            console.error('LLM completion error:', error);
            resolve({ suggestions: [] });
          }
        }, 500); // 500ms 防抖，给用户更多输入时间
      });
    } catch (error) {
      console.error('Completion provider error:', error);
      return { suggestions: [] };
    }
  }
}

