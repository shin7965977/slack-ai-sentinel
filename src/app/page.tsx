import React from 'react';
import { ShieldCheck, Cpu, Terminal, Eye, Bell, ArrowRight, Zap, CheckCircle2 } from 'lucide-react';

export default function Home() {
  return (
    <main className="max-w-5xl mx-auto px-6 py-16 space-y-12">
      {/* Hero */}
      <div className="space-y-4 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
          <Zap className="w-3.5 h-3.5" /> Autonomous AI Incident Diagnostic Sentinel
        </div>
        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
          Slack AI Sentinel
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-base sm:text-lg">
          Zero-noise error telemetry & Slack bot powered by Google Gemini Vision.
          Instantly analyzes production crashes, Streamlit pipeline exceptions, and screenshot attachments with whitebox code evidence.
        </p>
      </div>

      {/* Status & Endpoints Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4" /> Telemetry Webhook
          </div>
          <p className="font-mono text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 break-all">
            POST /api/telemetry/error
          </p>
          <p className="text-xs text-slate-400">
            Accepts runtime exceptions from Python, Streamlit, React, Node.js, and Cloud services.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <Eye className="w-4 h-4" /> Slack Events & Vision
          </div>
          <p className="font-mono text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 break-all">
            POST /api/slack/events
          </p>
          <p className="text-xs text-slate-400">
            Handles Slack @bot mentions, thread conversation memory, and multimodal screenshot OCR.
          </p>
        </div>

        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <ShieldCheck className="w-4 h-4" /> Interactive Actions
          </div>
          <p className="font-mono text-xs text-slate-300 bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 break-all">
            POST /api/slack/actions
          </p>
          <p className="text-xs text-slate-400">
            Interactive buttons in Slack Block Kit for one-click re-diagnosis or incident triage.
          </p>
        </div>
      </div>

      {/* Feature Highlights */}
      <div className="p-8 rounded-3xl bg-slate-900/50 border border-slate-800 space-y-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-blue-400" /> Key Superpowers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div className="space-y-1.5">
            <h3 className="font-semibold text-slate-200">1. Multimodal Gemini Vision</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Drop any screenshot (e.g. Streamlit 503 error box or AWS console crash) into Slack and @bot. It will OCR and diagnose without needing raw logs.
            </p>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-semibold text-slate-200">2. Multi-Tier Model Resilience</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Auto-cascades through Gemini 2.5 Flash, 2.0 Flash, and 1.5 Flash to guarantee 99.9% availability during quota spikes.
            </p>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-semibold text-slate-200">3. Built-in Secret Redactor</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Automatic regex scrubber redacts Google AI Studio, OpenAI, Slack, GitHub tokens, and Base64 dumps before posting.
            </p>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-semibold text-slate-200">4. Multi-Platform SDKs</h3>
            <p className="text-slate-400 text-xs leading-relaxed">
              Includes drop-in SDKs for Python (Streamlit, FastAPI) and TypeScript (React, Next.js, Node.js).
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center text-xs text-slate-500 pt-6">
        Slack AI Sentinel &bull; Open Source AI DevOps Telemetry Agent &bull; Powered by Google Gemini
      </footer>
    </main>
  );
}
