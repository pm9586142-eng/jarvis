"""OpenJarvis Engine Adapters (Python) — Ollama, llama.cpp, vLLM, SGLang & AM AI Cloud Adapter."""

from __future__ import annotations

import ipaddress
import json
import os
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional


BLOCKED_HOSTS = {"169.254.169.254", "metadata.google.internal", "0.0.0.0"}


def validate_url(raw_url: str) -> str:
    url = str(raw_url or "").strip()
    if not url:
        raise ValueError("URL cannot be empty.")
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError("Only http/https URLs are supported.")
    host = (parsed.hostname or "").lower()
    if host in BLOCKED_HOSTS or host.startswith("169.254."):
        raise ValueError("SSRF protection blocked metadata/link-local target.")
    try:
        ip = ipaddress.ip_address(host)
        if ip.is_link_local or ip.is_multicast:
            raise ValueError("Blocked link-local or multicast IP.")
    except ValueError as err:
        if "Blocked" in str(err):
            raise
    is_local = host in ("localhost", "127.0.0.1", "::1")
    if parsed.scheme == "http" and not is_local:
        raise ValueError("Non-local URLs must use HTTPS.")
    return url.rstrip("/")


class AmAiCloudAdapter:
    """Forwards completions cleanly to AM AI's existing `/api/chat` endpoint without altering AI keys."""

    def __init__(self, backend_url: Optional[str] = None, access_token: Optional[str] = None):
        self.backend_url = (backend_url or os.getenv("AM_AI_BACKEND_URL") or "").strip().rstrip("/")
        self.access_token = (access_token or os.getenv("APP_ACCESS_TOKEN") or "").strip()

    def is_configured(self) -> bool:
        return bool(self.backend_url)

    def generate(
        self,
        prompt: str,
        system_instruction: str = "",
        timeout: int = 30,
    ) -> Dict[str, Any]:
        if not self.backend_url:
            raise RuntimeError("AM_AI_BACKEND_URL is not configured for AmAiCloudAdapter.")
        safe_url = validate_url(self.backend_url)
        endpoint = f"{safe_url}/api/chat"
        payload = json.dumps(
            {
                "message": prompt,
                "systemInstruction": system_instruction,
                "mode": "chat",
            }
        ).encode("utf-8")
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if self.access_token:
            headers["Authorization"] = f"Bearer {self.access_token}"
        req = urllib.request.Request(endpoint, data=payload, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
        return {
            "text": str(data.get("reply") or ""),
            "provider": data.get("provider") or "amai_cloud",
            "model": data.get("model") or "gemini-3.8-flash",
            "engineId": "amai_cloud",
        }


class EngineManager:
    def __init__(self, cloud_adapter: Optional[AmAiCloudAdapter] = None):
        self.cloud_adapter = cloud_adapter or AmAiCloudAdapter()
        self.engines = {
            "ollama": {
                "id": "ollama",
                "base_url": (os.getenv("OLLAMA_BASE_URL") or "http://127.0.0.1:11434").strip().rstrip("/"),
                "protocol": "ollama",
            },
            "llamacpp": {
                "id": "llamacpp",
                "base_url": (os.getenv("LLAMACPP_BASE_URL") or "").strip().rstrip("/"),
                "protocol": "openai",
            },
            "vllm": {
                "id": "vllm",
                "base_url": (os.getenv("VLLM_BASE_URL") or "").strip().rstrip("/"),
                "protocol": "openai",
            },
            "sglang": {
                "id": "sglang",
                "base_url": (os.getenv("SGLANG_BASE_URL") or "").strip().rstrip("/"),
                "protocol": "openai",
            },
        }

    def probe_all(self) -> List[Dict[str, Any]]:
        out: List[Dict[str, Any]] = [
            {
                "id": "amai_cloud",
                "status": "connected" if self.cloud_adapter.is_configured() else "unconfigured",
                "models": ["gemini-3.8-flash"] if self.cloud_adapter.is_configured() else [],
            }
        ]
        for eng_id, cfg in self.engines.items():
            base = cfg["base_url"]
            if not base:
                out.append({"id": eng_id, "status": "unconfigured", "models": []})
                continue
            try:
                safe_base = validate_url(base)
                probe_path = f"{safe_base}/api/tags" if cfg["protocol"] == "ollama" else f"{safe_base}/v1/models"
                req = urllib.request.Request(probe_path, headers={"Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=2) as resp:
                    parsed = json.loads(resp.read().decode("utf-8"))
                raw_models = parsed.get("models") or parsed.get("data") or []
                names = [m.get("name") or m.get("id") for m in raw_models if isinstance(m, dict)]
                out.append({"id": eng_id, "status": "connected", "models": [n for n in names if n]})
            except Exception as exc:
                out.append({"id": eng_id, "status": "unreachable", "models": [], "error": str(exc)[:140]})
        return out

    def generate(
        self,
        prompt: str,
        engine_id: str = "amai_cloud",
        model: Optional[str] = None,
        system_instruction: str = "",
        temperature: float = 0.35,
        max_tokens: int = 1200,
    ) -> Dict[str, Any]:
        if engine_id != "amai_cloud" and engine_id in self.engines and self.engines[engine_id]["base_url"]:
            cfg = self.engines[engine_id]
            safe_base = validate_url(cfg["base_url"])
            messages = []
            if system_instruction:
                messages.append({"role": "system", "content": system_instruction})
            messages.append({"role": "user", "content": prompt})

            if cfg["protocol"] == "ollama":
                endpoint = f"{safe_base}/api/chat"
                body = {
                    "model": model or "qwen2.5:1.5b",
                    "messages": messages,
                    "stream": False,
                    "options": {"temperature": temperature, "num_predict": max_tokens},
                }
            else:
                endpoint = f"{safe_base}/v1/chat/completions"
                body = {
                    "model": model or "local-model",
                    "messages": messages,
                    "temperature": temperature,
                    "max_tokens": max_tokens,
                }
            req = urllib.request.Request(
                endpoint,
                data=json.dumps(body).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=30) as resp:
                parsed = json.loads(resp.read().decode("utf-8"))
            text = (
                (parsed.get("message") or {}).get("content")
                or ((parsed.get("choices") or [{}])[0].get("message") or {}).get("content")
                or ""
            )
            return {
                "text": str(text).strip(),
                "engineId": engine_id,
                "model": parsed.get("model") or model or "local-model",
            }

        if self.cloud_adapter.is_configured():
            return self.cloud_adapter.generate(prompt=prompt, system_instruction=system_instruction)

        raise RuntimeError(
            "No connected local engine and AM_AI_BACKEND_URL is unset on standalone Python service."
        )
