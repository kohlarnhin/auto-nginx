import { useState, useEffect, useCallback, memo } from 'react';
import {
  Server, Settings, Check, X, Globe, Plus, Trash2,
  Shield, ChevronRight, ChevronDown, Search, Download, Lock, Cloud,
  ExternalLink, FileCode, Terminal, LogOut
} from 'lucide-react';

const API = '/api';

/* ── Auth helpers ── */
function getToken() { return localStorage.getItem('auto-nginx-token'); }
function setToken(t) { localStorage.setItem('auto-nginx-token', t); }
function clearToken() { localStorage.removeItem('auto-nginx-token'); }
function authHeaders() {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}
async function authFetch(url, opts = {}) {
  opts.headers = { ...opts.headers, ...authHeaders() };
  return fetch(url, opts);
}

/* ── Toast ── */
const Toast = memo(function Toast({ data, onClose }) {
  useEffect(() => {
    if (!data) return;
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [data, onClose]);
  if (!data) return null;
  return (
    <div className="toast-wrap">
      <div className={`toast ${data.type === 'success' ? 'toast-ok' : 'toast-err'}`}>
        {data.type === 'success' ? <Check size={14} /> : <X size={14} />}
        {data.message}
      </div>
    </div>
  );
});

/* ── Login Screen ── */
function LoginScreen({ onLogin, toast, setToast }) {
  const [pwd, setPwd] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!pwd.trim()) return;
    setBusy(true);
    try {
      const r = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      });
      const d = await r.json();
      if (r.ok) {
        setToken(d.token);
        onLogin();
      } else {
        setToast({ type: 'error', message: d.error || '登录失败' });
      }
    } catch (e) {
      setToast({ type: 'error', message: '网络错误' });
    }
    finally { setBusy(false); }
  };

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-icon">
          <Lock size={32} strokeWidth={1.5} />
        </div>
        <h1 className="login-title">Auto Nginx</h1>
        <p className="login-desc">请输入访问密码以继续</p>
        <form onSubmit={submit} className="login-form">
          <input
            className="fi login-input"
            type="password"
            placeholder="输入密码"
            value={pwd}
            onChange={e => setPwd(e.target.value)}
            autoFocus
          />
          <button className="btn btn-primary login-btn" type="submit" disabled={busy || !pwd.trim()}>
            {busy ? <><span className="spin" /> 验证中…</> : '登 录'}
          </button>
        </form>
        <p className="login-hint">密码位于服务器 <code>server/.password</code> 文件中</p>
      </div>
      <Toast data={toast} onClose={() => setToast(null)} />
    </div>
  );
}

/* ── Collapsible Section ── */
function Section({ label, badge, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="fg">
      <button className="sec-toggle" onClick={() => setOpen(!open)}>
        <span className="sec-label">{label}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {badge}
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>
      {open && <div className="sec-content">{children}</div>}
    </div>
  );
}

/* ── Settings Modal ── */
function SettingsModal({ show, onClose, nginx, onInstall, installing, status, notify, onRefresh }) {
  const [cf, setCf] = useState(null);
  const [kf, setKf] = useState(null);
  const [uping, setUping] = useState(false);
  const [cfToken, setCfToken] = useState('');
  const [savingToken, setSavingToken] = useState(false);

  if (!show) return null;

  const uploadCert = async () => {
    if (!cf || !kf) return;
    setUping(true);
    try {
      const fd = new FormData();
      fd.append('fullchain', cf);
      fd.append('privkey', kf);
      const r = await authFetch(`${API}/certificate`, { method: 'POST', body: fd });
      const d = await r.json();
      if (r.ok) { notify({ type: 'success', message: d.message }); setCf(null); setKf(null); onRefresh(); }
      else notify({ type: 'error', message: d.error });
    } catch (e) { notify({ type: 'error', message: '网络错误，请重试' }); }
    finally { setUping(false); }
  };

  const saveCfToken = async () => {
    if (!cfToken.trim()) return;
    setSavingToken(true);
    try {
      const r = await authFetch(`${API}/cf-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cfToken.trim() }),
      });
      const d = await r.json();
      notify({ type: r.ok ? 'success' : 'error', message: r.ok ? d.message : d.error });
      if (r.ok) { setCfToken(''); onRefresh(); }
    } catch (e) { notify({ type: 'error', message: '网络错误，请重试' }); }
    finally { setSavingToken(false); }
  };

  const okBadge = <span className="badge-ok"><Check size={10} /> 就绪</span>;
  const errBadge = <span className="badge-err">未配置</span>;

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dlg-head">
          <h2>环境设置</h2>
          <button className="dlg-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="dlg-body">
          {/* Nginx */}
          <Section label="Nginx 引擎" defaultOpen={!nginx?.installed} badge={nginx?.installed ? okBadge : errBadge}>
            <div className="info-box">
              <div className="info-row">
                <span className="info-label">安装</span>
                <span className="info-val">
                  <span className={`ind ${nginx?.installed ? 'ind-ok' : 'ind-err'}`} />
                  {nginx?.installed ? `v${nginx.version}` : '未安装'}
                </span>
              </div>
              {nginx?.installed && (
                <div className="info-row">
                  <span className="info-label">运行</span>
                  <span className="info-val">
                    <span className={`ind ${nginx.running ? 'ind-ok' : 'ind-warn'}`} />
                    {nginx.running ? '运行中' : '已停止'}
                  </span>
                </div>
              )}
            </div>
            {!nginx?.installed && (
              <button className="btn btn-primary" onClick={onInstall} disabled={installing || !nginx?.canAutoInstall} style={{ width: '100%', marginTop: 8 }}>
                {installing ? <><span className="spin" /> 安装中…</> : <><Download size={14} /> {nginx?.canAutoInstall ? `通过 ${nginx.packageManager} 安装` : '需手动安装'}</>}
              </button>
            )}
          </Section>

          <div className="sep" />

          {/* SSL */}
          <Section label="SSL 证书" defaultOpen={!status?.certReady} badge={status?.certReady ? okBadge : errBadge}>
            <div className="up-grid">
              <label className={`up ${cf ? 'filled' : ''}`}>
                <input type="file" accept=".pem,.crt,.cer" onChange={e => setCf(e.target.files[0])} />
                <div className="up-text">{cf ? cf.name : '证书 .crt'}</div>
              </label>
              <label className={`up ${kf ? 'filled' : ''}`}>
                <input type="file" accept=".pem,.key" onChange={e => setKf(e.target.files[0])} />
                <div className="up-text">{kf ? kf.name : '私钥 .key'}</div>
              </label>
            </div>
            <button className="btn btn-secondary" onClick={uploadCert} disabled={uping || !cf || !kf} style={{ width: '100%', marginTop: 8 }}>
              {uping ? <><span className="spin" /> 上传中…</> : <><Shield size={14} /> 应用证书</>}
            </button>
          </Section>

          <div className="sep" />

          {/* Cloudflare */}
          <Section label="Cloudflare DNS" defaultOpen={!status?.cfTokenSet} badge={status?.cfTokenSet ? okBadge : errBadge}>
            {status?.cfTokenSet && (
              <div className="info-box" style={{ marginBottom: 12 }}>
                <div className="info-row">
                  <span className="info-label">API Token</span>
                  <span className="info-val">
                    <span className="ind ind-ok" />
                    已配置
                  </span>
                </div>
              </div>
            )}
            <div className="fg">
              <label className="fl">{status?.cfTokenSet ? '更新 Token' : 'API Token'}</label>
              <div className="cf-token-row">
                <div className="cf-token-input-wrap">
                  <Cloud size={16} className="cf-token-icon" />
                  <input
                    className="fi cf-token-input"
                    type="password"
                    placeholder={status?.cfTokenSet ? '输入新 Token 以覆盖' : '粘贴 Cloudflare API Token'}
                    value={cfToken}
                    onChange={e => setCfToken(e.target.value)}
                  />
                </div>
                <button className="btn btn-primary btn-sm" onClick={saveCfToken} disabled={savingToken || !cfToken.trim()}>
                  {savingToken ? <span className="spin" /> : '保存'}
                </button>
              </div>
              <div className="fh">添加站点时将自动创建 DNS A 记录解析至本机</div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

/* ── Add Modal ── */
function AddModal({ show, onClose, onDone, notify }) {
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [port, setPort] = useState('');
  const [busy, setBusy] = useState(false);
  if (!show) return null;

  const save = async () => {
    if (!name.trim() || !domain.trim() || !port.trim()) {
      notify({ type: 'error', message: '请填写完整信息' });
      return;
    }
    setBusy(true);
    try {
      const r = await authFetch(`${API}/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), domain: domain.trim(), port: port.trim() }),
      });
      const d = await r.json();
      if (r.ok) { notify({ type: 'success', message: d.message }); setName(''); setDomain(''); setPort(''); onDone(); onClose(); }
      else notify({ type: 'error', message: d.error });
    } catch (e) { notify({ type: 'error', message: '网络错误，请重试' }); }
    finally { setBusy(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dlg-head">
          <h2>新建站点</h2>
          <button className="dlg-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="dlg-body">
          <div className="fg">
            <label className="fl">站点名称</label>
            <input className="fi" placeholder="如：官网、后台" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">域名</label>
            <input className="fi" placeholder="如：www.example.com" value={domain} onChange={e => setDomain(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">本地端口</label>
            <input className="fi" type="number" min="1" max="65535" placeholder="3000" value={port} onChange={e => setPort(e.target.value)} />
          </div>
        </div>
        <div className="dlg-foot">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !name.trim() || !domain.trim() || !port.trim()}>
            {busy ? <><span className="spin" /> 部署中…</> : '添加'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Config Modal ── */
function ConfigModal({ site, onClose, notify }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(`${API}/sites/${encodeURIComponent(site.name)}/config`);
        const d = await r.json();
        if (r.ok) setContent(d.content);
        else notify({ type: 'error', message: d.error });
      } catch (e) { notify({ type: 'error', message: '加载失败' }); }
      finally { setLoading(false); }
    })();
  }, [site.name]);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const r = await authFetch(`${API}/sites/${encodeURIComponent(site.name)}/config`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const d = await r.json();
      notify({ type: r.ok ? 'success' : 'error', message: r.ok ? d.message : d.error });
      if (r.ok) onClose();
    } catch (e) { notify({ type: 'error', message: '保存失败' }); }
    finally { setSaving(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog dialog-wide" onClick={e => e.stopPropagation()}>
        <div className="dlg-head">
          <h2>{site.name} <span style={{ fontSize: '13px', color: 'var(--text-3)', fontWeight: 500, marginLeft: 8 }}>Nginx 配置</span></h2>
          <button className="dlg-x" onClick={onClose}><X size={18} strokeWidth={2} /></button>
        </div>
        <div className="dlg-body">
          <div className="config-editor-wrap">
            <div className="config-editor-header">
              <div className="mac-dots">
                <div className="mac-dot red"></div>
                <div className="mac-dot yellow"></div>
                <div className="mac-dot green"></div>
              </div>
              <span style={{ marginLeft: 8, display: 'flex', alignItems: 'center', gap: 6 }}><Terminal size={12} /> {site.name}.conf</span>
            </div>
            {loading ? (
              <div style={{ padding: 60, textAlign: 'center', color: '#9CA3AF' }}><span className="spin" style={{ borderColor: 'rgba(255,255,255,0.1)', borderTopColor: 'currentColor' }} /> 加载中…</div>
            ) : (
              <textarea
                className="config-editor"
                value={content}
                onChange={e => setContent(e.target.value)}
                spellCheck={false}
              />
            )}
          </div>
        </div>
        <div className="dlg-foot">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={saveConfig} disabled={saving || loading}>
            {saving ? <><span className="spin" /> 保存中…</> : '保存并生效'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Site Card ── */
const SiteCard = memo(function SiteCard({ site, onDel, onEdit }) {
  return (
    <div className="card">
      <div className="card-head">
        <div className="card-icon"><Globe size={24} strokeWidth={1.5} /></div>
        <div className="card-body">
          <div className="card-name">{site.name}</div>
          <div className="card-port">端口 {site.port}</div>
        </div>
      </div>
      <div className="card-domain">
        <a href={`https://${site.domain}`} target="_blank" rel="noopener noreferrer" className="card-link" onClick={e => e.stopPropagation()}>
          {site.domain} <ExternalLink size={11} />
        </a>
        <span className="card-port-tag">:{site.port}</span>
      </div>
      <div className="card-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => onEdit(site)} title="编辑配置">
          <FileCode size={16} strokeWidth={1.5} /> 编辑配置
        </button>
        <button className="btn btn-danger btn-sm" onClick={() => onDel(site.name)} title="删除" style={{ padding: '0 10px' }}>
          <Trash2 size={16} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
});

/* ── Dashboard (Main after login) ── */
function Dashboard({ onLogout }) {
  const [nginx, setNginx] = useState(null);
  const [chk, setChk] = useState(true);
  const [inst, setInst] = useState(false);
  const [status, setStatus] = useState(null);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [editSite, setEditSite] = useState(null);

  const loadNginx = useCallback(async () => {
    setChk(true);
    try { setNginx(await (await authFetch(`${API}/nginx-check`)).json()); } catch {}
    finally { setChk(false); }
  }, []);

  const loadStatus = useCallback(async () => {
    try { setStatus(await (await authFetch(`${API}/status`)).json()); } catch {}
  }, []);

  useEffect(() => { loadNginx(); loadStatus(); }, [loadNginx, loadStatus]);

  const doInstall = useCallback(async () => {
    setInst(true);
    try {
      const r = await authFetch(`${API}/nginx-install`, { method: 'POST' });
      const d = await r.json();
      setToast({ type: r.ok ? 'success' : 'error', message: r.ok ? d.message : d.error });
      if (r.ok) loadNginx();
    } catch (e) { setToast({ type: 'error', message: '安装失败，请重试' }); }
    finally { setInst(false); }
  }, [loadNginx]);

  const doDel = useCallback(async (n) => {
    if (!confirm(`确定删除站点「${n}」？`)) return;
    try {
      const r = await authFetch(`${API}/sites/${encodeURIComponent(n)}`, { method: 'DELETE' });
      const d = await r.json();
      setToast({ type: r.ok ? 'success' : 'error', message: r.ok ? d.message : d.error });
      if (r.ok) loadStatus();
    } catch (e) { setToast({ type: 'error', message: '操作失败，请重试' }); }
  }, [loadStatus]);

  const handleLogout = async () => {
    try { await authFetch(`${API}/auth/logout`, { method: 'POST' }); } catch {}
    clearToken();
    onLogout();
  };

  const sites = status?.sites || [];
  const list = q
    ? sites.filter(s =>
        s.name.toLowerCase().includes(q.toLowerCase()) ||
        s.domain?.toLowerCase().includes(q.toLowerCase()) ||
        s.port?.includes(q)
      )
    : sites;

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">Auto Nginx</span>
        <button className="nav-logout" onClick={handleLogout} title="退出登录">
          <LogOut size={16} strokeWidth={1.5} />
        </button>
      </nav>

      <main className="main">
        {/* Header: status strip inline with title */}
        <div className="page-header">
          <div className="page-header-left">
            <h1 className="page-title">站点管理</h1>
            <p className="page-desc">SSL 证书 · 域名解析 · Nginx 反代 · 一键部署</p>
          </div>
          <div className="strip" onClick={() => setModal('settings')} role="button" tabIndex={0}>
            <div className="strip-items">
              {chk ? (
                <div className="strip-item">
                  <span className="strip-val"><span className="spin" style={{ width: 10, height: 10 }} /> 检测中</span>
                </div>
              ) : (
                <>
                  <div className="strip-item">
                    <span className="strip-label">Nginx</span>
                    <span className="strip-val">
                      <span className={`ind ${nginx?.installed ? 'ind-ok' : 'ind-err'}`} />
                      {nginx?.installed ? (nginx.running ? '在线' : '已停止') : '未安装'}
                    </span>
                  </div>
                  <div className="strip-item">
                    <span className="strip-label">证书</span>
                    <span className="strip-val">
                      <span className={`ind ${status?.certReady ? 'ind-ok' : 'ind-err'}`} />
                      {status?.certReady ? '就绪' : '未上传'}
                    </span>
                  </div>
                  <div className="strip-item">
                    <span className="strip-label">DNS</span>
                    <span className="strip-val">
                      <span className={`ind ${status?.cfTokenSet ? 'ind-ok' : 'ind-warn'}`} />
                      {status?.cfTokenSet ? '已配置' : '未配置'}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="strip-cta"><Settings size={13} /> 设置 <ChevronRight size={13} /></div>
          </div>
        </div>

        {/* Action Row */}
        <div className="action-row">
          <div className="search-box">
            <Search size={16} />
            <input className="search-field" placeholder="搜索站点…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => setModal('add')}><Plus size={16} /> 新建</button>
        </div>

        {/* Grid */}
        <div className="grid">
          {list.length === 0 ? (
            <div className="empty" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-icon"><Server size={24} /></div>
              <div className="empty-title">{sites.length === 0 ? '尚无站点' : '没有匹配结果'}</div>
              <div className="empty-desc">
                {sites.length === 0 ? '点击「新建」添加你的第一个站点。' : '试试其他关键词。'}
              </div>
            </div>
          ) : (
            list.map(s => <SiteCard key={s.name} site={s} onDel={doDel} onEdit={setEditSite} />)
          )}
        </div>
      </main>

      {modal === 'settings' && (
        <SettingsModal show onClose={() => setModal(null)} nginx={nginx} onInstall={doInstall} installing={inst} status={status} notify={setToast} onRefresh={loadStatus} />
      )}
      {modal === 'add' && (
        <AddModal show onClose={() => setModal(null)} onDone={loadStatus} notify={setToast} />
      )}
      {editSite && (
        <ConfigModal site={editSite} onClose={() => setEditSite(null)} notify={setToast} />
      )}
      <Toast data={toast} onClose={() => setToast(null)} />
    </>
  );
}

/* ── App ── */
export default function App() {
  const [authed, setAuthed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    (async () => {
      const token = getToken();
      if (!token) { setChecking(false); return; }
      try {
        const r = await fetch(`${API}/auth/check`, { headers: { Authorization: `Bearer ${token}` } });
        const d = await r.json();
        if (d.authenticated) setAuthed(true);
        else clearToken();
      } catch {}
      setChecking(false);
    })();
  }, []);

  if (checking) {
    return (
      <div className="login-screen">
        <div className="spin" style={{ width: 24, height: 24 }} />
      </div>
    );
  }

  if (!authed) {
    return <LoginScreen onLogin={() => setAuthed(true)} toast={toast} setToast={setToast} />;
  }

  return <Dashboard onLogout={() => setAuthed(false)} />;
}
