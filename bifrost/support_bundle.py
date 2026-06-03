#!/usr/bin/env python3
"""Support bundle generator for Bifrost diagnostics."""

from __future__ import annotations

import hashlib
import json
import os
import platform
import shutil
import socket
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from bifrost import __version__
from bifrost import paths as bifrost_paths

DEFAULT_LOG_TAIL_LINES = 200


def _run(cmd: list[str]) -> str:
    try:
        out = subprocess.check_output(cmd, stderr=subprocess.STDOUT, timeout=5)
        return out.decode("utf-8", errors="replace").strip()
    except Exception as exc:
        return f"unavailable ({exc})"


def _tail_lines(path: Path, limit: int = DEFAULT_LOG_TAIL_LINES) -> list[str]:
    if not path.exists():
        return []
    if limit < 1:
        return []
    try:
        lines = path.read_text(encoding="utf-8", errors="replace").splitlines()
        return lines[-limit:]
    except Exception:
        return []


def _checksum(path: Path) -> str:
    if not path.exists():
        return ""
    h = hashlib.sha256()
    with path.open("rb") as handle:
        while True:
            chunk = handle.read(1024 * 1024)
            if not chunk:
                break
            h.update(chunk)
    return h.hexdigest()


def _port_open(host: str, port: int, timeout: float = 0.4) -> bool:
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except Exception:
        return False


def _service_hint(unit: str) -> str:
    if not shutil.which("systemctl"):
        return "systemctl not found"
    return _run(["systemctl", "is-active", unit])


def build_support_bundle(output_dir: str | Path | None = None) -> Path:
    config_path = bifrost_paths.config_path({})
    db_path = bifrost_paths.db_path({})
    log_path = bifrost_paths.log_path({})
    live_monitor_path = log_path.with_name("live_monitor.jsonl")

    diagnostics: dict[str, Any] = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "versions": {
            "bifrost": __version__,
            "python": platform.python_version(),
            "go": _run(["go", "version"]),
            "node": _run(["node", "--version"]),
            "pnpm": _run(["pnpm", "--version"]),
            "tauri": _run(["cargo", "tauri", "--version"]),
        },
        "paths": {
            "config": str(config_path),
            "config_sha256": _checksum(config_path),
            "database": str(db_path),
            "database_sha256": _checksum(db_path),
            "guardian_log": str(log_path),
            "guardian_log_sha256": _checksum(log_path),
            "live_monitor_jsonl": str(live_monitor_path),
            "live_monitor_sha256": _checksum(live_monitor_path),
        },
        "services": {
            "bifrost-guardian.service": _service_hint("bifrost-guardian.service"),
            "bifrost-agent.service": _service_hint("bifrost-agent.service"),
        },
        "environment": {
            "ollama_port_11434_open": _port_open("127.0.0.1", 11434),
            "ingest_port_8765_open": _port_open("127.0.0.1", 8765),
            "dashboard_port_8766_open": _port_open("127.0.0.1", 8766),
            "tokens": {
                "ingest_present": bool(os.getenv("BIFROST_INGEST_TOKEN", "").strip()),
                "executor_present": bool(os.getenv("BIFROST_EXECUTOR_TOKEN", "").strip()),
                "dashboard_present": bool(os.getenv("BIFROST_DASHBOARD_TOKEN", "").strip()),
            },
        },
        "logs_tail": {
            "guardian_log_last_200": _tail_lines(log_path, DEFAULT_LOG_TAIL_LINES),
            "live_monitor_last_200": _tail_lines(live_monitor_path, DEFAULT_LOG_TAIL_LINES),
        },
    }

    out_dir = Path(output_dir or Path.home())
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    bundle_path = out_dir / f"bifrost-support-bundle-{stamp}.tar.gz"

    with tempfile.TemporaryDirectory(prefix="bifrost-support-") as tmp:
        tmp_dir = Path(tmp)
        (tmp_dir / "diagnostics.json").write_text(
            json.dumps(diagnostics, indent=2),
            encoding="utf-8",
        )
        with tarfile.open(bundle_path, "w:gz") as tar:
            tar.add(tmp_dir / "diagnostics.json", arcname="diagnostics.json")

    return bundle_path
