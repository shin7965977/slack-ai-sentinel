import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Slack AI Sentinel | Autonomous Incident & Telemetry Diagnostic Agent',
  description: 'AI-Powered production telemetry & Slack alert bot with Gemini Vision multimodal diagnostics.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-950 text-slate-100 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
