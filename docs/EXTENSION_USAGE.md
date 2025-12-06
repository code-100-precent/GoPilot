# 扩展系统使用指南

## 概述

GoPilotCode 现在支持 VSCode 兼容的扩展系统。安装的扩展可以：
- 注册命令
- 访问编辑器 API
- 修改文档内容
- 显示消息通知

## 已实现的功能

### 1. 扩展安装
- ✅ 从 VSCode Marketplace 下载扩展
- ✅ 解压 VSIX 文件
- ✅ 保存扩展到本地目录

### 2. 扩展加载
- ✅ 自动加载已安装的扩展
- ✅ 解析 package.json
- ✅ 加载扩展主文件

### 3. 扩展激活
- ✅ 调用扩展的 `activate` 函数
- ✅ 提供扩展上下文（ExtensionContext）
- ✅ 注册扩展命令

### 4. 扩展 API
- ✅ `vscode.commands.registerCommand` - 注册命令
- ✅ `vscode.commands.executeCommand` - 执行命令
- ✅ `vscode.window.activeTextEditor` - 获取活动编辑器
- ✅ `vscode.window.showInformationMessage` - 显示信息
- ✅ `vscode.window.showWarningMessage` - 显示警告
- ✅ `vscode.window.showErrorMessage` - 显示错误

## 扩展目录结构

扩展安装后会被解压到：
```
~/Library/Application Support/com.cetiprobe.desktop/extensions/
  └── {publisher}.{name}-{version}/
      ├── package.json
      ├── extension.js (或其他主文件)
      └── ... (其他扩展文件)
```

## 扩展示例

一个简单的扩展示例：

```javascript
// extension.js
const vscode = require('vscode');

function activate(context) {
  console.log('扩展已激活！');
  
  // 注册一个命令
  const disposable = vscode.commands.registerCommand('extension.helloWorld', function () {
    vscode.window.showInformationMessage('Hello World from Extension!');
  });
  
  context.subscriptions.push(disposable);
}

function deactivate() {
  console.log('扩展已停用');
}

module.exports = {
  activate,
  deactivate
};
```

## 当前限制

1. **模块系统**: 目前只支持基本的 CommonJS `require`，不支持 Node.js 的所有模块
2. **文件系统 API**: 文件系统操作需要通过 Tauri API，不能直接使用 Node.js 的 `fs` 模块
3. **网络请求**: 扩展中的网络请求需要通过 Tauri API 或使用浏览器 fetch API
4. **UI 贡献**: 目前不支持扩展贡献 UI 元素（如视图、菜单等）
5. **语言支持**: 语法高亮和语言支持需要手动集成到 Monaco Editor

## 未来计划

- [ ] 支持更多 VSCode Extension API
- [ ] 实现扩展的 UI 贡献点
- [ ] 支持扩展的语言服务器
- [ ] 实现扩展的主题贡献
- [ ] 支持扩展的代码片段
- [ ] 实现扩展的调试适配器

## 调试扩展

扩展的日志会输出到浏览器控制台，可以通过以下方式查看：
1. 打开开发者工具（F12 或 Cmd+Option+I）
2. 查看 Console 标签页
3. 查找以 `[Extension]` 开头的日志

## 故障排除

### 扩展未激活
- 检查扩展的 `package.json` 中是否有 `main` 字段
- 检查扩展主文件是否存在
- 查看控制台是否有错误信息

### 命令未注册
- 确保扩展的 `activate` 函数正确调用了 `vscode.commands.registerCommand`
- 检查命令 ID 是否正确

### 编辑器 API 不可用
- 确保编辑器已创建并注册到扩展 API
- 检查 `vscode.window.activeTextEditor` 是否返回 `undefined`

