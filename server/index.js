const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3099;

const CERT_DIR = process.env.CERT_DIR || '/etc/nginx/ssl';
const SITES_AVAILABLE = process.env.SITES_AVAILABLE || '/etc/nginx/sites-available';
const SITES_ENABLED = process.env.SITES_ENABLED || '/etc/nginx/sites-enabled';
const CONFIG_FILE = path.join(__dirname, 'config.json');

// 证书固定文件名
const CERT_FILE = 'server.crt';
const KEY_FILE = 'server.key';

app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '..', 'frontend', 'dist')));
}

// --- Multer for cert upload (fixed filenames) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });
    cb(null, CERT_DIR);
  },
  filename: (req, file, cb) => {
    cb(null, file.fieldname === 'fullchain' ? CERT_FILE : KEY_FILE);
  }
});
const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.pem', '.crt', '.key', '.cer'].includes(ext) || file.mimetype === 'application/octet-stream') {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件类型: ${ext}`));
    }
  },
  limits: { fileSize: 1024 * 1024 }
});

// --- Config ---
// { sites: [{ name: "web", domain: "www.example.com", port: "3000" }] }
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
  } catch (e) { /* ignore */ }
  return { sites: [] };
}
function saveConfig(config) {
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf-8');
}

// --- Nginx helpers ---
function checkNginx() {
  const result = { installed: false, version: null, running: false, path: null };
  try {
    const out = execSync('nginx -v 2>&1', { encoding: 'utf-8' });
    result.installed = true;
    const m = out.match(/nginx\/(\S+)/);
    result.version = m ? m[1] : out.trim();
  } catch (e) { return result; }
  try { result.path = execSync('which nginx 2>/dev/null', { encoding: 'utf-8' }).trim(); } catch (e) {}
  try { execSync('pgrep -x nginx >/dev/null 2>&1'); result.running = true; } catch (e) {}
  return result;
}

function detectPM() {
  const list = [
    { cmd: 'apt-get --version', name: 'apt', install: 'apt-get update && apt-get install -y nginx' },
    { cmd: 'yum --version', name: 'yum', install: 'yum install -y nginx' },
    { cmd: 'dnf --version', name: 'dnf', install: 'dnf install -y nginx' },
    { cmd: 'pacman --version', name: 'pacman', install: 'pacman -S --noconfirm nginx' },
    { cmd: 'brew --version', name: 'brew', install: 'brew install nginx' },
    { cmd: 'apk --version', name: 'apk', install: 'apk add --no-cache nginx' },
  ];
  for (const p of list) {
    try { execSync(p.cmd + ' >/dev/null 2>&1'); return p; } catch (e) {}
  }
  return null;
}

// Generate nginx config for ONE site
function generateSiteConfig(site) {
  const certPath = path.join(CERT_DIR, CERT_FILE);
  const keyPath = path.join(CERT_DIR, KEY_FILE);

  return `# Auto Nginx - ${site.name}
server {
    listen 80;
    server_name ${site.domain};
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ${site.domain};

    ssl_certificate     ${certPath};
    ssl_certificate_key ${keyPath};
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    location / {
        proxy_pass http://127.0.0.1:${site.port};
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    access_log /var/log/nginx/${site.domain}_access.log;
    error_log  /var/log/nginx/${site.domain}_error.log;
}
`;
}

function getCertStatus() {
  return fs.existsSync(path.join(CERT_DIR, CERT_FILE)) &&
         fs.existsSync(path.join(CERT_DIR, KEY_FILE));
}

// Deploy all sites — each site gets its own config file
function deployAll() {
  const config = loadConfig();
  if (!getCertStatus()) throw new Error('请先上传 SSL 证书');
  if (config.sites.length === 0) throw new Error('请至少添加一个站点');

  if (!fs.existsSync(SITES_AVAILABLE)) fs.mkdirSync(SITES_AVAILABLE, { recursive: true });
  if (!fs.existsSync(SITES_ENABLED)) fs.mkdirSync(SITES_ENABLED, { recursive: true });

  // Clean old auto-nginx configs
  for (const f of fs.readdirSync(SITES_AVAILABLE)) {
    const content = fs.readFileSync(path.join(SITES_AVAILABLE, f), 'utf-8');
    if (content.startsWith('# Auto Nginx')) {
      try { fs.unlinkSync(path.join(SITES_ENABLED, f)); } catch (e) {}
      fs.unlinkSync(path.join(SITES_AVAILABLE, f));
    }
  }

  // Generate new configs
  for (const site of config.sites) {
    const filename = `auto-nginx_${site.domain}`;
    const availablePath = path.join(SITES_AVAILABLE, filename);
    const enabledPath = path.join(SITES_ENABLED, filename);

    fs.writeFileSync(availablePath, generateSiteConfig(site), 'utf-8');
    if (!fs.existsSync(enabledPath)) {
      fs.symlinkSync(availablePath, enabledPath);
    }
  }

  try {
    execSync('nginx -t 2>&1', { encoding: 'utf-8' });
  } catch (e) {
    throw new Error(`Nginx 配置检测失败: ${e.message}`);
  }
  execSync('nginx -s reload 2>&1');
}

// ===================== API =====================

// Nginx status
app.get('/api/nginx-check', (req, res) => {
  const info = checkNginx();
  const pm = detectPM();
  res.json({
    ...info,
    canAutoInstall: !!pm,
    packageManager: pm?.name || null,
  });
});

// Install nginx
app.post('/api/nginx-install', (req, res) => {
  const pm = detectPM();
  if (!pm) return res.status(400).json({ error: '未检测到包管理器，请手动安装' });
  try {
    execSync(pm.install, { encoding: 'utf-8', timeout: 120_000 });
    const info = checkNginx();
    res.json({ success: true, message: `Nginx 安装成功 (${pm.name})`, ...info });
  } catch (e) {
    res.status(500).json({ error: `安装失败: ${e.message}` });
  }
});

// Get status
app.get('/api/status', (req, res) => {
  const config = loadConfig();
  const certReady = getCertStatus();
  // Check deploy status: any auto-nginx config in sites-enabled?
  let deployed = false;
  try {
    const files = fs.readdirSync(SITES_ENABLED);
    deployed = files.some(f => f.startsWith('auto-nginx_'));
  } catch (e) {}

  res.json({
    sites: config.sites,
    certReady,
    deployed,
  });
});

// Upload certificate (fixed filenames, no domain needed)
app.post('/api/certificate', upload.fields([
  { name: 'fullchain', maxCount: 1 },
  { name: 'privkey', maxCount: 1 }
]), (req, res) => {
  if (!req.files?.fullchain || !req.files?.privkey) {
    return res.status(400).json({ error: '请同时上传证书文件和私钥文件' });
  }
  res.json({ success: true, message: '证书上传成功', certReady: true });
});

// Add site (name + domain + port)
app.post('/api/sites', (req, res) => {
  const { name, domain, port } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: '请填写站点名称' });
  if (!domain?.trim()) return res.status(400).json({ error: '请填写域名' });
  if (!port) return res.status(400).json({ error: '请填写端口' });
  const portNum = parseInt(port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) return res.status(400).json({ error: '端口号 1-65535' });

  const config = loadConfig();
  if (config.sites.find(s => s.name === name.trim())) {
    return res.status(400).json({ error: `站点名称 "${name}" 已存在` });
  }

  config.sites.push({
    name: name.trim(),
    domain: domain.trim(),
    port: String(portNum),
    createdAt: new Date().toISOString()
  });
  saveConfig(config);
  res.json({ success: true, message: `站点 "${name}" 已添加` });
});

// Delete site
app.delete('/api/sites/:name', (req, res) => {
  const name = decodeURIComponent(req.params.name);
  const config = loadConfig();
  config.sites = config.sites.filter(s => s.name !== name);
  saveConfig(config);
  res.json({ success: true, message: `站点 "${name}" 已删除` });
});

// Deploy all sites
app.post('/api/deploy', (req, res) => {
  try {
    deployAll();
    res.json({ success: true, message: '部署成功！Nginx 已重载' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// SPA fallback
if (process.env.NODE_ENV === 'production') {
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Auto Nginx Server · http://0.0.0.0:${PORT}\n`);
});
