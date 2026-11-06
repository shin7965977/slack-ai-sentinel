import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const payloadStr = formData.get('payload') as string;
    if (!payloadStr) {
      return NextResponse.json({ ok: true });
    }

    const payload = JSON.parse(payloadStr);
    const token = process.env.SLACK_BOT_TOKEN;

    if (payload.type === 'block_actions' && token) {
      const action = payload.actions?.[0];
      const channel = payload.channel?.id;
      const threadTs = payload.message?.thread_ts || payload.message?.ts;

      if (action?.action_id === 'trigger_rediasgnosis') {
        await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            channel,
            thread_ts: threadTs,
            text: `🔄 Re-diagnosis triggered by <@${payload.user?.id}>. Analyzing incident...`,
          }),
        });
      } else if (action?.action_id === 'acknowledge_incident') {
        await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            channel,
            thread_ts: threadTs,
            text: `✅ Incident acknowledged by <@${payload.user?.id}>. Investigation in progress.`,
          }),
        });
      } else if (action?.action_id === 'copy_fingerprint') {
        await fetch('https://slack.com/api/chat.postMessage', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json; charset=utf-8',
          },
          body: JSON.stringify({
            channel,
            thread_ts: threadTs,
            text: `📋 Incident Fingerprint: \`${action.value || 'N/A'}\``,
          }),
        });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('[SlackActions] Error handling action:', err);
    return NextResponse.json({ ok: true });
  }
}
