# Mjolnir Module (v0.3.0)

## Purpose

Mjolnir provides active deception helper routines for controlled trap deployment.

## Current Implementation

- Module path: `bifrost/mjolnir.py`
- Primary entrypoint: `deploy_active_deception_traps(honeypot_root=...)`
- Creates decoy files and directories under a supplied honeypot root

## Security Posture

- Uses clearly marked decoy placeholder values
- Restricts generated private-key decoy file permissions to `0600`

## Notes

- Integrated via Guardian orchestration helper.
- Intended for authorized lab/honeypot environments only.
