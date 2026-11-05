import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { handleSlackAppMention } from '@/lib/slackAiAgent';

function verifySlackSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  signingSecret: string
): boolean {
  if (!timestamp || !signature) return false;

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 60 * 5;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) {
    return false;
  }

  const sigBaseString = `v0:${timestamp}:${rawBody}`;
  const hmac = crypto.createHmac('sha256', signingSecret).update(sigBaseString).digest('hex');
  const computedSig = `v0=${hmac}`;

  try {
    return crypto.timingSafeEqual(Buffer.from(computedSig, 'utf8'), Buffer.from(signature, 'utf8'));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const timestamp = req.headers.get('x-slack-request-timestamp');
    const signature = req.headers.get('x-slack-signature');
    const signingSecret = process.env.SLACK_SIGNING_SECRET;

    if (signingSecret) {
      const isValid = verifySlackSignature(rawBody, timestamp, signature, signingSecret);
      if (!isValid) {
        console.warn('[SlackEvents] Invalid signature');
        return NextResponse.json({ error: 'Invalid request signature' }, { status: 401 });
      }
    }

    const payload = JSON.parse(rawBody);

    // 1. URL Verification challenge
    if (payload.type === 'url_verification') {
      return NextResponse.json({ challenge: payload.challenge });
    }

    // 2. Handle app_mention
    if (payload.type === 'event_callback' && payload.event) {
      const event = payload.event;

      if (event.type === 'app_mention') {
        // Return 200 immediately to Slack to avoid retry loops, process in background
        (async () => {
          try {
            await handleSlackAppMention(event);
          } catch (err) {
            console.error('[SlackEvents] Background app_mention processing failed:', err);
          }
        })();

        return NextResponse.json({ ok: true });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[SlackEvents] Unhandled exception:', err);
    return NextResponse.json({ error: err?.message || 'Server error' }, { status: 500 });
  }
}
