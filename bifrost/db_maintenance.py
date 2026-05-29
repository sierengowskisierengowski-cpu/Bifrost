#!/usr/bin/env python3
"""Background SQLite maintenance for crash resilience (e.g. SIGKILL)."""

from __future__ import annotations

import logging
import sqlite3
import threading
import time

log = logging.getLogger("heimdall.db_maintenance")


class WALCheckpointThread(threading.Thread):
    """
    Periodically checkpoint the WAL so a SIGKILL loses less data
    and recovery on restart is faster.
    """

    def __init__(
        self,
        db_path: str,
        shutdown: threading.Event,
        interval_seconds: float = 60.0,
    ):
        super().__init__(daemon=True, name="bifrost.db_maintenance")
        self.db_path = db_path
        self.shutdown = shutdown
        self.interval_seconds = interval_seconds

    def run(self) -> None:
        log.info(
            "WAL checkpoint thread started (interval=%.0fs)",
            self.interval_seconds,
        )
        while not self.shutdown.wait(self.interval_seconds):
            try:
                conn = sqlite3.connect(self.db_path, timeout=5.0)
                conn.execute("PRAGMA wal_checkpoint(PASSIVE)")
                conn.close()
            except sqlite3.Error as exc:
                log.warning("Periodic WAL checkpoint failed: %s", exc)
