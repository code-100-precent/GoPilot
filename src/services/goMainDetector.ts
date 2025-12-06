import { FileSystemService } from './fileSystem';

/**
 * 检测 Go 文件是否包含 main 函数
 */
export async function hasMainFunction(filePath: string): Promise<boolean> {
  try {
    // 只检查 .go 文件
    if (!filePath.endsWith('.go')) {
      console.log('[goMainDetector] 不是 .go 文件:', filePath);
      return false;
    }

    // 读取文件内容
    const content = await FileSystemService.readFileContent(filePath);
    
    if (!content || content.length === 0) {
      console.log('[goMainDetector] 文件内容为空:', filePath);
      return false;
    }
    
    // 使用同步检测函数（复用逻辑）
    return hasMainFunctionSync(content);
  } catch (error) {
    console.error('[goMainDetector] 检测 main 函数失败:', filePath, error);
    return false;
  }
}

/**
 * 同步检测（使用已有内容）
 */
export function hasMainFunctionSync(content: string): boolean {
  if (!content || content.length === 0) {
    console.log('[goMainDetector] 同步检测: 内容为空');
    return false;
  }
  
  // 检查是否包含 package main
  const hasPackageMain = content.includes('package main');
  if (!hasPackageMain) {
    console.log('[goMainDetector] 同步检测: 不包含 package main');
    console.log('[goMainDetector] 内容前200字符:', content.substring(0, 200));
    return false;
  }
  console.log('[goMainDetector] ✓ 包含 package main');

  // 检查是否包含 main 函数
  // 使用多种方式匹配，确保能检测到各种格式
  const patterns = [
    /func\s+main\s*\(/,           // func main(
    /func\s+main\s*\([^)]*\)/,    // func main(...)
    /func\s+main\s*\([^)]*\)\s*\{/, // func main(...) {
    /func\s+main\s*\([^)]*\)\s*\{/, // func main(...) {
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      console.log('[goMainDetector] ✓ 找到 main 函数，模式:', pattern);
      return true;
    }
  }
  
  // 如果所有模式都失败，尝试更宽松的匹配
  const loosePattern = /func\s+main/;
  if (loosePattern.test(content)) {
    console.log('[goMainDetector] ✓ 找到 func main 关键字（宽松匹配）');
    return true;
  }
  
  console.log('[goMainDetector] ✗ 未找到 main 函数');
  console.log('[goMainDetector] 内容片段（查找 func）:', content.match(/func[^\n]*/g)?.slice(0, 5));
  return false;
}

