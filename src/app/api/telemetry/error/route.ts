import { NextRequest, NextResponse } from 'next/server';
import { callGeminiDiagnostic, type ExtractedErrorContext } from '@/lib/slackAiAgent';
import { sanitizeContent, computeFingerprint } from '@/lib/sanitizer';

export const maxDuration = 60;

// Server-side in-memory rate-limiter to prevent Slack alert flooding
const recentErrors = new Map<string, number>();

function isRateLimited(fingerprint: string): boolean {
  const now = Date.now();
  const lastTime = recentErrors.get(fingerprint);
  // Throttle identical error fingerprints to at most once every 10 minutes
  if (lastTime && now - lastTime < 10 * 60 * 1000) {
    return true;
  }
  recentErrors.set(fingerprint, now);

  if (recentErrors.size > 200) {
    for (const [k, v] of recentErrors.entries()) {
      if (now - v > 60 * 60 * 1000) {
        recentErrors.delete(k);
      }
    }
  }
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      message = 'Unknown Error',
      stack = '',
      source = '',
      route = '/',
      fingerprint = computeFingerprint(message, stack),
      userAgent = 'Unknown Host',
    } = body;

    if (isRateLimited(fingerprint)) {
      return NextResponse.json({ success: true, throttled: true });
    }

    const token = process.env.SLACK_BOT_TOKEN;
    const channel = process.env.SLACK_CHANNEL_ID;
    const geminiKey = process.env.SERVER_GEMINI_API_KEY;

    if (!token || !channel) {
      console.warn('[Telemetry] SLACK_BOT_TOKEN or SLACK_CHANNEL_ID not configured');
      return NextResponse.json(
        { success: false, error: 'Slack configuration missing' },
        { status: 500 }
      );
    }

    const safeMessage = sanitizeContent(message);
    const safeStack = sanitizeContent(stack);

    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);

    // Block Kit Message
    const blocks: any[] = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 Incident Runtime Telemetry Alert',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Route / Service:*\n\`${route}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Client / Host:*\n${userAgent}`,
          },
          {
            type: 'mrkdwn',
            text: `*Fingerprint:*\n\`${fingerprint}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Reported At:*\n${timestamp} UTC`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error Message:*\n\`\`\`\n${safeMessage.slice(0, 1200)}\n\`\`\``,
        },
      },
    ];

    if (safeStack) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Stack Trace:*\n\`\`\`\n${safeStack.slice(0, 1500)}\n\`\`\``,
        },
      });
    }

    blocks.push({
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '🤖 _AI Diagnostic Sentinel is analyzing this incident in the thread..._',
        },
      ],
    });

    // Interactive Action Buttons
    blocks.push({
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔄 Re-diagnose',
            emoji: true,
          },
          style: 'primary',
          action_id: 'trigger_rediasgnosis',
          value: fingerprint,
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '✅ Acknowledge',
            emoji: true,
          },
          action_id: 'acknowledge_incident',
          value: fingerprint,
        },
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '📋 Copy Fingerprint',
            emoji: true,
          },
          action_id: 'copy_fingerprint',
          value: fingerprint,
        },
      ],
    });

    const fallbackText = `🚨 Incident Alert on ${route}: ${safeMessage.slice(0, 150)}`;

    const slackRes = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        channel,
        text: fallbackText,
        blocks,
      }),
    });

    const slackData = await slackRes.json();
    if (!slackData.ok) {
      console.error('[Telemetry] Failed to post alert to Slack:', slackData.error);
      return NextResponse.json({ success: false, error: slackData.error }, { status: 500 });
    }

    const threadTs = slackData.ts;

    // Trigger AI Diagnostic in Thread asynchronously
    if (geminiKey && threadTs) {
      const errorContext: ExtractedErrorContext = {
        route,
        device: userAgent,
        fingerprint,
        errorMessage: safeMessage,
        stackTrace: safeStack || undefined,
        rawText: `${safeMessage}\n${safeStack}`,
      };

      // Asynchronous diagnostic execution
      (async () => {
        try {
          const { analysis, modelUsed } = await callGeminiDiagnostic(
            errorContext,
            'Please perform a definitive root cause diagnosis and provide code fix vectors for this error.',
            [],
            geminiKey
          );

          await fetch('https://slack.com/api/chat.postMessage', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json; charset=utf-8',
            },
            body: JSON.stringify({
              channel,
              thread_ts: threadTs,
              reply_broadcast: true,
              text: `*🤖 AI Diagnostic Sentinel Analysis* (via \`${modelUsed}\`)\n\n${analysis}`,
            }),
          });
        } catch (diagErr: any) {
          console.error('[Telemetry] Background diagnostic error:', diagErr?.message);
        }
      })();
    }

    return NextResponse.json({ success: true, thread_ts: threadTs });
  } catch (err: any) {
    console.error('[Telemetry] Request parsing error:', err);
    return NextResponse.json(
      { success: false, error: err?.message || 'Server error' },
      { status: 500 }
    );
  }
}
