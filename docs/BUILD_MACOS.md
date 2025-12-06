# GoPilot macOS 打包指南

本文档详细说明如何将 GoPilot 打包为 macOS 应用程序。

## 📋 前置要求

### 1. 系统要求
- macOS 10.13 (High Sierra) 或更高版本
- Xcode Command Line Tools
- Rust 工具链
- Node.js 20+ 和 npm

### 2. 安装必要工具

```bash
# 安装 Xcode Command Line Tools
xcode-select --install

# 安装 Rust（如果还没有）
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# 验证安装
rustc --version
cargo --version
node --version
npm --version
```

### 3. 安装 Tauri CLI

```bash
npm install -g @tauri-apps/cli
# 或者使用项目本地版本
npm install --save-dev @tauri-apps/cli
```

## 🔧 配置说明

### 1. 检查 `src-tauri/tauri.conf.json`

确保配置文件包含以下关键设置：

```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:3535",
    "distDir": "../dist"
  },
  "package": {
    "productName": "GoPilot",
    "version": "1.0.0"
  },
  "tauri": {
    "allowlist": {
      "all": false,
      "shell": {
        "all": false,
        "execute": true,
        "open": true
      },
      "dialog": {
        "all": false,
        "open": true,
        "save": true
      },
      "fs": {
        "all": false,
        "readFile": true,
        "writeFile": true,
        "readDir": true,
        "createDir": true,
        "removeDir": true,
        "removeFile": true,
        "renameFile": true,
        "exists": true,
        "scope": ["$HOME/**", "$APPDATA/**", "$DOCUMENT/**"]
      }
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.gopilot.app",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ],
      "macOSPrivateApi": true,
      "resources": [],
      "externalBin": [],
      "copyright": "",
      "category": "DeveloperTool",
      "shortDescription": "A modern code editor for Go development",
      "longDescription": "GoPilot - A modern code editor for Go development, inspired by GoLand",
      "deb": {
        "depends": []
      },
      "macOS": {
        "frameworks": [],
        "minimumSystemVersion": "10.13",
        "exceptionDomain": "",
        "signingIdentity": null,
        "entitlements": null
      },
      "windows": {
        "certificateThumbprint": null,
        "digestAlgorithm": "sha256",
        "timestampUrl": ""
      }
    },
    "security": {
      "csp": null
    },
    "windows": [
      {
        "fullscreen": false,
        "resizable": true,
        "title": "GoPilot",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600
      }
    ],
    "macOSPrivateApi": true
  }
}
```

### 2. 图标准备

确保在 `src-tauri/icons/` 目录下有以下图标文件：

```
icons/
├── 32x32.png
├── 128x128.png
├── 128x128@2x.png
├── icon.icns          # macOS 图标
└── icon.ico           # Windows 图标
```

**生成 macOS 图标 (.icns)：**

```bash
# 方法1: 使用 iconutil（macOS 自带）
mkdir icon.iconset
# 将不同尺寸的 PNG 文件放入 iconset 目录
# 命名规则: icon_16x16.png, icon_16x16@2x.png, icon_32x32.png, 等等
iconutil -c icns icon.iconset -o icon.icns

# 方法2: 使用 sips（如果已有大尺寸图标）
sips -z 16 16     app-icon.png --out icon_16x16.png
sips -z 32 32     app-icon.png --out icon_32x32.png
sips -z 128 128   app-icon.png --out icon_128x128.png
sips -z 256 256   app-icon.png --out icon_256x256.png
sips -z 512 512   app-icon.png --out icon_512x512.png
sips -z 1024 1024 app-icon.png --out icon_1024x1024.png
```

## 🚀 打包步骤

### 方法 1: 使用构建脚本（最简单，推荐）⭐

```bash
# 运行自动化构建脚本
./scripts/build-macos.sh
```

脚本会自动完成：
- ✅ 检查必要工具
- ✅ 检查图标文件
- ✅ 清理旧构建
- ✅ 安装依赖
- ✅ 构建前端
- ✅ 构建 Tauri 应用
- ✅ 显示构建结果

### 方法 2: 使用 npm 脚本

```bash
# 1. 确保所有依赖已安装
npm install

# 2. 构建前端
npm run build

# 3. 打包应用
npm run tauri:build
```

### 方法 3: 直接使用 Tauri CLI

```bash
# 使用全局 CLI
tauri build

# 或使用项目本地 CLI
npx tauri build
```

### 方法 4: 仅构建特定架构

```bash
# Intel Mac (x86_64)
tauri build --target x86_64-apple-darwin

# Apple Silicon (M1/M2/M3)
tauri build --target aarch64-apple-darwin

# 通用二进制（Universal Binary，包含两种架构）- 默认
tauri build
```

## 📦 输出文件

打包完成后，应用文件位于：

```
src-tauri/target/release/bundle/
├── macos/
│   ├── GoPilot.app              # macOS 应用程序包
│   └── GoPilot_1.0.0_x64.dmg    # DMG 安装镜像（如果启用）
```

### 应用包结构

```
GoPilot.app/
├── Contents/
│   ├── Info.plist              # 应用信息
│   ├── MacOS/
│   │   └── gopilot             # 可执行文件
│   ├── Resources/
│   │   └── ...                  # 资源文件
│   └── Frameworks/              # 依赖框架
```

## 🔐 代码签名（可选但推荐）

### 1. 获取开发者证书

1. 访问 [Apple Developer](https://developer.apple.com/)
2. 注册开发者账号（免费或付费）
3. 在 Xcode 中创建证书：
   - 打开 Xcode → Preferences → Accounts
   - 添加 Apple ID
   - 下载证书

### 2. 配置签名

在 `src-tauri/tauri.conf.json` 中配置：

```json
{
  "tauri": {
    "bundle": {
      "macOS": {
        "signingIdentity": "Developer ID Application: Your Name (TEAM_ID)",
        "entitlements": "entitlements.plist"
      }
    }
  }
}
```

### 3. 创建 entitlements.plist

创建 `src-tauri/entitlements.plist`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.cs.allow-jit</key>
  <true/>
  <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
  <true/>
  <key>com.apple.security.cs.allow-dyld-environment-variables</key>
  <true/>
  <key>com.apple.security.cs.disable-library-validation</key>
  <true/>
  <key>com.apple.security.network.client</key>
  <true/>
  <key>com.apple.security.network.server</key>
  <true/>
  <key>com.apple.security.files.user-selected.read-write</key>
  <true/>
  <key>com.apple.security.files.downloads.read-write</key>
  <true/>
</dict>
</plist>
```

### 4. 手动签名（如果需要）

```bash
# 签名应用
codesign --force --deep --sign "Developer ID Application: Your Name (TEAM_ID)" \
  --entitlements entitlements.plist \
  --options runtime \
  GoPilot.app

# 验证签名
codesign --verify --verbose GoPilot.app
spctl --assess --verbose GoPilot.app
```

## 📝 创建 DMG 安装镜像（可选）

### 使用 create-dmg

```bash
# 安装 create-dmg
brew install create-dmg

# 创建 DMG
create-dmg \
  --volname "GoPilot" \
  --volicon "app-icon.png" \
  --window-pos 200 120 \
  --window-size 800 400 \
  --icon-size 100 \
  --icon "GoPilot.app" 200 190 \
  --hide-extension "GoPilot.app" \
  --app-drop-link 600 185 \
  "GoPilot_1.0.0.dmg" \
  "GoPilot.app"
```

### 使用 hdiutil（macOS 自带）

```bash
# 创建临时 DMG
hdiutil create -volname "GoPilot" -srcfolder "GoPilot.app" -ov -format UDRW GoPilot_temp.dmg

# 挂载 DMG
hdiutil attach GoPilot_temp.dmg -noverify -mountpoint /Volumes/GoPilot

# 设置图标位置（可选）
# 需要先安装 Platypus 或使用 AppleScript

# 卸载并转换为只读格式
hdiutil detach /Volumes/GoPilot
hdiutil convert GoPilot_temp.dmg -format UDZO -o GoPilot_1.0.0.dmg

# 清理临时文件
rm GoPilot_temp.dmg
```

## 🧪 测试应用

### 1. 本地测试

```bash
# 直接运行应用包
open src-tauri/target/release/bundle/macos/GoPilot.app

# 或使用命令行
./src-tauri/target/release/bundle/macos/GoPilot.app/Contents/MacOS/gopilot
```

### 2. 检查依赖

```bash
# 检查动态库依赖
otool -L GoPilot.app/Contents/MacOS/gopilot

# 检查应用信息
plutil -p GoPilot.app/Contents/Info.plist
```

## ⚠️ 常见问题

### 1. 构建失败：找不到 Rust 工具链

```bash
# 安装 Rust 工具链
rustup target add x86_64-apple-darwin
rustup target add aarch64-apple-darwin
```

### 2. 构建失败：权限错误

```bash
# 确保有执行权限
chmod +x src-tauri/target/release/gopilot
```

### 3. 应用无法启动：Gatekeeper 阻止

```bash
# 临时允许（仅用于测试）
xattr -cr GoPilot.app

# 或使用系统设置：
# 系统偏好设置 → 安全性与隐私 → 通用 → 点击"仍要打开"
```

### 4. 图标不显示

- 确保 `icon.icns` 文件存在且格式正确
- 检查 `tauri.conf.json` 中的图标路径
- 重新生成图标文件

### 5. 应用体积过大

```bash
# 使用 strip 减小体积
strip src-tauri/target/release/gopilot

# 或启用 release 优化
# 在 Cargo.toml 中添加：
[profile.release]
opt-level = "z"      # 优化大小
lto = true          # 链接时优化
codegen-units = 1   # 更好的优化
```

## 📊 优化建议

### 1. 减小应用体积

- 启用 Rust 的 release 优化
- 压缩前端资源
- 移除未使用的依赖

### 2. 提升启动速度

- 使用静态链接
- 优化前端打包
- 延迟加载非关键模块

### 3. 改进用户体验

- 添加启动画面
- 优化首次启动时间
- 提供更新机制

## 🔄 自动化构建脚本

创建 `scripts/build-macos.sh`：

```bash
#!/bin/bash

set -e

echo "🚀 开始构建 GoPilot macOS 版本..."

# 清理之前的构建
echo "🧹 清理构建文件..."
rm -rf dist
rm -rf src-tauri/target/release/bundle

# 安装依赖
echo "📦 安装依赖..."
npm install

# 构建前端
echo "🔨 构建前端..."
npm run build

# 构建 Tauri 应用
echo "📱 构建 Tauri 应用..."
npm run tauri:build

# 检查输出
if [ -d "src-tauri/target/release/bundle/macos" ]; then
    echo "✅ 构建成功！"
    echo "📦 应用位置: src-tauri/target/release/bundle/macos/GoPilot.app"
    ls -lh src-tauri/target/release/bundle/macos/
else
    echo "❌ 构建失败！"
    exit 1
fi
```

使用：

```bash
chmod +x scripts/build-macos.sh
./scripts/build-macos.sh
```

## 📚 相关资源

- [Tauri 官方文档](https://tauri.app/v1/guides/building/macos)
- [Apple 开发者文档](https://developer.apple.com/documentation/)
- [代码签名指南](https://developer.apple.com/library/archive/documentation/Security/Conceptual/CodeSigningGuide/)
- [DMG 创建指南](https://stackoverflow.com/questions/96882/how-do-i-create-a-nice-installer-dmg-for-mac-os-x-application)

## 🎯 快速开始

最简单的打包方式：

```bash
# 1. 安装依赖
npm install

# 2. 构建并打包
npm run tauri:build

# 3. 找到应用
open src-tauri/target/release/bundle/macos/GoPilot.app
```

完成！🎉

