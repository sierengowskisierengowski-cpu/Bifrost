# Bifrost Security Platform

**Local-first, AI-assisted security monitoring with safety-gated response.**  
Bifrost helps defenders detect, triage, and safely respond to suspicious host and honeypot activity without handing full control to automation.

---

## Elevator Pitch

Bifrost combines deterministic detection, AI reasoning, and strict policy guardrails to reduce alert noise and improve incident response speed — while keeping humans in control by default.

---

## Why Bifrost?

Traditional lightweight monitoring is often noisy, hard to tune, or cloud-dependent.  
Bifrost is designed for operators who want:

- stronger context than rules alone,
- safer automation than raw AI decisions,
- and local control over data and enforcement.

Bifrost gives you explainable decisions, safe defaults, and a practical path from observe-only mode to carefully controlled response.

---

## What Bifrost Offers

- **Unified telemetry pipeline** for host + honeypot event streams
- **Event normalization and schema validation** for consistent processing
- **AI-assisted reasoning** to prioritize and explain threats
- **Deterministic fallback rules** when model output is unavailable/unreliable
- **Policy-gated actions** (unsafe actions automatically downgraded)
- **Safe defaults enabled by default**
  - `learning_mode=true`
  - `dry_run=true`
  - `autonomous_actions_enabled=false`
- **Auditability**
  - decision logs
  - rationale tracking
  - rollback context
- **Operator visibility**
  - local dashboard
  - MQTT status/alert publishing

---

## AI in Bifrost: What It Does (and Doesn’t Do)

### AI *does*
- add context to suspicious behavior,
- help classify likely threat intent,
- propose candidate actions with confidence/reasoning.

### AI *does not*
- bypass policy controls,
- directly execute destructive actions by default,
- replace operator judgment in safe mode.

> AI improves triage speed.  
> Policy and safety gates enforce operational restraint.

---

## Safety Model (Default Behavior)

Bifrost is built to be safe-first:

1. **Schema gate** — malformed decisions are rejected/fallbacked.
2. **Policy gate** — destructive actions are downgraded when safety conditions are not met.
3. **Mode gate** — learning/dry-run/autonomous flags control enforcement eligibility.

In default mode, Bifrost observes and simulates response only.

---

## Benefits at a Glance

- Faster triage with contextual reasoning
- Reduced analyst fatigue from noisy raw alerts
- Better consistency via structured decisions
- Lower risk through safe defaults and downgrade logic
- Local-first deployment with optional anonymized external inference
- Clear upgrade path from demo/lab to cautious live operation

---

## Who It’s For

- Homelab defenders
- Detection engineers
- Security researchers
- Honeypot operators
- Edge security experiments and red/blue testing labs

## Not a Fit (Yet)

- Enterprise-wide distributed SOC at scale
- Fully autonomous, unsupervised response environments
- High-assurance environments requiring formal verification

---

## Quickstart

```bash
cd ~/Projects/bifrost
export PYTHONPATH="$PWD"
python3 -m pytest tests/ -v
python3 demo/demo.py --scenario examples/replay/mdrfckr_botnet.jsonl
```

Expected result: safe-mode simulation output with **no destructive enforcement**.

---

## Example Demo Output (Safe Mode)

- incidents detected and scored,
- requested actions shown,
- effective action downgraded per policy when needed,
- audit records written for review.

---

## High-Level Architecture

```text
Telemetry Sources (host, honeypot, eBPF, logs)
        │
        ▼
Ingest/Collector  ──► Extractor ──► Anonymizer ──► Memory
        │                                  │
        └──────────────────────────────► Reasoner (AI + deterministic fallback)
                                           │
                                           ▼
                                      Policy Gate
                                           │
                        ┌──────────────────┴──────────────────┐
                        ▼                                     ▼
                 Audit / Dashboard / MQTT             Executor (guarded)
```

---

## Hardware Tiers (Example Guidance)

| Tier | Typical Hardware | Recommended Mode |
|------|------------------|------------------|
| TIER_1 | Modern laptop/workstation GPU | Local model + full pipeline |
| TIER_2 | Mid desktop / strong CPU | Mixed local/remote reasoning |
| TIER_3 | Low-power mini PC | Deterministic-heavy, selective AI |
| TIER_4 | VM / constrained node | Safe-mode + fallback-first |

---

## Roadmap

### v0.1.x
- stabilize pipeline reliability
- strengthen failover tests
- improve docs and safety controls
- monitor-only live validation on real telemetry

### v0.2.0
- stronger authn/authz on local ingest paths
- richer metrics/health endpoints
- improved resilience under burst load
- policy tuning UX + operator workflows

---

## Contributing

Contributions are welcome for:
- detection rules
- replay scenarios
- policy hardening
- docs and incident playbooks
- reliability and observability improvements

Please open an issue with:
1. problem statement,
2. proposed change,
3. safety impact,
4. test evidence.

---

## Responsible Use

Bifrost is a defensive security tool.  
Do not deploy autonomous enforcement without controlled testing, rollback plans, and explicit operator approval.
