"""OpenJarvis Agents & Safe AST/Workspace Tools (Python)."""

from __future__ import annotations

import ast
import importlib.util
import math
import operator
import os
import re
import shutil
import time
from typing import Any, Dict, List, Optional

SAFE_BIN_OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
}
SAFE_UNARY_OPS = {ast.UAdd: operator.pos, ast.USub: operator.neg}
SAFE_FUNCS = {
    "sqrt": math.sqrt,
    "sin": math.sin,
    "cos": math.cos,
    "tan": math.tan,
    "log": math.log10,
    "ln": math.log,
    "abs": abs,
    "round": round,
    "min": min,
    "max": max,
    "pow": pow,
}
SAFE_CONSTS = {"pi": math.pi, "e": math.e, "tau": math.tau}
SENSITIVE_FILES_RE = re.compile(r"(^\.env|\.(pem|key|p12|jks|keystore)$|secret|credential|password|token)", re.I)


def safe_eval_math(expression: str) -> float:
    """Strictly evaluates pure arithmetic/math AST nodes with zero eval/exec."""
    expr = str(expression or "").strip().replace("^", "**")
    if not expr or len(expr) > 250:
        raise ValueError("Expression must be 1..250 chars.")
    tree = ast.parse(expr, mode="eval")

    def _eval(node: ast.AST) -> float:
        if isinstance(node, ast.Expression):
            return _eval(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.Name) and node.id.lower() in SAFE_CONSTS:
            return float(SAFE_CONSTS[node.id.lower()])
        if isinstance(node, ast.BinOp) and type(node.op) in SAFE_BIN_OPS:
            return float(SAFE_BIN_OPS[type(node.op)](_eval(node.left), _eval(node.right)))
        if isinstance(node, ast.UnaryOp) and type(node.op) in SAFE_UNARY_OPS:
            return float(SAFE_UNARY_OPS[type(node.op)](_eval(node.operand)))
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
            fn = SAFE_FUNCS.get(node.func.id.lower())
            if fn and not node.keywords:
                return float(fn(*[_eval(a) for a in node.args]))
        raise ValueError(f"Unsupported or unsafe AST construct: {type(node).__name__}")

    result = _eval(tree)
    if not math.isfinite(result):
        raise ValueError("Expression produced non-finite value.")
    return result


def resolve_confined_file(rel_path: str, workspace_root: str) -> str:
    raw = str(rel_path or "").strip()
    if not raw or os.path.isabs(raw) or "\x00" in raw:
        raise ValueError("Absolute paths or empty targets are disallowed inside confined workspace.")
    if SENSITIVE_FILES_RE.search(os.path.basename(raw)):
        raise ValueError("Access blocked: filename matches sensitive credential policy.")
    root_real = os.path.realpath(workspace_root)
    candidate = os.path.realpath(os.path.join(root_real, raw))
    if candidate != root_real and not candidate.startswith(root_real + os.sep):
        raise ValueError("Path traversal blocked outside OpenJarvis workspace.")
    return candidate


def check_optional_agent_runtimes() -> Dict[str, bool]:
    return {
        "openhands_sdk": importlib.util.find_spec("openhands") is not None,
        "claude_code_cli": shutil.which("claude") is not None,
        "official_openjarvis_pkg": importlib.util.find_spec("openjarvis") is not None,
    }


class PythonAgentRunner:
    def __init__(self, engine_manager: Any, memory: Any, workspace_dir: Optional[str] = None):
        self.engine_manager = engine_manager
        self.memory = memory
        self.workspace_dir = os.path.realpath(
            workspace_dir or os.getenv("OPENJARVIS_WORKSPACE_DIR") or os.path.join(os.getcwd(), "openjarvis_workspace")
        )
        os.makedirs(self.workspace_dir, exist_ok=True)

    def run(
        self,
        prompt: str,
        agent_id: str = "simple",
        engine_id: str = "amai_cloud",
        model: Optional[str] = None,
        namespace: str = "default",
    ) -> Dict[str, Any]:
        started = time.time()
        clean = str(prompt or "").strip()
        if not clean:
            raise ValueError("Prompt cannot be empty.")

        optional_caps = check_optional_agent_runtimes()
        if agent_id in ("openhands", "native_openhands") and not optional_caps["openhands_sdk"]:
            raise RuntimeError("OpenHands SDK is not installed in Python environment (`pip install openhands`).")
        if agent_id == "claude_code" and not optional_caps["claude_code_cli"]:
            raise RuntimeError("Claude Code CLI (`claude`) is not installed or licensed on host.")

        steps: List[Dict[str, str]] = [{"phase": "init", "detail": f"Running Python {agent_id} agent."}]
        observations: List[str] = []

        if agent_id in ("native_react", "orchestrator", "rlm"):
            hits = self.memory.search(clean, mode="hybrid", limit=4, namespace=namespace)
            if hits.get("results"):
                obs = "\n".join(f"- {r['title']}: {r['text']}" for r in hits["results"])
                observations.append(f"[Memory/HybridSearch]\n{obs}")
                steps.append({"phase": "retrieve", "detail": f"Retrieved {len(hits['results'])} chunks via SQLite/BM25."})

        math_match = re.search(r"(?:calculate|compute|solve)\s+([0-9+\-*/^().%\s,sqrtincoablogpowe]{3,100})", clean, re.I)
        if math_match:
            try:
                val = safe_eval_math(math_match.group(1))
                observations.append(f"[AST Calculator]\n{math_match.group(1).strip()} = {val}")
                steps.append({"phase": "ast_calculator", "detail": f"Computed {val}"})
            except Exception:
                pass

        full_prompt = clean
        if observations:
            full_prompt += "\n\nGrounded Context:\n" + "\n\n".join(observations)

        sys_prompt = f"You are OpenJarvis {agent_id} running cleanly inside the standalone AM AI Python microservice."
        res = self.engine_manager.generate(
            prompt=full_prompt,
            engine_id=engine_id,
            model=model,
            system_instruction=sys_prompt,
        )
        latency_ms = max(1, int((time.time() - started) * 1000))
        self.memory.record_trace(
            agent_id=agent_id,
            engine_id=res.get("engineId", engine_id),
            model_used=res.get("model", "unknown"),
            ok=True,
            latency_ms=latency_ms,
            payload={"steps": steps},
        )
        return {
            "ok": True,
            "agentId": agent_id,
            "engineId": res.get("engineId", engine_id),
            "model": res.get("model"),
            "answer": res.get("text", ""),
            "steps": steps,
            "latencyMs": latency_ms,
        }
