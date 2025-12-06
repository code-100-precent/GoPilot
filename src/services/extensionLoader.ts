/**
 * Extension Loader
 * 负责加载和执行 VSCode 扩展
 */

import JSZip from 'jszip';
import vscodeAPI, { vscode, ExtensionContext } from './vscodeExtensionAPI';

export interface ExtensionManifest {
  name: string;
  displayName: string;
  description: string;
  version: string;
  publisher: string;
  activationEvents?: string[];
  contributes?: {
    commands?: Array<{
      command: string;
      title: string;
      category?: string;
    }>;
    views?: {
      [viewContainerId: string]: Array<{
        id: string;
        name: string;
        when?: string;
        icon?: string;
        contextualTitle?: string;
      }>;
    };
    viewsContainers?: {
      [location: string]: Array<{
        id: string;
        title: string;
        icon: string;
      }>;
    };
    languages?: Array<{
      id: string;
      aliases?: string[];
      extensions?: string[];
    }>;
    themes?: Array<{
      label: string;
      uiTheme: string;
      path: string;
    }>;
    grammars?: Array<{
      language: string;
      scopeName: string;
      path: string;
    }>;
    [key: string]: any;
  };
  main?: string;
  [key: string]: any;
}

export interface LoadedExtension {
  id: string;
  manifest: ExtensionManifest;
  path: string;
  activated: boolean;
  exports?: any;
}

/**
 * Extension Loader
 * 负责加载、激活和管理扩展
 */
export class ExtensionLoader {
  private static loadedExtensions: Map<string, LoadedExtension> = new Map();
  private static extensionContext: any = {};

  /**
   * 从 VSIX 文件加载扩展
   */
  static async loadFromVSIX(vsixPath: string): Promise<LoadedExtension> {
    try {
      console.log('开始加载扩展:', vsixPath);
      
      // 读取 VSIX 文件
      let vsixData: Uint8Array;
      if (window.__TAURI__) {
        try {
          const fs = await import('@tauri-apps/api/fs');
          console.log('读取 VSIX 文件，路径:', vsixPath);
          vsixData = await fs.readBinaryFile(vsixPath);
          console.log('VSIX 文件读取完成，大小:', vsixData.length, '字节');
        } catch (readError: any) {
          console.error('读取 VSIX 文件失败:', readError);
          throw new Error(`读取 VSIX 文件失败: ${readError.message || readError}`);
        }
      } else {
        // 浏览器环境：使用 fetch
        const response = await fetch(vsixPath);
        const arrayBuffer = await response.arrayBuffer();
        vsixData = new Uint8Array(arrayBuffer);
      }

      // 解压 VSIX 文件（ZIP 格式）
      console.log('开始解压 VSIX 文件...');
      let zip: JSZip;
      try {
        zip = await JSZip.loadAsync(vsixData);
        console.log('VSIX 文件解压成功');
      } catch (zipError: any) {
        console.error('解压 VSIX 文件失败:', zipError);
        throw new Error(`解压 VSIX 文件失败: ${zipError.message || zipError}`);
      }

      // 读取 package.json
      const packageJsonFile = zip.file('extension/package.json') || zip.file('package.json');
      if (!packageJsonFile) {
        throw new Error('找不到 package.json 文件');
      }

      let manifest: ExtensionManifest;
      try {
        const packageJsonContent = await packageJsonFile.async('string');
        manifest = JSON.parse(packageJsonContent);
        console.log('扩展清单加载成功:', manifest.name);
      } catch (parseError: any) {
        console.error('解析 package.json 失败:', parseError);
        throw new Error(`解析扩展清单失败: ${parseError.message || parseError}`);
      }

      // 确定扩展根目录
      const extensionRoot = zip.file('extension/') ? 'extension/' : '';

      // 解压扩展文件到临时目录
      let extensionPath: string;
      try {
        console.log('开始解压扩展文件到本地目录...');
        extensionPath = await this.extractExtension(zip, extensionRoot, manifest);
        console.log('扩展文件解压完成，路径:', extensionPath);
      } catch (extractError: any) {
        console.error('解压扩展文件失败:', extractError);
        throw new Error(`解压扩展文件失败: ${extractError.message || extractError}`);
      }

      // 如果文件在 extension/ 子目录中，需要调整路径
      // 检查 package.json 是否在 extension 子目录中
      const path = await import('@tauri-apps/api/path');
      const fs = await import('@tauri-apps/api/fs');
      const packageJsonInExtension = await path.join(extensionPath, 'extension', 'package.json');
      const packageJsonInRoot = await path.join(extensionPath, 'package.json');
      
      let finalExtensionPath = extensionPath;
      if (await fs.exists(packageJsonInExtension)) {
        // package.json 在 extension 子目录中，使用该子目录作为扩展路径
        finalExtensionPath = await path.join(extensionPath, 'extension');
        console.log('检测到扩展文件在 extension 子目录中，使用路径:', finalExtensionPath);
      } else if (!(await fs.exists(packageJsonInRoot))) {
        // 如果根目录和 extension 子目录都没有 package.json，尝试查找
        console.warn('未找到 package.json，尝试在子目录中查找...');
      }

      const extension: LoadedExtension = {
        id: `${manifest.publisher}.${manifest.name}`,
        manifest,
        path: finalExtensionPath,
        activated: false,
      };

      this.loadedExtensions.set(extension.id, extension);
      console.log('扩展加载完成:', extension.id);
      
      return extension;
    } catch (error: any) {
      console.error('加载扩展失败:', error);
      throw new Error(`加载扩展失败: ${error.message || error}`);
    }
  }

  /**
   * 解压扩展文件到本地目录
   */
  private static async extractExtension(
    zip: JSZip,
    extensionRoot: string,
    manifest: ExtensionManifest
  ): Promise<string> {
    if (!window.__TAURI__) {
      // 浏览器环境：使用 IndexedDB 存储
      throw new Error('浏览器环境暂不支持扩展解压，请在 Tauri 应用中使用');
    }

    const path = await import('@tauri-apps/api/path');
    const fs = await import('@tauri-apps/api/fs');

    const appData = await path.appDataDir();
    const extensionsDir = await path.join(appData, 'extensions');
    const extensionId = `${manifest.publisher}.${manifest.name}`;
    const extensionVersion = manifest.version;
    const extensionPath = await path.join(extensionsDir, `${extensionId}-${extensionVersion}`);

    // 检查是否已解压
    const exists = await fs.exists(extensionPath);
    if (exists) {
      console.log('扩展已解压，跳过:', extensionPath);
      return extensionPath;
    }

    // 创建扩展目录
    await fs.createDir(extensionPath, { recursive: true });

    // 解压所有文件
    const files = Object.keys(zip.files);
    let extractedCount = 0;
    let errorCount = 0;

    console.log(`开始解压 ${files.length} 个文件...`);

    for (const fileName of files) {
      try {
        const file = zip.files[fileName];
        
        // 跳过目录
        if (file.dir) {
          continue;
        }

        // 只解压扩展根目录下的文件
        if (!fileName.startsWith(extensionRoot)) {
          continue;
        }

        // 获取相对路径（去掉 extensionRoot 前缀）
        let relativePath = fileName.substring(extensionRoot.length);
        // 如果 relativePath 以 / 开头，去掉它
        if (relativePath.startsWith('/')) {
          relativePath = relativePath.substring(1);
        }
        
        const filePath = await path.join(extensionPath, relativePath);
        const fileDir = await path.dirname(filePath);

        // 创建目录
        try {
          await fs.createDir(fileDir, { recursive: true });
        } catch (e) {
          // 目录可能已存在，忽略错误
        }

        // 写入文件（分批处理，避免内存问题）
        try {
          const fileData = await file.async('uint8array');
          await fs.writeBinaryFile(filePath, fileData);
          extractedCount++;
          
          // 每解压 100 个文件输出一次进度
          if (extractedCount % 100 === 0) {
            console.log(`已解压 ${extractedCount} 个文件...`);
          }
        } catch (writeError: any) {
          console.warn(`写入文件失败: ${fileName}`, writeError);
          errorCount++;
          // 继续处理其他文件
        }
      } catch (fileError: any) {
        console.warn(`处理文件失败: ${fileName}`, fileError);
        errorCount++;
        // 继续处理其他文件
      }
    }

    console.log(`扩展解压完成: ${extractedCount} 个文件成功，${errorCount} 个文件失败`, extensionPath);
    
    if (extractedCount === 0) {
      throw new Error('没有成功解压任何文件');
    }
    
    return extensionPath;
  }

  /**
   * 激活扩展
   */
  static async activateExtension(extensionId: string, context?: any): Promise<void> {
    const extension = this.loadedExtensions.get(extensionId);
    if (!extension) {
      throw new Error(`扩展 ${extensionId} 未找到`);
    }

    if (extension.activated) {
      console.log(`扩展 ${extensionId} 已经激活`);
      return;
    }

    try {
      console.log(`开始激活扩展: ${extensionId}`);

      // 创建扩展上下文
      const extensionContext = context || vscode.createExtensionContext(extension.path);

      // 即使没有主文件或激活失败，也要注册贡献点（视图容器、视图等）
      // 这样即使扩展代码执行失败，UI 元素也能显示
      
      // 先注册贡献点，这样即使后续激活失败，UI 也能显示
      if (extension.manifest.contributes?.viewsContainers) {
        await this.registerExtensionViewContainers(extensionId, extension.manifest.contributes.viewsContainers);
      }
      
      if (extension.manifest.contributes?.views) {
        this.registerExtensionViews(extensionId, extension.manifest.contributes.views);
      }
      
      if (extension.manifest.contributes?.commands) {
        for (const command of extension.manifest.contributes.commands) {
          this.registerExtensionCommand(extensionId, command);
        }
      }

      // 检查是否有主文件
      if (!extension.manifest.main) {
        console.log(`扩展 ${extensionId} 没有主文件，跳过激活`);
        extension.activated = true;
        return;
      }

      // 加载扩展主文件
      let mainFile: any;
      try {
        mainFile = await this.loadExtensionMain(extension);
      } catch (loadError: any) {
        console.warn(`加载扩展 ${extensionId} 主文件失败:`, loadError);
        // 即使加载失败，贡献点已经注册，UI 可以显示
        extension.activated = true;
        return;
      }
      
      // 如果 mainFile 为空对象或没有 activate 函数，说明代码执行失败但已返回空对象
      if (!mainFile || (typeof mainFile === 'object' && Object.keys(mainFile).length === 0 && !mainFile.activate)) {
        console.warn(`扩展 ${extensionId} 主文件加载失败或返回空对象（可能是兼容性问题）`);
        extension.activated = true;
        return;
      }
      
      if (typeof mainFile.activate !== 'function') {
        console.warn(`扩展 ${extensionId} 的 activate 函数未找到`);
        extension.activated = true;
        return;
      }

      // 调用扩展的 activate 函数
      console.log(`调用扩展 ${extensionId} 的 activate 函数`);
      try {
        const exports = await mainFile.activate(extensionContext);
        extension.exports = exports;
        console.log(`扩展 ${extensionId} 的 activate 函数执行成功`);
      } catch (activateError: any) {
        console.warn(`扩展 ${extensionId} 的 activate 函数执行失败:`, activateError);
        // 记录详细的错误信息以便调试
        if (activateError.message) {
          console.warn(`错误消息: ${activateError.message}`);
        }
        if (activateError.stack) {
          console.warn(`错误堆栈: ${activateError.stack}`);
        }
        // 即使激活失败，也继续注册贡献点
      }
      
      extension.activated = true;

      // 贡献点已经在激活前注册了，这里不需要重复注册
      console.log(`扩展 ${extensionId} 激活成功`);
    } catch (error: any) {
      console.error(`激活扩展 ${extensionId} 失败:`, error);
      throw new Error(`激活扩展失败: ${error.message || error}`);
    }
  }

  /**
   * 加载扩展主文件
   */
  private static async loadExtensionMain(extension: LoadedExtension): Promise<any> {
    const mainPath = extension.manifest.main;
    if (!mainPath) {
      return null;
    }

    if (window.__TAURI__) {
      // Tauri 环境：使用 path.join 正确处理相对路径
      const path = await import('@tauri-apps/api/path');
      const fs = await import('@tauri-apps/api/fs');
      
      // 清理路径：移除开头的 ./ 或 ../
      const cleanPath = mainPath.replace(/^\.\//, '').replace(/^\.\.\//, '');
      const fullPath = await path.join(extension.path, cleanPath);
      
      console.log('加载扩展主文件:', {
        original: mainPath,
        cleaned: cleanPath,
        full: fullPath,
        extensionPath: extension.path
      });

      // 检查文件是否存在
      const exists = await fs.exists(fullPath);
      if (!exists) {
        throw new Error(`扩展主文件不存在: ${fullPath}`);
      }

      // 读取文件并执行
      const code = await fs.readTextFile(fullPath);
      
      // 创建一个模块环境来执行扩展代码
      const moduleExports: any = {};
      const module = {
        exports: moduleExports,
      };

      // 创建 process 对象
      const processObj = {
        env: (typeof process !== 'undefined' && process.env) || {},
        platform: 'darwin',
        arch: 'x64',
        version: 'v18.0.0',
        versions: {
          node: '18.0.0',
          v8: '10.0.0',
        },
        cwd: () => extension.path,
        nextTick: (fn: Function) => setTimeout(fn, 0),
        exit: (code?: number) => {
          console.warn(`扩展尝试退出进程，代码: ${code || 0}`);
        },
        on: () => {}, // 事件监听器占位符
        off: () => {},
        emit: () => {},
      };

      // 创建扩展执行环境
      const extensionGlobals = {
        exports: moduleExports,
        module,
        require: this.createRequireFunction(extension.path),
        console,
        setTimeout,
        setInterval,
        clearTimeout,
        clearInterval,
        Promise,
        // Node.js 全局变量
        process: processObj,
        global: globalThis,
        __dirname: extension.path,
        __filename: fullPath,
        // 注入 vscode API
        vscode: vscodeAPI,
      };

      // 在代码执行前，添加全局变量声明
      // 这样扩展代码可以直接访问 process, global, __dirname, __filename 等
      const globalVarNames = Object.keys(extensionGlobals);
      const globalVarValues = Object.values(extensionGlobals);
      
      // 构建变量声明代码
      const varDeclarations = globalVarNames
        .map((name, index) => `var ${name} = arguments[${index}];`)
        .join('\n');

      // 执行扩展代码
      try {
        const wrappedCode = varDeclarations + '\n' + code;
        const func = new Function(...globalVarNames, wrappedCode);
        func(...globalVarValues);
        return module.exports;
      } catch (error: any) {
        console.error('执行扩展代码失败:', error);
        // 提供更详细的错误信息
        if (error.message) {
          console.error('错误消息:', error.message);
        }
        if (error.stack) {
          // 截取堆栈的前几行，避免输出过长
          const stackLines = error.stack.split('\n').slice(0, 10);
          console.error('错误堆栈:', stackLines.join('\n'));
        }
        // 如果是类继承错误或其他常见错误，不抛出错误，让扩展继续加载
        if (error.message && (
          error.message.includes('superclass is not a constructor') ||
          error.message.includes('is not a constructor') ||
          error.message.includes('Cannot read property') ||
          error.message.includes('is not defined')
        )) {
          console.error('提示: 扩展代码执行时遇到兼容性问题。这可能是由于某些模块的实现不完整导致的。');
          console.error('建议: 扩展可能依赖某些 Node.js 模块的完整实现，当前环境可能不完全支持。');
          // 不抛出错误，让扩展继续加载（即使激活失败）
          console.warn('扩展代码执行失败，但将继续尝试加载扩展的其他部分（如视图容器等）...');
          // 返回一个空对象，这样至少不会导致后续代码崩溃
          return module.exports || {};
        }
        throw error;
      }
    } else {
      // 浏览器环境：使用动态 import（需要配置 Vite）
      throw new Error('浏览器环境暂不支持扩展加载，请在 Tauri 应用中使用');
    }
  }

  /**
   * 创建 require 函数（简化版）
   */
  private static createRequireFunction(_extensionPath: string): (id: string) => any {
    return (id: string) => {
      // 处理 vscode 模块
      if (id === 'vscode') {
        return vscodeAPI;
      }
      
      // 简化版的 require，支持基本的 Node.js 模块
      const builtinModules: Record<string, any> = {
        'path': {
          join: (...parts: string[]) => parts.join('/'),
          dirname: (p: string) => p.substring(0, p.lastIndexOf('/')),
          basename: (p: string) => p.substring(p.lastIndexOf('/') + 1),
          resolve: (...parts: string[]) => parts.join('/'),
          sep: '/',
        },
        'fs': {
          // 在浏览器/Tauri 环境中，fs 需要通过 API 调用
          readFileSync: () => { throw new Error('fs.readFileSync not supported'); },
          existsSync: () => { throw new Error('fs.existsSync not supported'); },
          writeFileSync: () => { throw new Error('fs.writeFileSync not supported'); },
        },
        'util': {
          promisify: (fn: any) => fn,
          inspect: (obj: any) => JSON.stringify(obj, null, 2),
          isArray: Array.isArray,
          isBuffer: () => false,
        },
        'crypto': {
          // 使用 Web Crypto API 提供基本的 crypto 功能
          createHash: (algorithm: string) => {
            let dataBuffer: Uint8Array | null = null;
            const encoder = new TextEncoder();
            
            const hashObject = {
              update: (data: string | Uint8Array | Buffer) => {
                // 将数据转换为 Uint8Array
                if (typeof data === 'string') {
                  dataBuffer = encoder.encode(data);
                } else if (data instanceof Uint8Array) {
                  dataBuffer = data;
                } else if (data && typeof (data as any).buffer === 'object') {
                  // Buffer 对象
                  dataBuffer = new Uint8Array((data as any).buffer);
                } else {
                  dataBuffer = new Uint8Array(0);
                }
                return hashObject;
              },
              digest: (_encoding: string = 'hex') => {
                if (!dataBuffer) {
                  dataBuffer = new Uint8Array(0);
                }
                
                // 简化版：返回一个基于数据的简单 hash
                // 注意：这不是真正的加密 hash，只是为了兼容性
                // 实际应用中，扩展应该使用 Web Crypto API 的异步版本
                const hash = Array.from(dataBuffer)
                  .map(b => b.toString(16).padStart(2, '0'))
                  .join('');
                
                // 根据算法返回不同长度的 hash
                let result = hash;
                if (algorithm === 'sha256' || algorithm === 'sha512') {
                  result = hash.substring(0, 64);
                } else if (algorithm === 'sha1' || algorithm === 'md5') {
                  result = hash.substring(0, 40);
                }
                
                return result;
              }
            };
            return hashObject;
          },
          randomBytes: (size: number) => {
            // 使用 Web Crypto API 生成随机字节
            const array = new Uint8Array(size);
            if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
              crypto.getRandomValues(array);
            } else {
              // 降级方案：使用 Math.random（不够安全，但可以工作）
              for (let i = 0; i < size; i++) {
                array[i] = Math.floor(Math.random() * 256);
              }
            }
            return Buffer ? Buffer.from(array) : array;
          },
          // 添加其他常用的 crypto 方法
          createHmac: () => {
            throw new Error('crypto.createHmac not fully implemented');
          },
        },
        'buffer': {
          Buffer: typeof Buffer !== 'undefined' ? Buffer : {
            from: (data: any, _encoding?: string) => {
              if (typeof data === 'string') {
                const encoder = new TextEncoder();
                return encoder.encode(data);
              }
              return data;
            },
            isBuffer: (obj: any) => obj instanceof Uint8Array,
          }
        },
        'stream': (function() {
          // 定义基类
          class Stream {
            constructor() {}
          }
          
          class Readable extends Stream {
            constructor() {
              super();
            }
          }
          
          class Writable extends Stream {
            constructor() {
              super();
            }
          }
          
          class Transform extends Stream {
            constructor() {
              super();
            }
          }
          
          return {
            Readable,
            Writable,
            Transform,
            Stream,
          };
        })(),
        'events': {
          EventEmitter: (function() {
            class EventEmitter {
              private listeners: Map<string, Function[]> = new Map();
              constructor() {}
              on(event: string, listener: Function) {
                if (!this.listeners.has(event)) {
                  this.listeners.set(event, []);
                }
                this.listeners.get(event)!.push(listener);
                return this;
              }
              emit(event: string, ...args: any[]) {
                const listeners = this.listeners.get(event);
                if (listeners) {
                  listeners.forEach(listener => listener(...args));
                }
                return this;
              }
              removeListener(event: string, listener: Function) {
                const listeners = this.listeners.get(event);
                if (listeners) {
                  const index = listeners.indexOf(listener);
                  if (index > -1) {
                    listeners.splice(index, 1);
                  }
                }
                return this;
              }
            }
            return EventEmitter;
          })(),
        },
        'os': {
          platform: () => 'darwin',
          arch: () => 'x64',
          homedir: () => '/',
          tmpdir: () => '/tmp',
        },
        'url': {
          parse: (url: string) => {
            try {
              return new URL(url);
            } catch {
              return { href: url };
            }
          },
          format: (url: URL | any) => {
            if (url instanceof URL) {
              return url.href;
            }
            return url.href || url.toString();
          },
        },
        'http': {
          // 简化版，大多数扩展不需要完整的 http 模块
          request: () => {
            throw new Error('http.request not supported in extension environment');
          },
        },
        'https': {
          request: () => {
            throw new Error('https.request not supported in extension environment');
          },
        },
        'assert': {
          ok: (value: any, message?: string) => {
            if (!value) {
              throw new Error(message || 'Assertion failed');
            }
          },
          equal: (actual: any, expected: any, message?: string) => {
            if (actual !== expected) {
              throw new Error(message || `Expected ${expected}, but got ${actual}`);
            }
          },
          strictEqual: (actual: any, expected: any, message?: string) => {
            if (actual !== expected) {
              throw new Error(message || `Expected ${expected}, but got ${actual}`);
            }
          },
        },
        'querystring': {
          parse: (str: string) => {
            const params: Record<string, string> = {};
            str.split('&').forEach(pair => {
              const [key, value] = pair.split('=');
              if (key) {
                params[decodeURIComponent(key)] = decodeURIComponent(value || '');
              }
            });
            return params;
          },
          stringify: (obj: Record<string, any>) => {
            return Object.entries(obj)
              .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
              .join('&');
          },
        },
        'net': {
          // 网络模块占位符
          createServer: () => {
            throw new Error('net.createServer not supported in extension environment');
          },
          connect: () => {
            throw new Error('net.connect not supported in extension environment');
          },
        },
        'fs/promises': {
          // fs/promises 占位符
          readFile: () => {
            throw new Error('fs/promises.readFile not supported in extension environment');
          },
          writeFile: () => {
            throw new Error('fs/promises.writeFile not supported in extension environment');
          },
        },
        'diagnostics_channel': {
          // diagnostics_channel 占位符
          channel: () => ({
            subscribe: () => {},
            unsubscribe: () => {},
            publish: () => {},
          }),
        },
      };

      if (builtinModules[id]) {
        return builtinModules[id];
      }

      // 尝试加载扩展本地模块
      if (id.startsWith('./') || id.startsWith('../')) {
        // 相对路径模块加载
        console.warn(`相对路径模块加载未实现: ${id}`);
        return {};
      }

      // 对于未实现的模块，返回一个空对象而不是抛出错误
      // 这样扩展可能仍然可以部分工作
      // 静默处理，不显示警告（因为很多扩展会尝试 require 各种模块）
      return {};
    };
  }

  /**
   * 注册扩展命令
   */
  private static registerExtensionCommand(extensionId: string, command: { command: string; title: string }) {
    // 命令已经在扩展激活时通过 vscode.commands.registerCommand 注册
    // 这里可以添加额外的命令注册逻辑
    console.log(`扩展 ${extensionId} 注册命令: ${command.command}`);
  }

  /**
   * 注册扩展视图
   */
  private static registerExtensionViews(extensionId: string, views: { [viewContainerId: string]: any[] }) {
    // 触发视图注册事件
    const event = new CustomEvent('extension-views-registered', {
      detail: {
        extensionId,
        views,
      },
    });
    window.dispatchEvent(event);
    console.log(`扩展 ${extensionId} 注册视图:`, views);
  }

  /**
   * 注册扩展视图容器
   */
  private static async registerExtensionViewContainers(extensionId: string, containers: { [location: string]: any[] }) {
    const extension = this.loadedExtensions.get(extensionId);
    if (!extension) {
      console.warn(`扩展 ${extensionId} 未找到，无法注册视图容器`);
      return;
    }

    // 处理图标路径，将相对路径转换为可用的路径
    const processedContainers: { [location: string]: any[] } = {};
    
    for (const [location, containerList] of Object.entries(containers)) {
      processedContainers[location] = await Promise.all(
        containerList.map(async (container: any) => {
          // 如果图标是相对路径，转换为扩展目录的路径
          let iconPath = container.icon;
          if (iconPath && !iconPath.startsWith('http') && !iconPath.startsWith('data:') && !iconPath.startsWith('file://')) {
            // 相对路径，需要转换为扩展目录的路径
            if (window.__TAURI__) {
              // Tauri 环境：读取图标文件并转换为 base64 或使用路径
              try {
                const path = await import('@tauri-apps/api/path');
                const fs = await import('@tauri-apps/api/fs');
                
                // 清理路径：移除开头的 ./ 或 ../
                const cleanIconPath = iconPath.replace(/^\.\//, '').replace(/^\.\.\//, '');
                const iconFullPath = await path.join(extension.path, cleanIconPath);
                const iconExists = await fs.exists(iconFullPath);
                
                if (iconExists) {
                  // 读取图标文件并转换为 base64
                  const iconData = await fs.readBinaryFile(iconFullPath);
                  const base64 = btoa(String.fromCharCode(...iconData));
                  const ext = cleanIconPath.split('.').pop()?.toLowerCase() || 'png';
                  iconPath = `data:image/${ext === 'svg' ? 'svg+xml' : ext};base64,${base64}`;
                } else {
                  // 图标不存在，静默处理（不显示警告，因为很多扩展可能没有图标）
                  iconPath = '';
                }
              } catch (iconError: any) {
                // 加载失败，静默处理
                iconPath = '';
              }
            } else {
              // 浏览器环境：可能需要转换为 URL
              iconPath = `${extension.path}/${iconPath}`;
            }
          }
          
          return {
            ...container,
            icon: iconPath,
          };
        })
      );
    }

    // 触发视图容器注册事件
    const event = new CustomEvent('extension-view-containers-registered', {
      detail: {
        extensionId,
        containers: processedContainers,
      },
    });
    window.dispatchEvent(event);
    console.log(`扩展 ${extensionId} 注册视图容器:`, processedContainers);
  }

  /**
   * 获取所有已加载的扩展
   */
  static getLoadedExtensions(): LoadedExtension[] {
    return Array.from(this.loadedExtensions.values());
  }

  /**
   * 加载所有已安装的扩展
   */
  static async loadAllExtensions(): Promise<void> {
    try {
      const { ExtensionService } = await import('./extensionService');
      const installed = await ExtensionService.getInstalledExtensions();
      
      console.log(`发现 ${installed.length} 个已安装的扩展`);
      
      for (const ext of installed) {
        if (ext.enabled && ext.installedPath) {
          try {
            // 从 VSIX 路径推断解压后的路径
            const path = await import('@tauri-apps/api/path');
            const fs = await import('@tauri-apps/api/fs');
            
            const vsixDir = await path.dirname(ext.installedPath);
            const vsixName = await path.basename(ext.installedPath, '.vsix');
            const extensionPath = await path.join(vsixDir, '..', 'extensions', vsixName.replace(/-\d+\.\d+\.\d+.*$/, ''));
            
            // 查找实际的扩展目录（可能包含版本号）
            const extensionsBaseDir = await path.join(vsixDir, '..', 'extensions');
            
            // 检查扩展目录是否存在
            const extensionsDirExists = await fs.exists(extensionsBaseDir);
            if (!extensionsDirExists) {
              // 扩展目录不存在，需要从 VSIX 解压
              console.log(`扩展目录不存在，从 VSIX 解压扩展 ${ext.id}...`);
              try {
                const loaded = await this.loadFromVSIX(ext.installedPath);
                try {
                  await this.activateExtension(loaded.id);
                } catch (activateError: any) {
                  console.warn(`激活扩展 ${loaded.id} 失败:`, activateError);
                }
              } catch (loadError: any) {
                console.error(`从 VSIX 加载扩展 ${ext.id} 失败:`, loadError);
              }
              continue;
            }
            
            // 使用 read_directory 命令获取目录条目（包含类型信息）
            const { invoke } = await import('@tauri-apps/api/tauri');
            let entries: Array<{ name: string; path: string; entry_type: string }> = [];
            try {
              entries = await invoke('read_directory', { path: extensionsBaseDir });
            } catch (readError: any) {
              console.error(`读取扩展目录失败:`, readError);
              // 如果读取失败，尝试从 VSIX 解压
              try {
                const loaded = await this.loadFromVSIX(ext.installedPath);
                try {
                  await this.activateExtension(loaded.id);
                } catch (activateError: any) {
                  console.warn(`激活扩展 ${loaded.id} 失败:`, activateError);
                }
              } catch (loadError: any) {
                console.error(`从 VSIX 加载扩展 ${ext.id} 失败:`, loadError);
              }
              continue;
            }
            
            // 查找扩展目录（排除 .vsix 文件，只找目录）
            const extensionDir = entries.find(
              e => e.name.startsWith(ext.id) && e.entry_type === 'directory'
            );
            
            if (extensionDir) {
              const fullPath = extensionDir.path;
              
              // 扩展已解压，直接加载
              try {
                // 检查 package.json 是否在 extension 子目录中
                let packageJsonPath = await path.join(fullPath, 'package.json');
                let finalExtensionPath = fullPath;
                
                if (!(await fs.exists(packageJsonPath))) {
                  // 尝试在 extension 子目录中查找
                  const packageJsonInExtension = await path.join(fullPath, 'extension', 'package.json');
                  if (await fs.exists(packageJsonInExtension)) {
                    packageJsonPath = packageJsonInExtension;
                    finalExtensionPath = await path.join(fullPath, 'extension');
                    console.log(`检测到扩展 ${ext.id} 的文件在 extension 子目录中`);
                  }
                }
                
                const packageJsonContent = await fs.readTextFile(packageJsonPath);
                const manifest: ExtensionManifest = JSON.parse(packageJsonContent);
                
                const extension: LoadedExtension = {
                  id: ext.id,
                  manifest,
                  path: finalExtensionPath,
                  activated: false,
                };
                
                this.loadedExtensions.set(extension.id, extension);
                
                // 尝试激活扩展
                try {
                  await this.activateExtension(extension.id);
                } catch (activateError: any) {
                  console.warn(`激活扩展 ${extension.id} 失败:`, activateError);
                }
              } catch (error: any) {
                console.error(`加载已解压扩展 ${ext.id} 失败:`, error);
                // 如果加载失败，尝试从 VSIX 重新解压
                try {
                  const loaded = await this.loadFromVSIX(ext.installedPath);
                  try {
                    await this.activateExtension(loaded.id);
                  } catch (activateError: any) {
                    console.warn(`激活扩展 ${loaded.id} 失败:`, activateError);
                  }
                } catch (loadError: any) {
                  console.error(`从 VSIX 重新加载扩展 ${ext.id} 失败:`, loadError);
                }
              }
            } else {
              // 没有找到扩展目录，尝试从 VSIX 解压
              console.log(`未找到扩展 ${ext.id} 的解压目录，尝试从 VSIX 解压...`);
              try {
                const loaded = await this.loadFromVSIX(ext.installedPath);
                try {
                  await this.activateExtension(loaded.id);
                } catch (activateError: any) {
                  console.warn(`激活扩展 ${loaded.id} 失败:`, activateError);
                }
              } catch (loadError: any) {
                console.error(`从 VSIX 加载扩展 ${ext.id} 失败:`, loadError);
              }
            }
          } catch (error: any) {
            console.error(`加载扩展 ${ext.id} 失败:`, error);
          }
        }
      }
    } catch (error: any) {
      console.error('加载所有扩展失败:', error);
    }
  }

  /**
   * 获取扩展上下文（提供给扩展的 API）
   */
  static getExtensionContext() {
    return vscode;
  }
}

