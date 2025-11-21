import React, { useEffect, useState } from 'react';

const WORKSHOP_CHOICES = [
  { id: 2399830, label: 'ARK: Survival Ascended (2399830)' },
  { id: 346110, label: 'ARK: Survival Evolved (346110)' },
  { id: 480, label: 'Generic Steam Workshop (480)' },
];

export function SettingsPanel() {
  const [workspaceRoot, setWorkspaceRoot] = useState('');
  const [defaultWorkshopAppId, setDefaultWorkshopAppId] = useState<number>(2399830);
  const [offlineMode, setOfflineMode] = useState<boolean>(true);
  const [curseforgeApiKey, setCurseforgeApiKey] = useState<string>('');
  const [webApiToken, setWebApiToken] = useState<string>('');
  const [webApiTokenPresent, setWebApiTokenPresent] = useState<boolean>(false);
  const [webApiBaseUrl, setWebApiBaseUrl] = useState<string>('');
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false);
  const [autoUpdateCron, setAutoUpdateCron] = useState('0 * * * *');
  const [saveCleanupEnabled, setSaveCleanupEnabled] = useState(false);
  const [saveCleanupRetentionDays, setSaveCleanupRetentionDays] = useState(14);
  const [saveCleanupMaxWorldFiles, setSaveCleanupMaxWorldFiles] = useState(5);
  const [saveCleanupCron, setSaveCleanupCron] = useState('30 2 * * *');
  // Claude / Anthropic settings
  const [claudeEnabled, setClaudeEnabled] = useState(false);
  const [anthropicApiKey, setAnthropicApiKey] = useState('');
  const [claudeModel, setClaudeModel] = useState('claude-sonnet-4.5');
  const [saved, setSaved] = useState('');
  const [webApiTestPath, setWebApiTestPath] = useState('status');
  const [webApiTestResult, setWebApiTestResult] = useState<string>('');
  const [webApiTestBusy, setWebApiTestBusy] = useState(false);
  const [webApiAdvMethod, setWebApiAdvMethod] = useState<'GET'|'POST'|'PUT'|'DELETE'>('GET');
  const [webApiAdvPath, setWebApiAdvPath] = useState('status');
  const [webApiAdvBody, setWebApiAdvBody] = useState('{"example":true}');
  const [webApiAdvResult, setWebApiAdvResult] = useState('');
  const [webApiAdvBusy, setWebApiAdvBusy] = useState(false);
  // App update state
  const [appUpdateBusy, setAppUpdateBusy] = useState(false);
  const [appUpdateLog, setAppUpdateLog] = useState('');
  const [appUpdateOk, setAppUpdateOk] = useState<boolean | null>(null);

  const [bridgeError, setBridgeError] = useState<string | null>(null);
  useEffect(() => {
    const api: any = (window as any).api;
    if (!api || !api.settings) {
      setBridgeError('API bridge unavailable – preload failed. Close and reopen the application.');
      return;
    }
    // Load settings + token presence
    api.settings.get().then((s: any) => {
      if (!s) { setBridgeError('Settings object is undefined.'); return; }
      setWorkspaceRoot(s.workspaceRoot || '');
      setDefaultWorkshopAppId(s.defaultWorkshopAppId ?? 2399830);
      setOfflineMode(s.offlineMode ?? true);
      setCurseforgeApiKey(s.curseforgeApiKey ?? '');
      setWebApiBaseUrl(s.webApiBaseUrl || '');
      setAutoUpdateEnabled(!!s.autoUpdateEnabled);
      setAutoUpdateCron(s.autoUpdateCron || '0 * * * *');
      setSaveCleanupEnabled(!!s.saveCleanupEnabled);
      setSaveCleanupRetentionDays(s.saveCleanupRetentionDays ?? 14);
      setSaveCleanupMaxWorldFiles(s.saveCleanupMaxWorldFiles ?? 5);
      setSaveCleanupCron(s.saveCleanupCron || '30 2 * * *');
      setClaudeEnabled(!!s.claudeEnabled);
      setAnthropicApiKey(s.anthropicApiKey || '');
      setClaudeModel(s.claudeModel || 'claude-sonnet-4.5');
    }).catch((e: any) => setBridgeError('Failed to load settings: ' + String(e?.message || e)));
    api.token?.get().then((t: any) => { if (t && typeof t.present === 'boolean') setWebApiTokenPresent(!!t.present); }).catch(()=>{});
    // subscribe to offline mode changes broadcast from main process
    if (api.settings.onOfflineChanged) {
      const unsub = api.settings.onOfflineChanged((value:boolean)=>{
        console.debug('[SettingsPanel] offlineChanged event', value);
        setOfflineMode(value);
      });
      return () => { try { unsub && unsub(); } catch {} };
    }
  }, []);

  const browse = async () => {
    try {
      const api: any = (window as any).api;
      if (!api || !api.dialogs) { setBridgeError('Dialogs unavailable – bridge error.'); return; }
      const dir = await api.dialogs.chooseDirectory();
      if (dir) setWorkspaceRoot(String(dir).replaceAll('\\', '/'));
    } catch (e: any) {
      setBridgeError('Browse failed: ' + String(e?.message || e));
    }
  };

  const save = async () => {
    try {
      const api: any = (window as any).api;
      if (!api || !api.settings) { setBridgeError('Settings API unavailable.'); return; }
      // Use dedicated setter for offline mode so event broadcast occurs
      if (api.settings.setOfflineMode) {
        await api.settings.setOfflineMode(offlineMode);
      }
      const partial: any = {
        workspaceRoot,
        defaultWorkshopAppId,
        // offlineMode persisted by dedicated call above
        curseforgeApiKey: curseforgeApiKey || undefined,
        anthropicApiKey: anthropicApiKey || undefined,
        claudeEnabled: !!claudeEnabled,
        claudeModel: claudeModel || undefined,
        webApiBaseUrl,
        autoUpdateEnabled,
        autoUpdateCron,
        saveCleanupEnabled,
        saveCleanupRetentionDays,
        saveCleanupMaxWorldFiles,
        saveCleanupCron
      };
      await api.settings.set(partial);
      if (api.autoupdate) api.autoupdate.toggle(autoUpdateEnabled);
      setSaved('Saved');
      setTimeout(() => setSaved(''), 1500);
    } catch (e: any) {
      setBridgeError('Save failed: ' + String(e?.message || e));
    }
  };

  const saveToken = async () => {
    try {
      const api: any = (window as any).api;
      if (!api || !api.token) { setBridgeError('Token API unavailable.'); return; }
      if (!webApiToken.trim()) { const cleared = await api.token.clear(); setWebApiTokenPresent(false); setSaved('Token cleared'); setTimeout(()=>setSaved(''),1500); return; }
      const res = await api.token.set(webApiToken.trim());
      if (!res || !res.ok) throw new Error('Failed to persist token');
      setWebApiTokenPresent(true);
      setWebApiToken(''); // clear input after save for safety
      setSaved('Token saved');
      setTimeout(()=>setSaved(''),1500);
    } catch (e: any) {
      setBridgeError('Token save failed: ' + String(e?.message || e));
    }
  };

  const testWebApi = async () => {
    setWebApiTestResult('');
    setWebApiTestBusy(true);
    try {
      const api: any = (window as any).api;
      if (!api || !api.webapi) { setWebApiTestResult('Web API bridge unavailable.'); return; }
      const res = await api.webapi.get(webApiTestPath.trim());
      setWebApiTestResult(typeof res === 'string' ? res : JSON.stringify(res, null, 2));
    } catch (e: any) {
      setWebApiTestResult('Error: ' + String(e?.message || e));
    } finally {
      setWebApiTestBusy(false);
    }
  };

  const runAdvancedWebApi = async () => {
    setWebApiAdvResult('');
    setWebApiAdvBusy(true);
    try {
      const api: any = (window as any).api;
      if (!api || !api.webapi) { setWebApiAdvResult('Web API bridge unavailable.'); return; }
      let body: any = undefined;
      if (webApiAdvMethod === 'POST' || webApiAdvMethod === 'PUT') {
        try { body = webApiAdvBody ? JSON.parse(webApiAdvBody) : {}; } catch (e: any) { setWebApiAdvResult('Invalid JSON body: ' + String(e?.message||e)); return; }
      }
      let res: any;
      switch (webApiAdvMethod) {
        case 'GET': res = await api.webapi.get(webApiAdvPath.trim()); break;
        case 'POST': res = await api.webapi.post(webApiAdvPath.trim(), body); break;
        case 'PUT': res = await api.webapi.put(webApiAdvPath.trim(), body); break;
        case 'DELETE': res = await api.webapi.delete(webApiAdvPath.trim()); break;
      }
      setWebApiAdvResult(typeof res === 'string' ? res : JSON.stringify(res, null, 2));
    } catch (e: any) {
      setWebApiAdvResult('Error: ' + String(e?.message||e));
    } finally {
      setWebApiAdvBusy(false);
    }
  };

  if (bridgeError) {
    return <section className="panel"><h2 className="panel-title">Settings</h2><div style={{ color:'#d27d2c', fontSize:13 }}>{bridgeError}</div><div style={{ marginTop:12 }}><button onClick={()=>location.reload()}>Reload App</button></div></section>;
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Settings</h2>
      <div style={{ display: 'grid', gap: 10, maxWidth: 800 }}>
        <div>
          <label>Workspace Root</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={{ flex: 1 }} value={workspaceRoot} onChange={(e) => setWorkspaceRoot(e.target.value)} />
            <button onClick={browse}>Browse…</button>
          </div>
          <small>All installs, mods, backups, and configs are contained here.</small>
        </div>
        <div>
          <label>Web API Token</label>
          <div style={{ display:'flex', gap:8 }}>
            <input type="password" style={{ flex:1 }} value={webApiToken} onChange={(e)=>setWebApiToken(e.target.value)} placeholder={webApiTokenPresent ? 'Token set (enter new to replace)' : 'Enter token'} />
            <button onClick={saveToken}>{webApiTokenPresent ? 'Update' : 'Save'}</button>
            {webApiTokenPresent && <button onClick={async ()=>{ await (window as any).api.token.clear(); setWebApiTokenPresent(false); setSaved('Token cleared'); setTimeout(()=>setSaved(''),1500); }}>Clear</button>}
          </div>
          <small>Stored locally in a separate file. Not synced or transmitted. Leave blank and press Clear to remove.</small>
        </div>
        <div>
          <label>Web API Base URL</label>
          <input style={{ width:'100%' }} value={webApiBaseUrl} onChange={(e)=>setWebApiBaseUrl(e.target.value)} placeholder="https://api.example.com" />
          <small>Used for generic Web API calls. Must be HTTPS. Calls include Authorization Bearer token.</small>
        </div>
        <fieldset style={{ border:'1px solid var(--border)', padding:12, borderRadius:'var(--radius)' }}>
          <legend style={{ padding:'0 6px', fontSize:12 }}>Web API Test</legend>
          <div style={{ display:'flex', gap:8 }}>
            <input style={{ flex:1 }} value={webApiTestPath} onChange={(e)=>setWebApiTestPath(e.target.value)} />
            <button disabled={webApiTestBusy || !webApiTestPath.trim()} onClick={testWebApi}>{webApiTestBusy ? 'Testing...' : 'GET Test'}</button>
          </div>
          <small>Endpoint path appended to Base URL (e.g. /status). Requires token & non-offline mode.</small>
          {webApiTestResult && <pre style={{ marginTop:8, maxHeight:180, overflow:'auto', background:'#111', padding:8, fontSize:12 }}>{webApiTestResult}</pre>}
        </fieldset>
        <fieldset style={{ border:'1px solid var(--border)', padding:12, borderRadius:'var(--radius)' }}>
          <legend style={{ padding:'0 6px', fontSize:12 }}>Web API Advanced</legend>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            <select value={webApiAdvMethod} onChange={(e)=>setWebApiAdvMethod(e.target.value as any)}>
              <option>GET</option>
              <option>POST</option>
              <option>PUT</option>
              <option>DELETE</option>
            </select>
            <input style={{ flex:1, minWidth:220 }} value={webApiAdvPath} onChange={(e)=>setWebApiAdvPath(e.target.value)} placeholder="endpoint path" />
            <button disabled={webApiAdvBusy || !webApiAdvPath.trim()} onClick={runAdvancedWebApi}>{webApiAdvBusy ? 'Running...' : 'Send'}</button>
            <button style={{ opacity:0.8 }} disabled={webApiAdvBusy} onClick={async ()=>{ const h = await (window as any).api.webapi.history(); alert(h.map((r:any)=>`${r.ts} ${r.method} ${r.path} ${r.ok? 'OK':'ERR'}`).join('\n')); }}>History</button>
          </div>
          {(webApiAdvMethod==='POST'||webApiAdvMethod==='PUT') && <div style={{ marginTop:8 }}>
            <label style={{ fontSize:12 }}>JSON Body</label>
            <textarea style={{ width:'100%', minHeight:120, fontFamily:'monospace', fontSize:12 }} value={webApiAdvBody} onChange={(e)=>setWebApiAdvBody(e.target.value)} />
          </div>}
          {webApiAdvResult && <pre style={{ marginTop:8, maxHeight:240, overflow:'auto', background:'#111', padding:8, fontSize:12 }}>{webApiAdvResult}</pre>}
        </fieldset>
        <div>
          <label>Default Workshop App</label>
          <select value={defaultWorkshopAppId} onChange={(e) => setDefaultWorkshopAppId(Number(e.target.value))}>
            {WORKSHOP_CHOICES.map((o) => (
              <option key={o.id} value={o.id}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="checkbox" checked={offlineMode} onChange={async (e)=>{
              const value = e.target.checked;
              setOfflineMode(value);
              try {
                if ((window as any).api?.settings?.setOfflineMode) {
                  await (window as any).api.settings.setOfflineMode(value);
                } else {
                  // fallback persist (no broadcast)
                  await (window as any).api.settings.set({ offlineMode: value });
                }
              } catch(err:any){ console.error('[SettingsPanel] offline toggle persist failed', err); }
            }} /> Offline Mode
          </label>
          <small>{offlineMode ? 'Offline: network-dependent features are blocked.' : 'Online: SteamCMD, CurseForge, RCON enabled.'}</small>
          <div style={{ marginTop:4, fontSize:11, opacity:.7 }}>Current main process value may lag if fallback used.</div>
        </div>
        <div>
          <label>CurseForge API Key</label>
          <input style={{ width:'100%' }} value={curseforgeApiKey} onChange={(e)=>setCurseforgeApiKey(e.target.value)} placeholder="Enter API Key (kept locally)" />
          <small>Used for querying CurseForge mods. Stored only locally. Leave blank to disable CurseForge search.</small>
        </div>
        <fieldset style={{ border:'1px solid var(--border)', padding:12, borderRadius:'var(--radius)' }}>
          <legend style={{ padding:'0 6px', fontSize:12 }}>Claude AI</legend>
          <label style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="checkbox" checked={claudeEnabled} onChange={(e)=>setClaudeEnabled(e.target.checked)} /> Enable Claude Integration
          </label>
          <div style={{ marginTop:8 }}>
            <label>Anthropic API Key</label>
            <input type="password" style={{ width:'100%' }} value={anthropicApiKey} onChange={(e)=>setAnthropicApiKey(e.target.value)} placeholder={anthropicApiKey ? 'Key set (enter to replace)' : 'Enter API Key'} />
            <small>Stored locally only. Required for Claude API calls. Leave blank to disable.</small>
          </div>
            <div style={{ marginTop:8 }}>
              <label>Model Override</label>
              <input style={{ width:'100%' }} value={claudeModel} onChange={(e)=>setClaudeModel(e.target.value)} placeholder="claude-sonnet-4.5" />
              <small>Advanced: override default model id. Ensure account access.</small>
            </div>
          <div style={{ marginTop:4, fontSize:11, opacity:.7 }}>Use Claude panel to chat or stream responses. Offline Mode blocks requests.</div>
        </fieldset>
        <fieldset style={{ border:'1px solid var(--border)', padding:12, borderRadius:'var(--radius)' }}>
          <legend style={{ padding:'0 6px', fontSize:12 }}>Auto Update</legend>
          <label style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="checkbox" checked={autoUpdateEnabled} onChange={(e)=>setAutoUpdateEnabled(e.target.checked)} /> Enable Auto Update
          </label>
          <div style={{ marginTop:8 }}>
            <label>Cron Expression</label>
            <input style={{ width:'100%' }} value={autoUpdateCron} onChange={(e)=>setAutoUpdateCron(e.target.value)} />
            <small>Schedule for server + mod updates. Default hourly: 0 * * * *</small>
          </div>
        </fieldset>
        <fieldset style={{ border:'1px solid var(--border)', padding:12, borderRadius:'var(--radius)' }}>
          <legend style={{ padding:'0 6px', fontSize:12 }}>Save Cleanup</legend>
          <label style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="checkbox" checked={saveCleanupEnabled} onChange={(e)=>setSaveCleanupEnabled(e.target.checked)} /> Enable Save Cleanup
          </label>
          <div style={{ display:'grid', gap:8, gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', marginTop:8 }}>
            <div>
              <label>Retention Days</label>
              <input type="number" min={1} value={saveCleanupRetentionDays} onChange={(e)=>setSaveCleanupRetentionDays(Number(e.target.value)||1)} />
            </div>
            <div>
              <label>Keep Latest World Saves</label>
                <input type="number" min={1} value={saveCleanupMaxWorldFiles} onChange={(e)=>setSaveCleanupMaxWorldFiles(Number(e.target.value)||1)} />
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <label>Cleanup Cron</label>
              <input style={{ width:'100%' }} value={saveCleanupCron} onChange={(e)=>setSaveCleanupCron(e.target.value)} />
              <small>When distinct from auto update. Default daily 02:30: 30 2 * * *</small>
            </div>
            <div style={{ gridColumn:'1 / -1' }}>
              <button onClick={async ()=>{ if(!saveCleanupEnabled) return; const servers = (await window.api.profiles.list()).servers; for(const s of servers){ await window.api.saves.cleanup(s.id); } setSaved('Cleanup run'); setTimeout(()=>setSaved(''),1500); }}>Run Cleanup Now (All Servers)</button>
            </div>
          </div>
          <small>Deletes old player/tribe/profile files older than retention while keeping newest world .ark saves.</small>
        </fieldset>
        <div>
          <button className="btn-primary" onClick={save}>Save Settings</button>
          <span style={{ marginLeft: 8, opacity: 0.7 }}>{saved}</span>
        </div>
        <fieldset style={{ border:'1px solid var(--border)', padding:12, borderRadius:'var(--radius)' }}>
          <legend style={{ padding:'0 6px', fontSize:12 }}>Application Update</legend>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <button disabled={appUpdateBusy || offlineMode} onClick={async ()=>{
              setAppUpdateBusy(true); setAppUpdateLog(''); setAppUpdateOk(null);
              try {
                const res = await (window as any).api.appupdate.run();
                if (!res.ok) {
                  setAppUpdateOk(false);
                  let advice = '';
                  const out = (res.output||res.error||'').toLowerCase();
                  if (/git --version failed/i.test(res.error||'') || /not recognized/i.test(out)) {
                    advice = '\nHint: Git is not available on PATH. Install Git (https://git-scm.com/downloads) and reopen the app.';
                  } else if (/offline mode/i.test(out)) {
                    advice = '\nHint: Disable Offline Mode in Settings to run updates.';
                  } else if (/repository not found|\.git missing/i.test(out)) {
                    advice = '\nHint: Packaged builds are read-only. Run from a cloned Git repo for update.';
                  }
                  setAppUpdateLog(`[${res.step||'error'}] code=${res.code} \n${res.output || res.error}${advice}`);
                } else {
                  setAppUpdateOk(true);
                  const preflight = res.preflight ? `Git detected: ${res.preflight}\n\n` : '';
                  const logLines = res.steps.map((s:any)=>`> git ${s.args.join(' ')}\n${s.result.output.trim()}`).join('\n\n');
                  setAppUpdateLog(preflight + logLines);
                }
              } catch (e:any) {
                setAppUpdateOk(false); setAppUpdateLog('Exception: ' + String(e?.message||e));
              } finally { setAppUpdateBusy(false); }
            }}>{appUpdateBusy ? 'Updating…' : 'Update from Git'}</button>
            <button disabled={appUpdateBusy || !appUpdateOk} onClick={async ()=>{ const r = await (window as any).api.appupdate.restart(); if(!r.ok) alert('Restart failed: '+r.error); }}>Restart App</button>
            {offlineMode && <span style={{ fontSize:11, opacity:.7 }}>Offline Mode blocks update.</span>}
          </div>
          <small style={{ display:'block', marginTop:4 }}>Runs git fetch --all --prune and git pull --rebase in application directory (development/unpacked only).</small>
          {appUpdateLog && <pre style={{ marginTop:8, maxHeight:200, overflow:'auto', background:'#111', padding:8, fontSize:11, whiteSpace:'pre-wrap' }}>{appUpdateLog}</pre>}
        </fieldset>
      </div>
    </section>
  );
}
