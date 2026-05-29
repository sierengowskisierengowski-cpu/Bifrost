#!/usr/bin/env python3

import logging
import sqlite3
from queue import Queue

from bifrost import guardian


def _config():
    return {
        "hardware_tier": "TIER_4",
        "use_local_llm": False,
        "analyst_model": None,
        "system_baseline": "You are Heimdall-Core.",
    }


def test_event_router_drains_queue_after_shutdown(tmp_path):
    db_path = tmp_path / "events.db"
    queue = Queue()
    log = logging.getLogger("test.guardian.shutdown")

    original_db_path = guardian.DB_PATH
    guardian.DB_PATH = db_path
    guardian.init_database()
    guardian.DB_PATH = original_db_path

    queue.put({
        "source": "cowrie",
        "timestamp": "2026-05-29T00:00:00+00:00",
        "boundary": "HONEYPOT",
        "raw": {"eventid": "cowrie.login.failed"},
    })

    guardian.SHUTDOWN.set()
    guardian.ROUTER_STOP.clear()
    router = guardian.EventRouter(queue, _config(), str(db_path), log)
    router.start()

    try:
        assert guardian.wait_for_queue_drain(queue, timeout=2.0)
        guardian.ROUTER_STOP.set()
        router.join(timeout=2.0)

        assert not router.is_alive()
        assert queue.unfinished_tasks == 0

        conn = sqlite3.connect(db_path)
        try:
            stored = conn.execute("SELECT COUNT(*) FROM events").fetchone()[0]
        finally:
            conn.close()
        assert stored == 1
    finally:
        guardian.ROUTER_STOP.set()
        guardian.SHUTDOWN.set()
        router.join(timeout=2.0)
        guardian.SHUTDOWN.clear()
        guardian.ROUTER_STOP.clear()


def test_log_shutdown_summary_includes_processed_and_dropped(caplog):
    caplog.set_level(logging.INFO)

    guardian.log_shutdown_summary(
        logging.getLogger("test.guardian.summary"),
        processed=7,
        dropped=2,
        remaining=1,
    )

    assert "processed=7" in caplog.text
    assert "dropped=2" in caplog.text
    assert "remaining=1" in caplog.text
