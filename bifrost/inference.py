#!/usr/bin/env python3
"""
Bifrost Inference v0.1.0

Circuit breaker, retry logic, and timeout management
for all LLM inference calls in the Bifrost pipeline.

Prevents a slow or failing model from blocking the
entire event processing pipeline.
"""

from __future__ import annotations
import logging
import time
import threading
from typing import Callable, Any, Optional

log = logging.getLogger("heimdall.inference")

# Timeout per hardware tier in seconds
TIER_TIMEOUTS = {
    "TIER_1": 60.0,
    "TIER_2": 45.0,
    "TIER_3": 30.0,
    "TIER_4": 15.0,
}

DEFAULT_TIMEOUT = 30.0
MAX_RETRIES = 2
RETRY_DELAY = 1.0


def get_request_timeout(hardware_tier: str = "TIER_4") -> float:
    """Returns the appropriate timeout for the hardware tier."""
    return TIER_TIMEOUTS.get(hardware_tier, DEFAULT_TIMEOUT)


class CircuitBreaker:
    """
    Circuit breaker for LLM inference calls.

    States:
      CLOSED  — normal operation, calls go through
      OPEN    — too many failures, calls blocked
      HALF    — testing if service recovered

    Prevents a failing model from blocking the pipeline.
    Falls back to deterministic rules when open.
    """

    CLOSED = "CLOSED"
    OPEN = "OPEN"
    HALF = "HALF"

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.failure_count = 0
        self.last_failure_time = 0.0
        self.state = self.CLOSED
        self._lock = threading.Lock()

    def call(self, fn: Callable, *args, **kwargs) -> Any:
        """
        Execute fn through the circuit breaker.
        Returns None if circuit is open.
        """
        with self._lock:
            if self.state == self.OPEN:
                elapsed = time.time() - self.last_failure_time
                if elapsed >= self.recovery_timeout:
                    self.state = self.HALF
                    log.info(
                        f"CircuitBreaker {self.name}: HALF-OPEN, testing..."
                    )
                else:
                    log.warning(
                        f"CircuitBreaker {self.name}: OPEN. "
                        f"Skipping call. {self.recovery_timeout - elapsed:.0f}s until retry."
                    )
                    return None

        try:
            result = fn(*args, **kwargs)
            with self._lock:
                if self.state == self.HALF:
                    log.info(
                        f"CircuitBreaker {self.name}: recovered. CLOSED."
                    )
                self.state = self.CLOSED
                self.failure_count = 0
            return result

        except Exception as e:
            with self._lock:
                self.failure_count += 1
                self.last_failure_time = time.time()
                log.warning(
                    f"CircuitBreaker {self.name}: failure "
                    f"{self.failure_count}/{self.failure_threshold}: {e}"
                )
                if self.failure_count >= self.failure_threshold:
                    self.state = self.OPEN
                    log.error(
                        f"CircuitBreaker {self.name}: OPEN. "
                        f"Too many failures. Falling back to rules."
                    )
            return None

    def is_open(self) -> bool:
        return self.state == self.OPEN

    def reset(self):
        with self._lock:
            self.state = self.CLOSED
            self.failure_count = 0
            self.last_failure_time = 0.0
        log.info(f"CircuitBreaker {self.name}: manually reset.")

    def get_status(self) -> dict:
        return {
            "name": self.name,
            "state": self.state,
            "failure_count": self.failure_count,
            "failure_threshold": self.failure_threshold,
        }


def execute_with_retry(
    fn: Callable,
    *args,
    max_retries: int = MAX_RETRIES,
    delay: float = RETRY_DELAY,
    circuit_breaker: Optional[CircuitBreaker] = None,
    **kwargs,
) -> Any:
    """
    Execute fn with retry and optional circuit breaker.

    Retries up to max_retries times with delay between attempts.
    If circuit_breaker is provided uses it to track failures.
    Returns None if all retries fail.
    """
    if circuit_breaker:
        return circuit_breaker.call(
            _retry_loop, fn, *args,
            max_retries=max_retries,
            delay=delay,
            **kwargs
        )
    return _retry_loop(fn, *args, max_retries=max_retries, delay=delay, **kwargs)


def _retry_loop(
    fn: Callable,
    *args,
    max_retries: int = MAX_RETRIES,
    delay: float = RETRY_DELAY,
    **kwargs,
) -> Any:
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            last_error = e
            if attempt < max_retries:
                log.warning(
                    f"Attempt {attempt}/{max_retries} failed: {e}. "
                    f"Retrying in {delay}s..."
                )
                time.sleep(delay)
            else:
                log.error(
                    f"All {max_retries} attempts failed. Last error: {e}"
                )
    return None
