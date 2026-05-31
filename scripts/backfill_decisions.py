#!/usr/bin/env python3
"""
Backfill heimdall_decision for historical events (pre-pipeline-fix NULL rows).

Usage:
    cd ~/Projects/bifrost
    export PYTHONPATH=$PWD HEIMDALL_ENV=development
    python3 scripts/backfill_decisions.py

Monitor:
    watch -n 5 'sqlite3 /var/lib/heimdall/events.db \\
      "SELECT COUNT(*) FROM events WHERE heimdall_decision IS NOT NULL;"'
"""

from __future__ import annotations

import logging
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from bifrost import paths as bifrost_paths
from bifrost.backfill import run_backfill
from bifrost.guardian import load_config, refresh_runtime_paths

log = logging.getLogger("heimdall.backfill")


def main() -> int:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
    )

    os.environ.setdefault("HEIMDALL_ENV", "development")
    config = load_config()
    refresh_runtime_paths(config)

    db_path = os.getenv("HEIMDALL_DB_PATH") or str(bifrost_paths.db_path(config))
    if not os.path.isfile(db_path):
        log.error("Database not found: %s", db_path)
        return 1

    pending = _count_pending(db_path)
    log.info("Starting backfill: %d events pending in %s", pending, db_path)
    print(f"[backfill] {pending} events to classify", flush=True)

    stats = run_backfill(
        db_path=db_path,
        config=config,
        reuse_compressed=True,
        dry_run=False,
        progress_interval=50,
        delay_seconds=0.5,
    )

    classified = stats.get("updated", 0)
    print(
        f"[backfill] complete: {classified} decisions written, "
        f"{stats.get('skipped', 0)} skipped, "
        f"{stats.get('errors', 0)} errors",
        flush=True,
    )
    return 1 if stats.get("errors", 0) else 0


def _count_pending(db_path: str) -> int:
    import sqlite3

    conn = sqlite3.connect(db_path)
    count = conn.execute(
        """
        SELECT COUNT(*)
        FROM events
        WHERE heimdall_decision IS NULL
          AND false_positive = 0
          AND raw_event IS NOT NULL
          AND TRIM(raw_event) != ''
        """
    ).fetchone()[0]
    conn.close()
    return count


if __name__ == "__main__":
    sys.exit(main())
