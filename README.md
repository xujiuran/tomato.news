# 🚀 TomatoX News Server (tomato.news)

基于 **Hono.js** 与 TypeScript 构建的高性能微服务后端。专为 **Docker 容器化** 与 **ARM64 (linux/arm64) VPS 架构** 深度优化，宿主机无需安装 Node.js 环境，一键构建运行。

---

## 🌟 特性亮点

- **⚡️ 极速轻量**：基于 Hono 4.x，比 Express 快数倍，内存占用低至 30MB~50MB。
- **🛡 纯净单文件打包**：基于 `tsup` 将代码与依赖全量编译压缩为 ESM 单文件，运行时容器**无需安装 `node_modules`**，镜像体积缩减至 70MB 级别。
- **🦾 ARM64 原生适配**：基于官方多架构 `node:22-alpine`，针对 ARM64 VPS（如 Oracle ARM、AWS Graviton 等）原生优化。
- **🐳 Docker 一键启动**：内置生产级多阶段 `Dockerfile` 与 `docker-compose.yml`，具备健康检查（Healthcheck）与平滑退出（Graceful Shutdown）。
- **📡 实用开箱功能**：
  - `/health`：系统实时架构检测（自动返回 `arch: "arm64"`）、内存占用与运行状态
  - `/api/info`：API 端点自动探测与说明
  - `/api/news`：微博实时热搜、GitHub Trending 开源榜单、每日 60 秒早报聚合与缓存

---

## 📁 目录结构

```text
hono-server/
├── Dockerfile              # 多阶段 Docker 构建文件（ARM64/AMD64 全兼容）
├── docker-compose.yml      # Docker Compose 服务编排配置文件
├── .dockerignore           # Docker 构建忽略列表
├── .env.example            # 环境变量示例
├── package.json            # 项目配置与脚本
├── tsconfig.json           # TypeScript 编译配置
├── tsup.config.ts          # 生产打包配置（独立 ESM 打包）
└── src/
    ├── index.ts            # 主程序入口、全局中间件与优雅停机
    └── routes/
        ├── health.ts       # 健康检查与系统硬件架构信息
        ├── api.ts          # 基础服务与探测接口
        └── news.ts         # 新闻热点聚合接口（微博/GitHub/60s）
```

---

## 🛠 本地快速运行（开发模式）

如果你本地有 Node.js（推荐 20 或 22+）：

```bash
# 安装依赖
pnpm install
# 或 npm install

# 启动开发服务器（支持热重载）
pnpm dev
# 或 npm run dev

# 编译打包生产产物
pnpm build

# 运行生产产物
pnpm start
```

服务默认监听 `http://localhost:3000`。

---

## 🚢 VPS 部署指南（Docker 29.9.0 / ARM64）

> **💡 说明**：你的 VPS 主机上**完全不需要安装 Node.js 或 pnpm/npm**，所有构建与运行环境均封装在 Docker 容器内。

### 第一步：将代码上传到 VPS

你可以通过 Git 克隆或使用 `rsync` / `scp` 将整个 `hono-server` 目录上传到 VPS：

```bash
# 例如通过 scp 上传：
scp -r ./hono-server user@your-vps-ip:/opt/hono-server
```

### 第二步：一键构建并启动容器

进入 VPS 上的项目目录，使用 Docker Compose 启动：

```bash
cd /opt/hono-server

# 构建并后台启动
docker compose up -d --build
```

### 第三步：验证服务状态与架构

```bash
# 1. 检查容器运行状态与健康检查
docker compose ps

# 2. 查看实时服务日志
docker compose logs -f

# 3. 本地请求健康检查端点（验证 ARM64 架构与系统信息）
curl http://localhost:3000/health
```

如果是在 ARM64 VPS 上，返回的 JSON 中的 `system.arch` 将明确显示为 `"arm64"`，`system.platform` 显示为 `"linux"`。

---

## 🌐 接口列表概览

| 请求方法 | 路径 | 功能说明 |
| :--- | :--- | :--- |
| `GET` | `/` | 服务欢迎看板与基础状态 |
| `GET` | `/health` | **健康检查接口**（含 uptime、内存使用、CPU 架构 `arm64`） |
| `GET` | `/api/info` | 获取所有可用 API 清单与文档描述 |
| `GET` | `/api/time` | 获取服务器标准 UTC 时间与北京时间 |
| `POST` | `/api/echo` | JSON 请求回显测试 |
| `GET` | `/api/news/sources` | 查看可用的新闻抓取与聚合源 |
| `GET` | `/api/news/60s` | 每日 60 秒天下事热点快讯 |
| `GET` | `/api/news/weibo` | 微博官方实时热搜榜单 |
| `GET` | `/api/news/github` | GitHub 今日 Trending 热门代码库 |

---

## 🔒 生产环境反向代理（Nginx 示例配置）

如果你希望通过自己的域名（例如 `api.xujiuran.top`）并配置 SSL 证书对外提供访问：

```nginx
server {
    listen 80;
    server_name api.xujiuran.top;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.xujiuran.top;

    ssl_certificate     /etc/letsencrypt/live/api.xujiuran.top/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.xujiuran.top/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 常用运维命令

```bash
# 重启服务
docker compose restart

# 停止服务
docker compose down

# 重新拉取构建并启动
docker compose up -d --build --force-recreate
```
