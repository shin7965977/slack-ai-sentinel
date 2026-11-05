"""
Example: Streamlit Integration with Slack AI Sentinel
Run with: streamlit run streamlit_demo.py
"""

import streamlit as st
import traceback
from sentinel import init_sentinel

# 1. Initialize Sentinel with your deployed Slack Bot API endpoint
sentinel = init_sentinel(
    endpoint_url="https://your-slack-bot.vercel.app",  # Or http://localhost:3000
    service_name="Elyra AI Data Engine"
)

st.title("🏗️ Elyra AI Data Engine")
st.write("Streamlit Application protected by Slack AI Sentinel")

user_input = st.text_area("Customer Conversation Transcript", "I want a single-family house...")

if st.button("🚀 Run Pipeline"):
    with st.spinner("Processing with Gemini..."):
        try:
            # Simulate an API error (e.g. Gemini 503 Overloaded)
            raise RuntimeError(
                "503 UNAVAILABLE. {'error': {'code': 503, 'message': 'This model is currently experiencing high demand. Please try again later.', 'status': 'UNAVAILABLE'}}"
            )
        except Exception as err:
            st.error(f"Pipeline error: {err}")
            
            # Automatically sends structured telemetry to Slack Bot + triggers AI Diagnostic!
            sentinel.report_error(
                error=err,
                stack_trace=traceback.format_exc(),
                route="/streamlit/elyra-data-engine"
            )
            st.info("🚨 Error incident report automatically dispatched to Slack AI Sentinel!")
