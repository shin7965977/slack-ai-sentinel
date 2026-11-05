# 🤖 Slack AI Sentinel

> **Autonomous AI-Powered Incident Diagnostic & Telemetry Agent for Slack**  
> Powered by Google Gemini (Vision Multimodal) & Built for Next.js, Python/Streamlit, and Cloud Services.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Powered by Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4.svg)](https://ai.google.dev/)
[![Next.js 15](https://img.shields.io/badge/Framework-Next.js%2015-black.svg)](https://nextjs.org/)
[![Python SDK](https://img.shields.io/badge/Client-Python%20%2F%20Streamlit-3776AB.svg)](./clients/python)

---

## 🌟 Key Features (核心功能)

1. **🚨 Instant Incident Telemetry (即時異常警報與降噪)**
   - Receives runtime errors from **Streamlit**, **Python backend**, **React/Next.js**, or **Cloud Workers**.
   - Formats sleek, readable Slack Block Kit alert cards with severity, host metadata, fingerprint, and stack trace.
   - Built-in deduplication & in-memory rate-limiter (prevents Slack alert flooding).
   - Universal secret redactor automatically strips Google AI Studio keys (`AIzaSy...`), OpenAI tokens, Slack tokens, and Base64 bloat.

2. **🧠 Autonomous AI Root Cause Diagnosis (自動化根因診斷)**
   - When an incident occurs, the Sentinel immediately spins up Google Gemini in the Slack thread.
   - Outputs a structured, senior-architect-grade report:
     - 📌 **Definitive Diagnosis (問題本質判定)**: Distinguishes between external API spikes (e.g., Google 503 Overloaded) and internal code bugs.
     - 🔍 **Root Cause & Evidence (根因與證據)**: Analyzes stack traces, HTTP codes, and parameters.
     - ⚠️ **Actual User Impact (影響範圍)**: Assesses pipeline blockage vs transient failure.
     - 🛠️ **Recommended Fix Vector (具體修復方案)**: Provides copy-pasteable code fixes (Exponential Backoff, Circuit Breakers, Fallbacks).

3. **👁️ Multimodal Vision Support (多模態螢幕截圖識別)**
   - Drop a screenshot of an error (e.g. Streamlit red alert box, terminal crash, AWS console warning) into Slack and mention `@bot`.
   - The bot downloads the secure Slack image, runs OCR and visual understanding, and diagnoses the issue directly from the picture!

4. **🔄 Multi-Tier Fallback Resilience (多模型自動降級)**
   - Seamlessly cascades through `gemini-2.5-flash` ➔ `gemini-2.0-flash` ➔ `gemini-1.5-flash` to guarantee 99.9% availability during Google Cloud quota spikes.

5. **📦 Drop-in Multi-Platform SDKs (跨平台支援)**
   - **Python / Streamlit**: `clients/python/sentinel.py` (1-line exception reporting).
   - **TypeScript / React**: `clients/typescript/sentinel.ts` (Automatic browser listener).

---

## 🏗️ System Architecture

```mermaid
flowchart LR
    A[Streamlit / Python App] -->|POST /api/telemetry/error| S[Slack AI Sentinel Hub]
    B[Web Frontend / React] -->|POST /api/telemetry/error| S
    S -->|1. Sanitize & Deduplicate| S
    S -->|2. Post Block Kit Alert| C[Slack Channel]
    S -->|3. Invoke Gemini Vision / Flash| G[(Google Gemini API)]
    G -->|4. Post AI Diagnostic Report| T[Slack Incident Thread]
    User[Engineer] -->|5. @bot with Screenshot| C
    C -->|POST /api/slack/events| S
```

---

## 🚀 Quick Start (5 分鐘安裝與設定流程)

### Step 1: Clone & Install Dependencies

```bash
git clone https://github.com/shin7965977/slack-ai-sentinel.git
cd slack-ai-sentinel
npm install
```

### Step 2: Configure Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your secrets:

```env
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_SIGNING_SECRET=your-signing-secret
SLACK_CHANNEL_ID=C0123456789
SERVER_GEMINI_API_KEY=AIzaSyYourGeminiApiKey
```

### Step 3: Run Locally or Deploy to Vercel

* **Run Locally**:
  ```bash
  npm run dev
  # Use ngrok or localtunnel to expose port 3000 to Slack
  ngrok http 3000
  ```

* **Deploy to Vercel (Recommended)**:
  Push to GitHub and import into Vercel with 1 click. Add the 4 environment variables in Vercel Project Settings.

---

## 🤖 Slack App Configuration (Slack 應用設定)

Go to [api.slack.com/apps](https://api.slack.com/apps), click **Create New App** ➔ **From an app manifest**, and paste the following YAML:

```yaml
display_information:
  name: AI Diagnostic Sentinel
  description: Autonomous Telemetry & Vision-based Incident Diagnostic Bot
  background_color: "#0f172a"
features:
  bot_user:
    display_name: AI Sentinel
    always_online: true
oauth_config:
  scopes:
    bot:
      - app_mentions:read
      - chat:write
      - channels:history
      - groups:history
      - files:read
settings:
  event_subscriptions:
    request_url: https://your-deployment-domain.vercel.app/api/slack/events
    bot_events:
      - app_mention
  interactivity:
    is_enabled: true
    request_url: https://your-deployment-domain.vercel.app/api/slack/actions
```

1. **Install to Workspace**: Click **Install to Workspace** and authorize.
2. **Invite to Channel**: Go to your target Slack channel and type `/invite @AI Sentinel`.

---

## 🐍 Streamlit Integration Guide (Streamlit 整合範例)

Copy [`clients/python/sentinel.py`](./clients/python/sentinel.py) into your Streamlit project:

```python
import streamlit as st
import traceback
from sentinel import init_sentinel

# 1. Initialize Sentinel
sentinel = init_sentinel(
    endpoint_url="https://your-slack-bot.vercel.app",
    service_name="Elyra AI Data Engine"
)

st.title("🏗️ Elyra AI Data Engine")

if st.button("🚀 Run Pipeline"):
    try:
        # Your Gemini Pipeline Logic
        result = run_gemini_extraction()
        st.success("Extraction complete!")
    except Exception as err:
        st.error(f"Pipeline error: {err}")
        
        # 🚨 Automatically dispatches error to Slack Bot + triggers Gemini diagnosis!
        sentinel.report_error(
            error=err,
            stack_trace=traceback.format_exc(),
            route="/streamlit/elyra-data-engine"
        )
```

---

## 📄 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/telemetry/error` | Ingestion endpoint for application exceptions and crashes |
| `POST` | `/api/slack/events` | Slack Events API (handles `@bot` mentions and vision analysis) |
| `POST` | `/api/slack/actions` | Slack Interactive Block Kit button handlers |

---

## 🛡️ License

MIT License &copy; 2026 Chen-Yu Liu (shin7965977). Free for personal and commercial usage.
