# Gjallarhorn Module (v0.3.0)

## Purpose

Gjallarhorn handles alert dispatch from Guardian decisions.

## Current Implementation

- Module path: `bifrost/gjallarhorn.py`
- Primary entrypoint: `dispatch_discord_alert(telemetry, analysis=None)`
- Supports severity gating and dedup/rate controls before notification delivery
- Optional Twilio SMS fallback path via environment variables

## Configuration Inputs

- `GJALLARHORN_WEBHOOK_URL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_TO_NUMBER`
- `TWILIO_FROM_NUMBER`

## Notes

- Integrated via Guardian orchestration helper.
- UI does not currently expose a dedicated Gjallarhorn page; alerts are reflected through incident/live views.
