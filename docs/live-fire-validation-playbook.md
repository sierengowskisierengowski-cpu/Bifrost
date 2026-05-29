# Bifrost Live-Fire Validation Playbook

**Authorized use only.** Run this only in systems you own or where you have
written authorization. Keep testing isolated from production.

This playbook implements a phased live-fire process for validating that Bifrost
holds up under realistic attack pressure in a controlled lab.

Use this together with:

- [lab-attack-simulation.md](./lab-attack-simulation.md)
- [templates/live-fire-scorecard.csv](./templates/live-fire-scorecard.csv)

---

## Phase 0 — Isolated Scope Gate (mandatory)

Pass this gate before any attack simulation:

- Host-only/private network with no production routes
- All VMs snapshotted (`pre-test`)
- Test scope documented (IPs, attack categories, duration)
- Recovery procedure tested (`snapshot restore`)

If any item fails: **stop test execution**.

---

## Phase 1 — Safe-Mode Validation (learning + dry-run)

Start with non-enforcing mode:

```json
{
  "learning_mode": true,
  "dry_run": true,
  "autonomous_actions_enabled": false
}
```

Run baseline replay:

```bash
python3 -m bifrost.demo --scenario examples/replay/benign_web_burst.jsonl
```

Gate criteria:

- Pipeline stays healthy (no crashes/hangs)
- Decisions are produced for expected events
- No destructive action is actually enforced
- Benign replay does not produce high-confidence destructive decisions

---

## Phase 2 — Progressive Attack Categories

Execute attack categories in increasing disruption order from
[lab-attack-simulation.md](./lab-attack-simulation.md):

1. Initial access
2. Execution
3. Persistence
4. Credential access
5. Discovery
6. Lateral movement
7. Privilege escalation staging (SUID)

For each category, record in scorecard:

- Expected threat class, severity, action
- Detection latency
- Whether policy gate allowed or blocked enforcement
- False positives / false negatives

Gate criteria:

- Expected class/action appears in audit output
- Policy gate behavior matches current mode
- No unsafe action on protected/private targets

---

## Phase 3 — Stress and Failure Injection

Validate resilience under pressure and dependency failure.

Recommended checks:

- Event bursts: replay multiple scenario files back-to-back
- Ingest/API disruption: temporarily stop inference endpoint
- Network interruptions between agent and pipeline
- Restart one component while others continue running

Gate criteria:

- System degrades safely (alerts/logs, no unsafe autonomous action)
- Components recover cleanly after dependency restoration
- Event processing resumes without manual data surgery

---

## Phase 4 — Lab-Only Enforcement

Only after stable dry-run results, move to enforcement in lab:

```json
{
  "learning_mode": false,
  "dry_run": false,
  "autonomous_actions_enabled": true
}
```

Re-run the same scenarios and verify:

- Intended action is actually executed when policy allows
- RFC1918/loopback protections are honored unless explicitly overridden
- Quarantine and rollback data is recorded correctly

Gate criteria:

- Correct actions with no safety-policy violations
- No destructive action against protected process/IP boundaries

---

## Phase 5 — Tune and Retest Loop

After each run:

1. Classify each scenario result (TP / FP / FN / TN)
2. Adjust thresholds/rules/policy minimally
3. Restore snapshot
4. Replay same scenario set
5. Compare scorecard metrics to previous run

Promote changes only when:

- False positive rate is acceptable for your environment
- Missed critical detections are resolved
- Stability and latency are consistent across repeated runs

---

## Suggested Execution Cadence

Per validation cycle:

1. Phase 0 once per lab session
2. Phase 1 once after config changes
3. Phase 2 full scenario sweep
4. Phase 3 failure checks
5. Phase 4 enforcement sweep
6. Phase 5 tune-and-repeat as needed

Treat each cycle as complete only when scorecard evidence is filled in.
