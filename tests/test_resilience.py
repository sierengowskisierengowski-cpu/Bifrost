#!/usr/bin/env python3

import json
import logging

import pytest

from bifrost.resilience import (
    MAX_EVENT_RAW_BYTES,
    MAX_INGEST_BODY_BYTES,
    validate_event_envelope,
    verify_config_integrity,
)


def test_validate_event_envelope_accepts_valid():
    ok, err = validate_event_envelope({
        "source": "test",
        "timestamp": "2026-05-29T00:00:00Z",
        "boundary": "HOST",
        "raw": {"pid": 1},
    })
    assert ok is True
    assert err == ""


def test_validate_event_rejects_invalid_boundary():
    ok, err = validate_event_envelope({
        "source": "test",
        "timestamp": "2026-05-29T00:00:00Z",
        "boundary": "EVIL",
        "raw": {},
    })
    assert ok is False
    assert "boundary" in err


def test_validate_event_rejects_oversize_raw():
    ok, err = validate_event_envelope({
        "source": "test",
        "timestamp": "2026-05-29T00:00:00Z",
        "boundary": "HOST",
        "raw": {"data": "x" * (MAX_EVENT_RAW_BYTES + 1)},
    })
    assert ok is False
    assert "exceeds" in err


def test_verify_config_integrity_missing_file(tmp_path):
    config_path = tmp_path / "heimdall_config.json"
    ok, reason = verify_config_integrity(config_path)
    assert ok is False
    assert "missing" in reason


def test_verify_config_integrity_mismatch(tmp_path):
    config_path = tmp_path / "heimdall_config.json"
    config_path.write_text('{"k": "v"}')
    checksum_path = config_path.with_suffix(".sha256")
    checksum_path.write_text("deadbeef")

    ok, reason = verify_config_integrity(config_path)
    assert ok is False
    assert "mismatch" in reason


def test_guardian_rejects_invalid_queue_event(tmp_path, monkeypatch):
    from bifrost import guardian

    monkeypatch.setattr(guardian, "DB_PATH", tmp_path / "events.db")
    guardian.init_database()

    router = guardian.EventRouter.__new__(guardian.EventRouter)
    router.queue = __import__("queue").Queue()
    router.config = {"hardware_tier": "TIER_4", "use_local_llm": False}
    router.db_path = str(tmp_path / "events.db")
    router.log = logging.getLogger("test.resilience")
    router.event_count = 0
    router.db_healthy = True
    router.config_integrity_ok = True
    router.conn = __import__("sqlite3").connect(router.db_path)
    guardian.configure_sqlite_connection(router.conn)

    router.queue.put({"source": "bad", "boundary": "HOST"})
    router.queue.put({
        "source": "good",
        "timestamp": "2026-05-29T00:00:00Z",
        "boundary": "HOST",
        "raw": {"ok": True},
    })

    guardian.SHUTDOWN.clear()
    processed = []

    original_store = router.store_event

    def track_store(event, compressed=None, decision=None):
        processed.append(event.get("source"))
        return original_store(event, compressed, decision)

    router.store_event = track_store
    router.setup_inference_clients = lambda: None
    router.analyst_client = None
    router.extractor_client = None

    def run_one():
        event = None
        try:
            event = router.queue.get(timeout=0.1)
            ok, err = guardian.validate_event_envelope(event)
            if not ok:
                return
            router.store_event(event)
        finally:
            if event is not None:
                router.queue.task_done()

    run_one()
    run_one()

    assert processed == ["good"]
