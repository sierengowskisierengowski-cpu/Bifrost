#!/usr/bin/env python3

import json
import sqlite3
from datetime import datetime, timezone

from bifrost.dashboard import build_dashboard_state


def test_build_dashboard_state_summarizes_jsonl_and_db(tmp_path):
    db_path = tmp_path / "events.db"
    jsonl_path = tmp_path / "live_monitor.jsonl"

    with sqlite3.connect(db_path) as conn:
        conn.execute("CREATE TABLE events (id INTEGER PRIMARY KEY, timestamp TEXT)")
        conn.execute(
            "INSERT INTO events (timestamp) VALUES (?)",
            ("2026-05-30T00:00:00Z",),
        )
        conn.execute(
            "INSERT INTO events (timestamp) VALUES (?)",
            ("2026-05-30T00:01:00Z",),
        )
        conn.commit()

    incidents = [
        {
            "record_type": "incident",
            "timestamp": "2026-05-30T12:00:00Z",
            "severity": "HIGH",
            "threat_class": "brute_force_ssh",
            "attacker_identity": "45.83.64.11",
            "policy_allowed": True,
            "action_taken": "ALERT",
            "summary": "SSH brute-force detected.",
            "mitre_attack": [
                {
                    "tactic_id": "TA0006",
                    "tactic": "Credential Access",
                    "technique_id": "T1110",
                    "technique": "Brute Force",
                }
            ],
        },
        {
            "record_type": "incident",
            "timestamp": "2026-05-30T12:01:00Z",
            "severity": "CRITICAL",
            "threat_class": "port_scan",
            "attacker_identity": "203.0.113.7",
            "policy_allowed": False,
            "action_taken": "BLOCK",
            "summary": "Recon activity observed.",
            "mitre_attack": [
                {
                    "tactic_id": "TA0043",
                    "tactic": "Reconnaissance",
                    "technique_id": "T1046",
                    "technique": "Network Service Scanning",
                }
            ],
        },
    ]
    jsonl_path.write_text(
        "\n".join(json.dumps(record) for record in incidents) + "\n",
        encoding="utf-8",
    )

    state = build_dashboard_state(
        db_path=db_path,
        live_monitor_jsonl_path=jsonl_path,
        monitor_safelist=["45.83.64.11"],
        incident_limit=10,
        now=datetime(2026, 5, 30, 12, 30, tzinfo=timezone.utc),
    )

    assert state["summary"]["dashboard_incidents"] == 2
    assert state["summary"]["db_events"] == 2
    assert state["summary"]["blocked_actions"] == 1
    assert state["summary"]["unique_attackers"] == 2
    assert state["allowlist"] == ["45.83.64.11"]
    assert state["top_mitre_techniques"][0]["count"] == 1
    assert state["incidents"][0]["threat_class"] == "port_scan"
