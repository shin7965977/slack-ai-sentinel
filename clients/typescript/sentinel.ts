/**
 * Slack AI Sentinel - Browser & Node.js Client SDK
 */

export interface TelemetryPayload {
  message: string;
  stack?: string;
  route?: string;
  userAgent?: string;
  fingerprint?: string;
}

export class SlackSentinelClient {
  private endpoint: string;

  constructor(endpointUrl: string) {
    this.endpoint = endpointUrl.replace(/\/$/, '');
    if (!this.endpoint.endsWith('/api/telemetry/error')) {
      this.endpoint += '/api/telemetry/error';
    }
  }

  public async report(payload: TelemetryPayload): Promise<boolean> {
    try {
      const res = await fetch(this.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: payload.message,
          stack: payload.stack || '',
          route: payload.route || (typeof window !== 'undefined' ? window.location.pathname : '/'),
          userAgent: payload.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js Client'),
        }),
      });
      return res.ok;
    } catch (e) {
      console.warn('[SlackSentinel] Telemetry dispatch failed:', e);
      return false;
    }
  }

  /**
   * Automatically attaches to window.onerror and unhandledrejection
   */
  public attachBrowserListeners() {
    if (typeof window === 'undefined') return;

    window.addEventListener('error', (event) => {
      this.report({
        message: event.message,
        stack: event.error?.stack,
        route: window.location.pathname,
      });
    });

    window.addEventListener('unhandledrejection', (event) => {
      this.report({
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack,
        route: window.location.pathname,
      });
    });
  }
}
