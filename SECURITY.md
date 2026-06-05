# Security Policy

## Supported version

| Version | Supported |
|---------|-----------|
| 0.3.x   | ✅ Current pre-release |

## Reporting a vulnerability

If you discover a security vulnerability in Bifrost, **do not open a public GitHub issue**.

Instead:

1. Email the maintainer using the address listed in `AUTHORS` with the subject:
   - `[BIFROST SECURITY] <brief summary>`
2. If no email is available there, use GitHub's private vulnerability reporting flow from the repository Security tab.
3. Include:
   - affected component
   - reproduction steps or proof of concept
   - impact assessment
   - suggested fix if you have one

### Response targets

- initial acknowledgement: **within 72 hours**
- follow-up status update: **within 7 days**

## What Bifrost does

Bifrost is a Linux endpoint detection and response system that:

- monitors local security telemetry
- ingests data from sources such as Cowrie honeypot, auditd, and process watchers
- classifies events using local AI inference through Ollama
- maps detections to MITRE ATT&CK context
- can broadcast alerts through multiple local or remote channels
- can take autonomous defensive action **only when the operator explicitly enables it**

## What Bifrost does not do

Bifrost does **not**:

- guarantee prevention of every attack
- replace responsible system hardening, patching, network segmentation, backups, or human review
- make cloud calls mandatory for core local analysis
- grant safe authorization for use on systems you do not own or control
- eliminate the need to test autonomous actions before enabling them

## Safe-operation guidance

Before enabling more aggressive behavior, verify:

- telemetry sources are correct
- confidence thresholds are tuned for your environment
- notification endpoints are under your control
- deception assets are deployed intentionally
- dry-run behavior has been validated

## Responsible use and legal notice

Bifrost is a **defensive security tool** intended only for systems you own or are explicitly authorized to monitor and protect.

Running Bifrost against systems, users, networks, or environments without permission may violate law, policy, contracts, or acceptable-use terms.

You are solely responsible for:

- lawful deployment
- validating monitoring scope
- reviewing autonomous response behavior before enabling it
- ensuring deception assets and alerts are used appropriately in your jurisdiction and environment

## Scope

In scope for responsible disclosure:

- code in this repository
- install and packaging scripts
- service units
- default local configuration behavior
- authentication and local security controls

Out of scope:

- vulnerabilities in upstream dependencies that have not yet been fixed upstream
- attacks requiring physical compromise of the host first
- misuse of Bifrost outside authorized defensive environments
