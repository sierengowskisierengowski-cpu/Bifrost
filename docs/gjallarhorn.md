# Gjallarhorn

## Purpose

Gjallarhorn is Bifrost’s alert broadcasting system. It distributes Guardian decisions to configured channels so operators can respond quickly.

## Implementation

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

- Integrated through the Guardian backend pipeline.
- Alerts are reflected in incident/live desktop views while external channels are notified.
