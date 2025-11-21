import React, { useState, Component, ReactNode, useEffect } from 'react';
// Placeholder for global error boundary to be added next
import './theme.css';
import { Mods } from './panels/Mods';
import { ClaudePanel } from './panels/Claude';
import dinoIcon from '../assets/dino.png';
import { SettingsPanel } from './panels/Settings';
import { BackupsPanel } from './panels/Backups';
import { ServersPanel } from './panels/Servers';
import { DashboardPanel } from './panels/Dashboard';
import { IniSettingsPanel } from './panels/IniSettings';

class PanelErrorBoundary extends Component<{ children: ReactNode }, { error?: any }> {
  constructor(props: any) { super(props); this.state = { error: undefined }; }
  static getDerivedStateFromError(error: any) { return { error }; }
  componentDidCatch(error: any, info: any) { console.error('[renderer] panel crashed', error, info); }
  render() {
    if (this.state.error) {
      return <div style={{ padding:16, color:'#d27d2c' }}>Panel error: {String(this.state.error?.message || this.state.error)}<br/>Check logs and retry. Switch panels to continue.</div>;
    }
    return this.props.children;
  }
}

export function App(){
  const [panel, setPanel] = useState<'dashboard' | 'servers' | 'mods' | 'backups' | 'settings' | 'inisettings' | 'ai'>('dashboard');
  const [bridgeOk, setBridgeOk] = useState<boolean | null>(null);
  useEffect(()=>{
    const run = async () => {
      try {
        const res = await (window as any).api?.bridge?.ping?.();
        setBridgeOk(!!res?.pong);
      } catch { setBridgeOk(false); }
    }; run();
  }, []);

  const NavButton = ({ id, label }: { id: 'dashboard' | 'servers' | 'mods' | 'backups' | 'settings' | 'inisettings' | 'ai'; label: string }) => (
    <button onClick={() => setPanel(id)} className={panel === id ? 'nav-btn nav-btn--active' : 'nav-btn'}>{label}</button>
  );

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-header__row">
          <img src={dinoIcon} alt="ASA" className="app-icon" />
          <h1 className="app-title">ASA Server Manager</h1>
        </div>
        <nav className="nav-bar">
          <NavButton id="dashboard" label="Dashboard" />
          <NavButton id="servers" label="Servers" />
          <NavButton id="mods" label="Mods" />
          <NavButton id="backups" label="Backups" />
          <NavButton id="settings" label="Settings" />
          <NavButton id="ai" label="Claude AI" />
          <NavButton id="inisettings" label="INI Settings" />
        </nav>
      </header>
      <main className="main-content">
        {bridgeOk === false && <div style={{ background:'#402', padding:8, fontSize:12, marginBottom:8 }}>Bridge self-test failed. Some IPC features may not work. Restart the application.</div>}
        <PanelErrorBoundary>
          {panel === 'dashboard' && <DashboardPanel />}
          {panel === 'servers' && <ServersPanel />}
          {panel === 'mods' && <Mods />}
          {panel === 'backups' && <BackupsPanel />}
          {panel === 'settings' && <SettingsPanel />}
          {panel === 'inisettings' && <IniSettingsPanel />}
          {panel === 'ai' && <ClaudePanel />}
        </PanelErrorBoundary>
      </main>
    </div>
  );
}
