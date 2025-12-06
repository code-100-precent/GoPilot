# VoicePilotCore 运行指南

## 快速开始

### 1. 环境要求

- Node.js 20+
- Go 1.21+
- Rust
- Git

### 2. 克隆项目

```bash
git clone https://github.com/code-100-precent/voicePilotCore.git
cd voicePilotCore
```

### 2. 安装依赖

```bash
# 前端依赖
npm install

# 后端依赖
cd server
go mod download
cd ..
```

### 3. 配置文件

```bash
# 复制环境变量模板
cp server/env.example server/.env

# 编辑配置文件
# 至少需要配置: LLM_API_KEY, SESSION_SECRET
```

### 4. 启动服务

```bash
# 启动后端 (在 server 目录)
cd server
go run ./cmd/server/main.go

# 启动前端 (在项目根目录)
npm run tauri:dev

# 启动终端项目
wails dev
```

### 5. 访问应用

- 桌面端自动启动
- 前端浏览器打开: http://localhost:3535
- 后端: http://localhost:7072
- API文档: http://localhost:7072/api/docs
- 管理后他: http://localhost:7072/api/auth/login

## 最小配置

编辑 `server/.env`:

```env
APP_ENV=development
MODE=dev
ADDR=:8080

DB_DRIVER=sqlite
DSN=./pilotCore.db

LLM_API_KEY=your-openai-api-key
LLM_MODEL=gpt-4

SESSION_SECRET=your-random-secret-key
```

## 其他运行方式

### 桌面应用 (Tauri)

```bash
# 开发模式
npm run tauri:dev

# 构建
npm run tauri:build
```

### Docker 部署

```bash
# 构建镜像
docker build -t voicepilotcore .

# 运行容器
docker run -p 8080:8080 voicepilotcore
```

## 常见问题

### 端口被占用

修改 `server/.env` 中的 `ADDR` 端口号

### 依赖安装失败

```bash
# 清理并重装
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

## 📚 更多信息

- 完整文档: [README.md](../README.md)
- 配置说明: [server/env.example](../server/env.example)
