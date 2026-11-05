"""
Slack AI Sentinel - Python & Streamlit Client SDK
Drop-in telemetry reporting to your Slack AI Sentinel agent.
"""

import sys
import traceback
import requests
from typing import Optional, Callable
from functools import wraps

class SlackSentinel:
    def __init__(self, endpoint_url: str, service_name: str = "Streamlit Application"):
        self.endpoint_url = endpoint_url.rstrip("/")
        self.service_name = service_name

    def report_error(
        self,
        error: Exception or str,
        stack_trace: Optional[str] = None,
        route: str = "/",
        metadata: Optional[dict] = None
    ) -> bool:
        """Report an error or exception directly to the Slack Sentinel Telemetry API."""
        try:
            error_message = str(error)
            if not stack_trace and isinstance(error, Exception):
                stack_trace = "".join(traceback.format_exception(type(error), error, error.__traceback__))

            payload = {
                "message": error_message,
                "stack": stack_trace or "",
                "route": route,
                "userAgent": f"{self.service_name} (Python {sys.version.split()[0]})",
                "fingerprint": f"py-{abs(hash(error_message)) % 1000000:x}",
            }

            if metadata:
                payload["metadata"] = metadata

            target_url = self.endpoint_url
            if not target_url.endswith("/api/telemetry/error"):
                target_url = f"{target_url}/api/telemetry/error"

            res = requests.post(target_url, json=payload, timeout=5)
            return res.status_code == 200
        except Exception as e:
            print(f"[SlackSentinel] Failed to report incident: {e}", file=sys.stderr)
            return False

    def guard(self, route: str = "/"):
        """Decorator to wrap function executions with automatic incident reporting."""
        def decorator(func: Callable):
            @wraps(func)
            def wrapper(*args, **kwargs):
                try:
                    return func(*args, **kwargs)
                except Exception as exc:
                    self.report_error(exc, route=route)
                    raise exc
            return wrapper
        return decorator

    def attach_streamlit(self, st_instance):
        """
        Helper for Streamlit apps.
        Example usage:
            import streamlit as st
            sentinel = SlackSentinel("https://your-bot.vercel.app")
            sentinel.attach_streamlit(st)
        """
        pass

# Default global instance helper
_default_sentinel: Optional[SlackSentinel] = None

def init_sentinel(endpoint_url: str, service_name: str = "Streamlit Pipeline") -> SlackSentinel:
    global _default_sentinel
    _default_sentinel = SlackSentinel(endpoint_url, service_name)
    return _default_sentinel

def report_error(error: Exception or str, route: str = "/", stack_trace: Optional[str] = None) -> bool:
    if not _default_sentinel:
        print("[SlackSentinel] Sentinel not initialized. Call init_sentinel() first.", file=sys.stderr)
        return False
    return _default_sentinel.report_error(error, stack_trace=stack_trace, route=route)
