import React, { useRef, useEffect, useState } from 'react';
import * as monaco from 'monaco-editor';
import { FileCode } from 'lucide-react';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface CodeEditorProps {
  value: string;
  language?: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  fileName?: string;
  onNavigateToFile?: (filePath: string, line: number, column: number) => void;
  onFindReferences?: (symbolName: string, packageName: string | null, position: { line: number; column: number }) => void;
}

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
}

const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  language = 'go',
  onChange,
  readOnly = false,
  fileName,
  onNavigateToFile,
  onFindReferences,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const editorInstanceRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  
  const [editorSettings] = useLocalStorage<EditorSettings>('gopilot_editor_settings', {
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
  });

  // 监听设置更新事件
  useEffect(() => {
    const handleSettingsUpdate = () => {
      if (editorInstanceRef.current) {
        const settings = JSON.parse(localStorage.getItem('gopilot_editor_settings') || '{}');
        editorInstanceRef.current.updateOptions({
          theme: settings.theme || 'vs-dark',
          fontSize: settings.fontSize || 14,
          fontFamily: settings.fontFamily || 'Monaco, "Courier New", monospace',
          tabSize: settings.tabSize || 4,
          wordWrap: settings.wordWrap ? 'on' : 'off',
          minimap: { enabled: settings.minimap !== false },
          lineNumbers: settings.lineNumbers || 'on',
          renderWhitespace: settings.renderWhitespace || 'selection',
          formatOnPaste: settings.formatOnPaste !== false,
        });
        monaco.editor.setTheme(settings.theme || 'vs-dark');
      }
    };

    window.addEventListener('settings-updated', handleSettingsUpdate);
    return () => window.removeEventListener('settings-updated', handleSettingsUpdate);
  }, []);

  useEffect(() => {
    if (!editorRef.current) return;

    // 注册 go.mod 和 go.sum 语言（使用 toml 作为基础，因为它们格式类似）
    if (!monaco.languages.getLanguages().find(l => l.id === 'go.mod')) {
      monaco.languages.register({ id: 'go.mod' });
      monaco.languages.setMonarchTokensProvider('go.mod', {
        tokenizer: {
          root: [
            [/^module\s+/, 'keyword'],
            [/^go\s+/, 'keyword'],
            [/^require\s+/, 'keyword'],
            [/^replace\s+/, 'keyword'],
            [/^exclude\s+/, 'keyword'],
            [/^retract\s+/, 'keyword'],
            [/\/\/.*$/, 'comment'],
            [/\/\*[\s\S]*?\*\//, 'comment'],
            [/"[^"]*"/, 'string'],
            [/[a-zA-Z_$][a-zA-Z0-9_$]*/, 'identifier'],
            [/\d+\.\d+/, 'number'],
            [/[=]/, 'operator'],
          ],
        },
      });
    }

    if (!monaco.languages.getLanguages().find(l => l.id === 'go.sum')) {
      monaco.languages.register({ id: 'go.sum' });
      monaco.languages.setMonarchTokensProvider('go.sum', {
        tokenizer: {
          root: [
            [/^[a-zA-Z0-9.\-_\/]+/, 'identifier'],
            [/\/\/\s+go\.sum/, 'comment'],
            [/h1:[a-zA-Z0-9+\/]+=/, 'string'],
            [/h1:[a-zA-Z0-9+\/]+$/, 'string'],
            [/[\s]+/, 'white'],
          ],
        },
      });
    }

    // 创建编辑器实例
    const editor = monaco.editor.create(editorRef.current, {
      value: value || '',
      language: language,
      theme: editorSettings.theme || 'vs-dark',
      readOnly: readOnly,
      automaticLayout: true,
      minimap: { enabled: editorSettings.minimap !== false },
      scrollBeyondLastLine: false,
      fontSize: editorSettings.fontSize || 14,
      fontFamily: editorSettings.fontFamily || 'Monaco, "Courier New", monospace',
      lineNumbers: editorSettings.lineNumbers || 'on',
      roundedSelection: false,
      cursorStyle: 'line',
      wordWrap: editorSettings.wordWrap ? 'on' : 'off',
      formatOnPaste: editorSettings.formatOnPaste !== false,
      formatOnType: true,
      tabSize: editorSettings.tabSize || 4,
      insertSpaces: true,
      detectIndentation: true,
      renderWhitespace: editorSettings.renderWhitespace || 'selection',
      renderLineHighlight: 'all',
      scrollbar: {
        vertical: 'auto',
        horizontal: 'auto',
        useShadows: false,
        verticalScrollbarSize: 12,
        horizontalScrollbarSize: 12,
        alwaysConsumeMouseWheel: false,
      },
      smoothScrolling: true,
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      bracketPairColorization: {
        enabled: true,
      },
      guides: {
        bracketPairs: true,
        indentation: true,
        highlightActiveIndentation: true,
      },
      suggest: {
        showKeywords: true,
        showSnippets: true,
        showClasses: true,
        showFunctions: true,
        showVariables: true,
        showFields: true,
      },
      quickSuggestions: {
        other: true,
        comments: true,
        strings: true,
      },
      parameterHints: {
        enabled: true,
      },
      hover: {
        enabled: true,
        delay: 300,
      },
      colorDecorators: true,
      folding: true,
      foldingStrategy: 'auto',
      showFoldingControls: 'always',
      matchBrackets: 'always',
      occurrencesHighlight: true,
      selectionHighlight: true,
      codeLens: true,
      links: true,
      contextmenu: true,
      mouseWheelZoom: false,
      multiCursorModifier: 'alt',
      accessibilitySupport: 'auto',
      // 启用定义跳转相关功能
      gotoLocation: {
        multiple: 'peek',
        multipleDefinitions: 'peek',
        multipleReferences: 'peek',
        multipleImplementations: 'peek',
      },
      // 启用符号导航
      definitionLinkOpensInPeek: false,
      // 启用代码导航
      quickSuggestionsDelay: 100,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnCommitCharacter: true,
      acceptSuggestionOnEnter: 'on',
      tabCompletion: 'on',
      // 启用 inline suggestions（浮现代码提示）
      inlineSuggest: {
        enabled: true,
      },
    });

    editorInstanceRef.current = editor;

    // 注册编辑器到扩展 API
    (async () => {
      try {
        const { vscode } = await import('@/services/vscodeExtensionAPI');
        vscode.setActiveEditor(editor);
        
        // 注册模型
        const model = editor.getModel();
        if (model) {
          vscode.registerModel(model.uri.toString(), model);
        }
      } catch (error) {
        console.warn('注册编辑器到扩展 API 失败:', error);
      }
    })();

    // 注册 LLM 代码补全提供者（异步加载）
    const disposables: monaco.IDisposable[] = [];
    (async () => {
      try {
        const { LLMCompletionProvider } = await import('@/components/Editor/LLMCompletionProvider');
        const llmProvider = new LLMCompletionProvider(editor, language);
        const disposable = monaco.languages.registerCompletionItemProvider(language, llmProvider);
        disposables.push(disposable);
        console.log('LLM completion provider registered for language:', language);
      } catch (error) {
        console.warn('Failed to load LLM completion provider:', error);
      }

      // 注册 Inline Completion Provider（浮现代码提示）
      try {
        const { InlineCompletionProvider } = await import('@/components/Editor/InlineCompletionProvider');
        const inlineProvider = new InlineCompletionProvider(editor, language);
        const inlineDisposable = monaco.languages.registerInlineCompletionsProvider(language, inlineProvider);
        disposables.push(inlineDisposable);
        console.log('Inline completion provider registered for language:', language);
      } catch (error) {
        console.warn('Failed to load inline completion provider:', error);
      }
    })();

    // 查找定义（支持跨文件）
    const findDefinition = async (
      position: monaco.Position
    ): Promise<{ filePath: string; line: number; column: number } | null> => {
      const model = editor.getModel();
      if (!model) return null;

      const word = model.getWordAtPosition(position);
      if (!word) return null;

      const wordText = word.word;
      const currentLine = position.lineNumber;
      const text = model.getValue();
      const lines = text.split('\n');
      
      // 对于 Go 语言，先检查是否是包引用（如 models.OverviewConfig）
      if (language === 'go' && fileName) {
        const { parsePackageReference, parseGoImports, findTypeDefinitionInFile } = await import('@/utils/goNavigation');
        
        // 解析包引用
        const pkgRef = parsePackageReference(text, {
          line: position.lineNumber,
          column: position.column,
        });
        
        if (pkgRef) {
          console.log('Found package reference:', pkgRef);
          
          // 解析 import 语句
          const imports = parseGoImports(text, fileName);
          const importInfo = imports.find(
            (imp) => (imp.alias && imp.alias === pkgRef.packageName) || 
                     (!imp.alias && imp.path.endsWith(`/${pkgRef.packageName}`))
          );
          
          if (importInfo) {
            console.log('Found import:', importInfo);
            
            // 根据 import 路径推断文件路径
            const { inferFilePathFromPackage } = await import('@/utils/goNavigation');
            const currentDir = fileName.substring(0, fileName.lastIndexOf('/'));
            
            // 尝试获取工作区根路径（从当前文件向上查找 go.mod）
            let workspaceRoot: string | undefined = undefined;
            let currentPath = currentDir;
            const { FileSystemService } = await import('@/services/fileSystem');
            
            // 向上查找 go.mod 来确定工作区根
            for (let i = 0; i < 10; i++) {
              const goModPath = `${currentPath}/go.mod`;
              if (await FileSystemService.pathExists(goModPath)) {
                workspaceRoot = currentPath;
                break;
              }
              const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
              if (parentPath === currentPath) break;
              currentPath = parentPath;
            }
            
            // 如果没有找到 go.mod，使用当前文件的目录作为工作区根
            if (!workspaceRoot) {
              workspaceRoot = currentDir;
            }
            
            const possibleFiles = inferFilePathFromPackage(
              importInfo.path,
              pkgRef.typeName,
              fileName,
              workspaceRoot
            );
            
            console.log('Possible files to search:', possibleFiles);
            
            // 尝试查找文件
            for (const filePath of possibleFiles) {
              try {
                const exists = await FileSystemService.pathExists(filePath);
                if (exists) {
                  console.log('Found file:', filePath);
                  const def = await findTypeDefinitionInFile(filePath, pkgRef.typeName);
                  if (def) {
                    console.log('Found definition at:', def);
                    return {
                      filePath: filePath,
                      line: def.line,
                      column: def.column,
                    };
                  }
                }
              } catch (error) {
                console.error('Error checking file:', filePath, error);
                // 继续尝试下一个文件
              }
            }
          }
        }
      }
      
      // 对于 Go 语言，查找函数定义（同一文件内）
      if (language === 'go') {
        // 查找 func 函数定义
        const funcPattern = new RegExp(`\\bfunc\\s+${wordText}\\s*\\(`, 'i');
        // 查找方法定义
        const methodPattern = new RegExp(`\\bfunc\\s+\\([^)]+\\)\\s+${wordText}\\s*\\(`, 'i');
        // 查找变量/常量定义
        const varPattern = new RegExp(`\\b(var|const)\\s+${wordText}\\s*=`, 'i');
        // 查找类型定义
        const typePattern = new RegExp(`\\btype\\s+${wordText}\\s+`, 'i');
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (i !== currentLine - 1) {
            if (funcPattern.test(line) || methodPattern.test(line)) {
              const match = line.match(new RegExp(`\\b${wordText}\\b`));
              if (match && match.index !== undefined) {
                return new monaco.Position(i + 1, match.index + 1);
              }
            }
            if (varPattern.test(line)) {
              const match = line.match(new RegExp(`\\b${wordText}\\b`));
              if (match && match.index !== undefined) {
                return new monaco.Position(i + 1, match.index + 1);
              }
            }
            if (typePattern.test(line)) {
              const match = line.match(new RegExp(`\\b${wordText}\\b`));
              if (match && match.index !== undefined) {
                return fileName ? {
                  filePath: fileName,
                  line: i + 1,
                  column: match.index + 1,
                } : null;
              }
            }
          }
        }
      }

      // 对于 JavaScript/TypeScript，查找函数定义
      if (language === 'javascript' || language === 'typescript') {
        const patterns = [
          new RegExp(`\\bfunction\\s+${wordText}\\s*\\(`, 'i'),
          new RegExp(`\\b(const|let|var)\\s+${wordText}\\s*=`, 'i'),
          new RegExp(`\\b${wordText}\\s*:\\s*function`, 'i'),
          new RegExp(`\\b${wordText}\\s*:\\s*\\(`, 'i'),
          new RegExp(`\\bclass\\s+${wordText}\\s*`, 'i'),
          new RegExp(`\\binterface\\s+${wordText}\\s*`, 'i'),
          new RegExp(`\\btype\\s+${wordText}\\s*=`, 'i'),
        ];
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (i !== currentLine - 1) {
            for (const pattern of patterns) {
              if (pattern.test(line)) {
                const match = line.match(new RegExp(`\\b${wordText}\\b`));
                if (match && match.index !== undefined) {
                  return fileName ? {
                    filePath: fileName,
                    line: i + 1,
                    column: match.index + 1,
                  } : null;
                }
              }
            }
          }
        }
      }

      // 通用：查找变量声明（向后查找，优先找到定义）
      const varPatterns = [
        new RegExp(`\\b(const|let|var|type|struct|interface|class|enum)\\s+${wordText}\\b`, 'i'),
      ];
      
      for (let i = lines.length - 1; i >= 0; i--) {
        if (i !== currentLine - 1) {
          for (const pattern of varPatterns) {
            if (pattern.test(lines[i])) {
              const match = lines[i].match(new RegExp(`\\b${wordText}\\b`));
              if (match && match.index !== undefined) {
                return fileName ? {
                  filePath: fileName,
                  line: i + 1,
                  column: match.index + 1,
                } : null;
              }
            }
          }
        }
      }

      return null;
    };

    // 启用 Command/Ctrl + 单击跳转
    const clickHandler = editor.onMouseDown(async (e: monaco.editor.IEditorMouseEvent) => {
      const { event, target } = e;
      
      // 检查是否是 Cmd/Ctrl + 单击
      const isModifierPressed = event.metaKey || event.ctrlKey;
      const isLeftClick = event.button === 0;
      const isContentText = target.type === monaco.editor.MouseTargetType.CONTENT_TEXT;
      
      if (isModifierPressed && isLeftClick && isContentText) {
        const position = target.position;
        if (position) {
          // 阻止默认行为
          event.preventDefault();
          event.stopPropagation();
          
          console.log('Cmd+Click detected, position:', position);
          
          // 立即执行查找
          const model = editor.getModel();
          if (!model) {
            console.log('No model available');
            return;
          }
          
          const word = model.getWordAtPosition(position);
          if (!word) return;
          
          console.log('Word at position:', word);
          
          // 解析包引用（如果是 models.OverviewConfig 这样的形式）
          let symbolName = word.word;
          let packageName: string | null = null;
          
          if (language === 'go' && fileName) {
            const { parsePackageReference } = await import('@/utils/goNavigation');
            const pkgRef = parsePackageReference(model.getValue(), {
              line: position.lineNumber,
              column: position.column,
            });
            
            if (pkgRef) {
              symbolName = pkgRef.typeName;
              packageName = pkgRef.packageName;
              console.log('Found package reference:', pkgRef);
            }
          }
          
          // 优先显示引用列表
          if (onFindReferences) {
            console.log('Finding references for:', symbolName);
            onFindReferences(symbolName, packageName, {
              line: position.lineNumber,
              column: position.column,
            });
          } else {
            // 如果没有引用查找功能，则跳转到定义
            const defResult = await findDefinition(position);
            console.log('Definition found at:', defResult);
            
            if (defResult) {
              // 如果是跨文件跳转
              if (defResult.filePath !== fileName && onNavigateToFile) {
                console.log('Navigating to file:', defResult.filePath);
                onNavigateToFile(defResult.filePath, defResult.line, defResult.column);
              } else if (defResult.filePath === fileName) {
                // 同一文件内跳转
                const defPosition = new monaco.Position(defResult.line, defResult.column);
                editor.setPosition(defPosition);
                editor.revealPositionInCenter(defPosition);
                console.log('Jumped to definition');
                
                // 添加视觉反馈
                const defWord = model.getWordAtPosition(defPosition);
                if (defWord) {
                  const range = new monaco.Range(
                    defPosition.lineNumber,
                    defWord.startColumn,
                    defPosition.lineNumber,
                    defWord.endColumn
                  );
                  
                  // 临时高亮定义位置
                  let decoration: string[] = [];
                  decoration = editor.deltaDecorations([], [
                    {
                      range: range,
                      options: {
                        className: 'go-to-definition-highlight',
                        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                      },
                    },
                  ]);
                  
                  // 2秒后清除高亮
                  setTimeout(() => {
                    editor.deltaDecorations(decoration, []);
                  }, 2000);
                }
              }
            } else {
              // 如果没有找到定义，在控制台显示提示
              console.log('Definition not found for:', word.word);
            }
          }
        }
      }
    });

    // 添加悬停显示定义和视觉提示
    let hoverDecoration: string[] = [];
    editor.onMouseMove((e: monaco.editor.IEditorMouseEvent) => {
      const { target, event } = e;
      const model = editor.getModel();
      
      if (target.type === monaco.editor.MouseTargetType.CONTENT_TEXT && model) {
        const position = target.position;
        if (position) {
          const word = model.getWordAtPosition(position);
          
          // 如果按住 Cmd/Ctrl，显示可跳转提示
          if ((event.metaKey || event.ctrlKey) && word) {
            // 添加下划线装饰，提示可以跳转
            const range = new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn
            );
            
            hoverDecoration = editor.deltaDecorations(hoverDecoration, [
              {
                range: range,
                options: {
                  inlineClassName: 'cursor-pointer',
                  hoverMessage: { value: '**Cmd/Ctrl + Click** to go to definition' },
                  glyphMarginClassName: 'go-to-definition-hint',
                },
              },
            ]);
          } else {
            // 清除装饰
            hoverDecoration = editor.deltaDecorations(hoverDecoration, []);
          }
        }
      } else {
        // 清除装饰
        hoverDecoration = editor.deltaDecorations(hoverDecoration, []);
      }
    });

    // 鼠标离开时清除装饰
    editor.onMouseLeave(() => {
      hoverDecoration = editor.deltaDecorations(hoverDecoration, []);
    });

    // 注册快捷键：Cmd/Ctrl + 单击跳转到定义
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.MouseLeft, () => {
      editor.getAction('editor.action.revealDefinition')?.run();
    });

    // 添加右键菜单项：跳转到定义
    editor.addAction({
      id: 'go-to-definition',
      label: 'Go to Definition',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.5,
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.F12,
      ],
      run: () => {
        editor.getAction('editor.action.revealDefinition')?.run();
      },
    });

    // 添加右键菜单项：查看定义（Peek Definition）
    editor.addAction({
      id: 'peek-definition',
      label: 'Peek Definition',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.6,
      keybindings: [
        monaco.KeyMod.Alt | monaco.KeyCode.F12,
      ],
      run: () => {
        editor.getAction('editor.action.peekDefinition')?.run();
      },
    });

    // 添加右键菜单项：返回（Go Back）
    editor.addAction({
      id: 'go-back',
      label: 'Go Back',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.7,
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Minus,
      ],
      run: () => {
        editor.getAction('editor.action.navigateBack')?.run();
      },
    });

    // 添加右键菜单项：前进（Go Forward）
    editor.addAction({
      id: 'go-forward',
      label: 'Go Forward',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1.8,
      keybindings: [
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.Equal,
      ],
      run: () => {
        editor.getAction('editor.action.navigateForward')?.run();
      },
    });

    // 监听内容变化
    if (onChange) {
      editor.onDidChangeModelContent(() => {
        const currentValue = editor.getValue();
        onChange(currentValue);
      });
    }

    // 监听导航事件（跨文件跳转）
    const navigateHandler = (event: CustomEvent) => {
      const { filePath, line, column } = event.detail;
      if (filePath === fileName) {
        const position = new monaco.Position(line, column);
        editor.setPosition(position);
        editor.revealPositionInCenter(position);
        
        // 添加视觉反馈
        const model = editor.getModel();
        if (model) {
          const word = model.getWordAtPosition(position);
          if (word) {
            const range = new monaco.Range(
              position.lineNumber,
              word.startColumn,
              position.lineNumber,
              word.endColumn
            );
            
            let decoration: string[] = [];
            decoration = editor.deltaDecorations([], [
              {
                range: range,
                options: {
                  className: 'go-to-definition-highlight',
                  stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
                },
              },
            ]);
            
            setTimeout(() => {
              editor.deltaDecorations(decoration, []);
            }, 2000);
          }
        }
      }
    };

    window.addEventListener('navigate-to-position', navigateHandler as EventListener);

    // 清理函数
    return () => {
      if (clickHandler) {
        clickHandler.dispose();
      }
      window.removeEventListener('navigate-to-position', navigateHandler as EventListener);
      // 清理所有 disposables
      disposables.forEach(disposable => {
        try {
          disposable.dispose();
        } catch (error) {
          console.warn('Error disposing:', error);
        }
      });
      editor.dispose();
    };
  }, [language, readOnly, editorSettings.theme]);

  // 更新编辑器内容
  useEffect(() => {
    if (editorInstanceRef.current && editorInstanceRef.current.getValue() !== value) {
      editorInstanceRef.current.setValue(value || '');
    }
  }, [value]);

  // 更新编辑器设置
  useEffect(() => {
    if (editorInstanceRef.current) {
      editorInstanceRef.current.updateOptions({
        fontSize: editorSettings.fontSize || 14,
        fontFamily: editorSettings.fontFamily || 'Monaco, "Courier New", monospace',
        tabSize: editorSettings.tabSize || 4,
        wordWrap: editorSettings.wordWrap ? 'on' : 'off',
        minimap: { enabled: editorSettings.minimap !== false },
        lineNumbers: editorSettings.lineNumbers || 'on',
        renderWhitespace: editorSettings.renderWhitespace || 'selection',
        formatOnPaste: editorSettings.formatOnPaste !== false,
      });
      monaco.editor.setTheme(editorSettings.theme || 'vs-dark');
    }
  }, [editorSettings]);

  return (
    <div className="h-full w-full flex flex-col bg-white dark:bg-gray-900">
      {fileName && (
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-800 border-b dark:border-gray-700">
          <FileCode className="w-4 h-4 text-gray-600 dark:text-gray-400" />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{fileName}</span>
        </div>
      )}
      <div ref={editorRef} className="flex-1 w-full" />
    </div>
  );
};

export default CodeEditor;
