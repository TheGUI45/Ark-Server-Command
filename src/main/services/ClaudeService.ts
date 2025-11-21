import { AppSettings } from './SettingsService.js';

interface CompleteArgs { prompt: string; system?: string; maxTokens?: number }
interface StreamArgs { prompt: string; system?: string; jobId: string; maxTokens?: number }
interface StreamEvent { jobId: string; type: 'start' | 'chunk' | 'done' | 'error'; text?: string; error?: string }

export class ClaudeService {
  private getSettings: () => AppSettings;
  private lastWindowMs = 0;
  private callsInWindow = 0;
  private readonly windowMs = 60_000; // 1 minute
  private readonly maxCallsPerWindow = 20; // basic rate limiting safeguard

  constructor(getSettings: () => AppSettings) {
    this.getSettings = getSettings;
  }

  private rateLimitCheck() {
    const now = Date.now();
    if (now - this.lastWindowMs > this.windowMs) {
      this.lastWindowMs = now;
      this.callsInWindow = 0;
    }
    this.callsInWindow++;
    if (this.callsInWindow > this.maxCallsPerWindow) {
      throw new Error('Claude rate limit exceeded. Try again later.');
    }
  }

  async complete(args: CompleteArgs) {
    this.rateLimitCheck();
    const settings = this.getSettings();
    const apiKey = settings.anthropicApiKey;
    const model = settings.claudeModel || 'claude-sonnet-4.5';
    if (!apiKey) throw new Error('Anthropic API key missing.');
    const body: any = {
      model,
      max_tokens: args.maxTokens || 1024,
      messages: [
        { role: 'user', content: [ { type: 'text', text: args.prompt } ] }
      ]
    };
    if (args.system) body.system = args.system;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const txt = await res.text();
      throw new Error('Claude API error: ' + res.status + ' ' + txt.slice(0, 400));
    }
    const json: any = await res.json();
    // Aggregate text from content blocks
    const parts = Array.isArray(json.content) ? json.content.filter((c: any) => c.type === 'text').map((c: any) => c.text) : [];
    return { ok: true, model, text: parts.join('\n') };
  }

  async stream(args: StreamArgs, emit: (ev: StreamEvent) => void) {
    this.rateLimitCheck();
    const settings = this.getSettings();
    const apiKey = settings.anthropicApiKey;
    const model = settings.claudeModel || 'claude-sonnet-4.5';
    if (!apiKey) { emit({ jobId: args.jobId, type: 'error', error: 'Anthropic API key missing.' }); return; }
    const body: any = {
      model,
      max_tokens: args.maxTokens || 1024,
      stream: true,
      messages: [ { role: 'user', content: [ { type: 'text', text: args.prompt } ] } ]
    };
    if (args.system) body.system = args.system;
    let res: Response;
    try {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(body)
      });
    } catch (e: any) {
      emit({ jobId: args.jobId, type: 'error', error: 'Network error: ' + String(e?.message || e) });
      return;
    }
    if (!res.ok || !res.body) {
      const txt = await res.text();
      emit({ jobId: args.jobId, type: 'error', error: 'Claude API error: ' + res.status + ' ' + txt.slice(0, 400) });
      return;
    }
    emit({ jobId: args.jobId, type: 'start' });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Streaming events are SSE style lines beginning with 'data:'
        const lines = buffer.split(/\r?\n/);
        // Keep last partial line in buffer
        buffer = lines.pop() || '';
        for (const line of lines) {
          const trimmed = line.trim();
            if (!trimmed) continue;
            if (trimmed.startsWith('data:')) {
              const jsonPart = trimmed.slice(5).trim();
              if (jsonPart === '[DONE]') continue; // anthopic may send terminator
              try {
                const evt = JSON.parse(jsonPart);
                if (evt.type === 'content_block_delta' && evt.delta && evt.delta.text) {
                  emit({ jobId: args.jobId, type: 'chunk', text: evt.delta.text });
                } else if (evt.type === 'message_delta' && evt.delta && evt.delta.stop_reason) {
                  // ignore
                } else if (evt.type === 'error') {
                  emit({ jobId: args.jobId, type: 'error', error: evt.error?.message || 'Claude stream error' });
                }
              } catch {}
            }
        }
      }
      emit({ jobId: args.jobId, type: 'done' });
    } catch (e: any) {
      emit({ jobId: args.jobId, type: 'error', error: 'Stream failure: ' + String(e?.message || e) });
    }
  }
}
