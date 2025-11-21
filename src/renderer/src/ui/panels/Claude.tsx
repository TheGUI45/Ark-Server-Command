import React, { useState, useEffect, useRef } from 'react';

export function ClaudePanel() {
  const [enabled, setEnabled] = useState<boolean>(false);
  const [apiKeyPresent, setApiKeyPresent] = useState<boolean>(false);
  const [model, setModel] = useState<string>('');
  const [prompt, setPrompt] = useState<string>('');
  const [system, setSystem] = useState<string>('Helpful assistant for Ark server administration.');
  const [busy, setBusy] = useState<boolean>(false);
  const [response, setResponse] = useState<string>('');
  const [streaming, setStreaming] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const streamAbortRef = useRef<() => void>();

  useEffect(() => {
    (async () => {
      try {
        const s = await (window as any).api.settings.get();
        setEnabled(!!s.claudeEnabled);
        setApiKeyPresent(!!s.anthropicApiKey);
        setModel(s.claudeModel || 'claude-sonnet-4.5');
      } catch (e:any) {
        setError('Failed to load settings: ' + String(e?.message||e));
      }
    })();
  }, []);

  const runComplete = async () => {
    setBusy(true); setError(''); setResponse('');
    try {
      const res = await (window as any).api.claude.complete(prompt, system);
      if (!res.ok) throw new Error(res.error || 'Unknown error');
      setResponse(res.text);
    } catch(e:any){
      setError(String(e?.message||e));
    } finally { setBusy(false); }
  };

  const runStream = async () => {
    setError(''); setResponse(''); setStreaming(true); setBusy(true);
    try {
      const abort = (window as any).api.claude.stream(prompt, system, (ev:any) => {
        if (ev.type === 'chunk' && ev.text) {
          setResponse(r => r + ev.text);
        } else if (ev.type === 'error') {
          setError(ev.error || 'Stream error');
          setStreaming(false); setBusy(false);
        } else if (ev.type === 'done') {
          setStreaming(false); setBusy(false);
        }
      });
      streamAbortRef.current = abort;
    } catch(e:any){
      setError(String(e?.message||e)); setStreaming(false); setBusy(false);
    }
  };

  const stopStream = () => {
    try { streamAbortRef.current && streamAbortRef.current(); } catch {}
    setStreaming(false); setBusy(false);
  };

  if (error) {
    return <section className="panel"><h2 className="panel-title">Claude AI</h2><div style={{ color:'#d27d2c', fontSize:13 }}>{error}</div></section>;
  }

  return (
    <section className="panel">
      <h2 className="panel-title">Claude AI</h2>
      <div style={{ display:'flex', flexDirection:'column', gap:12, maxWidth:800 }}>
        <div style={{ fontSize:12, opacity:.8 }}>
          {enabled ? 'Enabled' : 'Disabled'} • {apiKeyPresent ? 'API Key Set' : 'API Key Missing'} • Model: {model || 'default'}
        </div>
        {!enabled && <div style={{ fontSize:12, color:'#d27d2c' }}>Claude is disabled. Enable and set API key in Settings.</div>}
        <div>
          <label style={{ fontSize:12 }}>System Prompt (optional)</label>
          <input style={{ width:'100%' }} value={system} onChange={(e)=>setSystem(e.target.value)} disabled={busy} />
        </div>
        <div>
          <label style={{ fontSize:12 }}>User Prompt</label>
          <textarea style={{ width:'100%', minHeight:120, fontFamily:'monospace', fontSize:13 }} value={prompt} onChange={(e)=>setPrompt(e.target.value)} disabled={busy && !streaming} />
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button disabled={busy || !enabled || !apiKeyPresent || !prompt.trim()} onClick={runComplete}>{busy && !streaming ? 'Running…' : 'Complete'}</button>
          <button disabled={busy || !enabled || !apiKeyPresent || !prompt.trim() || streaming} onClick={runStream}>{streaming ? 'Streaming…' : 'Stream'}</button>
          {streaming && <button onClick={stopStream}>Stop</button>}
          <button style={{ opacity:.7 }} disabled={busy && !streaming} onClick={()=>{ setPrompt(''); setResponse(''); }}>Clear</button>
        </div>
        {response && <pre style={{ marginTop:4, background:'#111', padding:8, fontSize:12, whiteSpace:'pre-wrap', maxHeight:300, overflow:'auto' }}>{response}</pre>}
      </div>
    </section>
  );
}
