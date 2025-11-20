import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuid } from 'uuid';

type Tab = 'profiles' | 'ini' | 'overrides' | 'clusters' | 'shutdown' | 'curseforge';

export function ServersPanel(){
  // Local state for servers, clusters, current tab, and selection
  const [servers, setServers] = useState<any[]>([]);
  const [clusters, setClusters] = useState<any[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [tab, setTab] = useState<Tab>('profiles');
  const refresh = async () => {
    const s = await window.api.profiles.list();
    setServers(s.servers); setClusters(s.clusters);
    if (!selectedServerId && s.servers.length) setSelectedServerId(s.servers[0].id);
  };

  useEffect(() => { refresh(); }, []);

  const selectedServer = useMemo(() => servers.find(x=>x.id===selectedServerId), [servers, selectedServerId]);

  return (
    <section className="panel">
      <h2 className="panel-title" style={{ marginTop:0 }}>Servers</h2>
      <div style={{ margin: '10px 0', display: 'flex', gap: 8 }}>
        <TabBtn id="profiles" label="Profiles" tab={tab} setTab={setTab} />
        <TabBtn id="ini" label="INI Editor" tab={tab} setTab={setTab} />
        <TabBtn id="overrides" label="INI Overrides" tab={tab} setTab={setTab} />
        <TabBtn id="clusters" label="Clusters" tab={tab} setTab={setTab} />
        <TabBtn id="shutdown" label="Shutdown" tab={tab} setTab={setTab} />
        <TabBtn id="curseforge" label="CurseForge Mods" tab={tab} setTab={setTab} />
      </div>

      {tab === 'profiles' && (
        <ProfilesSubpanel onChanged={refresh} servers={servers} clusters={clusters} />
      )}
      {tab === 'ini' && (
        <IniEditorSubpanel servers={servers} selectedServerId={selectedServerId} onSelect={setSelectedServerId} />
      )}
      {tab === 'overrides' && (
        <IniOverridesSubpanel servers={servers} selectedServerId={selectedServerId} onSelect={setSelectedServerId} onChanged={refresh} />
      )}
      {tab === 'clusters' && (
        <ClustersSubpanel servers={servers} clusters={clusters} onChanged={refresh} />
      )}
      {tab === 'shutdown' && (
        <ShutdownSubpanel servers={servers} selectedServerId={selectedServerId} />
      )}
      {tab === 'curseforge' && (
        <CurseForgeModsSubpanel servers={servers} />
      )}
    </section>
  );
}

function TabBtn({ id, label, tab, setTab }: { id: Tab; label: string; tab: Tab; setTab: (t: Tab)=>void }) {
  const active = tab === id;
  return (
    <button onClick={()=>setTab(id)} className={active ? 'btn-primary' : ''} style={{ minWidth:90 }}>{label}</button>
  );
}

function ShutdownSubpanel({ servers, selectedServerId }: { servers:any[]; selectedServerId:string }){
  const srv = servers.find(s=>s.id===selectedServerId);
  const [host, setHost] = useState(srv?.rconHost || '127.0.0.1');
  const [port, setPort] = useState(srv?.rconPort || 27020);
  const [password, setPassword] = useState(srv?.rconPassword || '');
  const [adminPassword, setAdminPassword] = useState(srv?.adminPassword || '');
  const [seconds, setSeconds] = useState(600);
  const [status, setStatus] = useState('');
  const [wipeStatus, setWipeStatus] = useState('');
  const [pingStatus, setPingStatus] = useState('');
  const [batch, setBatch] = useState('SaveWorld\nDestroyWildDinos');
  const [batchResult, setBatchResult] = useState('');

  const start = async () => {
    if (!password) { alert('Enter RCON password'); return; }
    try {
      const res = await window.api.rcon.shutdownCountdown(host, Number(port), password, Number(seconds));
      setStatus(`Scheduled shutdown in ${res.totalSeconds} seconds`);
      setTimeout(() => setStatus(''), 4000);
    } catch (e: any) {
      alert(`Failed: ${e?.message || e}`);
    }
  };

  const wipeDinos = async () => {
    if (!password) { alert('Enter RCON password'); return; }
    if (!confirm('Wipe all wild dinos now? They will respawn over time.')) return;
    try {
      await window.api.rcon.wildDinoWipe(host, Number(port), password);
      setWipeStatus('Wild dino wipe command sent');
      setTimeout(()=>setWipeStatus(''), 4000);
    } catch (e: any) {
      alert(`Wipe failed: ${e?.message || e}`);
    }
  };
  const ping = async () => {
    if (!password) { alert('Enter RCON password'); return; }
    setPingStatus('Pinging...');
    try {
      const res = await window.api.rcon.ping(host, Number(port), password);
      setPingStatus(res.ok ? 'Ping OK' : 'Ping Failed');
    } catch (e: any) {
      setPingStatus('Ping error');
    }
    setTimeout(()=>setPingStatus(''), 3000);
  };
  const runBatch = async () => {
    if (!password) { alert('Enter RCON password'); return; }
    const cmds = batch.split(/\r?\n/).map(c=>c.trim()).filter(Boolean);
    if (!cmds.length) { alert('No commands'); return; }
    if (!confirm(`Execute ${cmds.length} command(s)?`)) return;
    let out: string[] = [];
    for (const c of cmds) {
      try {
        const r = await window.api.rcon.exec(host, Number(port), password, c);
        out.push(`${c} => ${r.ok ? 'OK' : 'ERR'}${r.output ? ' output:' + r.output : ''}`);
      } catch (e: any) {
        out.push(`${c} => ERR ${String(e?.message||e)}`);
      }
    }
    setBatchResult(out.join('\n'));
  };

  useEffect(()=>{
    const s = servers.find(x=>x.id===selectedServerId);
    if (s) {
      setHost(s.rconHost || '127.0.0.1');
      setPort(s.rconPort || 27020);
      setPassword(s.rconPassword || '');
      setAdminPassword(s.adminPassword || '');
    }
  }, [selectedServerId, servers]);

  const saveConn = async () => {
    if (!srv) return;
    await window.api.profiles.upsertServer({ ...srv, rconHost: host, rconPort: port, rconPassword: password, adminPassword });
    alert('Connection info saved');
  };
  const applyAdminPw = async () => {
    if (!srv) { alert('No server selected'); return; }
    if (!adminPassword) { alert('Set admin password first'); return; }
    try { await window.api.profiles.applyAdminPassword(srv.id); alert('Admin password applied to GameUserSettings.ini'); } catch(e:any){ alert('Apply failed: ' + String(e?.message||e)); }
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: 8 };

  return (
    <div style={{ display:'grid', gap:10, maxWidth: 600 }}>
      <div>
        <label>Host
          <input style={inputStyle} value={host} onChange={e=>setHost(e.target.value)} />
        </label>
      </div>
      <div>
        <label>RCON Port
          <input style={inputStyle} type="number" value={port} onChange={e=>setPort(Number(e.target.value)||27020)} />
        </label>
      </div>
      <div>
        <label>Password
          <input style={inputStyle} type="password" value={password} onChange={e=>setPassword(e.target.value)} />
        </label>
      </div>
      <div>
        <label>Admin Password
          <input style={inputStyle} type="password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} />
        </label>
      </div>
      <div>
        <label>Countdown (seconds)
          <input style={inputStyle} type="number" value={seconds} onChange={e=>setSeconds(Number(e.target.value)||600)} />
        </label>
      </div>
      <div>
        <button onClick={start}>Start Shutdown Countdown</button>
        <span style={{ marginLeft:8, opacity:0.8 }}>{status}</span>
      </div>
      <div style={{ fontSize:12, opacity:0.8 }}>
        Tip: Ensure RCON is enabled in GameUserSettings.ini (ServerSettings): RCONEnabled=True, RCONPort matches, and set RCONPassword.
      </div>
      <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
        <button onClick={saveConn}>Save Connection Info</button>
        <button onClick={applyAdminPw} disabled={!adminPassword}>Apply Admin Password</button>
      </div>
      <fieldset style={{ border:'1px solid var(--border)', padding:10 }}>
        <legend style={{ padding:'0 6px', fontSize:12 }}>RCON Utilities</legend>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button onClick={wipeDinos}>Wild Dino Wipe</button>
          <button onClick={ping}>Ping RCON</button>
          <button onClick={runBatch}>Run Batch</button>
          <button onClick={()=>{ setBatch('SaveWorld\nDestroyWildDinos'); }}>Preset Save+Wipe</button>
          <button onClick={()=>{ setBatch('SaveWorld\nDoRestartLevel'); }}>Preset Save+Restart</button>
          <button onClick={()=>{ setBatch(''); setBatchResult(''); }}>Clear Batch</button>
        </div>
        <textarea style={{ width:'100%', minHeight:100, fontFamily:'monospace', fontSize:12, marginTop:8 }} value={batch} onChange={e=>setBatch(e.target.value)} />
        {batchResult && <pre style={{ marginTop:8, background:'#111', padding:8, maxHeight:160, overflow:'auto', fontSize:11 }}>{batchResult}</pre>}
        <div style={{ fontSize:11, opacity:.7, marginTop:4 }}>Results shown inline. Batch executes sequentially.</div>
        <div style={{ marginTop:6, fontSize:11 }}>
          <span style={{ marginRight:12 }}>Wipe: {wipeStatus}</span>
          <span style={{ marginRight:12 }}>Ping: {pingStatus}</span>
        </div>
      </fieldset>
    </div>
  );
}

function ProfilesSubpanel({ servers, clusters, onChanged }: { servers:any[]; clusters:any[]; onChanged: ()=>void }){
  const [name, setName] = useState('');
  const [installDir, setInstallDir] = useState('servers/asa');
  const [map, setMap] = useState('TheIsland_WP');
  const [appId, setAppId] = useState(2430930);
  // New persisted connection fields
  const [rconHost, setRconHost] = useState('');
  const [rconPort, setRconPort] = useState(27020);
  const [rconPassword, setRconPassword] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  const addOrSave = async () => {
    if (!name) { alert('Enter a server name'); return; }
    const settings = await window.api.settings.get();
    const absInstall = (settings.workspaceRoot.replace(/\\/g,'/') + '/' + installDir).replace(/\\/g,'/');
    const id = editingId || uuid();
    await window.api.profiles.upsertServer({ id, name, installDir: absInstall, appId, map, mods: editingId ? (servers.find(s=>s.id===editingId)?.mods || []) : [], rconHost, rconPort, rconPassword, adminPassword });
    setName(''); setInstallDir('servers/asa'); setMap('TheIsland_WP'); setAppId(2430930);
    setRconHost(''); setRconPort(27020); setRconPassword(''); setAdminPassword(''); setEditingId(null);
    await onChanged();
  };
  const del = async (id: string) => { await window.api.profiles.deleteServer(id); await onChanged(); };
  const beginEdit = (s:any) => {
    setEditingId(s.id); setName(s.name); setInstallDir(s.installDir); setMap(s.map); setAppId(s.appId||2430930);
    setRconHost(s.rconHost||''); setRconPort(s.rconPort||27020); setRconPassword(s.rconPassword||''); setAdminPassword(s.adminPassword||'');
  };
  const cancelEdit = () => { setEditingId(null); setName(''); setInstallDir('servers/asa'); setMap('TheIsland_WP'); setAppId(2430930); setRconHost(''); setRconPort(27020); setRconPassword(''); setAdminPassword(''); };

  return (
    <div>
      <div style={{ display:'grid', gap:8, maxWidth:800 }}>
        <label>Name<input style={{ width:'100%' }} value={name} onChange={e=>setName(e.target.value)} /></label>
        <label>Install Dir (relative to workspace)<input style={{ width:'100%' }} value={installDir} onChange={e=>setInstallDir(e.target.value)} /></label>
        <label>Map<input style={{ width:'100%' }} value={map} onChange={e=>setMap(e.target.value)} /></label>
        <label>App ID<input style={{ width:'100%' }} value={appId} onChange={e=>setAppId(Number(e.target.value)||2430930)} /></label>
        <label>RCON Host/IP<input style={{ width:'100%' }} value={rconHost} placeholder="e.g. 123.45.67.89" onChange={e=>setRconHost(e.target.value)} /></label>
        <label>RCON Port<input style={{ width:'100%' }} type="number" value={rconPort} onChange={e=>setRconPort(Number(e.target.value)||27020)} /></label>
        <label>RCON Password<input style={{ width:'100%' }} type="password" value={rconPassword} onChange={e=>setRconPassword(e.target.value)} /></label>
        <label>Admin Password<input style={{ width:'100%' }} type="password" value={adminPassword} onChange={e=>setAdminPassword(e.target.value)} placeholder="In-game admin password" /></label>
        <button onClick={addOrSave}>{editingId ? 'Save Changes' : 'Add Server'}</button>
        {editingId && <button onClick={cancelEdit} style={{ marginLeft:8 }}>Cancel</button>}
      </div>
      <h3>Existing</h3>
      <ul>
        {servers.map((s)=> (
          <li key={s.id}>
            <strong>{s.name}</strong> — {s.installDir}
            {s.rconHost && <span style={{ marginLeft:8, fontSize:11, opacity:.7 }}>RCON: {s.rconHost}:{s.rconPort || 27020}</span>}
            {s.adminPassword && <span style={{ marginLeft:8, fontSize:11, opacity:.5 }}>Admin PW set</span>}
            <button style={{ marginLeft:8 }} onClick={()=>del(s.id)}>Delete</button>
            <button style={{ marginLeft:4 }} onClick={()=>beginEdit(s)}>Edit</button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function IniEditorSubpanel({ servers, selectedServerId, onSelect }: { servers:any[]; selectedServerId:string; onSelect:(id:string)=>void }){
  const [gus, setGus] = useState('');
  const [game, setGame] = useState('');
  const [message, setMessage] = useState('');
  const [overrides, setOverrides] = useState<any[]>([]);
  const [ovMsg, setOvMsg] = useState('');

  const load = async (server:any) => {
    if (!server) return;
    const rootPath = server.installDir.replace(/\\/g,'/');
    const gusPath = `${rootPath}/ShooterGame/Saved/Config/WindowsServer/GameUserSettings.ini`;
    const gamePath = `${rootPath}/ShooterGame/Saved/Config/WindowsServer/Game.ini`;
    setGus(await window.api.ini.readText(gusPath));
    setGame(await window.api.ini.readText(gamePath));
    setOverrides(Array.isArray(server.customIniOverrides) ? server.customIniOverrides.slice() : []);
  };

  useEffect(()=>{
    const s = servers.find(x=>x.id===selectedServerId);
    load(s);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedServerId, servers.length]);

  const save = async () => {
    const s = servers.find(x=>x.id===selectedServerId);
    if (!s) return;
    const rootPath = s.installDir.replace(/\\/g,'/');
    const gusPath = `${rootPath}/ShooterGame/Saved/Config/WindowsServer/GameUserSettings.ini`;
    const gamePath = `${rootPath}/ShooterGame/Saved/Config/WindowsServer/Game.ini`;
    await window.api.ini.writeText(gusPath, gus);
    await window.api.ini.writeText(gamePath, game);
    setMessage('Saved'); setTimeout(()=>setMessage(''), 1500);
  };

  const addOverride = () => {
    setOverrides(o=>[...o, { id: uuid(), target: 'GameUserSettings.ini', content: '# Example override\nSetting=Value', enabled: true }]);
  };
  const updateOverride = (id:string, patch:any) => {
    setOverrides(o=>o.map(x=> x.id===id ? { ...x, ...patch } : x));
  };
  const removeOverride = (id:string) => { setOverrides(o=>o.filter(x=>x.id!==id)); };
  const saveOverrides = async () => {
    const s = servers.find(x=>x.id===selectedServerId);
    if (!s) return;
    await window.api.profiles.upsertServer({ ...s, customIniOverrides: overrides });
    setOvMsg('Overrides saved'); setTimeout(()=>setOvMsg(''),1500);
  };
  const applyOverrides = async () => {
    const s = servers.find(x=>x.id===selectedServerId); if(!s) return;
    await window.api.ini.applyOverrides(s.id);
    setOvMsg('Applied to disk'); setTimeout(()=>setOvMsg(''),1500);
  };

  return (
    <div style={{ display:'grid', gap:10 }}>
      <label>Server
        <select value={selectedServerId} onChange={(e)=>onSelect(e.target.value)}>
          {servers.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
        <div>
          <h4>GameUserSettings.ini</h4>
          <textarea style={{ width:'100%', height: 300 }} value={gus} onChange={e=>setGus(e.target.value)} />
        </div>
        <div>
          <h4>Game.ini</h4>
          <textarea style={{ width:'100%', height: 300 }} value={game} onChange={e=>setGame(e.target.value)} />
        </div>
      </div>
      <div>
        <button onClick={save}>Save Both</button>
        <span style={{ marginLeft:8, opacity:0.7 }}>{message}</span>
      </div>
      <fieldset style={{ border:'1px solid var(--border)', padding:10, borderRadius:'var(--radius)' }}>
        <legend style={{ padding:'0 6px', fontSize:12 }}>Custom INI Overrides</legend>
        <p style={{ fontSize:12, opacity:0.8 }}>Appends override blocks with markers to selected INI files during Apply or Auto Update. Use to lift engine/server limits or enforce values post-update.</p>
        {overrides.map(ov => (
          <div key={ov.id} style={{ border:'1px solid #333', padding:8, marginBottom:8, borderRadius:4 }}>
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:4 }}>
              <select value={ov.target} onChange={e=>updateOverride(ov.id,{ target: e.target.value })}>
                <option>GameUserSettings.ini</option>
                <option>Game.ini</option>
                <option>Engine.ini</option>
              </select>
              <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12 }}>
                <input type="checkbox" checked={ov.enabled} onChange={e=>updateOverride(ov.id,{ enabled: e.target.checked })} /> Enabled
              </label>
              <button style={{ fontSize:11 }} onClick={()=>removeOverride(ov.id)}>Remove</button>
            </div>
            <textarea style={{ width:'100%', minHeight:120, fontFamily:'monospace', fontSize:12 }} value={ov.content} onChange={e=>updateOverride(ov.id,{ content: e.target.value })} />
            <small style={{ opacity:0.7 }}>Override ID: {ov.id}</small>
          </div>
        ))}
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={addOverride}>Add Override</button>
          <button onClick={saveOverrides} disabled={!overrides.length}>Save Overrides</button>
          <button onClick={applyOverrides} disabled={!overrides.some(o=>o.enabled)}>Apply Now</button>
          <span style={{ marginLeft:8, opacity:0.7 }}>{ovMsg}</span>
        </div>
      </fieldset>
    </div>
  );
}

function IniOverridesSubpanel({ servers, selectedServerId, onSelect, onChanged }: { servers:any[]; selectedServerId:string; onSelect:(id:string)=>void; onChanged: ()=>void }) {
  const [list, setList] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<string|null>(null);
  const [target, setTarget] = useState('GameUserSettings.ini');
  const [content, setContent] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [msg, setMsg] = useState('');

  const load = async () => {
    const s = servers.find(x=>x.id===selectedServerId);
    if (!s) return;
    setList(s.customIniOverrides || []);
  };
  useEffect(()=>{ load(); /* eslint-disable-next-line */ }, [selectedServerId, servers.length]);

  const resetForm = () => { setEditingId(null); setTarget('GameUserSettings.ini'); setContent(''); setEnabled(true); };

  const edit = (ov:any) => { setEditingId(ov.id); setTarget(ov.target); setContent(ov.content); setEnabled(!!ov.enabled); };
  const remove = async (id:string) => {
    const s = servers.find(x=>x.id===selectedServerId); if(!s) return;
    const next = (s.customIniOverrides||[]).filter((o:any)=>o.id!==id);
    await window.api.profiles.setIniOverrides(s.id, next);
    setMsg('Removed'); setTimeout(()=>setMsg(''),1200);
    await onChanged(); load();
    if (editingId === id) resetForm();
  };
  const saveBlock = async () => {
    const s = servers.find(x=>x.id===selectedServerId); if(!s) return;
    const existing = s.customIniOverrides || [];
    let next;
    if (editingId) {
      next = existing.map((o:any)=> o.id===editingId ? { ...o, target, content, enabled } : o);
    } else {
      const id = uuid();
      next = [...existing, { id, target, content, enabled }];
    }
    await window.api.profiles.setIniOverrides(s.id, next);
    setMsg(editingId ? 'Updated' : 'Added'); setTimeout(()=>setMsg(''),1200);
    await onChanged(); load();
    resetForm();
  };
  const toggle = async (ov:any) => {
    const s = servers.find(x=>x.id===selectedServerId); if(!s) return;
    const next = (s.customIniOverrides||[]).map((o:any)=> o.id===ov.id ? { ...o, enabled: !o.enabled } : o);
    await window.api.profiles.setIniOverrides(s.id, next); setList(next);
  };
  const applyNow = async () => {
    if (!confirm('Apply all enabled overrides to target INI files now? This will modify files on disk.')) return;
    await window.api.ini.applyOverrides(selectedServerId);
    setMsg('Applied'); setTimeout(()=>setMsg(''),1200);
  };
  const verifyPersist = async () => {
    const s = (await window.api.profiles.list()).servers.find((x:any)=>x.id===selectedServerId);
    if (s && Array.isArray(s.customIniOverrides) && s.customIniOverrides.length === list.length) {
      setMsg('Persistence OK');
    } else {
      setMsg('Persistence mismatch');
    }
    setTimeout(()=>setMsg(''),1500);
  };
  const exportJson = () => {
    const json = JSON.stringify(list, null, 2);
    try { navigator.clipboard.writeText(json); setMsg('Copied JSON'); setTimeout(()=>setMsg(''),1200); } catch { setMsg('Clipboard failed'); setTimeout(()=>setMsg(''),1200); }
  };
  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(list, null, 2)], { type:'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ini-overrides.json'; a.click();
    setTimeout(()=>URL.revokeObjectURL(url), 2000);
  };
  const importJson = async () => {
    const raw = prompt('Paste overrides JSON (array of blocks):');
    if (!raw) return;
    try {
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) throw new Error('Expected array');
      const s = servers.find(x=>x.id===selectedServerId); if(!s) return;
      // Validate shape
      const cleaned = arr.filter((o:any)=> o && typeof o.target==='string' && typeof o.content==='string').map((o:any)=> ({
        id: o.id && typeof o.id==='string' ? o.id : uuid(),
        target: o.target,
        content: o.content,
        enabled: o.enabled !== false
      }));
      await window.api.profiles.setIniOverrides(s.id, cleaned);
      setMsg('Imported'); setTimeout(()=>setMsg(''),1200);
      await onChanged(); load();
    } catch (e:any) {
      alert('Import failed: ' + String(e?.message||e));
    }
  };

  return (
    <div style={{ display:'grid', gap:12 }}>
      <label>Server
        <select value={selectedServerId} onChange={(e)=>onSelect(e.target.value)}>
          {servers.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <div style={{ display:'grid', gap:8, maxWidth:900 }}>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
          <select value={target} onChange={e=>setTarget(e.target.value)}>
            <option>GameUserSettings.ini</option>
            <option>Game.ini</option>
            <option>Engine.ini</option>
          </select>
          <label style={{ display:'flex', alignItems:'center', gap:6 }}><input type='checkbox' checked={enabled} onChange={e=>setEnabled(e.target.checked)} /> Enabled</label>
          <button onClick={saveBlock}>{editingId ? 'Update Block' : 'Add Block'}</button>
          {editingId && <button onClick={resetForm}>Cancel Edit</button>}
          <button onClick={applyNow}>Apply Enabled Overrides Now</button>
          <button onClick={verifyPersist}>Verify Persistence</button>
          <button onClick={exportJson}>Copy JSON</button>
          <button onClick={downloadJson}>Download JSON</button>
          <button onClick={importJson}>Import JSON</button>
          <span style={{ opacity:0.7 }}>{msg}</span>
        </div>
        <textarea style={{ width:'100%', minHeight:160, fontFamily:'monospace' }} placeholder='Override content (raw INI lines)' value={content} onChange={e=>setContent(e.target.value)} />
      </div>
      <div>
        <h4>Existing Overrides</h4>
        {!list.length && <div style={{ fontSize:12, opacity:0.7 }}>None yet.</div>}
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ textAlign:'left' }}>
              <th style={{ padding:4 }}>Target</th>
              <th style={{ padding:4 }}>Enabled</th>
              <th style={{ padding:4 }}>Preview</th>
              <th style={{ padding:4 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {list.map(ov => (
              <tr key={ov.id} style={{ borderTop:'1px solid var(--border)' }}>
                <td style={{ padding:4 }}>{ov.target}</td>
                <td style={{ padding:4 }}><input type='checkbox' checked={!!ov.enabled} onChange={()=>toggle(ov)} /></td>
                <td style={{ padding:4, fontSize:11, maxWidth:300, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{String(ov.content).split(/\r?\n/)[0]}</td>
                <td style={{ padding:4 }}>
                  <button onClick={()=>edit(ov)}>Edit</button>
                  <button style={{ marginLeft:6 }} onClick={()=>remove(ov.id)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <small style={{ fontSize:11, opacity:0.7, display:'block', marginTop:6 }}>Apply writes blocks delimited by BEGIN/END markers; re-applying replaces previous block content.</small>
      </div>
    </div>
  );
}

function ClustersSubpanel({ servers, clusters, onChanged }:{ servers:any[]; clusters:any[]; onChanged: ()=>void }){
  const [name, setName] = useState('');
  const addCluster = async () => {
    if (!name) return;
    const id = uuid();
    await window.api.profiles.upsertCluster({ id, name });
    setName('');
    await onChanged();
  };

  const setServerCluster = async (srv:any, clusterId:string) => {
    await window.api.profiles.upsertServer({ ...srv, clusterId: clusterId || undefined });
    await onChanged();
  };
  const delCluster = async (id:string) => { await window.api.profiles.deleteCluster(id); await onChanged(); };

  return (
    <div style={{ display:'grid', gap:10 }}>
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <input placeholder="Cluster name" value={name} onChange={e=>setName(e.target.value)} />
        <button onClick={addCluster}>Add Cluster</button>
      </div>

      <h4>Clusters</h4>
      <ul>
        {clusters.map(c=> (
          <li key={c.id}>{c.name} <button style={{ marginLeft:8 }} onClick={()=>delCluster(c.id)}>Delete</button></li>
        ))}
      </ul>

      <h4>Assign Servers</h4>
      <table style={{ width:'100%', borderCollapse:'collapse' }}>
        <thead>
          <tr><th style={{ textAlign:'left' }}>Server</th><th style={{ textAlign:'left' }}>Cluster</th></tr>
        </thead>
        <tbody>
          {servers.map(s=> (
            <tr key={s.id}>
              <td>{s.name}</td>
              <td>
                <select value={s.clusterId || ''} onChange={(e)=>setServerCluster(s, e.target.value)}>
                  <option value=''>— none —</option>
                  {clusters.map(c=> <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CurseForgeModsSubpanel({ servers }: { servers:any[] }) {
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [mods, setMods] = useState<{ projectId: number; fileId: number; displayName?: string }[]>([]);
  const [projectInput, setProjectInput] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!selectedServerId && servers.length) setSelectedServerId(servers[0].id);
  }, [servers, selectedServerId]);

  useEffect(() => {
    const srv = servers.find(s => s.id === selectedServerId);
    setMods(srv?.curseforgeMods || []);
  }, [selectedServerId, servers]);

  const addMod = async () => {
    const projectId = Number(projectInput.trim());
    if (!projectId) { setStatus('Enter project id'); setTimeout(()=>setStatus(''),1500); return; }
    try {
      const details = await (window as any).api.curseforge.getModDetails(projectId);
      const modData = details.data || details;
      const latest = (modData.latestFiles || [])[0];
      if (!latest) { setStatus('No files'); setTimeout(()=>setStatus(''),1500); return; }
      const entry = { projectId, fileId: latest.id || latest.fileId, displayName: modData.name };
      const next = [...mods.filter(m=>m.projectId!==projectId), entry];
      await (window as any).api.profiles.updateCurseForgeMods(selectedServerId, next);
      setMods(next);
      setProjectInput('');
      setStatus('Added'); setTimeout(()=>setStatus(''),1500);
    } catch(e:any){ setStatus('Err'); setTimeout(()=>setStatus(''),1500); }
  };

  const removeMod = async (projectId:number) => {
    const next = mods.filter(m=>m.projectId!==projectId);
    await (window as any).api.profiles.updateCurseForgeMods(selectedServerId, next);
    setMods(next);
  };

  return (
    <div style={{ display:'grid', gap:10, maxWidth:700 }}>
      <label>Server
        <select value={selectedServerId} onChange={e=>setSelectedServerId(e.target.value)}>
          {servers.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </label>
      <div style={{ display:'flex', gap:6 }}>
        <input placeholder="Project ID" value={projectInput} onChange={e=>setProjectInput(e.target.value)} style={{ flex:1 }} />
        <button onClick={addMod}>Add</button>
        <span style={{ alignSelf:'center', fontSize:12, opacity:0.7 }}>{status}</span>
      </div>
      <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
        <thead><tr><th style={{ textAlign:'left' }}>Project</th><th style={{ textAlign:'left' }}>File ID</th><th>Name</th><th></th></tr></thead>
        <tbody>
          {mods.map(m=> (
            <tr key={m.projectId}>
              <td>{m.projectId}</td>
              <td>{m.fileId}</td>
              <td>{m.displayName || '—'}</td>
              <td><button onClick={()=>removeMod(m.projectId)}>Remove</button></td>
            </tr>
          ))}
          {mods.length===0 && <tr><td colSpan={4} style={{ opacity:0.6 }}>No tracked mods</td></tr>}
        </tbody>
      </table>
      <div style={{ fontSize:11, opacity:0.7 }}>Tracked CurseForge mods will auto-update to latest file on schedule.</div>
    </div>
  );
}
