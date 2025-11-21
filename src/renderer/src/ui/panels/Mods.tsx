import React, { useEffect, useState, useRef } from 'react';

export function Mods() {
  const [root, setRoot] = useState(navigator.platform.toLowerCase().includes('win') ? 'C:/ASAWorkspace' : '/tmp/asa-workspace');
  const [steamcmdDir, setSteamcmdDir] = useState('steamcmd');
  const [outDir, setOutDir] = useState('servers/asa/ShooterGame/Content/Mods');
  const [modIds, setModIds] = useState('');
  const [appId, setAppId] = useState(2399830); // default ASA client app id
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState('');
  const [cfQuery, setCfQuery] = useState('');
  const [cfResults, setCfResults] = useState<Array<any>>([]);
  const [cfBusy, setCfBusy] = useState(false);
  const [offlineMode, setOfflineMode] = useState<boolean>(true);
  const [curseforgeApiKey, setCurseforgeApiKey] = useState<string>('');
  const [mainProcessOffline, setMainProcessOffline] = useState<boolean | null>(null);
  const [statusRefreshedAt, setStatusRefreshedAt] = useState<number>(0);
  const [details, setDetails] = useState<Record<number, { loading: boolean; error?: string; data?: any }>>({});
  // Hover preview state (CurseForge style card)
  const [hoverInfo, setHoverInfo] = useState<null | { projectId?: number; steamModId?: string; x: number; y: number; anchorRect: DOMRect; flipX?: boolean; flipY?: boolean }>(null);
  const [previewCache, setPreviewCache] = useState<Record<number, { loading: boolean; data?: any; error?: string }>>({});
  const [steamPreviewCache, setSteamPreviewCache] = useState<Record<string, { loading: boolean; data?: any; error?: string }>>({});
  const [fadingOut, setFadingOut] = useState(false);
  const tooltipRef = useRef<HTMLDivElement|null>(null);
  const previewTimeouts = useRef<Record<string, any>>({});
  // Manual CurseForge fallback (no API key) state
  const [manualProjectId, setManualProjectId] = useState<string>('');
  const [manualAddBusy, setManualAddBusy] = useState<boolean>(false);

  const [bridgeError, setBridgeError] = useState<string | null>(null);

  useEffect(() => {
    // Pre-fill from settings with defensive bridge check
    const api: any = (window as any).api;
    if (!api || !api.settings) {
      setBridgeError('API bridge unavailable – preload failed. Try closing and reopening the application or reinstalling.');
      return;
    }
    api.settings.get().then((s: any) => {
      if (!s) { setBridgeError('Settings unavailable – unexpected null response.'); return; }
      setRoot(s.workspaceRoot);
      setAppId(s.defaultWorkshopAppId);
      setOfflineMode(s.offlineMode);
      setCurseforgeApiKey(s.curseforgeApiKey || '');
      // fetch authoritative offline flag from main process specific endpoint
      if (api.settings.getOfflineMode) {
        api.settings.getOfflineMode().then((v:any)=>{
          setMainProcessOffline(!!v.offlineMode);
          setStatusRefreshedAt(Date.now());
        }).catch(()=>{});
      }
    }).catch((e: any) => {
      setBridgeError('Failed to load settings: ' + String(e?.message || e));
    });
  }, []);

  // Subscribe to offline mode changes from main process via preload API
  useEffect(() => {
    const api: any = (window as any).api;
    if (!api?.settings?.onOfflineChanged) return;
    const unsubscribe = api.settings.onOfflineChanged((value: boolean) => {
      console.debug('[CurseForgeSearch] offlineChanged event', value);
      setOfflineMode(value);
      setMainProcessOffline(value);
      setStatusRefreshedAt(Date.now());
    });
    return unsubscribe;
  }, []);

  const run = async () => {
    const ids = modIds.split(',').map((s) => s.trim()).filter(Boolean);
    if (ids.length === 0) { alert('Enter at least one Workshop ID'); return; }
    setBusy(true); setLog('Running SteamCMD...');
    try {
      const res = await window.api.mods.downloadOrUpdate(root, steamcmdDir, ids, outDir, appId);
      setLog(JSON.stringify(res, null, 2));
    } catch (e: any) {
      setLog(String(e?.message ?? e));
    } finally { setBusy(false); }
  };

  const searchCurseForge = async () => {
    if (!cfQuery.trim()) return;
    console.debug('[CurseForgeSearch] initiating search', { query: cfQuery.trim(), offlineMode, hasKey: !!curseforgeApiKey });
    setCfBusy(true);
    if (offlineMode) { setCfResults([{ error: 'Offline Mode enabled. Disable in Settings.' }]); setCfBusy(false); return; }
    if (!curseforgeApiKey) { setCfResults([{ error: 'CurseForge API key not set in Settings.' }]); setCfBusy(false); return; }
    try {
      const res = await (window as any).api.curseforge.searchMods(cfQuery.trim(), 15);
      setCfResults(res);
    } catch (e: any) {
      const msg = String(e?.message ?? e);
      let friendly = msg;
      if (/offline mode/i.test(msg)) friendly = 'Offline Mode is still enabled at main process. Toggle it off in Settings.';
      else if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg)) friendly = 'Network error contacting CurseForge. Check connection.';
      setCfResults([{ error: friendly }]);
    } finally { setCfBusy(false); }
  };

  const toggleDetails = async (id: number) => {
    setDetails((d) => ({ ...d, [id]: d[id] ? d[id] : { loading: true } }));
    const current = details[id];
    // If already loaded, collapse
    if (current && current.data) {
      setDetails((d) => { const cp = { ...d }; delete cp[id]; return cp; });
      return;
    }
    try {
      const data = await (window as any).api.curseforge.getModDetails(id);
      setDetails((d) => ({ ...d, [id]: { loading: false, data } }));
    } catch (e: any) {
      setDetails((d) => ({ ...d, [id]: { loading: false, error: String(e?.message ?? e) } }));
    }
  };

  // Hover preview fetch (lazy on first hover)
  const ensurePreview = async (projectId: number) => {
    if (offlineMode) return; // respect offline mode
    setPreviewCache((c) => c[projectId] ? c : { ...c, [projectId]: { loading: true } });
    const current = previewCache[projectId];
    if (current && (current.data || current.error)) return; // already fetched
    const key = `cf-${projectId}`;
    if (previewTimeouts.current[key]) {
      clearTimeout(previewTimeouts.current[key]);
    }
    previewTimeouts.current[key] = setTimeout(async () => {
      try {
        const data = await (window as any).api.curseforge.getModDetails(projectId);
        setPreviewCache((c) => ({ ...c, [projectId]: { loading: false, data } }));
      } catch (e: any) {
        setPreviewCache((c) => ({ ...c, [projectId]: { loading: false, error: String(e?.message || e) } }));
      }
    }, 120); // debounce delay
  };

  const ensureSteamPreview = async (modId: string) => {
    if (!serverId) return;
    setSteamPreviewCache((c)=> c[modId] ? c : { ...c, [modId]: { loading: true } });
    const current = steamPreviewCache[modId];
    if (current && (current.data || current.error)) return;
    const key = `steam-${modId}`;
    if (previewTimeouts.current[key]) clearTimeout(previewTimeouts.current[key]);
    previewTimeouts.current[key] = setTimeout(async () => {
      try {
        const info = await (window as any).api.mods.getSteamModInfo(serverId, modId);
        setSteamPreviewCache((c)=> ({ ...c, [modId]: { loading: false, data: info } }));
      } catch (e:any) {
        setSteamPreviewCache((c)=> ({ ...c, [modId]: { loading: false, error: String(e?.message||e) } }));
      }
    }, 120);
  };

  const computePlacement = (rect: DOMRect) => {
    const width = 320; // planned card width
    const heightGuess = 260; // rough height for overflow calc
    let x = rect.right + 8;
    let y = rect.top;
    let flipX = false;
    let flipY = false;
    if (x + width > window.innerWidth - 8) {
      x = rect.left - width - 8;
      flipX = true;
    }
    if (y + heightGuess > window.innerHeight - 8) {
      y = Math.max(8, window.innerHeight - heightGuess - 8);
      flipY = true;
    }
    return { x, y, flipX, flipY };
  };
  const onHoverEnterSearch = (projectId: number, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = computePlacement(rect);
    setHoverInfo({ projectId, steamModId: undefined, x: pos.x, y: pos.y, anchorRect: rect, flipX: pos.flipX, flipY: pos.flipY });
    ensurePreview(projectId);
  };
  const onHoverEnterSteam = (modId: string, e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const pos = computePlacement(rect);
    setHoverInfo({ projectId: undefined, steamModId: modId, x: pos.x, y: pos.y, anchorRect: rect, flipX: pos.flipX, flipY: pos.flipY });
    ensureSteamPreview(modId);
  };
  const onHoverLeave = () => {
    // fade-out animation
    setFadingOut(true);
    setTimeout(()=>{ setHoverInfo(null); setFadingOut(false); }, 160);
  };

  // Recompute vertical placement once content resolves (actual height measurement)
  useEffect(() => {
    if (!hoverInfo) return;
    const el = tooltipRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8) {
      const delta = rect.bottom - (window.innerHeight - 8);
      setHoverInfo(h => h ? { ...h, y: Math.max(8, h.y - delta - 4), flipY: true } : h);
    }
  }, [hoverInfo, previewCache, steamPreviewCache]);

  const addToProfile = async (mod: any) => {
    try {
      const state = await (window as any).api.profiles.list();
      // pick first server or create a default one
      let server = state.servers[0];
      if (!server) {
        server = {
          id: 'server-1',
          name: 'Default Server',
          installDir: root + '/servers/asa',
          appId: 2430930,
          map: 'TheIsland_WP',
          mods: [],
          orderedMods: []
        };
      }
      const cfIdTag = `cf:${mod.id}`;
      if (!server.mods.includes(cfIdTag)) server.mods = [...server.mods, cfIdTag];
      if (!server.orderedMods) server.orderedMods = [];
      if (!server.orderedMods.find((m:any)=>m.id===cfIdTag)) {
        server.orderedMods.push({ id: cfIdTag, type:'curseforge', displayName: mod.name, projectId: mod.id });
      }
      await (window as any).api.profiles.upsertServer(server);
      setLog((l) => l + `\nAdded CurseForge mod ${mod.name} (${cfIdTag}) to profile ${server.name}.`);
    } catch (e: any) {
      setLog((l) => l + `\nFailed to add mod: ${String(e?.message ?? e)}`);
    }
  };

  // Manual add by CurseForge project ID or URL (fallback when API key missing)
  const manualAddCurseForge = async () => {
    const raw = manualProjectId.trim();
    if (!raw) return;
    // Extract ID from possible full URL
    let idStr = raw;
    const urlMatch = raw.match(/(\d+)/); // simplest approach: first number sequence
    if (urlMatch) idStr = urlMatch[1];
    const idNum = Number(idStr);
    if (!idNum) { alert('Invalid numeric project ID'); return; }
    setManualAddBusy(true);
    try {
      // Attempt to fetch details IF API endpoint works without key (likely fails). Gracefully fallback.
      let name = `CurseForge Project ${idNum}`;
      try {
        if (!offlineMode && curseforgeApiKey) {
          const details = await (window as any).api.curseforge.getModDetails(idNum);
          const data = details?.data?.data;
          if (data?.name) name = data.name;
        }
      } catch {}
      await addToProfile({ id: idNum, name });
      setManualProjectId('');
    } catch (e:any) {
      setLog(l=>l+`\nManual add failed: ${String(e?.message||e)}`);
    } finally {
      setManualAddBusy(false);
    }
  };

  // Ordered mods UI state
  const [ordered, setOrdered] = useState<any[]>([]);
  const [serverId, setServerId] = useState<string | null>(null);
  const [servers, setServers] = useState<any[]>([]);
  useEffect(()=>{
    (async ()=>{
      try {
        const state = await (window as any).api.profiles.list();
        setServers(state.servers);
        let srv = state.servers[0];
        if (serverId) srv = state.servers.find((s:any)=>s.id===serverId) || srv;
        if (srv) {
          setServerId(srv.id);
          setOrdered(srv.orderedMods || []);
          // auto fetch CF details if missing author/link
          for (const mod of srv.orderedMods||[]) {
            if (mod.type==='curseforge' && mod.projectId && (!mod.author || !mod.link)) {
              try {
                const details = await (window as any).api.curseforge.getModDetails(mod.projectId);
                const data = details?.data;
                mod.author = data?.authors?.[0]?.name;
                mod.link = data?.links?.websiteUrl || data?.links?.downloadUrl;
                mod.fileId = data?.latestFiles?.[0]?.id;
              } catch {}
            }
          }
          setOrdered([...(srv.orderedMods||[])]);
        }
      } catch {}
    })();
  }, [serverId]);
  const selectServer = (id: string) => { setServerId(id); };
  const bulkEnable = async (enabled: boolean) => {
    if (!serverId) return;
    try {
      const res = await (window as any).api.profiles.toggleAllMods(serverId, enabled);
      setOrdered(res.orderedMods || []);
    } catch (e:any) { setLog(l=>l+`\nBulk toggle failed: ${String(e?.message||e)}`); }
  };
  const exportList = () => {
    const data = JSON.stringify(ordered, null, 2);
    navigator.clipboard?.writeText(data).catch(()=>{});
    const blob = new Blob([data], { type:'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'mods-order.json'; a.click();
    setLog(l=>l+'\nExported ordered mod list (copied to clipboard).');
  };
  const cleanFolder = async () => {
    if (!serverId) return;
    try { const r = await (window as any).api.maintenance.cleanModsFolder(serverId); setLog(l=>l+`\nCleaned mods folder. Removed: ${r.removed.join(', ')}`); } catch(e:any){ setLog(l=>l+`\nClean failed: ${String(e?.message||e)}`); }
  };

  // Drag and drop
  const dragIndexRef = useRef<number|null>(null);
  const onDragStart = (i:number) => (e:any) => { dragIndexRef.current = i; e.dataTransfer.effectAllowed='move'; };
  const onDragOver = (i:number) => (e:any) => { e.preventDefault(); e.dataTransfer.dropEffect='move'; };
  const onDrop = (i:number) => async (e:any) => {
    e.preventDefault(); const from = dragIndexRef.current; if (from===null || from===i) return; const arr = [...ordered]; const [item] = arr.splice(from,1); arr.splice(i,0,item); setOrdered(arr); dragIndexRef.current=null; // persist
    if (serverId) { try { const res = await (window as any).api.profiles.setOrderedMods(serverId, arr); setOrdered(res.orderedMods||arr); } catch(e:any){ setLog(l=>l+`\nDrag persist failed: ${String(e?.message||e)}`); } }
  };
  const toggleEnabled = async (modId: string) => {
    const arr = ordered.map(m => m.id===modId ? { ...m, enabled: m.enabled===false ? true : false } : m);
    setOrdered(arr);
    if (serverId) { try { const res = await (window as any).api.profiles.setOrderedMods(serverId, arr); setOrdered(res.orderedMods||arr); } catch(e:any){ setLog(l=>l+`\nToggle failed: ${String(e?.message||e)}`); } }
  };

  const reorder = async (modId: string, dir: 'up'|'down'|'top') => {
    if (!serverId) return;
    try {
      const res = await (window as any).api.profiles.reorderMod(serverId, modId, dir);
      setOrdered(res.orderedMods || []);
    } catch (e:any) {
      setLog(l=>l+`\nReorder failed: ${String(e?.message||e)}`);
    }
  };
  const deleteMod = async (modId: string) => {
    if (!serverId) return;
    try {
      const res = await (window as any).api.profiles.deleteMod(serverId, modId);
      setOrdered(res.orderedMods || []);
    } catch (e:any) {
      setLog(l=>l+`\nDelete failed: ${String(e?.message||e)}`);
    }
  };

  if (bridgeError) {
    return (
      <section className="panel">
        <h2 className="panel-title" style={{ marginTop: 0 }}>Mods</h2>
        <div style={{ color:'#d27d2c', fontSize:13, lineHeight:1.5 }}>{bridgeError}</div>
        <div style={{ marginTop:12 }}>
          <button onClick={()=>location.reload()}>Reload App</button>
        </div>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2 className="panel-title" style={{ marginTop: 0 }}>Mods</h2>
      <div style={{ display: 'grid', gap: 8, maxWidth: 1100 }}>
        <h3 style={{ margin: '4px 0', display:'flex', alignItems:'center', gap:12 }}>
          <span>Profile Mods Ordering</span>
          <select value={serverId||''} onChange={(e)=>selectServer(e.target.value)} style={{ fontSize:12 }}>
            {servers.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button onClick={()=>bulkEnable(true)} style={{ fontSize:11 }}>Enable All</button>
          <button onClick={()=>bulkEnable(false)} style={{ fontSize:11 }}>Disable All</button>
          <button onClick={exportList} style={{ fontSize:11 }}>Export JSON</button>
          <button onClick={cleanFolder} style={{ fontSize:11 }}>Clean Mods Folder</button>
        </h3>
        {ordered.length === 0 && <div style={{ fontSize:12, opacity:.7 }}>No mods tracked yet. Add via CurseForge search below.</div>}
        {ordered.length > 0 && (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
              <thead>
                <tr style={{ textAlign:'left', borderBottom:'1px solid #333' }}>
                  <th style={{ padding:4 }}>Order</th>
                  <th style={{ padding:4 }}>ID</th>
                  <th style={{ padding:4 }}>Name</th>
                  <th style={{ padding:4 }}>Enabled</th>
                  <th style={{ padding:4 }}>Type</th>
                  <th style={{ padding:4 }}>Author</th>
                  <th style={{ padding:4 }}>File</th>
                  <th style={{ padding:4 }}>Link</th>
                  <th style={{ padding:4 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {ordered.map((m,i)=>{
                  const projectId = m.type==='curseforge' ? (m.projectId || Number(String(m.id).replace(/^cf:/,''))) : null;
                  const steamModId = m.type==='steam' ? String(m.id) : null;
                  return (
                  <tr key={m.id} style={{ borderBottom:'1px solid #222', opacity: m.enabled===false?0.5:1 }} draggable onDragStart={onDragStart(i)} onDragOver={onDragOver(i)} onDrop={onDrop(i)}
                    onMouseEnter={
                      (e)=> {
                        if (projectId) { onHoverEnterSearch(projectId, e); }
                        else if (steamModId) { onHoverEnterSteam(steamModId, e); }
                      }
                    }
                    onMouseLeave={onHoverLeave}
                  >
                    <td style={{ padding:4 }}>{i+1}</td>
                    <td style={{ padding:4, fontFamily:'monospace' }}>{m.id}</td>
                    <td style={{ padding:4 }}>{m.displayName || m.id}</td>
                    <td style={{ padding:4 }}><input type="checkbox" checked={m.enabled!==false} onChange={()=>toggleEnabled(m.id)} /></td>
                    <td style={{ padding:4 }}>{m.type}</td>
                    <td style={{ padding:4 }}>{m.author || ''}</td>
                    <td style={{ padding:4 }}>{m.fileId || ''}</td>
                    <td style={{ padding:4, maxWidth:160, overflow:'hidden', textOverflow:'ellipsis' }}>{m.link ? <a href={m.link} target="_blank" rel="noreferrer">link</a> : ''}</td>
                    <td style={{ padding:4, whiteSpace:'nowrap' }}>
                      <button style={{ marginRight:4 }} onClick={()=>reorder(m.id,'top')}>Top</button>
                      <button style={{ marginRight:4 }} disabled={i===0} onClick={()=>reorder(m.id,'up')}>Up</button>
                      <button style={{ marginRight:4 }} disabled={i===ordered.length-1} onClick={()=>reorder(m.id,'down')}>Down</button>
                      <button style={{ marginRight:4 }} onClick={()=>deleteMod(m.id)}>Delete</button>
                    </td>
                  </tr>
                );})}
              </tbody>
            </table>
          </div>
        )}
        <label>Workspace Root
          <input style={{ width: '100%' }} value={root} onChange={(e) => setRoot(e.target.value)} />
        </label>
        <label>SteamCMD Directory (relative to root)
          <input style={{ width: '100%' }} value={steamcmdDir} onChange={(e) => setSteamcmdDir(e.target.value)} />
        </label>
        <label>Server Mods Directory (relative to root)
          <input style={{ width: '100%' }} value={outDir} onChange={(e) => setOutDir(e.target.value)} />
        </label>
        <label>Workshop App ID
          <input style={{ width: '100%' }} value={appId} onChange={(e) => setAppId(Number(e.target.value)||2399830)} />
        </label>
        <label>Workshop IDs (comma separated)
          <input style={{ width: '100%' }} value={modIds} onChange={(e) => setModIds(e.target.value)} placeholder="123456,789012" />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button disabled={busy} onClick={run}>Download / Update Mods (Steam)</button>
        </div>
        <pre style={{ whiteSpace: 'pre-wrap' }}>{log}</pre>
        <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid #333' }} />
        <h3 className="panel-title" style={{ margin: 0 }}>CurseForge Search</h3>
        <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:11, flexWrap:'wrap' }}>
          <span style={{ padding:'2px 6px', borderRadius:4, background: offlineMode? '#442':'#244', color:'#ccc' }}>
            Renderer Offline: {offlineMode? 'Yes':'No'}
          </span>
          <span style={{ padding:'2px 6px', borderRadius:4, background: mainProcessOffline? '#533':'#353', color:'#ccc' }}>
            Main Offline: {mainProcessOffline===null? '—': mainProcessOffline? 'Yes':'No'}
          </span>
          <span style={{ padding:'2px 6px', borderRadius:4, background: curseforgeApiKey? '#2a4':'#555', color:'#ccc' }}>
            API Key: {curseforgeApiKey? 'Set':'Missing'}
          </span>
          <button style={{ fontSize:11 }} onClick={async ()=>{
            try {
              const api: any = (window as any).api;
              if (api?.settings?.getOfflineMode) {
                const v = await api.settings.getOfflineMode();
                setMainProcessOffline(!!v.offlineMode);
                setStatusRefreshedAt(Date.now());
              }
              if (api?.settings?.get) {
                const s = await api.settings.get();
                setCurseforgeApiKey(s.curseforgeApiKey||'');
              }
            } catch(e:any){ console.warn('Status refresh failed', e); }
          }}>Refresh Status</button>
          <span style={{ opacity:.6 }}>Updated {statusRefreshedAt? new Date(statusRefreshedAt).toLocaleTimeString(): '—'}</span>
        </div>
        <label>Query
          <input style={{ width: '100%' }} value={cfQuery} onChange={(e) => setCfQuery(e.target.value)} placeholder="Structures" />
        </label>
        <div>
          <button disabled={cfBusy || offlineMode || !curseforgeApiKey} onClick={searchCurseForge}>Search CurseForge</button>
          <small style={{ display:'block', marginTop:4, opacity:.7 }}>
            {offlineMode ? 'Offline Mode: enable in Settings to query.' : (!curseforgeApiKey ? 'Enter CurseForge API key in Settings to enable search.' : 'Powered by CurseForge API.')}
          </small>
        </div>
        {/* Fallback manual add UI when API key missing */}
        {!curseforgeApiKey && (
          <div style={{ marginTop:12, padding:8, border:'1px solid #333', borderRadius:4 }}>
            <div style={{ fontSize:12, fontWeight:600, marginBottom:4 }}>Manual Add (No API Key)</div>
            <div style={{ fontSize:11, opacity:.7, marginBottom:6 }}>Enter a CurseForge project ID or full URL to add a placeholder entry to your profile. You can enrich metadata later once an API key is provided.</div>
            <input style={{ width:'100%', marginBottom:6 }} value={manualProjectId} onChange={(e)=>setManualProjectId(e.target.value)} placeholder="e.g. 123456 or https://www.curseforge.com/ark-survival-ascended/mods/123456" />
            <button disabled={manualAddBusy || !manualProjectId.trim()} onClick={manualAddCurseForge} style={{ fontSize:11 }}>Add Project ID</button>
          </div>
        )}
        <div style={{ display: 'grid', gap: 8 }}>
          {cfResults.map((m, i) => (
            <div key={i} className="panel panel--tight" style={{ padding:8 }}
              onMouseEnter={(e)=>m.id && onHoverEnterSearch(m.id, e)}
              onMouseLeave={onHoverLeave}
            >
              {m.error && <div style={{ color: '#d27d2c' }}>Error: {m.error}</div>}
              {!m.error && (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                    <div style={{ fontWeight: 600 }}>{m.name}</div>
                    <button onClick={()=>toggleDetails(m.id)} style={{ fontSize:11 }}>
                      {details[m.id]?.data ? 'Collapse' : details[m.id]?.loading ? 'Loading…' : 'Details'}
                    </button>
                  </div>
                  <div style={{ fontSize: 12, opacity: 0.8 }}>{m.summary}</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>Downloads: {m.downloadCount}</div>
                  {m.latestFiles && <div style={{ fontSize: 11 }}>Files: {m.latestFiles.map((f:any)=>f.displayName).join(', ')}</div>}
                  {details[m.id] && !details[m.id].loading && details[m.id].data && (
                    <div style={{ marginTop:8, borderTop:'1px solid #333', paddingTop:8 }}>
                      <div style={{ fontSize:11, opacity:.8 }}>Description:</div>
                      <div style={{ fontSize:12, whiteSpace:'pre-wrap' }}>{details[m.id].data?.data?.summary || details[m.id].data?.data?.description || 'No additional summary.'}</div>
                      {details[m.id].data?.data?.authors && (
                        <div style={{ fontSize:11, marginTop:4 }}>Authors: {details[m.id].data.data.authors.map((a:any)=>a.name).join(', ')}</div>
                      )}
                      {details[m.id].data?.data?.categories && (
                        <div style={{ fontSize:11 }}>Categories: {details[m.id].data.data.categories.map((c:any)=>c.name).join(', ')}</div>
                      )}
                      <div style={{ marginTop:6, display:'flex', gap:8, flexWrap:'wrap' }}>
                        <button onClick={()=>addToProfile(m)} style={{ fontSize:11 }}>Add to Profile</button>
                        {m.cached && <span style={{ fontSize:10, opacity:.6 }}>Cached</span>}
                      </div>
                    </div>
                  )}
                  {details[m.id] && details[m.id].loading && <div style={{ fontSize:11, marginTop:6, opacity:.7 }}>Loading details…</div>}
                  {details[m.id] && details[m.id].error && <div style={{ fontSize:11, marginTop:6, color:'#d27d2c' }}>Error: {details[m.id].error}</div>}
                </>
              )}
            </div>
          ))}
          {cfResults.length === 0 && <div style={{ fontSize:12, opacity:.7 }}>No results yet.</div>}
        </div>
        {/* Hover Preview Overlay */}
        {hoverInfo && (
          <div style={{ position:'fixed', top:hoverInfo.y, left:hoverInfo.x, zIndex:9999, pointerEvents:'none' }}>
            <div ref={tooltipRef} style={{ width:320, background:'#1d2024', border:'1px solid #333', borderRadius:6, padding:10, boxShadow:'0 4px 14px rgba(0,0,0,0.55)', fontSize:12,
              animation: fadingOut ? 'fadeOutCF 0.16s ease-out forwards' : 'fadeInCF 0.16s ease-out',
              transform: `translateY(${hoverInfo.flipY? '4px':'0'}) translateX(${hoverInfo.flipX? '-4px':'0'})`,
            }}>
              {/* CurseForge preview */}
              {hoverInfo.projectId && previewCache[hoverInfo.projectId] && (
                <>
                  {previewCache[hoverInfo.projectId].loading && (
                    <div>
                      <div className="cf-skel-row" style={{ height:20, width:'60%', marginBottom:8 }} />
                      <div style={{ display:'flex', gap:10 }}>
                        <div className="cf-skel-thumb" style={{ width:64, height:64, borderRadius:4 }} />
                        <div style={{ flex:1 }}>
                          <div className="cf-skel-row" style={{ height:14, width:'80%', marginBottom:6 }} />
                          <div className="cf-skel-row" style={{ height:12, width:'50%', marginBottom:6 }} />
                          <div className="cf-skel-row" style={{ height:12, width:'40%' }} />
                        </div>
                      </div>
                      <div className="cf-skel-row" style={{ height:11, width:'95%', marginTop:12 }} />
                      <div className="cf-skel-row" style={{ height:11, width:'90%', marginTop:4 }} />
                    </div>
                  )}
                  {previewCache[hoverInfo.projectId].error && <div style={{ color:'#d27d2c' }}>Error: {previewCache[hoverInfo.projectId].error}</div>}
                  {previewCache[hoverInfo.projectId].data && (() => {
                    const mod = previewCache[hoverInfo.projectId].data.data || previewCache[hoverInfo.projectId].data;
                    return (
                      <div>
                        <div style={{ display:'flex', gap:10 }}>
                          {mod.logo?.thumbnailUrl && <img src={mod.logo.thumbnailUrl} alt={mod.name} style={{ width:64, height:64, objectFit:'cover', borderRadius:4, border:'1px solid #222' }} />}
                          <div style={{ flex:1 }}>
                            <div style={{ fontWeight:600, fontSize:13 }}>{mod.name}</div>
                            <div style={{ fontSize:11, opacity:.7 }}>{mod.authors?.map((a:any)=>a.name).join(', ')}</div>
                            <div style={{ fontSize:11, marginTop:4 }}>Downloads: {mod.downloadCount}</div>
                          </div>
                        </div>
                        <div style={{ marginTop:8, fontSize:11, lineHeight:1.4, maxHeight:140, overflow:'auto' }}>{mod.summary || mod.description || 'No description.'}</div>
                        {mod.categories && <div style={{ marginTop:6, fontSize:10, display:'flex', flexWrap:'wrap', gap:4 }}>{mod.categories.map((c:any)=>(<span key={c.id} style={{ background:'#2a2f36', padding:'2px 6px', borderRadius:3 }}>{c.name}</span>))}</div>}
                        {mod.latestFiles && mod.latestFiles.length>0 && <div style={{ marginTop:6, fontSize:10 }}>Latest: {mod.latestFiles[0].displayName || mod.latestFiles[0].fileName}</div>}
                        {mod.links?.websiteUrl && <div style={{ marginTop:6 }}><a href={mod.links.websiteUrl} target="_blank" rel="noreferrer" style={{ fontSize:11 }}>Open on CurseForge</a></div>}
                      </div>
                    );
                  })()}
                </>
              )}
              {/* Steam mod preview */}
              {hoverInfo.steamModId && steamPreviewCache[hoverInfo.steamModId] && (
                <>
                  {steamPreviewCache[hoverInfo.steamModId].loading && (
                    <div>
                      <div className="cf-skel-row" style={{ height:16, width:'70%', marginBottom:6 }} />
                      <div className="cf-skel-row" style={{ height:12, width:'50%', marginBottom:4 }} />
                      <div className="cf-skel-row" style={{ height:12, width:'60%' }} />
                    </div>
                  )}
                  {steamPreviewCache[hoverInfo.steamModId].error && <div style={{ color:'#d27d2c' }}>Error: {steamPreviewCache[hoverInfo.steamModId].error}</div>}
                  {steamPreviewCache[hoverInfo.steamModId].data && (() => {
                    const info = steamPreviewCache[hoverInfo.steamModId].data;
                    const sizeMB = info.sizeBytes ? (info.sizeBytes / (1024*1024)).toFixed(2) : '0';
                    return (
                      <div>
                        <div style={{ fontWeight:600, fontSize:13 }}>Steam Workshop Mod {info.modId}</div>
                        <div style={{ fontSize:11, opacity:.7 }}>Directory: {info.exists ? 'Present' : 'Missing'}</div>
                        {info.exists && <div style={{ fontSize:11, marginTop:4 }}>Files: {info.fileCount} · Size: {sizeMB} MB</div>}
                        <div style={{ fontSize:10, marginTop:6, opacity:.65 }}>Path: {info.path}</div>
                        <div style={{ marginTop:8, fontSize:10 }}>Tip: Add a CurseForge mod via search to enrich metadata.</div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>
            {/* Inline keyframes for fade animations */}
            <style>{`@keyframes fadeInCF { from { opacity:0; transform:translateY(4px);} to { opacity:1; transform:translateY(0);} } @keyframes fadeOutCF { from { opacity:1; } to { opacity:0; } } @keyframes cfPulse { 0% { background-color:#2a2f36;} 50% { background-color:#323840;} 100% { background-color:#2a2f36;} } .cf-skel-row,.cf-skel-thumb { background:#2a2f36; animation: cfPulse 1.4s ease-in-out infinite; }`}</style>
          </div>
        )}
      </div>
    </section>
  );
}
