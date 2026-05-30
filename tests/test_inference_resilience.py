#!/usr/bin/env python3

import json
import logging
import sys
import types

from bifrost import extractor, guardian, reasoner
from bifrost import inference as inference_utils


class _FakeResponse:
    def __init__(self, content: str):
        self.choices = [
            types.SimpleNamespace(
                message=types.SimpleNamespace(content=content)
            )
        ]


class _FakeClient:
    def __init__(self, outcomes, create_calls):
        self._outcomes = outcomes
        self._create_calls = create_calls
        self.chat = types.SimpleNamespace(
            completions=types.SimpleNamespace(create=self._create)
        )

    def _create(self, **kwargs):
        self._create_calls.append(kwargs)
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return _FakeResponse(outcome)


def _reset_breaker(breaker):
    breaker.failure_count = 0
    breaker.open_until = 0.0


def test_route_to_groq_retries_and_uses_timeout(monkeypatch):
    create_calls = []
    init_kwargs = []
    outcomes = [
        TimeoutError("timed out"),
        TimeoutError("timed out"),
        json.dumps({
            "incident_detected": True,
            "severity": "HIGH",
            "boundary": "HOST",
            "threat_class": "test",
            "confidence": 0.9,
            "action_required": "ALERT",
            "reasoning": "retry success",
        }),
    ]

    class _OpenAI:
        def __init__(self, **kwargs):
            init_kwargs.append(kwargs)
            self._client = _FakeClient(outcomes, create_calls)
            self.chat = self._client.chat

    _reset_breaker(reasoner.INFERENCE_CIRCUIT_BREAKERS["groq"])
    monkeypatch.setenv("HEIMDALL_API_KEY", "test-key")
    monkeypatch.setattr(inference_utils.time, "sleep", lambda _: None)
    monkeypatch.setitem(sys.modules, "openai", types.SimpleNamespace(OpenAI=_OpenAI))

    result = reasoner.route_to_groq(
        "prompt",
        "baseline",
        {
            "groq_model": "groq-test",
            "llm_timeout_seconds": 1.5,
            "llm_retry_attempts": 2,
            "llm_retry_backoff_seconds": 0.0,
            "llm_retry_max_backoff_seconds": 0.0,
        },
    )

    assert result is not None
    assert result["reasoning"] == "retry success"
    assert len(create_calls) == 3
    assert init_kwargs[0]["timeout"] == 1.5


def test_route_to_groq_opens_circuit_breaker_after_failure(monkeypatch):
    create_calls = []
    outcomes = [TimeoutError("timed out")]

    class _OpenAI:
        def __init__(self, **kwargs):
            self._client = _FakeClient(outcomes, create_calls)
            self.chat = self._client.chat

    breaker = reasoner.INFERENCE_CIRCUIT_BREAKERS["groq"]
    _reset_breaker(breaker)
    monkeypatch.setenv("HEIMDALL_API_KEY", "test-key")
    monkeypatch.setitem(sys.modules, "openai", types.SimpleNamespace(OpenAI=_OpenAI))

    config = {
        "groq_model": "groq-test",
        "llm_retry_attempts": 0,
        "llm_circuit_breaker_failures": 1,
        "llm_circuit_breaker_reset_seconds": 60.0,
    }

    assert reasoner.route_to_groq("prompt", "baseline", config) is None
    assert breaker.open_until > 0
    assert reasoner.route_to_groq("prompt", "baseline", config) is None
    assert len(create_calls) == 1


def test_guardian_analyst_circuit_breaker_uses_safe_fallback():
    create_calls = []
    router = guardian.EventRouter.__new__(guardian.EventRouter)
    router.config = {
        "hardware_tier": "TIER_4",
        "system_baseline": "baseline",
        "llm_retry_attempts": 0,
        "llm_circuit_breaker_failures": 1,
        "llm_circuit_breaker_reset_seconds": 60.0,
    }
    router.log = logging.getLogger("tests.guardian")
    router.analyst_model = "groq-test"
    router.analyst_breaker = inference_utils.CircuitBreaker()
    router.analyst_client = _FakeClient([TimeoutError("timed out")], create_calls)

    first = router.route_to_heimdall("{}")
    second = router.route_to_heimdall("{}")

    assert first["reasoning"] == "Safe fallback: llm_error"
    assert second["reasoning"] == "Safe fallback: analyst_circuit_open"
    assert len(create_calls) == 1


def test_extractor_circuit_breaker_falls_back_to_deterministic(monkeypatch):
    _reset_breaker(extractor.EXTRACTOR_CIRCUIT_BREAKER)
    calls = []

    def _fake_ollama_chat(**kwargs):
        calls.append(kwargs)
        raise TimeoutError("timed out")

    monkeypatch.setattr(extractor, "ollama_chat", _fake_ollama_chat)

    event = {
        "source": "process.watcher",
        "timestamp": "2026-05-28T03:00:00Z",
        "boundary": "HOST",
        "raw": {"cmdline": "wget http://malware", "exe": "/usr/bin/wget"},
    }
    config = {
        "hardware_tier": "TIER_2",
        "use_extractor": True,
        "extractor_model": "extractor-test",
        "llm_timeout_seconds": 2.0,
        "llm_retry_attempts": 0,
        "llm_circuit_breaker_failures": 1,
        "llm_circuit_breaker_reset_seconds": 60.0,
    }

    first = extractor.compress_event(event, config)
    second = extractor.compress_event(event, config)

    assert first["extraction_method"] == "deterministic"
    assert second["extraction_method"] == "deterministic"
    assert first["extractor_model"] == "extractor-test"
    assert len(calls) == 1
    payload = calls[0]
    assert payload["messages"][1]["content"]
    assert payload["model"] == "extractor-test"


def test_get_client_timeout_uses_scalar_without_split():
    timeout = inference_utils.get_client_timeout({"llm_timeout_seconds": 33})
    assert timeout == 33.0


def test_get_client_timeout_uses_split_values():
    timeout = inference_utils.get_client_timeout(
        {
            "llm_timeout_seconds": 50,
            "llm_connect_timeout_seconds": 10,
            "llm_read_timeout_seconds": 120,
        }
    )
    assert getattr(timeout, "connect", None) == 10.0
    assert getattr(timeout, "read", None) == 120.0


def test_route_to_ollama_parses_fenced_json(monkeypatch):
    _reset_breaker(reasoner.INFERENCE_CIRCUIT_BREAKERS["ollama"])
    monkeypatch.setattr(
        reasoner,
        "ollama_chat",
        lambda **_: {
            "content": "```json\n{\"incident_detected\": false, \"severity\": \"LOW\"}\n```",
            "timings": {},
            "duration_ms": 1.0,
        },
    )

    parsed = reasoner.route_to_ollama(
        "prompt",
        "baseline",
        {
            "analyst_model": "qwen2.5:1.5b-instruct",
            "llm_retry_attempts": 0,
        },
    )

    assert parsed == {"incident_detected": False, "severity": "LOW"}


def test_event_router_prewarm_ollama_is_non_fatal(monkeypatch):
    router = guardian.EventRouter.__new__(guardian.EventRouter)
    router.config = {"use_local_llm": True}
    router.analyst_model = "qwen2.5:1.5b-instruct"
    router.log = logging.getLogger("tests.guardian.prewarm")
    router._record_ollama_timing = lambda _response: None

    monkeypatch.setattr(
        router,
        "_call_ollama_chat",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("boom")),
    )

    before = guardian.METRICS.get("ollama_failures", 0)
    router.prewarm_ollama()
    assert guardian.METRICS.get("ollama_failures", 0) == before + 1
