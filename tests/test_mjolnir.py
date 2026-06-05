#!/usr/bin/env python3
"""Release-safety checks for Mjolnir decoy deployment."""

from __future__ import annotations

import stat

from bifrost.mjolnir import deploy_active_deception_traps


def test_deploy_active_deception_traps_uses_placeholder_values(tmp_path):
    target = tmp_path / "honeypot"
    target.mkdir()

    assert deploy_active_deception_traps(str(target)) is True

    credentials = (target / "root" / ".aws" / "credentials").read_text(encoding="utf-8")
    env_file = (target / "root" / ".env").read_text(encoding="utf-8")
    login_data = (target / "root" / ".config" / "google-chrome" / "Default" / "Login Data JSON").read_text(
        encoding="utf-8"
    )

    assert "AKIA" not in credentials
    assert "BIFROST_DECOY_ACCESS_KEY" in credentials
    assert "BIFROST_DECOY_SECRET" in env_file
    assert "BIFROST_DECOY_BROWSER_PASSWORD" in login_data


def test_deploy_active_deception_traps_sets_private_key_permissions(tmp_path):
    target = tmp_path / "honeypot"
    target.mkdir()

    assert deploy_active_deception_traps(str(target)) is True

    key_path = target / "root" / ".ssh" / "id_rsa"
    mode = stat.S_IMODE(key_path.stat().st_mode)
    assert mode == 0o600
