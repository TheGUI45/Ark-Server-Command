import React, { useEffect, useState, useRef } from 'react';
import DraggableResizablePanel from '../../components/DraggableResizablePanel';
import {
  Chart as ChartJS,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  ArcElement,
  BarElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, ArcElement, BarElement, Tooltip, Legend);

export function DashboardPanel() {
    const doWipe = async () => {
      if (!rconPassword) { setWipeStatus('Enter password'); setTimeout(()=>setWipeStatus(''),1500); return; }
      try {
        await (window as any).api?.rcon?.wildDinoWipe?.(rconHost, Number(rconPort), rconPassword);
        setWipeStatus('Wipe sent');
        setTimeout(()=>setWipeStatus(''),2000);
      } catch(e:any){
        setWipeStatus('Failed');
        setTimeout(()=>setWipeStatus(''),2000);
      }
    };
  const [metrics, setMetrics] = useState<any>(null);
  const [servers, setServers] = useState<any[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  interface ReportState {
    crashLogs: string[];
    playerConnections: string[];
    adminCommands: string[];
    entries?: { crashes: { ts?: string; line: string }[]; connections: { ts?: string; line: string }[]; admins: { ts?: string; line: string }[] };
    summaries?: { crashCount: number; connectionCount: number; adminCommandCount: number; byHour: { hour: string; crashes: number; connections: number; admin: number }[] };
  }
  const [reports, setReports] = useState<ReportState | null>(null);
  const [rconHost, setRconHost] = useState('127.0.0.1');
  const [rconPort, setRconPort] = useState(27020);
  const [rconPassword, setRconPassword] = useState('');
  const [wipeStatus, setWipeStatus] = useState('');
  const [refreshMs, setRefreshMs] = useState(5000);
  const [perf, setPerf] = useState<any>(null);
  const historyRef = useRef<{ totalCpu: number[]; totalMem: number[]; perProcess: Record<string, { cpu: number[]; mem: number[] }> }>({ totalCpu: [], totalMem: [], perProcess: {} });
  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState<boolean>(false);
  const [updateStatus, setUpdateStatus] = useState<string>('');
  useEffect(() => { (async () => { try { const m = await (window as any).api?.analytics?.get?.(); setMetrics(m); } catch {} })(); }, []);
  useEffect(() => { (async () => { try { const p = await (window as any).api?.profiles?.list?.(); setServers(p.servers || []); if (!selectedServerId && p.servers?.length) setSelectedServerId(p.servers[0].id); } catch {} })(); }, [selectedServerId]);
  useEffect(() => { (async () => { if (!selectedServerId) return; try { const r = await (window as any).api?.reports?.get?.(selectedServerId); setReports(r); } catch {} })(); }, [selectedServerId]);
  useEffect(() => { (async () => { try { const s = await (window as any).api?.settings?.get?.(); setAutoUpdateEnabled(!!s.autoUpdateEnabled); } catch {} })(); }, []);
  // auto-refresh at adjustable interval
  useEffect(() => {
    if (!selectedServerId) return;
    const interval = setInterval(async () => {
      try { const r = await (window as any).api?.reports?.get?.(selectedServerId); setReports(r); } catch {}
    }, refreshMs);
    return () => clearInterval(interval);
  }, [selectedServerId, refreshMs]);
  // performance polling (reuse interval)
  useEffect(() => {
    if (!selectedServerId) return;
    const interval = setInterval(async () => {
      try { const p = await (window as any).api?.perf?.getServerUsage?.(selectedServerId); if (p) pushPerfHistory(p, historyRef); setPerf(p); } catch {}
    }, refreshMs);
    (async () => { try { const p = await (window as any).api?.perf?.getServerUsage?.(selectedServerId); if (p) pushPerfHistory(p, historyRef); setPerf(p); } catch {} })();
    return () => clearInterval(interval);
  }, [selectedServerId, refreshMs]);

  const m = metrics || { backupJobCount: 0, totalBackupsZipCount: 0, estimatedBackupsSizeMB: 0, lastBackupAgeMinutes: null, modIdsTracked: 0, offlineMode: true };

  const barData = {
    labels: ['Backup Jobs', 'Backups', 'Mods Tracked'],
    datasets: [{ label: 'Counts', data: [m.backupJobCount, m.totalBackupsZipCount, m.modIdsTracked], backgroundColor: ['#0e639c', '#d27d2c', '#4caf50'] }]
  };
  const lineData = {
    labels: Array.from({ length: 7 }, (_, i) => `D-${6 - i}`),
    datasets: [{ label: 'Backups (stub)', data: [2,3,1,4,0,5,3], borderColor: '#61dafb', backgroundColor: 'rgba(97,218,251,0.2)' }]
  };
  const doughnutData = {
    labels: ['Used (MB)', 'Free (MB)'],
    datasets: [{ data: [m.estimatedBackupsSizeMB, Math.max(0, 1024 - m.estimatedBackupsSizeMB)], backgroundColor: ['#d27d2c', '#2d2d2d'] }]
  };

  return (
    <div className="free-layout-canvas">
      <DraggableResizablePanel id="overview" defaultX={20} defaultY={20} defaultWidth={380} defaultHeight={260} className="panel">
        <ChartPanel title="Backup / Mod Overview">
          <Bar data={barData} options={chartOpts} />
        </ChartPanel>
      </DraggableResizablePanel>
      <DraggableResizablePanel id="activity" defaultX={420} defaultY={20} defaultWidth={380} defaultHeight={260} className="panel">
        <ChartPanel title="Backup Activity (7d)">
          <Line data={lineData} options={chartOpts} />
        </ChartPanel>
      </DraggableResizablePanel>
      <DraggableResizablePanel id="storage" defaultX={820} defaultY={20} defaultWidth={340} defaultHeight={260} className="panel">
        <ChartPanel title="Backup Storage (Est.)">
          <div style={{ height: '180px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Doughnut data={doughnutData} options={{ plugins: { legend: { display: false } } }} />
          </div>
          <div style={{ marginTop: 6, fontSize: 12, textAlign: 'center' }}>Approx {m.estimatedBackupsSizeMB} MB used</div>
        </ChartPanel>
      </DraggableResizablePanel>
      <DraggableResizablePanel id="status" defaultX={20} defaultY={300} defaultWidth={300} defaultHeight={200} className="panel">
        <ChartPanel title="Status">
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 12, lineHeight: '18px' }}>
            <li>Offline Mode: {m.offlineMode ? 'Enabled' : 'Disabled'}</li>
            <li>Last Backup Age: {m.lastBackupAgeMinutes == null ? 'N/A' : m.lastBackupAgeMinutes + ' min'}</li>
          </ul>
        </ChartPanel>
      </DraggableResizablePanel>
      <DraggableResizablePanel id="perf" defaultX={340} defaultY={300} defaultWidth={520} defaultHeight={340} className="panel">
        <ChartPanel title="Server CPU / RAM">
          {!selectedServerId && <div style={{ fontSize:12 }}>Select a server.</div>}
          {selectedServerId && !perf && <div style={{ fontSize:12 }}>Loading...</div>}
          {perf && (
            <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:12 }}>
              {perf.note && <div style={{ opacity:0.6 }}>{perf.note}</div>}
              <div style={{ display:'flex', gap:18, flexWrap:'wrap' }}>
                <MetricBox label="Total CPU" value={perf.totalCpu.toFixed(1) + '%'} />
                <MetricBox label="Total RAM" value={perf.totalMemoryMB.toFixed(0) + ' MB'} />
                <MetricBox label="RAM %" value={perf.systemTotalMemoryMB ? ((perf.totalMemoryMB / perf.systemTotalMemoryMB) * 100).toFixed(2) + '%' : '—'} />
                <MetricBox label="Processes" value={String(perf.processes.length)} />
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:4, maxHeight:140, overflow:'auto', fontSize:11 }}>
                {perf.processes.map((p: any) => {
                  const histCpu = historyRef.current.perProcess[String(p.pid)]?.cpu || [];
                  const histMem = historyRef.current.perProcess[String(p.pid)]?.mem || [];
                  return (
                    <div key={p.pid} style={{ display:'flex', flexDirection:'column', background:'#1e1e1e', border:'1px solid #333', borderRadius:4, padding:4 }}>
                      <div style={{ display:'flex', justifyContent:'space-between' }}>
                        <span>PID {p.pid}</span>
                        <span>{p.cpu.toFixed(1)}% | {p.memoryMB.toFixed(0)} MB</span>
                      </div>
                      <div style={{ display:'flex', gap:4 }}>
                        <Sparkline values={histCpu} color="#61dafb" label="CPU" />
                        <Sparkline values={histMem} color="#d27d2c" label="MB" />
                      </div>
                    </div>
                  );
                })}
                {perf.processes.length === 0 && <div style={{ opacity:0.6 }}>No processes detected.</div>}
              </div>
            </div>
          )}
        </ChartPanel>
      </DraggableResizablePanel>
      <DraggableResizablePanel id="update" defaultX={880} defaultY={300} defaultWidth={380} defaultHeight={200} className="panel">
        <ChartPanel title="Server Update">
          {!selectedServerId && <div style={{ fontSize:12 }}>Select a server to update.</div>}
          {selectedServerId && (
            <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:12 }}>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <button onClick={async ()=>{ try { setUpdateStatus('Updating...'); await (window as any).api?.server?.update?.(selectedServerId,'steamcmd'); setUpdateStatus('Done'); setTimeout(()=>setUpdateStatus(''),2000); } catch { setUpdateStatus('Failed'); } }} style={{ padding:'6px 10px' }}>Update Server Now</button>
                <label style={{ display:'flex', alignItems:'center', gap:4 }}>
                  <input type="checkbox" checked={autoUpdateEnabled} onChange={async e=>{ const en=e.target.checked; setAutoUpdateEnabled(en); try { await (window as any).api?.autoupdate?.toggle?.(en); } catch {} }} /> Auto-update
                </label>
                <span style={{ fontSize:11, opacity:0.7 }}>{updateStatus}</span>
              </div>
              <div style={{ fontSize:11, opacity:0.6 }}>Runs SteamCMD app_update (no validate) and refreshes ActiveMods hourly when enabled.</div>
            </div>
          )}
        </ChartPanel>
      </DraggableResizablePanel>
      <DraggableResizablePanel id="reports" defaultX={20} defaultY={660} defaultWidth={900} defaultHeight={420} className="panel">
        <ChartPanel title="Server Reports">
          {servers.length === 0 && <div style={{ fontSize:12 }}>No servers defined.</div>}
          {servers.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:12 }}>Server
                <select value={selectedServerId} onChange={e=>setSelectedServerId(e.target.value)} style={{ width:'100%', marginTop:4 }}>
                  {servers.map(s=> <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              {reports?.summaries && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:10, fontSize:11, alignItems:'center' }}>
                  <div>Crashes: <strong>{reports.summaries.crashCount}</strong></div>
                  <div>Connections: <strong>{reports.summaries.connectionCount}</strong></div>
                  <div>Admin Cmds: <strong>{reports.summaries.adminCommandCount}</strong></div>
                  <label style={{ display:'flex', alignItems:'center', gap:4 }}>
                    <span style={{ opacity:0.7 }}>Refresh(ms)</span>
                    <input
                      type="number"
                      value={refreshMs}
                      onChange={e=> setRefreshMs(Math.min(Math.max(Number(e.target.value)||5000, 1000), 60000))}
                      style={{ width:70, background:'#1e1e1e', color:'#eee', border:'1px solid #444', padding:'2px 4px', fontSize:11, borderRadius:4 }}
                    />
                  </label>
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(140px,1fr))', gap:6, fontSize:11 }}>
                <ReportBox title="Crash Logs" items={reports?.crashLogs || []} />
                <ReportBox title="Player Connections" items={reports?.playerConnections || []} />
                <ReportBox title="Admin Commands" items={reports?.adminCommands || []} />
              </div>
              {reports?.summaries?.byHour?.length ? (
                <div style={{ fontSize:11, maxHeight:100, overflow:'auto', background:'#1e1e1e', border:'1px solid #333', borderRadius:4, padding:6 }}>
                  <div style={{ fontWeight:600, marginBottom:4 }}>Hourly (last {reports.summaries.byHour.length} hrs)</div>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead>
                      <tr style={{ textAlign:'left', fontSize:10 }}>
                        <th>Hour</th><th>C</th><th>Conn</th><th>Adm</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reports.summaries.byHour.slice(-24).map(h=> (
                        <tr key={h.hour} style={{ fontSize:10 }}>
                          <td>{h.hour.replace('T',' ')}</td>
                          <td>{h.crashes}</td>
                          <td>{h.connections}</td>
                          <td>{h.admin}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ): null}
              <div style={{ display:'grid', gap:4, fontSize:11 }}>
                <strong>Wild Dino Wipe</strong>
                <div style={{ display:'flex', gap:4 }}>
                  <input placeholder="Host" value={rconHost} onChange={e=>setRconHost(e.target.value)} style={miniInput} />
                  <input placeholder="Port" type="number" value={rconPort} onChange={e=>setRconPort(Number(e.target.value)||27020)} style={miniInput} />
                  <input placeholder="RCON Password" type="password" value={rconPassword} onChange={e=>setRconPassword(e.target.value)} style={miniInput} />
                  <button onClick={doWipe} style={{ padding:'4px 8px' }}>Wipe</button>
                  <span style={{ alignSelf:'center', fontSize:11, opacity:0.7 }}>{wipeStatus}</span>
                </div>
                <div style={{ opacity:0.6 }}>Executes DestroyWildDinos via RCON on selected server host.</div>
              </div>
            </div>
          )}
        </ChartPanel>
      </DraggableResizablePanel>
    </div>
  );
}

const chartOpts = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  layout: { padding: 4 }
};

const panelStyleBase: React.CSSProperties = {
  background: '#1b1b1b',
  border: '1px solid #333',
  padding: 10,
  borderRadius: 6,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minHeight: 240,
  maxHeight: 260,
  overflow: 'hidden'
};

function ChartPanel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel panel-chart">
      <h3 className="panel-title">{title}</h3>
      <div style={{ flex:1, position:'relative' }}>{children}</div>
    </div>
  );
}

const panelStyle: React.CSSProperties = panelStyleBase; // retained for any legacy usage
const titleStyle: React.CSSProperties = { margin: 0, marginBottom: 8, fontSize: 14, fontWeight: 600 };

function ReportBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="panel panel--tight" style={{ minHeight:120 }}>
      <div className="panel-title" style={{ fontSize:12 }}>{title}</div>
      <div className="scroll" style={{ flex:1, fontSize:11, lineHeight:'14px', whiteSpace:'pre-wrap' }}>
        {items.length === 0 && <div className="muted">No entries</div>}
        {items.slice(-30).map((l,i)=> <div key={i}>{l}</div>)}
      </div>
    </div>
  );
}

const miniInput: React.CSSProperties = { background:'#1e1e1e', color:'#eee', border:'1px solid #444', padding:'4px 6px', borderRadius:4, fontSize:11, width:130 };
function MetricBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="panel panel--tight" style={{ minWidth:100, padding:'4px 6px' }}>
      <span style={{ fontSize:10, opacity:.7 }}>{label}</span>
      <strong style={{ fontSize:13 }}>{value}</strong>
    </div>
  );
}

function Sparkline({ values, color, label }: { values: number[]; color: string; label: string }) {
  const pts = values.slice(-30);
  if (pts.length === 0) return <div style={{ fontSize:10, opacity:0.4 }}>no {label}</div>;
  const max = Math.max(...pts);
  const min = Math.min(...pts);
  const norm = max === min ? pts.map(()=>50) : pts.map(v => 100 - ((v - min) / (max - min)) * 100);
  const path = norm.map((y,i)=> `${i * (100/ (norm.length -1))},${y}`).join(' ');
  return (
    <svg width={70} height={20} viewBox="0 0 100 100" className="spark-box">
      <polyline points={path} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" />
    </svg>
  );
}

function pushPerfHistory(snapshot: any, historyRef: React.MutableRefObject<{ totalCpu: number[]; totalMem: number[]; perProcess: Record<string, { cpu: number[]; mem: number[] }> }>) {
  const h = historyRef.current;
  h.totalCpu.push(snapshot.totalCpu);
  h.totalMem.push(snapshot.totalMemoryMB);
  if (h.totalCpu.length > 300) { h.totalCpu.shift(); h.totalMem.shift(); }
  snapshot.processes.forEach((p: any) => {
    const key = String(p.pid);
    if (!h.perProcess[key]) h.perProcess[key] = { cpu: [], mem: [] };
    h.perProcess[key].cpu.push(p.cpu);
    h.perProcess[key].mem.push(p.memoryMB);
    if (h.perProcess[key].cpu.length > 300) { h.perProcess[key].cpu.shift(); h.perProcess[key].mem.shift(); }
  });
}

async function doWipe(this: any) { /* placeholder; replaced at runtime */ }

// Bind wipe function after definition to access state via closure inside DashboardPanel
// (Simpler pattern: redefine inside component to capture state)
