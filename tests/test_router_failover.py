#!/usr/bin/env python3
"""
tests/test_router_failover.py

Tests the full fallback chain:
  deterministic rules -> safe_fallback -> policy gate
"""

import pytest
from bifrost.policy import Decision, ActionType, evaluate_policy
from heimdall.schema import validate_decision_dict
from heimdall.schema import Decision as SchemaDecision


def make_event(path="/tmp/malware.sh", boundary="HOST", alert=None):
    return {
        "event_type": "process.watcher",
        "boundary": boundary,
        "timestamp": "2026-05-28T03:00:00Z",
        "process": "malware",
        "path": path,
        "ip": None,
        "port": None,
        "user": "0",
        "command": f"{path} -c install",
        "syscall": "execve",
        "alert_signal": alert or "scratch_space_exec",
        "raw_snippet": f"pid=5678 exe={path}",
        "extraction_method": "deterministic",
        "extractor_model": "deterministic"
    }


def make_config():
    return {
        "hardware_tier": "TIER_4",
        "use_local_llm": False,
        "analyst_model": None,
        "system_baseline": "You are Heimdall-Core.",
        "learning_mode": True,
        "dry_run": True,
        "autonomous_actions_enabled": False,
        "confidence_threshold": 0.85,
        "min_evidence_count": 2,
    }


class TestDeterministicFallback:

    def test_tmp_path_triggers_detection(self):
        from bifrost.reasoner import apply_deterministic_rules
        event = make_event(path="/tmp/malware.sh")
        result = apply_deterministic_rules(event, make_config())
        assert result is not None
        assert result.get("incident_detected") is True
        assert result.get("action_required") in ("KILL", "BLOCK", "ALERT")

    def test_shm_path_triggers_high_severity(self):
        from bifrost.reasoner import apply_deterministic_rules
        event = make_event(path="/dev/shm/evil")
        result = apply_deterministic_rules(event, make_config())
        assert result is not None
        assert result.get("severity") in ("CRITICAL", "HIGH")

    def test_safe_fallback_always_alert(self):
        d = SchemaDecision.safe_fallback("all_reasoners_failed")
        assert d.action_required.value == "ALERT"
        assert d.incident_detected is True
        assert "all_reasoners_failed" in d.reasoning

    def test_safe_fallback_confidence(self):
        d = SchemaDecision.safe_fallback("test")
        assert d.confidence == 0.5


class TestPolicyGateFailover:

    def test_learning_mode_blocks_kill(self):
        d = Decision(action=ActionType.KILL, confidence=0.99,
                     reason="test", evidence_count=5, event_window_seconds=60)
        r = evaluate_policy(d, learning_mode=True, dry_run=False,
                            autonomous_enabled=True)
        assert r.allowed is False
        assert r.downgraded_action == ActionType.ALERT

    def test_dry_run_blocks_block(self):
        d = Decision(action=ActionType.BLOCK, confidence=0.99,
                     reason="test", evidence_count=5, event_window_seconds=60)
        r = evaluate_policy(d, learning_mode=False, dry_run=True,
                            autonomous_enabled=True)
        assert r.allowed is False

    def test_autonomous_disabled_blocks_quarantine(self):
        d = Decision(action=ActionType.QUARANTINE, confidence=0.99,
                     reason="test", evidence_count=5, event_window_seconds=60)
        r = evaluate_policy(d, learning_mode=False, dry_run=False,
                            autonomous_enabled=False)
        assert r.allowed is False

    def test_full_chain_tmp_exec(self):
        from bifrost.reasoner import apply_deterministic_rules
        event = make_event(path="/tmp/dropper.sh")
        raw = apply_deterministic_rules(event, make_config())
        assert raw is not None

        decision = validate_decision_dict(raw)
        assert decision.incident_detected is True

        policy_d = Decision(
            action=ActionType(decision.action_required.value),
            confidence=decision.confidence,
            reason=decision.reasoning,
            evidence_count=2,
            event_window_seconds=60,
        )
        result = evaluate_policy(
            policy_d,
            learning_mode=True,
            dry_run=True,
            autonomous_enabled=False,
        )
        # Deterministic rules return ALERT for /tmp paths.
        # ALERT is non-destructive so policy gate allows it.
        # The contract is: effective action is always safe.
        assert result.downgraded_action == ActionType.ALERT
        assert result.allowed is True
