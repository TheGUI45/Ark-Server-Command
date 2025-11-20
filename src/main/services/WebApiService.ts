import { AppSettings } from './SettingsService.js';

/**
 * Minimal generic Web API client that uses the stored token for Authorization.
 * Throws informative errors for missing token, base URL, or offline mode.
 */
export class WebApiService {
  constructor(private getSettings: () => AppSettings, private getToken: () => string | undefined) {}

  private buildUrl(path: string) {
    const base = (this.getSettings().webApiBaseUrl || '').trim();
    if (!base) throw new Error('Web API base URL not configured. Set it in Settings.');
    return base.replace(/\/$/, '') + '/' + path.replace(/^\//, '');
  }

  private authHeaders() {
    const token = this.getToken();
    if (!token) throw new Error('Web API token missing. Add it in Settings.');
    return { Authorization: `Bearer ${token}` };
  }

  async get(path: string): Promise<any> {
    const s = this.getSettings();
    if (s.offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to call Web API.');
    const url = this.buildUrl(path);
    const res = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json', ...this.authHeaders() },
    });
    if (!res.ok) throw new Error(`GET ${url} failed: ${res.status} ${res.statusText}`);
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }

  async post(path: string, body: any): Promise<any> {
    const s = this.getSettings();
    if (s.offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to call Web API.');
    const url = this.buildUrl(path);
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(body ?? {})
    });
    if (!res.ok) throw new Error(`POST ${url} failed: ${res.status} ${res.statusText}`);
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }

  async put(path: string, body: any): Promise<any> {
    const s = this.getSettings();
    if (s.offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to call Web API.');
    const url = this.buildUrl(path);
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', ...this.authHeaders() },
      body: JSON.stringify(body ?? {})
    });
    if (!res.ok) throw new Error(`PUT ${url} failed: ${res.status} ${res.statusText}`);
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }

  async delete(path: string): Promise<any> {
    const s = this.getSettings();
    if (s.offlineMode) throw new Error('Offline Mode enabled. Disable in Settings to call Web API.');
    const url = this.buildUrl(path);
    const res = await fetch(url, {
      method: 'DELETE',
      headers: { 'Accept': 'application/json', ...this.authHeaders() }
    });
    if (!res.ok) throw new Error(`DELETE ${url} failed: ${res.status} ${res.statusText}`);
    const ct = res.headers.get('content-type') || '';
    return ct.includes('application/json') ? res.json() : res.text();
  }
}
