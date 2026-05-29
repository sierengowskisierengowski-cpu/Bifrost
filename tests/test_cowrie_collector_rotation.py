#!/usr/bin/env python3

import json
import logging
import time
from pathlib import Path
from queue import Queue

from bifrost.guardian import COLLECTOR_STOP, HoneypotLogCollector


def _append_line(path: Path, line: str):
    with open(path, "a") as f:
        f.write(line + "\n")
        f.flush()


def test_cowrie_collector_reopens_after_rotation(tmp_path, monkeypatch):
    cowrie_log = tmp_path / "cowrie.json"
    monkeypatch.setattr(HoneypotLogCollector, "RETRY_INTERVAL", 0.05)
    cowrie_log.write_text("")

    q = Queue()
    log = logging.getLogger("test.cowrie.rotation")
    COLLECTOR_STOP.clear()

    collector = HoneypotLogCollector(q, log, cowrie_log)
    collector.start()

    try:
        time.sleep(0.2)
        _append_line(
            cowrie_log,
            json.dumps({"eventid": "cowrie.login.success", "src_ip": "1.2.3.4"}),
        )
        first = q.get(timeout=2)
        assert first["source"] == "cowrie"

        rotated = tmp_path / "cowrie.json.1"
        cowrie_log.rename(rotated)
        cowrie_log.write_text("")
        time.sleep(0.2)
        _append_line(
            cowrie_log,
            json.dumps({"eventid": "cowrie.command.input", "input": "ls"}),
        )

        second = q.get(timeout=2)
        assert second["raw"]["eventid"] == "cowrie.command.input"
    finally:
        COLLECTOR_STOP.set()
        collector.join(timeout=2)
        COLLECTOR_STOP.clear()


def test_cowrie_collector_retries_when_log_deleted(tmp_path, monkeypatch):
    cowrie_log = tmp_path / "cowrie.json"
    monkeypatch.setattr(HoneypotLogCollector, "RETRY_INTERVAL", 0.05)

    q = Queue()
    log = logging.getLogger("test.cowrie.deleted")
    COLLECTOR_STOP.clear()

    collector = HoneypotLogCollector(q, log, cowrie_log)
    collector.start()

    try:
        time.sleep(0.2)
        cowrie_log.write_text("")
        time.sleep(0.2)
        _append_line(
            cowrie_log,
            json.dumps({"eventid": "cowrie.login.failed"}),
        )

        event = q.get(timeout=5)
        assert event["source"] == "cowrie"
    finally:
        COLLECTOR_STOP.set()
        collector.join(timeout=2)
        COLLECTOR_STOP.clear()
