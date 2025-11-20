import React, { useEffect, useMemo, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

export function BackupsPanel() {
  const [jobs, setJobs] = useState<Array<any>>([]);
  const [workspaceRoot, setWorkspaceRoot] = useState('');

  const empty = useMemo(() => ({
    id: uuidv4(),
    label: 'Server Backup',
    sourceDir: '',
    targetDir: '',
    scheduleCron: '',
    retention: 5,
  }), []);

  const [draft, setDraft] = useState<any>(empty);

  const load = async () => {
    const s = await window.api.settings.get();
    setWorkspaceRoot(s.workspaceRoot);
    const list = await window.api.backup.list();
    setJobs(list);
  };

  useEffect(() => { load(); }, []);

  const onSave = async () => {
    if (!draft.sourceDir || !draft.targetDir) return;
    const job = await window.api.backup.upsert(draft);
    setDraft({ ...empty, id: uuidv4() });
    setJobs((prev) => {
      const idx = prev.findIndex((j) => j.id === job.id);
      if (idx >= 0) { const cp = prev.slice(); cp[idx] = job; return cp; }
      return [...prev, job];
    });
  };

  const onDelete = async (id: string) => {
    await window.api.backup.delete(id);
    setJobs((j) => j.filter((x) => x.id !== id));
  };

  const onRunNow = async (id: string) => {
    const res = await window.api.backup.runNow(id);
    alert(`Backup created: ${res.path}`);
  };

  const pickDir = async (field: 'sourceDir' | 'targetDir') => {
    const dir = await window.api.dialogs.chooseDirectory();
    if (!dir) return;
    if (!dir.startsWith(workspaceRoot)) {
      alert('Choose a directory inside the workspace root.');
      return;
    }
    setDraft((d: any) => ({ ...d, [field]: dir }));
  };

  const inputStyle: React.CSSProperties = { width: '100%', padding: 8, background: '#252526', color: '#eaeaea', border: '1px solid #3c3c3c', borderRadius: 4 };
  const labelStyle: React.CSSProperties = { fontSize: 12, opacity: 0.9, marginBottom: 4 };
  const rowStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      <section className="panel">
        <h2 className="panel-title" style={{ marginTop: 0 }}>Create / Update Backup Job</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <div style={labelStyle}>Label</div>
            <input style={inputStyle} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
          </div>
          <div>
            <div style={labelStyle}>Source Directory (inside workspace)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={draft.sourceDir} onChange={(e) => setDraft({ ...draft, sourceDir: e.target.value })} />
              <button onClick={() => pickDir('sourceDir')}>Browse</button>
            </div>
          </div>
          <div>
            <div style={labelStyle}>Target Directory (inside workspace)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input style={{ ...inputStyle, flex: 1 }} value={draft.targetDir} onChange={(e) => setDraft({ ...draft, targetDir: e.target.value })} />
              <button onClick={() => pickDir('targetDir')}>Browse</button>
            </div>
          </div>
          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>Schedule (CRON, optional)</div>
              <input placeholder="0 3 * * *" style={inputStyle} value={draft.scheduleCron} onChange={(e) => setDraft({ ...draft, scheduleCron: e.target.value })} />
            </div>
            <div>
              <div style={labelStyle}>Retention (number of zips)</div>
              <input type="number" min={1} style={inputStyle} value={draft.retention ?? 5} onChange={(e) => setDraft({ ...draft, retention: Number(e.target.value) })} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onSave}>Save Job</button>
            <button onClick={() => setDraft({ ...empty, id: uuidv4() })}>Reset</button>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title" style={{ marginTop: 0 }}>Scheduled Jobs</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {jobs.length === 0 && <div style={{ opacity: 0.8 }}>No backup jobs yet.</div>}
          {jobs.map((j) => (
            <div key={j.id} className="panel panel--tight" style={{ padding:10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontWeight: 600 }}>{j.label}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => onRunNow(j.id)}>Run Now</button>
                  <button onClick={() => onDelete(j.id)}>Delete</button>
                </div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.9, marginTop: 6 }}>
                <div>Source: {j.sourceDir.replace(workspaceRoot, '') || j.sourceDir}</div>
                <div>Target: {j.targetDir.replace(workspaceRoot, '') || j.targetDir}</div>
                <div>Schedule: {j.scheduleCron || '—'}</div>
                <div>Retention: {j.retention ?? '—'}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
