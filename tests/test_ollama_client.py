#!/usr/bin/env python3

import io
import json
import logging
import urllib.error

import pytest

from bifrost import ollama_client


class _FakeHTTPResponse:
    def __init__(self, status, payload):
        self.status = status
        self._payload = payload

    def read(self):
        return self._payload.encode("utf-8")

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


def test_resolve_ollama_chat_url_normalizes_v1_path():
    assert (
        ollama_client.resolve_ollama_chat_url("http://127.0.0.1:11434/v1")
        == "http://127.0.0.1:11434/api/chat"
    )
    assert (
        ollama_client.resolve_ollama_chat_url("http://127.0.0.1:11434")
        == "http://127.0.0.1:11434/api/chat"
    )


def test_parse_json_object_handles_wrapped_and_fenced_output():
    wrapped = "analysis...\n```json\n{\"incident_detected\": true, \"severity\": \"LOW\"}\n```\nextra"
    parsed = ollama_client.parse_json_object(wrapped)
    assert parsed == {"incident_detected": True, "severity": "LOW"}


def test_ollama_chat_sends_cpu_safe_defaults(monkeypatch):
    requests = []

    def _fake_urlopen(request, timeout):
        requests.append((request, timeout))
        payload = json.dumps(
            {
                "message": {"content": "{\"incident_detected\": false}"},
                "total_duration": 123,
                "load_duration": 10,
                "prompt_eval_duration": 20,
                "eval_duration": 30,
            }
        )
        return _FakeHTTPResponse(200, payload)

    monkeypatch.setattr(ollama_client.urllib.request, "urlopen", _fake_urlopen)

    response = ollama_client.ollama_chat(
        config={"local_url": "http://127.0.0.1:11434/v1"},
        model="qwen2.5:1.5b-instruct",
        messages=[{"role": "user", "content": "Reply with OK"}],
        logger=logging.getLogger("tests.ollama"),
    )

    assert response["content"] == "{\"incident_detected\": false}"
    assert requests
    request, timeout = requests[0]
    body = json.loads(request.data.decode("utf-8"))
    assert timeout == 15.0
    assert body["stream"] is False
    assert body["options"]["num_ctx"] == 1024
    assert body["options"]["num_predict"] == 64
    assert body["options"]["num_gpu"] == 0


def test_ollama_chat_logs_non_200_with_context(monkeypatch, caplog):
    error_payload = b"{\"error\":\"model load timeout\"}"

    def _fake_urlopen(_request, timeout=None):
        raise urllib.error.HTTPError(
            url="http://127.0.0.1:11434/api/chat",
            code=500,
            msg="Internal Server Error",
            hdrs=None,
            fp=io.BytesIO(error_payload),
        )

    monkeypatch.setattr(ollama_client.urllib.request, "urlopen", _fake_urlopen)

    with pytest.raises(RuntimeError):
        ollama_client.ollama_chat(
            config={"local_url": "http://127.0.0.1:11434/v1"},
            model="qwen2.5:1.5b-instruct",
            messages=[{"role": "user", "content": "test"}],
            logger=logging.getLogger("tests.ollama"),
        )

    assert "status=500" in caplog.text
    assert "api/chat" in caplog.text
    assert "qwen2.5:1.5b-instruct" in caplog.text
