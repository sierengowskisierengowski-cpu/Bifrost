# Mjolnir

## Purpose

Mjolnir is Bifrost’s deception trap system. It deploys controlled decoys used to test detections and pressure attacker workflows in authorized environments.

## Implementation

- Module path: `bifrost/mjolnir.py`
- Primary entrypoint: `deploy_active_deception_traps(honeypot_root=...)`
- Creates decoy files and directories under a supplied trap root

## Security Posture

- Uses clearly marked decoy values
- Restricts generated private-key decoy file permissions to `0600`

## Notes

- Integrated through the Guardian backend pipeline.
- Intended for authorized security validation environments.
