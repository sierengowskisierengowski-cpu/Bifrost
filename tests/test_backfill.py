#!/usr/bin/env python3
"""Tests for historical heimdall_decision backfill."""

import json
import logging
import sqlite3

import pytest

from bifrost import backfill, guardian


def _insert_pending_event(conn, *, eventid="cowrie.login.failed", boundary="HONEYPOT"):
    raw = json.dumps({"eventid": eventid, "src_ip": "1.2.3.4"})
    conn.execute(
        """
        INSERT INTO events (timestamp, source, boundary, raw_event)
        VALUES (?, ?, ?, ?)
        """,
        ("2026-05-30T12:00:00Z", "cowrie", boundary, raw),
    )
    conn.commit()
    return conn.execute("SELECT last_insert_rowid()").fetchone()[0]


@pytest.fixture
def backfill_db(tmp_path, monkeypatch):
    db_path = tmp_path / "events.db"
    monkeypatch.setattr(guardian, "DB_PATH", db_path)
    guardian.init_database()
    return db_path


def test_row_to_event_parses_raw_json():
    row = (
        7,
        "2026-05-30T12:00:00Z",
        "cowrie",
        "HONEYPOT",
        '{"eventid":"cowrie.login.failed"}',
        None,
    )
    event, event_id, compressed = backfill.row_to_event(row)
    assert event_id == 7
    assert compressed is None
    assert event["raw"]["eventid"] == "cowrie.login.failed"


def test_fetch_pending_rows_orders_chronologically(backfill_db):
    conn = sqlite3.connect(backfill_db)
    conn.execute(
        """
        INSERT INTO events (timestamp, source, boundary, raw_event, heimdall_decision)
        VALUES ('2026-05-30T13:00:00Z', 'cowrie', 'HONEYPOT', '{}', NULL)
        """
    )
    conn.execute(
        """
        INSERT INTO events (timestamp, source, boundary, raw_event, heimdall_decision)
        VALUES ('2026-05-30T11:00:00Z', 'cowrie', 'HONEYPOT', '{}', NULL)
        """
    )
    conn.execute(
        """
        INSERT INTO events (timestamp, source, boundary, raw_event, heimdall_decision)
        VALUES ('2026-05-30T12:00:00Z', 'cowrie', 'HONEYPOT', '{}', '{"done": true}')
        """
    )
    conn.execute(
        """
        INSERT INTO events (timestamp, source, boundary, raw_event, heimdall_decision, false_positive)
        VALUES ('2026-05-30T10:00:00Z', 'cowrie', 'HONEYPOT', '{}', NULL, 1)
        """
    )
    conn.execute(
        """
        INSERT INTO events (timestamp, source, boundary, raw_event, heimdall_decision)
        VALUES ('2026-05-30T09:00:00Z', 'cowrie', 'HONEYPOT', '', NULL)
        """
    )
    conn.commit()

    rows = backfill.fetch_pending_rows(conn)
    conn.close()

    assert len(rows) == 2
    assert rows[0][1] == "2026-05-30T11:00:00Z"
    assert rows[1][1] == "2026-05-30T13:00:00Z"


def test_update_event_decision_writes_json(backfill_db):
    conn = sqlite3.connect(backfill_db)
    event_id = _insert_pending_event(conn)
    decision = {
        "schema_version": "0.1.0",
        "severity": "LOW",
        "action_required": "LOG",
        "action_effective": "LOG",
        "confidence": 0.5,
        "reasoning": "backfill test",
    }

    conn = backfill.update_event_decision(
        conn,
        str(backfill_db),
        logging.getLogger("test.backfill"),
        event_id,
        '{"event_type":"cowrie_login"}',
        decision,
    )
    row = conn.execute(
        "SELECT heimdall_decision, action_taken FROM events WHERE id = ?",
        (event_id,),
    ).fetchone()
    conn.close()

    stored = json.loads(row[0])
    assert stored["action_required"] == "LOG"
    assert row[1] == "LOG"


def test_run_backfill_updates_routed_events(backfill_db, monkeypatch):
    conn = sqlite3.connect(backfill_db)
    event_id = _insert_pending_event(conn)
    conn.close()

    decision = {
        "schema_version": "0.1.0",
        "incident_detected": True,
        "severity": "MEDIUM",
        "boundary": "HONEYPOT",
        "threat_class": "brute_force_ssh",
        "confidence": 0.8,
        "action_required": "ALERT",
        "target": None,
        "gjallarhorn_tier": 1,
        "reasoning": "mocked backfill",
        "action_effective": "ALERT",
        "policy_allowed": True,
    }

    def fake_reason(_self, event, compressed):
        return dict(decision)

    def fake_compress(_self, event):
        return '{"event_type":"cowrie_login"}'

    monkeypatch.setattr(guardian.EventRouter, "_reason_event", fake_reason)
    monkeypatch.setattr(guardian.EventRouter, "compress_event", fake_compress)
    monkeypatch.setattr(
        guardian.EventRouter,
        "apply_policy_gate",
        lambda self, d, e: d,
    )
    monkeypatch.setattr(
        guardian.EventRouter,
        "setup_inference_clients",
        lambda self: None,
    )

    config = {"use_local_llm": False, "hardware_tier": "TIER_4"}
    stats = backfill.run_backfill(
        db_path=str(backfill_db),
        config=config,
        progress_interval=0,
        delay_seconds=0,
    )

    assert stats["updated"] == 1
    conn = sqlite3.connect(backfill_db)
    row = conn.execute(
        "SELECT heimdall_decision FROM events WHERE id = ?",
        (event_id,),
    ).fetchone()
    conn.close()
    stored = json.loads(row[0])
    assert stored["threat_class"] == "brute_force_ssh"
    assert stored["backfill"] is True
    assert stored["execution_result"] == "backfill_skipped"


def test_run_backfill_processes_all_pending_events(backfill_db, monkeypatch):
    conn = sqlite3.connect(backfill_db)
    event_id = _insert_pending_event(conn, eventid="cowrie.client.kex")
    conn.close()

    decision = {
        "schema_version": "0.1.0",
        "incident_detected": False,
        "severity": "LOW",
        "boundary": "HONEYPOT",
        "threat_class": "scanner_noise",
        "confidence": 0.3,
        "action_required": "LOG",
        "target": None,
        "gjallarhorn_tier": 1,
        "reasoning": "mocked backfill",
        "action_effective": "LOG",
        "policy_allowed": True,
    }

    monkeypatch.setattr(guardian.EventRouter, "_reason_event", lambda s, e, c: dict(decision))
    monkeypatch.setattr(guardian.EventRouter, "compress_event", lambda s, e: "{}")
    monkeypatch.setattr(guardian.EventRouter, "apply_policy_gate", lambda s, d, e: d)
    monkeypatch.setattr(guardian.EventRouter, "setup_inference_clients", lambda self: None)

    config = {"use_local_llm": False, "hardware_tier": "TIER_4"}
    stats = backfill.run_backfill(
        db_path=str(backfill_db),
        config=config,
        progress_interval=0,
        delay_seconds=0,
    )

    assert stats["updated"] == 1
    conn = sqlite3.connect(backfill_db)
    row = conn.execute(
        "SELECT heimdall_decision FROM events WHERE id = ?",
        (event_id,),
    ).fetchone()
    conn.close()
    assert json.loads(row[0])["action_required"] == "LOG"
