"""Standalone OpenJarvis HTTP Server (FastAPI + Uvicorn when installed, stdlib ThreadingHTTPServer fallback)."""

from __future__ import annotations

import hmac
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any, Dict, Optional

from openjarvis_service.agents_tools import PythonAgentRunner, check_optional_agent_runtimes
from openjarvis_service.engines import EngineManager
from openjarvis_service.intelligence import inspect_hardware, recommend_models
from openjarvis_service.memory import HybridSqliteMemory


class OpenJarvisServiceState:
    def __init__(self, db_path: Optional[str] = None, workspace_dir: Optional[str] = None):
        self.memory = HybridSqliteMemory(db_path=db_path)
        self.engine_manager = EngineManager()
        self.agent_runner = PythonAgentRunner(
            engine_manager=self.engine_manager,
            memory=self.memory,
            workspace_dir=workspace_dir,
        )

    def health_payload(self) -> Dict[str, Any]:
        hw = inspect_hardware()
        caps = {
            **self.memory.capabilities(),
            **check_optional_agent_runtimes(),
        }
        return {
            "status": "ok",
            "service": "openjarvis-python-companion",
            "hardware": hw,
            "capabilities": caps,
            "engines": self.engine_manager.probe_all(),
        }


def _authorized(headers: Any) -> bool:
    expected = (os.getenv("OPENJARVIS_AUTH_TOKEN") or "").strip()
    if not expected:
        return True
    auth = str(headers.get("Authorization") or "")
    if not auth.lower().startswith("bearer "):
        return False
    provided = auth[7:].strip()
    return hmac.compare_digest(provided.encode("utf-8"), expected.encode("utf-8"))


def create_stdlib_server(host: str = "127.0.0.1", port: int = 8100, state: Optional[OpenJarvisServiceState] = None) -> ThreadingHTTPServer:
    svc = state or OpenJarvisServiceState()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
            return

        def _send_json(self, code: int, payload: Dict[str, Any]) -> None:
            raw = json.dumps(payload).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def _read_json(self) -> Dict[str, Any]:
            length = int(self.headers.get("Content-Length") or 0)
            if length <= 0 or length > 4 * 1024 * 1024:
                return {}
            return json.loads(self.rfile.read(length).decode("utf-8"))

        def do_GET(self) -> None:  # noqa: N802
            if self.path == "/health":
                self._send_json(200, svc.health_payload())
                return
            if not _authorized(self.headers):
                self._send_json(401, {"error": "Unauthorized"})
                return
            if self.path == "/v1/models":
                hw = inspect_hardware()
                self._send_json(200, {"ok": True, "hardware": hw, "models": recommend_models(hw)})
                return
            if self.path == "/v1/learning/summary":
                self._send_json(200, {"ok": True, "summary": svc.memory.learning_summary()})
                return
            self._send_json(404, {"error": "Not found"})

        def do_POST(self) -> None:  # noqa: N802
            if not _authorized(self.headers):
                self._send_json(401, {"error": "Unauthorized"})
                return
            try:
                body = self._read_json()
                if self.path == "/v1/memory/index":
                    res = svc.memory.index_document(
                        title=body.get("title", "Untitled"),
                        text=body.get("text", ""),
                        namespace=body.get("namespace", "default"),
                    )
                    self._send_json(201, res)
                    return
                if self.path == "/v1/memory/search":
                    res = svc.memory.search(
                        query=body.get("query", ""),
                        mode=body.get("mode", "hybrid"),
                        limit=int(body.get("limit", 6)),
                        namespace=body.get("namespace", "default"),
                    )
                    self._send_json(200, res)
                    return
                if self.path == "/v1/generate":
                    res = svc.engine_manager.generate(
                        prompt=body.get("prompt", ""),
                        engine_id=body.get("engine_id", "amai_cloud"),
                        model=body.get("model"),
                        system_instruction=body.get("system_instruction", ""),
                    )
                    self._send_json(200, res)
                    return
                if self.path == "/v1/agents/run":
                    res = svc.agent_runner.run(
                        prompt=body.get("prompt", ""),
                        agent_id=body.get("agent_id", "simple"),
                        engine_id=body.get("engine_id", "amai_cloud"),
                        model=body.get("model"),
                        namespace=body.get("namespace", "default"),
                    )
                    self._send_json(200, res)
                    return
                self._send_json(404, {"error": "Not found"})
            except Exception as exc:
                self._send_json(400, {"ok": False, "error": str(exc)})

    return ThreadingHTTPServer((host, port), Handler)


def main() -> None:
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8100"))
    server = create_stdlib_server(host=host, port=port)
    print(f"[OpenJarvis Python Service] Listening on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
