#!/usr/bin/env python3
"""Tests for guardian pipeline decoupling (reasoning vs executor integrity)."""

import json
import logging
import sqlite3

import pytest

from bifrost import guardian


def _cowrie_event(eventid: str) -> dict:
    return {
        "source": "cowrie",
        "timestamp": "2026-05-30T12:00:00Z",
        "boundary": "HONEYPOT",
        "raw": {"eventid": eventid, "src_ip": "87.251.64.176"},
    }


def test_should_route_supported_cowrie_events():
    for eventid in guardian.SUPPORTED_COWRIE_EVENTS:
        assert guardian.should_route_to_reasoner(_cowrie_event(eventid)) is True


def test_should_route_cowrie_direct_tcpip_request():
    event = _cowrie_event("cowrie.direct-tcpip.request")
    assert guardian.should_route_to_reasoner(event) is True


def test_should_skip_unsupported_cowrie_noise():
    event = _cowrie_event("cowrie.client.kex")
    assert guardian.should_route_to_reasoner(event) is False


def test_should_route_host_events():
    event = {
        "source": "auditd",
        "timestamp": "2026-05-30T12:00:00Z",
        "boundary": "HOST",
        "raw": {"pid": 1234},
    }
    assert guardian.should_route_to_reasoner(event) is True


def test_should_route_honeypot_breakout():
    event = {
        "source": "network_watcher",
        "timestamp": "2026-05-30T12:00:00Z",
        "boundary": "HONEYPOT",
        "raw": {"alert": "honeypot_to_host_connection", "remote_ip": "10.0.0.5"},
    }
    assert guardian.should_route_to_reasoner(event) is True


def test_check_executor_integrity_does_not_mark_db_unhealthy(
    tmp_path, monkeypatch
):
    db_path = tmp_path / "events.db"
    config_path = tmp_path / "heimdall_config.json"
    checksum_path = tmp_path / "heimdall_config.sha256"

    config_path.write_text("{}", encoding="utf-8")
    checksum_path.write_text("wrong", encoding="utf-8")

    monkeypatch.setattr(guardian, "CONFIG_PATH", config_path)
    monkeypatch.setattr(guardian, "DB_PATH", db_path)
    guardian.init_database()

    router = guardian.EventRouter.__new__(guardian.EventRouter)
    router.config = {"hardware_tier": "TIER_4"}
    router.log = logging.getLogger("test.pipeline.integrity")
    router.db_path = str(db_path)
    router.conn = sqlite3.connect(db_path)
    guardian.configure_sqlite_connection(router.conn)
    router.db_healthy = True
    router.config_integrity_ok = True

    assert router.check_executor_integrity() is False
    assert router.db_healthy is True


def test_store_event_persists_decision_even_when_db_healthy_false(
    tmp_path, monkeypatch
):
    db_path = tmp_path / "events.db"
    monkeypatch.setattr(guardian, "DB_PATH", db_path)
    guardian.init_database()

    router = guardian.EventRouter(
        guardian.EVENT_QUEUE,
        {"use_local_llm": False},
        str(db_path),
        logging.getLogger("test.pipeline.store"),
    )
    router.db_healthy = False

    decision = {
        "schema_version": "0.1.0",
        "incident_detected": True,
        "severity": "HIGH",
        "boundary": "HONEYPOT",
        "threat_class": "brute_force_ssh",
        "confidence": 0.9,
        "action_required": "ALERT",
        "target": None,
        "gjallarhorn_tier": 1,
        "reasoning": "test",
        "action_effective": "ALERT",
        "policy_allowed": True,
    }
    event_id = router.store_event(
        _cowrie_event("cowrie.login.failed"),
        compressed='{"event_type":"cowrie_login"}',
        decision=decision,
    )
    router.conn.close()

    assert event_id > 0
    conn = sqlite3.connect(db_path)
    row = conn.execute(
        "SELECT heimdall_decision FROM events WHERE id = ?",
        (event_id,),
    ).fetchone()
    conn.close()
    assert row[0] is not None
    stored = json.loads(row[0])
    assert stored["action_required"] == "ALERT"
    assert stored["severity"] == "HIGH"


def test_dispatch_enforcement_integrity_blocks_executor_only(monkeypatch, tmp_path):
    db_path = tmp_path / "events.db"
    config_path = tmp_path / "heimdall_config.json"
    checksum_path = tmp_path / "heimdall_config.sha256"
    config_path.write_text("{}", encoding="utf-8")
    checksum_path.write_text("mismatch", encoding="utf-8")

    monkeypatch.setattr(guardian, "CONFIG_PATH", config_path)
    monkeypatch.setattr(guardian, "DB_PATH", db_path)
    guardian.init_database()

    router = guardian.EventRouter.__new__(guardian.EventRouter)
    router.config = {
        "hardware_tier": "TIER_4",
        "learning_mode": False,
        "dry_run": False,
        "autonomous_actions_enabled": True,
    }
    router.log = logging.getLogger("test.pipeline.dispatch")
    router.db_path = str(db_path)
    router.conn = sqlite3.connect(db_path)
    guardian.configure_sqlite_connection(router.conn)
    router.db_healthy = True
    router.config_integrity_ok = True

    event_id = router.store_event(
        _cowrie_event("cowrie.login.failed"),
        compressed='{"event_type":"cowrie_login"}',
        decision={
            "schema_version": "0.1.0",
            "action_required": "KILL",
            "action_effective": "KILL",
            "policy_allowed": True,
            "severity": "HIGH",
            "reasoning": "test kill",
        },
    )

    decision = {
        "action_required": "KILL",
        "action_effective": "KILL",
        "policy_allowed": True,
        "target": "9999",
        "severity": "HIGH",
        "reasoning": "test kill",
    }

    calls = []
    monkeypatch.setattr(
        "bifrost.router.execute_decision",
        lambda *args, **kwargs: calls.append(args) or True,
    )

    result = router._dispatch_enforcement(decision, event_id=event_id)

    assert result == "integrity_check_failed"
    assert calls == []
    assert router.db_healthy is True
    assert decision["action_effective"] == "ALERT"
    assert decision["policy_allowed"] is False

    row = router.conn.execute(
        "SELECT heimdall_decision, action_taken FROM events WHERE id = ?",
        (event_id,),
    ).fetchone()
    stored = json.loads(row[0])
    assert stored["action_effective"] == "ALERT"
    assert stored["policy_allowed"] is False
    assert row[1] == "ALERT"
