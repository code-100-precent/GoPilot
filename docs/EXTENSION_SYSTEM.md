# 扩展系统架构设计

## 概述

本文档描述了 GoPilotCode 的扩展系统架构，目标是支持 VSCode 兼容的扩展。

## 架构组件

### 1. Extension Service (`extensionService.ts`)
- 负责与 VSCode Marketplace API 交互
- 下载和安装扩展
- 管理已安装扩展列表

### 2. Extension Loader (`extensionLoader.ts`)
- 解析 VSIX 文件（ZIP 格式）
- 加载扩展清单（package.json）
- 激活扩展
- 管理扩展生命周期

### 3. Extension Runtime
- 提供扩展执行环境
- 实现扩展 API（类似 VSCode Extension API）
- 处理扩展的命令、语言、主题等贡献

## 实现步骤

### 阶段 1: VSIX 文件解析
- [ ] 实现 ZIP 文件解压（使用 JSZip 或类似库）
- [ ] 提取 package.json
- [ ] 验证扩展清单格式

### 阶段 2: 扩展加载
- [ ] 实现扩展主文件加载
- [ ] 支持 CommonJS 模块系统
- [ ] 创建扩展执行上下文

### 阶段 3: 扩展激活
- [ ] 实现 activationEvents 检查
- [ ] 调用扩展的 activate 函数
- [ ] 处理扩展的 deactivate 函数

### 阶段 4: 扩展贡献
- [ ] 命令注册和执行
- [ ] 语言支持（语法高亮、自动完成等）
- [ ] 主题支持
- [ ] 其他贡献点（视图、菜单等）

### 阶段 5: 扩展 API
- [ ] 实现 VSCode Extension API 的核心部分
- [ ] 编辑器 API
- [ ] 文件系统 API
- [ ] 窗口 API
- [ ] 命令 API

## 技术栈

- **VSIX 解析**: JSZip (https://stuk.github.io/jszip/)
- **模块加载**: 动态 import() 或 require()
- **扩展 API**: 自定义实现，参考 VSCode Extension API

## 注意事项

1. **安全性**: 扩展代码在沙箱环境中执行，需要限制文件系统访问
2. **性能**: 扩展加载不应阻塞主线程
3. **兼容性**: 优先支持最常用的 VSCode 扩展功能
4. **渐进式实现**: 先实现核心功能，再逐步添加高级特性

## 参考

- VSCode Extension API: https://code.visualstudio.com/api/references/vscode-api
- VSCode Extension Manifest: https://code.visualstudio.com/api/references/extension-manifest

