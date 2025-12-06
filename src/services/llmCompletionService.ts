/**
 * LLM 代码补全服务
 * 支持 LMStudio 和 Ollama
 */

import * as monaco from 'monaco-editor';

export interface LLMConfig {
  provider: 'lmstudio' | 'ollama';
  baseUrl: string; // 例如: "http://localhost:1234" 或 "http://localhost:11434"
  model: string;
  temperature?: number;
  maxTokens?: number;
  enabled?: boolean;
}

export interface CompletionRequest {
  prompt: string;
  context?: string; // 文件上下文
  language: string;
  position: {
    line: number;
    column: number;
  };
}

export interface CompletionSuggestion {
  label: string;
  kind: monaco.languages.CompletionItemKind;
  detail?: string;
  documentation?: string;
  insertText: string;
  range?: {
    startLine?: number;
    startColumn?: number;
    endLine?: number;
    endColumn?: number;
  };
  sortText?: string;
}

/**
 * LLM 代码补全服务
 */
export class LLMCompletionService {
  private static config: LLMConfig | null = null;
  private static cache: Map<string, CompletionSuggestion[]> = new Map();
  private static readonly CACHE_TTL = 5 * 60 * 1000; // 5分钟缓存

  /**
   * 设置配置
   */
  static setConfig(config: LLMConfig) {
    this.config = config;
    // 保存到 localStorage
    localStorage.setItem('gopilot_llm_config', JSON.stringify(config));
  }

  /**
   * 获取配置
   */
  static getConfig(): LLMConfig | null {
    if (this.config) {
      return this.config;
    }
    
    // 从 localStorage 读取
    const stored = localStorage.getItem('gopilot_llm_config');
    if (stored) {
      try {
        this.config = JSON.parse(stored);
        return this.config;
      } catch (error) {
        console.error('Failed to parse LLM config:', error);
      }
    }
    
    return null;
  }

  /**
   * 调用 LMStudio API
   */
  private static async callLMStudio(
    config: LLMConfig,
    request: CompletionRequest
  ): Promise<CompletionSuggestion[]> {
    const url = `${config.baseUrl}/v1/completions`;
    
    const prompt = this.buildPrompt(request);
    
    const body = {
      model: config.model,
      prompt: prompt,
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 100,
      stop: ['\n\n', '```', '//', '#'],
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.parseLMStudioResponse(data, request);
    } catch (error: any) {
      console.error('LMStudio API error:', error);
      // 提供更友好的错误信息
      if (error.message?.includes('Failed to fetch') || error.message?.includes('Load failed')) {
        throw new Error('无法连接到 LMStudio 服务，请确保服务已启动并运行在 ' + config.baseUrl);
      }
      throw error;
    }
  }

  /**
   * 调用 Ollama API
   */
  private static async callOllama(
    config: LLMConfig,
    request: CompletionRequest
  ): Promise<CompletionSuggestion[]> {
    const url = `${config.baseUrl}/api/generate`;
    
    const prompt = this.buildPrompt(request);
    
    const body = {
      model: config.model,
      prompt: prompt,
      stream: false,
      options: {
        temperature: config.temperature || 0.7,
        num_predict: config.maxTokens || 100,
      },
    };

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return this.parseOllamaResponse(data, request);
    } catch (error: any) {
      console.error('Ollama API error:', error);
      // 提供更友好的错误信息
      if (error.message?.includes('Failed to fetch') || error.message?.includes('Load failed')) {
        throw new Error('无法连接到 Ollama 服务，请确保服务已启动并运行在 ' + config.baseUrl);
      }
      throw error;
    }
  }

  /**
   * 构建提示词
   */
  private static buildPrompt(request: CompletionRequest): string {
    let prompt = `You are a ${request.language} code completion assistant.\n\n`;
    
    if (request.context) {
      prompt += `Here is the current file context:\n\`\`\`${request.language}\n${request.context}\n\`\`\`\n\n`;
    }
    
    prompt += `Complete the code at the cursor position. Only return the completion text, no explanations:\n${request.prompt}`;
    
    return prompt;
  }

  /**
   * 解析 LMStudio 响应
   */
  private static parseLMStudioResponse(
    data: any,
    request: CompletionRequest
  ): CompletionSuggestion[] {
    const suggestions: CompletionSuggestion[] = [];
    
    if (data.choices && Array.isArray(data.choices)) {
      for (const choice of data.choices) {
        if (choice.text) {
          const completions = this.extractCompletions(choice.text, request.language);
          for (const completion of completions) {
            suggestions.push({
              label: completion.substring(0, 50),
              kind: this.inferKind(completion, request.language),
              insertText: completion,
              detail: `LLM Completion`,
              sortText: `0_${completion}`,
            });
          }
        }
      }
    }
    
    return suggestions;
  }

  /**
   * 解析 Ollama 响应
   */
  private static parseOllamaResponse(
    data: any,
    request: CompletionRequest
  ): CompletionSuggestion[] {
    const suggestions: CompletionSuggestion[] = [];
    
    if (data.response) {
      const completions = this.extractCompletions(data.response, request.language);
      for (const completion of completions) {
        suggestions.push({
          label: completion.substring(0, 50),
          kind: this.inferKind(completion, request.language),
          insertText: completion,
          detail: `LLM Completion`,
          sortText: `0_${completion}`,
        });
      }
    }
    
    return suggestions;
  }

  /**
   * 从响应文本中提取补全建议
   */
  private static extractCompletions(text: string, language: string): string[] {
    const completions: string[] = [];
    const lines = text.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed &&
        !trimmed.startsWith('//') &&
        !trimmed.startsWith('#') &&
        !trimmed.startsWith('```') &&
        trimmed.length > 2
      ) {
        completions.push(trimmed);
      }
    }
    
    // 如果没有找到，返回整个文本作为一个补全
    if (completions.length === 0 && text.trim()) {
      completions.push(text.trim());
    }
    
    return completions.slice(0, 5); // 最多返回5个建议
  }

  /**
   * 推断补全类型
   */
  private static inferKind(text: string, language: string): monaco.languages.CompletionItemKind {
    if (language === 'go') {
      if (text.includes('func ')) {
        return monaco.languages.CompletionItemKind.Function;
      } else if (text.includes('type ')) {
        return monaco.languages.CompletionItemKind.Class;
      } else if (text.includes('var ') || text.includes('const ')) {
        return monaco.languages.CompletionItemKind.Variable;
      } else if (text.includes('interface ')) {
        return monaco.languages.CompletionItemKind.Interface;
      }
    }
    return monaco.languages.CompletionItemKind.Text;
  }

  /**
   * 获取代码补全
   */
  static async getCompletions(
    request: CompletionRequest
  ): Promise<CompletionSuggestion[]> {
    const config = this.getConfig();
    
    if (!config || !config.enabled) {
      return [];
    }

    // 检查缓存
    const cacheKey = `${config.provider}_${config.model}_${request.prompt.substring(0, 50)}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      let suggestions: CompletionSuggestion[] = [];
      
      if (config.provider === 'lmstudio') {
        suggestions = await this.callLMStudio(config, request);
      } else if (config.provider === 'ollama') {
        suggestions = await this.callOllama(config, request);
      }
      
      // 缓存结果
      this.cache.set(cacheKey, suggestions);
      
      // 5分钟后清除缓存
      setTimeout(() => {
        this.cache.delete(cacheKey);
      }, this.CACHE_TTL);
      
      return suggestions;
    } catch (error) {
      console.error('LLM completion error:', error);
      return [];
    }
  }

  /**
   * 测试连接
   */
  static async testConnection(config: LLMConfig): Promise<boolean> {
    try {
      const testRequest: CompletionRequest = {
        prompt: 'test',
        language: 'go',
        position: { line: 0, column: 0 },
      };
      
      if (config.provider === 'lmstudio') {
        await this.callLMStudio(config, testRequest);
      } else if (config.provider === 'ollama') {
        await this.callOllama(config, testRequest);
      }
      
      return true;
    } catch (error: any) {
      console.error('Connection test failed:', error);
      // 重新抛出错误，让调用者可以显示错误信息
      throw error;
    }
  }
}

