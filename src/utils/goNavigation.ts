/**
 * Go 语言导航工具
 * 用于解析 Go 代码并支持跨文件跳转
 */

export interface GoImport {
  alias?: string;
  path: string;
  line: number;
}

export interface GoDefinition {
  filePath: string;
  line: number;
  column: number;
  name: string;
}

/**
 * 解析 Go 文件的 import 语句
 */
export function parseGoImports(content: string, filePath: string): GoImport[] {
  const imports: GoImport[] = [];
  const lines = content.split('\n');
  let inImportBlock = false;
  let importStartLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 检测 import 块开始
    if (line === 'import (' || line.startsWith('import ')) {
      inImportBlock = true;
      importStartLine = i;
      
      // 单行 import
      if (line.startsWith('import ')) {
        const importMatch = line.match(/import\s+(?:"([^"]+)"|`([^`]+)`|([^\s]+))/);
        if (importMatch) {
          const path = importMatch[1] || importMatch[2] || importMatch[3];
          const aliasMatch = line.match(/import\s+(\w+)\s+(?:"|`)/);
          imports.push({
            alias: aliasMatch ? aliasMatch[1] : undefined,
            path: path,
            line: i + 1,
          });
          inImportBlock = false;
        }
      }
    }
    
    // 在 import 块中
    if (inImportBlock) {
      // 检测 import 块结束
      if (line === ')') {
        inImportBlock = false;
        continue;
      }
      
      // 解析 import 行
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('//')) {
        // 带别名: alias "path" 或 "path"
        const aliasMatch = trimmed.match(/^(\w+)\s+(?:"([^"]+)"|`([^`]+)`)/);
        const pathMatch = trimmed.match(/(?:"([^"]+)"|`([^`]+)`)/);
        
        if (aliasMatch) {
          imports.push({
            alias: aliasMatch[1],
            path: aliasMatch[2] || aliasMatch[3],
            line: i + 1,
          });
        } else if (pathMatch) {
          imports.push({
            alias: undefined,
            path: pathMatch[1] || pathMatch[2],
            line: i + 1,
          });
        }
      }
    }
  }

  return imports;
}

/**
 * 从包路径推断文件路径
 */
export function inferFilePathFromPackage(
  packagePath: string,
  typeName: string,
  currentFilePath: string,
  workspaceRoot?: string
): string[] {
  const possibleFiles: string[] = [];
  
  // 如果是相对路径，基于当前文件路径计算
  if (packagePath.startsWith('.')) {
    const currentDir = currentFilePath.substring(0, currentFilePath.lastIndexOf('/'));
    const relativePath = packagePath.replace(/^\./, '').replace(/^\/+/, '');
    const packageDir = `${currentDir}/${relativePath}`;
    
    // 尝试常见的文件命名模式
    possibleFiles.push(
      `${packageDir}/${typeName.toLowerCase()}.go`,
      `${packageDir}/${typeName}.go`,
      `${packageDir}/overview_config.go`, // 特殊情况
      `${packageDir}/overview.go`,
      `${packageDir}/${packagePath.split('/').pop()}.go`,
    );
  } else if (workspaceRoot) {
    // 如果是绝对路径，尝试在工作区中查找
    // 假设包路径格式为 github.com/user/repo/pkg/subpkg
    const pathParts = packagePath.split('/');
    const packageName = pathParts[pathParts.length - 1];
    
    // 尝试在多个可能的位置查找
    const searchPaths = [
      `${workspaceRoot}/${packagePath}`,
      `${workspaceRoot}/internal/${packageName}`,
      `${workspaceRoot}/pkg/${packageName}`,
      `${workspaceRoot}/models`, // 特殊情况
    ];
    
    for (const searchPath of searchPaths) {
      possibleFiles.push(
        `${searchPath}/${typeName.toLowerCase()}.go`,
        `${searchPath}/${typeName}.go`,
        `${searchPath}/overview_config.go`,
        `${searchPath}/overview.go`,
        `${searchPath}/${packageName}.go`,
      );
    }
  }

  return possibleFiles;
}

/**
 * 在文件中查找类型定义
 */
export async function findTypeDefinitionInFile(
  filePath: string,
  typeName: string,
  fileContent?: string
): Promise<{ line: number; column: number } | null> {
  let content = fileContent;
  
  if (!content) {
    try {
      const { FileSystemService } = await import('@/services/fileSystem');
      content = await FileSystemService.readFileContent(filePath);
    } catch (error) {
      console.error('Failed to read file:', error);
      return null;
    }
  }

  const lines = content.split('\n');
  
  // 查找 type 定义
  const typePattern = new RegExp(`\\btype\\s+${typeName}\\s+`, 'i');
  
  for (let i = 0; i < lines.length; i++) {
    if (typePattern.test(lines[i])) {
      const match = lines[i].match(new RegExp(`\\b${typeName}\\b`));
      if (match && match.index !== undefined) {
        return {
          line: i + 1,
          column: match.index + 1,
        };
      }
    }
  }

  return null;
}

/**
 * 在文件中查找所有引用
 */
export async function findReferencesInFile(
  filePath: string,
  symbolName: string,
  packageName: string | null = null,
  fileContent?: string
): Promise<Array<{ line: number; column: number; preview: string }>> {
  let content = fileContent;
  
  if (!content) {
    try {
      const { FileSystemService } = await import('@/services/fileSystem');
      content = await FileSystemService.readFileContent(filePath);
    } catch (error) {
      console.error('Failed to read file:', error);
      return [];
    }
  }

  const lines = content.split('\n');
  const references: Array<{ line: number; column: number; preview: string }> = [];
  
  // 构建匹配模式
  let searchPattern: RegExp;
  if (packageName) {
    // 如果是包引用，匹配 package.Symbol 或 &package.Symbol{}
    searchPattern = new RegExp(`\\b${packageName}\\.${symbolName}\\b|&${packageName}\\.${symbolName}\\{`, 'g');
  } else {
    // 直接使用符号名
    searchPattern = new RegExp(`\\b${symbolName}\\b`, 'g');
  }
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmedLine = line.trim();
    
    // 跳过注释行
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
      continue;
    }
    
    // 重置正则表达式
    searchPattern.lastIndex = 0;
    let match;
    
    while ((match = searchPattern.exec(line)) !== null) {
      // 排除定义行
      const isDefinition = 
        /^\s*(type|func|var|const|interface|struct)\s+/.test(trimmedLine) &&
        match.index < 100; // 定义通常在行首附近
      
      if (!isDefinition) {
        // 检查是否在字符串中（简单检查）
        const beforeMatch = line.substring(0, match.index);
        const quoteCount = (beforeMatch.match(/"/g) || []).length;
        const isInString = quoteCount % 2 === 1;
        
        if (!isInString) {
          references.push({
            line: i + 1,
            column: match.index + 1,
            preview: trimmedLine.substring(0, 100), // 预览前100个字符
          });
        }
      }
    }
  }

  return references;
}

/**
 * 在工作区中查找所有引用
 */
export async function findAllReferences(
  symbolName: string,
  packageName: string | null,
  currentFilePath: string,
  workspaceRoot: string,
  allFiles: string[]
): Promise<Array<{ filePath: string; fileName: string; line: number; column: number; preview: string }>> {
  const references: Array<{ filePath: string; fileName: string; line: number; column: number; preview: string }> = [];
  
  // 如果指定了包名，只搜索相关文件
  let filesToSearch = allFiles;
  if (packageName) {
    // 过滤出可能包含该包的文件
    filesToSearch = allFiles.filter(file => {
      // 搜索 .go 文件
      if (!file.endsWith('.go')) return false;
      
      // 如果包路径已知，可以进一步过滤
      return true;
    });
  }
  
  // 限制搜索范围（避免搜索太多文件）
  const maxFiles = 100;
  const filesToProcess = filesToSearch.slice(0, maxFiles);
  
  const { findReferencesInFile } = await import('@/utils/goNavigation');
  const { FileSystemService } = await import('@/services/fileSystem');
  
  // 并行搜索文件
  const searchPromises = filesToProcess.map(async (filePath) => {
    try {
      const fileRefs = await findReferencesInFile(filePath, symbolName, packageName);
      return fileRefs.map(ref => ({
        ...ref,
        filePath,
        fileName: filePath.split(/[/\\]/).pop() || 'unknown',
      }));
    } catch (error) {
      console.error('Error searching file:', filePath, error);
      return [];
    }
  });
  
  const results = await Promise.all(searchPromises);
  
  // 展平结果
  for (const fileRefs of results) {
    references.push(...fileRefs);
  }
  
  return references;
}

/**
 * 解析 Go 代码中的包引用（如 models.OverviewConfig）
 */
export function parsePackageReference(
  content: string,
  position: { line: number; column: number }
): { packageName: string; typeName: string } | null {
  const lines = content.split('\n');
  const line = lines[position.line - 1];
  
  if (!line) return null;

  // 查找当前位置附近的包引用模式：package.Type 或 &package.Type{}
  const beforeCursor = line.substring(0, position.column - 1);
  const afterCursor = line.substring(position.column - 1);
  
  // 匹配 package.Type 模式
  const match = beforeCursor.match(/(\w+)\.(\w+)$/);
  if (match) {
    return {
      packageName: match[1],
      typeName: match[2],
    };
  }

  // 匹配 &package.Type{} 模式
  const match2 = beforeCursor.match(/&(\w+)\.(\w+)\{?\}?$/);
  if (match2) {
    return {
      packageName: match2[1],
      typeName: match2[2],
    };
  }

  return null;
}

