import { useState, useEffect, useCallback } from 'react';
import {
  Server, Settings, Check, X, Globe, Plus, Trash2,
  Rocket, Shield, ChevronRight, Search, Download, Lock
} from 'lucide-react';

const API = '/api';

/* ── Toast ── */
function Toast({ data, onClose }) {
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
}

/* ── Settings Modal ── */
function SettingsModal({ show, onClose, nginx, onInstall, installing, status, notify, onRefresh }) {
  const [cf, setCf] = useState(null);
  const [kf, setKf] = useState(null);
  const [uping, setUping] = useState(false);

  if (!show) return null;

  const uploadCert = async () => {
    if (!cf || !kf) return;
    setUping(true);
    try {
      const fd = new FormData();
      fd.append('fullchain', cf);
      fd.append('privkey', kf);
      const r = await fetch(`${API}/certificate`, { method: 'POST', body: fd });
      const d = await r.json();
      if (r.ok) { notify({ type: 'success', message: d.message }); setCf(null); setKf(null); onRefresh(); }
      else notify({ type: 'error', message: d.error });
    } catch (e) { notify({ type: 'error', message: e.message }); }
    finally { setUping(false); }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="dialog" onClick={e => e.stopPropagation()}>
        <div className="dlg-head">
          <h2>环境设置</h2>
          <button className="dlg-x" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="dlg-body">
          {/* Nginx */}
          <div className="fg">
            <span className="sec-label">Nginx 引擎</span>
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
              <button className="btn btn-primary" onClick={onInstall} disabled={installing || !nginx?.canAutoInstall} style={{ width: '100%' }}>
                {installing ? <><span className="spin" /> 安装中…</> : <><Download size={14} /> {nginx?.canAutoInstall ? `通过 ${nginx.packageManager} 安装` : '需手动安装'}</>}
              </button>
            )}
          </div>

          <div className="sep" />

          {/* SSL */}
          <div className="fg">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="sec-label">SSL 证书</span>
              {status?.certReady && (
                <span style={{ fontSize: '0.72rem', color: 'var(--ok)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Lock size={10} /> 已配置
                </span>
              )}
            </div>
            <div className="up-grid">
              <label className={`up ${cf ? 'filled' : ''}`}>
                <input type="file" accept=".pem,.crt,.cer" onChange={e => setCf(e.target.files[0])} />
                <div className="up-text">{cf ? cf.name : '证书文件 .crt'}</div>
              </label>
              <label className={`up ${kf ? 'filled' : ''}`}>
                <input type="file" accept=".pem,.key" onChange={e => setKf(e.target.files[0])} />
                <div className="up-text">{kf ? kf.name : '私钥文件 .key'}</div>
              </label>
            </div>
            <button className="btn btn-secondary" onClick={uploadCert} disabled={uping || !cf || !kf} style={{ width: '100%' }}>
              {uping ? <><span className="spin" /> 上传中…</> : <><Shield size={14} /> 应用证书</>}
            </button>
          </div>
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
      const r = await fetch(`${API}/sites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), domain: domain.trim(), port: port.trim() }),
      });
      const d = await r.json();
      if (r.ok) { notify({ type: 'success', message: d.message }); setName(''); setDomain(''); setPort(''); onDone(); onClose(); }
      else notify({ type: 'error', message: d.error });
    } catch (e) { notify({ type: 'error', message: e.message }); }
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
            <input className="fi" placeholder="如：官网、后台API" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="fg">
            <label className="fl">域名</label>
            <input className="fi" placeholder="如：www.example.com" value={domain} onChange={e => setDomain(e.target.value)} />
            <div className="fh">使用已上传证书对应的域名或子域名</div>
          </div>
          <div className="fg">
            <label className="fl">本地端口</label>
            <input className="fi" type="number" min="1" max="65535" placeholder="3000" value={port} onChange={e => setPort(e.target.value)} />
            <div className="fh">代理至 127.0.0.1:{port || '…'}</div>
          </div>
        </div>
        <div className="dlg-foot">
          <button className="btn btn-ghost" onClick={onClose}>取消</button>
          <button className="btn btn-primary" onClick={save} disabled={busy || !name.trim() || !domain.trim() || !port.trim()}>
            {busy ? <span className="spin" /> : '添加'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── App ── */
export default function App() {
  const [nginx, setNginx] = useState(null);
  const [chk, setChk] = useState(true);
  const [inst, setInst] = useState(false);
  const [status, setStatus] = useState(null);
  const [q, setQ] = useState('');
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [dep, setDep] = useState(false);

  const loadNginx = useCallback(async () => {
    setChk(true);
    try { setNginx(await (await fetch(`${API}/nginx-check`)).json()); } catch {}
    finally { setChk(false); }
  }, []);

  const loadStatus = useCallback(async () => {
    try { setStatus(await (await fetch(`${API}/status`)).json()); } catch {}
  }, []);

  useEffect(() => { loadNginx(); loadStatus(); }, [loadNginx, loadStatus]);

  const doInstall = async () => {
    setInst(true);
    try {
      const r = await fetch(`${API}/nginx-install`, { method: 'POST' });
      const d = await r.json();
      setToast({ type: r.ok ? 'success' : 'error', message: r.ok ? d.message : d.error });
      if (r.ok) loadNginx();
    } catch (e) { setToast({ type: 'error', message: e.message }); }
    finally { setInst(false); }
  };

  const doDeploy = async () => {
    setDep(true);
    try {
      const r = await fetch(`${API}/deploy`, { method: 'POST' });
      const d = await r.json();
      setToast({ type: r.ok ? 'success' : 'error', message: r.ok ? d.message : d.error });
      if (r.ok) loadStatus();
    } catch (e) { setToast({ type: 'error', message: e.message }); }
    finally { setDep(false); }
  };

  const doDel = async (n) => {
    if (!confirm(`确定删除站点「${n}」？`)) return;
    try {
      const r = await fetch(`${API}/sites/${encodeURIComponent(n)}`, { method: 'DELETE' });
      const d = await r.json();
      setToast({ type: r.ok ? 'success' : 'error', message: r.ok ? d.message : d.error });
      if (r.ok) loadStatus();
    } catch (e) { setToast({ type: 'error', message: e.message }); }
  };

  const sites = status?.sites || [];
  const list = sites.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.domain?.toLowerCase().includes(q.toLowerCase()) ||
    s.port?.includes(q)
  );

  return (
    <>
      <nav className="nav">
        <span className="nav-brand">Auto Nginx</span>
      </nav>

      <main className="main">
        <h1 className="page-title">HTTPS 部署管理</h1>
        <p className="page-desc">上传 SSL 证书，配置站点域名与端口，一键发布至 Nginx。</p>

        {/* Status Strip */}
        <div className="strip" onClick={() => setModal('settings')} role="button" tabIndex={0}>
          <div className="strip-items">
            {chk ? (
              <div className="strip-item">
                <span className="strip-label">状态</span>
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
                {status?.deployed && (
                  <div className="strip-item">
                    <span className="strip-label">部署</span>
                    <span className="strip-val"><span className="ind ind-ok" /> 已生效</span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="strip-cta"><Settings size={13} /> 设置 <ChevronRight size={13} /></div>
        </div>

        {/* Section Head */}
        <div className="section-head">
          <span className="section-title">站点列表</span>
        </div>

        {/* Action Row */}
        <div className="action-row">
          <div className="search-box">
            <Search size={16} />
            <input className="search-field" placeholder="搜索站点…" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <button className="btn btn-secondary" onClick={() => setModal('add')}><Plus size={16} /> 新建</button>
          <button className="btn btn-primary" onClick={doDeploy} disabled={dep || !status?.certReady || !sites.length}>
            {dep ? <><span className="spin" /> 发布中</> : <><Rocket size={16} /> 发布</>}
          </button>
        </div>

        {/* Grid */}
        <div className="grid">
          {list.length === 0 ? (
            <div className="empty" style={{ gridColumn: '1 / -1' }}>
              <div className="empty-icon"><Server size={24} /></div>
              <div className="empty-title">{sites.length === 0 ? '尚无站点' : '没有匹配结果'}</div>
              <div className="empty-desc">
                {sites.length === 0 ? '新建站点，配置域名和端口即可快速部署 HTTPS 服务。' : '试试其他关键词。'}
              </div>
            </div>
          ) : (
            list.map(s => (
              <div key={s.name} className="card">
                <div className="card-icon"><Globe size={20} /></div>
                <div className="card-body">
                  <div className="card-name">{s.name}</div>
                  <div className="card-sub">{s.domain} → :{s.port}</div>
                </div>
                <div className="card-actions">
                  <button className="btn btn-danger btn-sm" onClick={() => doDel(s.name)}>
                    <Trash2 size={14} /> 删除
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      {/* Modals */}
      {modal === 'settings' && (
        <SettingsModal show onClose={() => setModal(null)} nginx={nginx} onInstall={doInstall} installing={inst} status={status} notify={setToast} onRefresh={loadStatus} />
      )}
      {modal === 'add' && (
        <AddModal show onClose={() => setModal(null)} onDone={loadStatus} notify={setToast} />
      )}
      <Toast data={toast} onClose={() => setToast(null)} />
    </>
  );
}
