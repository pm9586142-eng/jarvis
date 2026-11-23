"""OpenJarvis Intelligence Pillar (Python) — BUILTIN_MODELS & Real Hardware Inspection."""

from __future__ import annotations

import os
import platform
import shutil
import subprocess
from typing import Any, Dict, List, Optional

BUILTIN_MODELS: List[Dict[str, Any]] = [
    {
        "id": "gemini-3.8-flash",
        "name": "Gemini 3.8 Flash (AM AI Adapter)",
        "params_b": 0,
        "min_ram_gb": 0,
        "min_vram_gb": 0,
        "engines": ["amai_cloud"],
        "capabilities": ["chat", "reasoning", "coding", "vision", "tool_calling"],
        "efficiency_tier": "cloud_free_tier",
    },
    {
        "id": "qwen2.5:1.5b",
        "name": "Qwen 2.5 1.5B Instruct",
        "params_b": 1.5,
        "min_ram_gb": 4,
        "min_vram_gb": 2,
        "engines": ["ollama", "llamacpp", "vllm", "sglang"],
        "capabilities": ["chat", "coding", "tool_calling"],
        "efficiency_tier": "ultra_efficient",
    },
    {
        "id": "gemma3:4b",
        "name": "Gemma 3 4B Instruct",
        "params_b": 4.0,
        "min_ram_gb": 8,
        "min_vram_gb": 4,
        "engines": ["ollama", "llamacpp", "vllm", "sglang"],
        "capabilities": ["chat", "reasoning", "vision", "tool_calling"],
        "efficiency_tier": "high_efficiency",
    },
    {
        "id": "qwen2.5-coder:7b",
        "name": "Qwen 2.5 Coder 7B",
        "params_b": 7.0,
        "min_ram_gb": 12,
        "min_vram_gb": 6,
        "engines": ["ollama", "llamacpp", "vllm", "sglang"],
        "capabilities": ["coding", "debugging", "tool_calling"],
        "efficiency_tier": "balanced",
    },
    {
        "id": "deepseek-r1:8b",
        "name": "DeepSeek-R1 Distill Llama 8B",
        "params_b": 8.0,
        "min_ram_gb": 12,
        "min_vram_gb": 6,
        "engines": ["ollama", "llamacpp", "vllm", "sglang"],
        "capabilities": ["reasoning", "mathematics", "coding"],
        "efficiency_tier": "balanced",
    },
    {
        "id": "qwen2.5:14b",
        "name": "Qwen 2.5 14B Instruct",
        "params_b": 14.0,
        "min_ram_gb": 20,
        "min_vram_gb": 12,
        "engines": ["ollama", "llamacpp", "vllm", "sglang"],
        "capabilities": ["chat", "reasoning", "coding", "rag"],
        "efficiency_tier": "workstation",
    },
    {
        "id": "llama3.3:70b",
        "name": "Llama 3.3 70B Instruct",
        "params_b": 70.0,
        "min_ram_gb": 64,
        "min_vram_gb": 44,
        "engines": ["vllm", "sglang", "ollama"],
        "capabilities": ["chat", "reasoning", "coding", "research"],
        "efficiency_tier": "gpu_server",
    },
]


def _read_ram_gb() -> Dict[str, float]:
    try:
        import psutil  # type: ignore

        vm = psutil.virtual_memory()
        return {
            "total": round(vm.total / (1024**3), 2),
            "free": round(vm.available / (1024**3), 2),
        }
    except Exception:
        total_gb = 0.0
        free_gb = 0.0
        if os.path.exists("/proc/meminfo"):
            try:
                with open("/proc/meminfo", "r", encoding="utf-8") as fh:
                    for line in fh:
                        if line.startswith("MemTotal:"):
                            kb = int(line.split()[1])
                            total_gb = round(kb / (1024**2), 2)
                        elif line.startswith("MemAvailable:"):
                            kb = int(line.split()[1])
                            free_gb = round(kb / (1024**2), 2)
            except Exception:
                pass
        return {"total": total_gb, "free": free_gb}


def _probe_nvidia_gpu() -> Dict[str, Any]:
    nvsmi = shutil.which("nvidia-smi")
    if not nvsmi:
        return {
            "detected": False,
            "name": None,
            "vramTotalGb": 0,
            "vramFreeGb": 0,
            "source": "No nvidia-smi GPU binary detected on host.",
        }
    try:
        out = subprocess.check_output(
            [nvsmi, "--query-gpu=name,memory.total,memory.free", "--format=csv,noheader,nounits"],
            timeout=2.5,
            text=True,
        ).strip()
        first = out.splitlines()[0].split(",")
        name = first[0].strip()
        total_mb = float(first[1].strip())
        free_mb = float(first[2].strip())
        return {
            "detected": True,
            "name": name,
            "vramTotalGb": round(total_mb / 1024.0, 2),
            "vramFreeGb": round(free_mb / 1024.0, 2),
            "source": "nvidia-smi live telemetry",
        }
    except Exception:
        return {
            "detected": False,
            "name": None,
            "vramTotalGb": 0,
            "vramFreeGb": 0,
            "source": "nvidia-smi probe returned no active GPU device.",
        }


def inspect_hardware() -> Dict[str, Any]:
    ram = _read_ram_gb()
    gpu = _probe_nvidia_gpu()
    return {
        "platform": platform.system().lower(),
        "arch": platform.machine(),
        "cpuCores": os.cpu_count() or 1,
        "totalRamGb": ram["total"],
        "freeRamGb": ram["free"],
        "gpu": gpu,
    }


def recommend_models(hw: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
    info = hw or inspect_hardware()
    total_ram = float(info.get("totalRamGb") or 0)
    vram = float((info.get("gpu") or {}).get("vramTotalGb") or 0)
    results: List[Dict[str, Any]] = []
    for m in BUILTIN_MODELS:
        if m["efficiency_tier"] == "cloud_free_tier":
            fit = "optimal"
            rec = True
        elif vram >= m["min_vram_gb"] and vram > 0:
            fit = "optimal"
            rec = True
        elif total_ram >= m["min_ram_gb"]:
            fit = "optimal_cpu" if vram == 0 else "cpu_offload"
            rec = m["params_b"] <= 8
        else:
            fit = "insufficient_hardware"
            rec = False
        results.append({**m, "fitStatus": fit, "recommended": rec})
    return results
