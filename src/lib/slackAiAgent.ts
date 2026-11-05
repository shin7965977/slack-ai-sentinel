import fs from 'fs';
import path from 'path';
import { sanitizeContent } from './sanitizer';

/**
 * Slack AI Incident Diagnostic Agent
 * Integrates evidence-based debugging discipline with Google Gemini models
 * Supports multimodal error screenshot inspection, thread memory, and codebase grounding.
 */

export const PREFERRED_DEBUGGING_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash',
] as const;

export interface ExtractedErrorContext {
  route: string;
  device: string;
  fingerprint: string;
  errorMessage: string;
  stackTrace?: string;
  rawText: string;
}

export interface SlackMessage {
  text?: string;
  user?: string;
  bot_id?: string;
  ts?: string;
  files?: Array<{
    id: string;
    name: string;
    mimetype: string;
    url_private?: string;
    url_private_download?: string;
  }>;
}

/**
 * Dynamically resolves project manifest from package.json without hardcoded descriptions
 */
export function getDynamicProjectManifest(): string {
  try {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    if (!fs.existsSync(pkgPath)) return 'Project Context: Web / Cloud Application';
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    const deps = pkg.dependencies || {};
    const keyDeps = Object.keys(deps).slice(0, 15).join(', ');
    return `Project Context (from package.json):\n- Name: ${pkg.name || 'Application'}\n- Dependencies: ${keyDeps || 'Standard libraries'}`;
  } catch {
    return 'Project Context: Web / Cloud Application';
  }
}

/**
 * Dynamically reads and extracts relevant source code snippets for whitebox diagnosis
 */
export function resolveRelevantCodeSnippets(errorContext: ExtractedErrorContext): string {
  try {
    const cwd = process.cwd();
    const route = errorContext.route || '/';
    const textBlob = `${errorContext.route} ${errorContext.errorMessage} ${errorContext.stackTrace || ''}`.toLowerCase();

    const candidateFiles = new Set<string>();

    // Route-based candidates
    if (route.includes('api')) {
      candidateFiles.add('src/app/api/telemetry/error/route.ts');
    }

    // Keyword matching
    if (textBlob.includes('streamlit') || textBlob.includes('pipeline') || textBlob.includes('503')) {
      candidateFiles.add('clients/python/sentinel.py');
    }

    const snippets: string[] = [];
    let fileCount = 0;

    for (const rel of candidateFiles) {
      if (fileCount >= 3) break;
      const fullPath = path.resolve(/*turbopackIgnore: true*/ cwd, rel);
      if (fs.existsSync(fullPath)) {
        const fileContent = fs.readFileSync(fullPath, 'utf8');
        const lines = fileContent.split(/\r?\n/);
        const trimmed = lines.slice(0, 150).join('\n');
        snippets.push(`#### 📄 \`${rel}\` (Top ${Math.min(150, lines.length)} lines):\n\`\`\`\n${trimmed}\n\`\`\``);
        fileCount++;
      }
    }

    return snippets.join('\n\n');
  } catch {
    return '';
  }
}

/**
 * Extracts structured error telemetry context from Slack thread messages
 */
export function extractErrorContextFromThread(messages: SlackMessage[]): ExtractedErrorContext {
  const rootText = messages[0]?.text || '';

  const routeMatch = rootText.match(/發生路由\s*\(Route\):\s*`?([^\n`]+)`?/i) || rootText.match(/Route:\s*`?([^\n`]+)`?/i);
  const deviceMatch = rootText.match(/客戶端環境:\s*([^\n]+)/i) || rootText.match(/Device:\s*([^\n]+)/i);
  const fpMatch = rootText.match(/錯誤指紋\s*\(Hash\):\s*`?([^\n`]+)`?/i) || rootText.match(/Fingerprint:\s*`?([^\n`]+)`?/i);
  const errorMatch =
    rootText.match(/錯誤訊息\s*\(Error Message\):\s*```(?:\w+)?\n([\s\S]*?)```/i) ||
    rootText.match(/Error Message:\s*```(?:\w+)?\n([\s\S]*?)```/i) ||
    rootText.match(/Pipeline error:\s*([^\n]+)/i);
  const stackMatch =
    rootText.match(/呼叫堆疊\s*\(Stack Trace\):\s*```(?:\w+)?\n([\s\S]*?)```/i) ||
    rootText.match(/Stack Trace:\s*```(?:\w+)?\n([\s\S]*?)```/i);

  const route = routeMatch ? routeMatch[1].trim() : '/';
  const device = deviceMatch ? deviceMatch[1].trim() : 'Unknown Environment';
  const fingerprint = fpMatch ? fpMatch[1].trim() : 'unknown';
  const errorMessage = errorMatch ? errorMatch[1].trim() : rootText.slice(0, 500);
  const stackTrace = stackMatch ? stackMatch[1].trim() : undefined;

  return {
    route,
    device,
    fingerprint,
    errorMessage,
    stackTrace,
    rawText: rootText,
  };
}

/**
 * Fetches Slack thread history
 */
export async function fetchSlackThreadHistory(
  channel: string,
  threadTs: string,
  token: string
): Promise<SlackMessage[]> {
  try {
    const url = `https://slack.com/api/conversations.replies?channel=${channel}&ts=${threadTs}`;
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    });

    const data = await res.json();
    if (!data.ok) {
      console.warn(`[SlackAiAgent] conversations.replies error: ${data.error}`);
      return [];
    }
    return data.messages || [];
  } catch (err: any) {
    console.warn(`[SlackAiAgent] fetchSlackThreadHistory exception: ${err?.message}`);
    return [];
  }
}

/**
 * Calls multi-tier Gemini model with vision, thread history, and code grounding
 */
export async function callGeminiDiagnostic(
  errorContext: ExtractedErrorContext,
  userPrompt: string,
  conversationHistory: SlackMessage[],
  apiKey: string,
  imageAttachment?: { mimeType: string; base64Data: string }
): Promise<{ analysis: string; modelUsed: string }> {
  const dynamicManifest = getDynamicProjectManifest();
  const inspectedCode = resolveRelevantCodeSnippets(errorContext);

  const conversationTranscript = conversationHistory
    .map((m) => {
      const role = m.bot_id ? 'AI Diagnostic Assistant' : 'Engineer / User';
      const text = sanitizeContent(m.text || '');
      return `${role}: ${text}`;
    })
    .join('\n\n');

  const isFollowUp = conversationHistory.length > 2;

  const systemInstruction = `You are a Senior Principal Software Reliability & AI Architect monitoring production incidents.
Your role is to diagnose errors, API failures (e.g. Gemini 503, OpenAI 429), frontend exceptions, and cloud pipeline crashes.

Diagnostic Principles:
1. Definitive Diagnosis:
   - Base your findings on factual evidence (code snippets, error response codes, stack traces, or screenshots).
   - If an error is external (e.g., Google API 503 temporary spike, third-party timeout), state it directly rather than guessing internal bugs.
2. Code & Runtime Evidence:
   - Cite specific code files, parameters, error status codes, or configuration flags.
3. Actual User Impact:
   - Clearly state whether the application suffered a hard crash or a retryable failure.
4. Actionable Fix Vector:
   - Provide concrete code changes (e.g. exponential backoff, circuit breaker, retry loop, fallback model).

${dynamicManifest}

Tone & Language Guidelines:
- Highly professional, direct, concise, and definitive.
- DEFAULT LANGUAGE: English.
- DYNAMIC LANGUAGE SWITCHING: If the user communicates or asks questions in another language (e.g., Traditional Chinese, Simplified Chinese, German, Japanese), respond fluently in that user's language.`;

  const promptInstruction = isFollowUp
    ? `## User Follow-up Question / Discussion in Thread:
"${userPrompt}"

Instructions for Follow-up:
- Address the user's specific observation or question directly as a senior engineer.
- Refer directly to the error message, attached screenshot (if any), and code.
- Provide a direct, insightful response without boilerplate.`
    : `## User Question / Command:
"${userPrompt}"

Provide a structured, evidence-based diagnosis with:
1. 📌 **問題本質判定 (Definitive Diagnosis)**: 判定此為外部 API 波動 (如 Google 503)、代碼 Bug、還是環境配置異常。
2. 🔍 **根本原因與證據 (Root Cause & Evidence)**: 依據錯誤訊息、堆疊或截圖詳細說明原因。
3. ⚠️ **影響範圍 (User Impact)**: 評估對整體管線或使用者的影響程度。
4. 🛠️ **建議處置方式 (Recommended Fix Vector)**: 提供具體修復代碼 (例如重試機制 Exponential Backoff、降級備用方案 Fallback)。

Language: Match the language of the user's prompt (e.g., Traditional Chinese if in Chinese, English by default).`;

  const imageNotice = imageAttachment
    ? '\n- **隨附圖片 (Attached Image)**: 包含螢幕截圖 (已傳送至 Gemini Vision 進行多模態多維分析)\n'
    : '';

  const fence = '```';
  const userQuery = `## Production Incident Telemetry
- **Route**: \`${errorContext.route}\`
- **Device / Host**: ${errorContext.device}
- **Fingerprint**: \`${errorContext.fingerprint}\`${imageNotice}
- **Error Message**:
${fence}
${errorContext.errorMessage}
${fence}
${errorContext.stackTrace ? `- **Stack Trace**:\n${fence}\n${errorContext.stackTrace}\n${fence}` : ''}

## 📂 Inspected Source Code Files:
${inspectedCode || '(No matching local source files needed for this signature)'}

## Discussion in Thread:
${conversationTranscript || '(No prior discussion in thread)'}

${promptInstruction}`;

  const cleanKey = apiKey.trim();
  if (!cleanKey) {
    throw new Error('Gemini API Key is unconfigured. Please set SERVER_GEMINI_API_KEY.');
  }

  let lastError: any = null;

  for (const model of PREFERRED_DEBUGGING_MODELS) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(cleanKey)}`;
      const parts: any[] = [];

      if (imageAttachment?.base64Data) {
        parts.push({
          inline_data: {
            mime_type: imageAttachment.mimeType,
            data: imageAttachment.base64Data,
          },
        });
      }

      parts.push({ text: userQuery });

      const payload = {
        contents: [{ role: 'user', parts }],
        system_instruction: { parts: [{ text: systemInstruction }] },
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[SlackAiAgent] Model ${model} failed with HTTP ${res.status}: ${errText}`);
        lastError = new Error(`Model ${model} HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        return { analysis: text, modelUsed: model };
      }
    } catch (err: any) {
      console.warn(`[SlackAiAgent] Error invoking ${model}: ${err?.message}`);
      lastError = err;
    }
  }

  throw new Error(`All Gemini models failed. Last error: ${lastError?.message}`);
}

/**
 * Handles Slack @bot app_mentions (with Vision support)
 */
export async function handleSlackAppMention(event: {
  channel: string;
  ts: string;
  thread_ts?: string;
  text: string;
  files?: Array<{
    id: string;
    name: string;
    mimetype: string;
    url_private?: string;
    url_private_download?: string;
  }>;
}) {
  const token = process.env.SLACK_BOT_TOKEN;
  const geminiKey = process.env.SERVER_GEMINI_API_KEY;

  if (!token) {
    console.error('[SlackAiAgent] Missing SLACK_BOT_TOKEN');
    return;
  }
  if (!geminiKey) {
    console.error('[SlackAiAgent] Missing SERVER_GEMINI_API_KEY');
    return;
  }

  const threadTs = event.thread_ts || event.ts;
  const cleanPrompt =
    event.text.replace(/<@[A-Z0-9]+>/g, '').trim() ||
    'Please analyze this error/feedback and provide a concise diagnosis.';

  try {
    // 1. Fetch thread history
    const threadHistory = await fetchSlackThreadHistory(event.channel, threadTs, token);
    const errorContext = extractErrorContextFromThread(threadHistory);

    // 2. Check for image attachments (Gemini Vision)
    let imageAttachment: { mimeType: string; base64Data: string } | undefined = undefined;

    const allFiles: any[] = [];
    if (event.files) allFiles.push(...event.files);
    for (const msg of threadHistory) {
      if (msg.files) allFiles.push(...msg.files);
    }

    const imageFile = allFiles.find((f) => f.mimetype && f.mimetype.startsWith('image/'));
    if (imageFile && (imageFile.url_private_download || imageFile.url_private)) {
      const downloadUrl = imageFile.url_private_download || imageFile.url_private;
      try {
        const imgRes = await fetch(downloadUrl, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          const base64Data = Buffer.from(buffer).toString('base64');
          imageAttachment = {
            mimeType: imageFile.mimetype,
            base64Data,
          };
        }
      } catch (imgErr) {
        console.warn('[SlackAiAgent] Failed to download Slack image:', imgErr);
      }
    }

    // 3. Post "Thinking..." message
    const thinkRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel: event.channel,
        thread_ts: threadTs,
        text: '🤖 *AI Diagnostic Sentinel is analyzing telemetry & codebase...*',
      }),
    });
    const thinkData = await thinkRes.json();
    const thinkTs = thinkData.ts;

    // 4. Run Gemini Diagnostic
    const { analysis, modelUsed } = await callGeminiDiagnostic(
      errorContext,
      cleanPrompt,
      threadHistory,
      geminiKey,
      imageAttachment
    );

    const replyText = `*🤖 AI Incident Diagnostic Report* (via \`${modelUsed}\`)\n\n${analysis}`;

    // 5. Update or post final response
    if (thinkTs) {
      await fetch('https://slack.com/api/chat.update', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel: event.channel,
          ts: thinkTs,
          text: replyText,
        }),
      });
    } else {
      await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          channel: event.channel,
          thread_ts: threadTs,
          text: replyText,
        }),
      });
    }
  } catch (err: any) {
    console.error('[SlackAiAgent] Error handling app_mention:', err);
    await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel: event.channel,
        thread_ts: threadTs,
        text: `⚠️ *AI Diagnostic Error*: ${err?.message || 'Failed to complete analysis'}`,
      }),
    });
  }
}
