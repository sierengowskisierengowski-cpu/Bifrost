#!/usr/bin/env python3
import json
import re
import sqlite3
from collections import Counter
from pathlib import Path

DB_PATH = Path("/var/lib/heimdall/events.db")

def parse_decision_field(decision_text):
    if not decision_text:
        return None, None, None
    try:
        data = json.loads(decision_text)
        return (
            data.get("mitre_tactic") or data.get("threat_class"),
            data.get("severity"),
            data.get("action")
        )
    except json.JSONDecodeError:
        pass
    tactic_match = re.search(r'(?i)(?:tactic|class)["\s:]+([\w\s\-]+)', decision_text)
    severity_match = re.search(r'(?i)severity["\s:]+(\w+)', decision_text)
    action_match = re.search(r'(?i)action["\s:]+(\w+)', decision_text)
    tactic = tactic_match.group(1).strip() if tactic_match else None
    severity = severity_match.group(1).strip() if severity_match else None
    action = action_match.group(1).strip() if action_match else None
    return tactic, severity, action

def execute_audit():
    if not DB_PATH.exists():
        print(f"[!] Database file missing at: {DB_PATH}")
        return
    print("=" * 65)
    print("         BIFROST / HEIMDALL LIVE DATASET AUDIT REPORT        ")
    print("=" * 65)
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM events")
    total_events = cursor.fetchone()[0]
    print(f"[*] Total Attacker Events Ingested: {total_events}")
    cursor.execute("SELECT COUNT(*) FROM events WHERE false_positive = 1")
    fps = cursor.fetchone()[0]
    print(f"[*] Marked False Positives (To skip in tuning): {fps}")
    print("-" * 65)
    cursor.execute("SELECT source, heimdall_decision, raw_event FROM events WHERE false_positive = 0")
    rows = cursor.fetchall()
    sources = Counter()
    tactics = Counter()
    severities = Counter()
    actions = Counter()
    unique_payloads = set()
    for source, decision, raw_event in rows:
        sources[source] += 1
        unique_payloads.add(raw_event)
        tactic, severity, action = parse_decision_field(decision)
        if tactic: tactics[tactic] += 1
        if severity: severities[severity.upper()] += 1
        if action: actions[action.upper()] += 1
    print("[*] Ingestion Telemetry Sources:")
    for src, count in sources.items():
        print(f"    -> {src:<20}: {count} records")
    print("-" * 65)
    print("[*] Detected MITRE Tactics / Threat Classes:")
    for tac, count in tactics.most_common():
        pct = (count / len(rows)) * 100 if rows else 0
        print(f"    -> {tac:<25}: {count:<4} ({pct:.1f}%)")
    print("-" * 65)
    print("[*] Enforced EDR Decisions:")
    for act, count in actions.most_common():
        print(f"    -> {act:<25}: {count}")
    print("-" * 65)
    redundancy_ratio = (1 - (len(unique_payloads) / len(rows))) * 100 if rows else 0
    print("[*] Payload Redundancy Analysis:")
    print(f"    -> Unique Raw Payloads: {len(unique_payloads)}")
    print(f"    -> Dataset Redundancy  : {redundancy_ratio:.1f}%")
    print("=" * 65)
    print("\n[NEXT STEP ACTION ITEM]:")
    if redundancy_ratio > 75.0:
        print("[!] Dataset contains heavy automated script redundancy (bot networks repeating strings).")
        print("    Action: We must run a deduplication step when building your JSONL data to ensure")
        print("    the model doesn't overfit on identical scanning commands.")
    else:
        print("[+] Dataset has solid organic variety. Proceed directly with structuring your LoRA payload.")
    print("=" * 65)
    conn.close()

if __name__ == "__main__":
    execute_audit()
