/**
 * Universal Secret Sanitizer & Telemetry Redactor
 * Masks API keys, tokens, and base64 bloat before posting to Slack or LLMs.
 */

export function sanitizeContent(input: string): string {
  if (!input) return '';

  return (
    input
      // 1. Google Gemini & AI Studio API Keys (starts with AIzaSy... or standard AIza...)
      .replace(/AIza[0-9A-Za-z-_]{35}/g, '[REDACTED_GEMINI_KEY]')
      // 2. Server-side custom API Keys (e.g. AQ.xxx)
      .replace(/AQ\.[0-9A-Za-z-_]{30,}/g, '[REDACTED_API_KEY]')
      // 3. Slack Tokens (xoxb-, xoxp-, xoxa-)
      .replace(/xox[bpa]-[0-9A-Za-z-_]{20,}/g, '[REDACTED_SLACK_TOKEN]')
      // 4. OpenAI & standard bearer tokens
      .replace(/sk-[0-9A-Za-z-_]{32,}/g, '[REDACTED_OPENAI_KEY]')
      // 5. GitHub Personal Access Tokens (ghp_, gho_, ghs_)
      .replace(/gh[pous]_[0-9A-Za-z]{36}/g, '[REDACTED_GITHUB_TOKEN]')
      // 6. Generic Bearer Tokens in headers
      .replace(/Bearer\s+[A-Za-z0-9-_=.]+/gi, 'Bearer [REDACTED]')
      // 7. Base64 payload bloat (e.g. data:image/png;base64,...)
      .replace(/data:image\/[a-zA-Z]+;base64,[A-Za-z0-9+/=]{50,}/g, '[BASE64_IMAGE_DATA_REDACTED]')
  );
}

export function computeFingerprint(message: string, stack?: string): string {
  const normalized = `${message || ''}::${(stack || '').split('\n')[0] || ''}`.trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}
