import json

from bifrost import router


class _DummyResponse:
    def __init__(self, payload: dict):
        self.status = 200
        self._payload = payload

    def read(self):
        return json.dumps(self._payload).encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class _Log:
    def __init__(self):
        self.messages: list[str] = []

    def info(self, msg):
        self.messages.append(str(msg))

    def warning(self, msg):
        self.messages.append(str(msg))

    def error(self, msg):
        self.messages.append(str(msg))


def test_normalize_action_context_populates_required_fields():
    ctx = router._normalize_action_context({}, 42, {"action_required": "BLOCK", "target": "1.2.3.4"})
    assert ctx["session_id"] == "event-42"
    assert ctx["ssh_fingerprint"] == "unknown"
    assert len(ctx["command_hash"]) == 64


def test_execute_decision_refuses_dispatch_without_executor_token(monkeypatch):
    monkeypatch.delenv("BIFROST_EXECUTOR_TOKEN", raising=False)
    monkeypatch.setattr(router, "executor_available", lambda: True)
    log = _Log()
    ok = router.execute_decision(
        {"action_required": "BLOCK", "target": "203.0.113.8", "reasoning": "x"},
        event_id=9,
        db_path="",
        log_ref=log,
    )
    assert ok is False
    assert any("BIFROST_EXECUTOR_TOKEN unset" in m for m in log.messages)


def test_execute_decision_includes_required_context(monkeypatch):
    monkeypatch.setenv("BIFROST_EXECUTOR_TOKEN", "tok")
    monkeypatch.setattr(router, "executor_available", lambda: True)
    captured = {}

    def fake_urlopen(req, timeout=5):
        captured["body"] = req.data.decode("utf-8")
        captured["token"] = req.headers.get("X-bifrost-token")
        return _DummyResponse({"status": "dispatched"})

    monkeypatch.setattr(router.urllib.request, "urlopen", fake_urlopen)
    log = _Log()
    ok = router.execute_decision(
        {"action_required": "BLOCK", "target": "198.51.100.7", "reasoning": "x"},
        event_id=11,
        db_path="",
        log_ref=log,
    )
    assert ok is True
    payload = json.loads(captured["body"])
    assert payload["session_id"] == "event-11"
    assert payload["ssh_fingerprint"] == "unknown"
    assert len(payload["command_hash"]) == 64
