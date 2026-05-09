# Auto Nginx

单域名 HTTPS 快速部署工具。上传 SSL 证书，配置域名和端口，一键生成 Nginx 配置并部署。

## 功能

- 📤 上传 SSL 证书文件（.crt/.pem + .key）保存到服务器
- ⚙️ 自动生成 Nginx 反向代理配置（HTTP → HTTPS）
- 🔗 自动创建 `sites-available` 和 `sites-enabled` 软链接
- ✅ 自动执行 `nginx -t` 测试配置，失败则自动回滚
- 🔄 自动执行 `nginx -s reload` 重载 Nginx
- 👁️ 配置预览（终端风格语法高亮）
- 🗑️ 一键移除部署

## 快速开始

```bash
# 安装所有依赖
npm run install:all

# 开发模式（前后端同时启动）
npm run dev

# 生产模式
npm run build
sudo npm start
```

## 部署到服务器

```bash
# 1. 克隆到服务器
git clone <repo> /opt/auto-nginx
cd /opt/auto-nginx

# 2. 安装依赖
npm run install:all

# 3. 构建前端
npm run build

# 4. 以 root 权限启动（需要操作 nginx 配置）
sudo PORT=3099 NODE_ENV=production node server/index.js
```

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `3099` | 服务监听端口 |
| `CERT_DIR` | `/etc/nginx/ssl` | 证书保存目录 |
| `SITES_AVAILABLE` | `/etc/nginx/sites-available` | Nginx sites-available 目录 |
| `SITES_ENABLED` | `/etc/nginx/sites-enabled` | Nginx sites-enabled 目录 |

## 技术栈

- **前端**: React 18 + Vite + Lucide Icons + Vanilla CSS
- **后端**: Node.js + Express + Multer
- **设计**: Dark Terminal 风格 UI
