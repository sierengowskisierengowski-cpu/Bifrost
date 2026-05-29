# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 0.1.x   | ✅ Active  |

## Reporting a Vulnerability

If you discover a security vulnerability in Bifrost, **please do not open a
public GitHub issue.** Public disclosure before a fix is available could expose
operators to risk.

### Responsible Disclosure Steps

1. **Email** the maintainer at the address listed in [AUTHORS](AUTHORS) (subject:
   `[BIFROST SECURITY] <one-line summary>`).  
   If no email is available, open a **private** GitHub Security Advisory via:  
   `GitHub repo → Security tab → "Report a vulnerability"`.

2. Include in your report:
   - Affected component (file, function, module)
   - Attack scenario / proof of concept
   - Severity assessment (Critical / High / Medium / Low)
   - Suggested fix (if known)

3. Expect an initial acknowledgement within **72 hours** and a status update
   within **7 days**.

4. We will credit researchers in the release notes (unless you prefer
   anonymity).

### Coordinated Disclosure Timeline

| Day | Action |
|-----|--------|
| 0   | Report received; acknowledgement sent |
| 1-7 | Triage and initial assessment |
| 7-30| Fix developed and tested |
| 30  | Fix released; CVE filed if warranted |
| 30+ | Public disclosure (coordinated with reporter) |

## Scope

The following are **in scope**:

- All code in this repository (`bifrost/`, `agent/`, `heimdall/`, `gjallarhorn/`,
  `kernel/`)
- Install and setup scripts (`install.sh`, `setup.py`, `kernel/tetragon/setup.sh`)
- Service unit files
- Default configuration values
- Authentication and token handling

The following are **out of scope**:

- Attacks that require physical access to the machine
- Vulnerabilities in upstream dependencies (report to the upstream project
  directly; we will update our dependency once they release a fix)
- Attacks against AI model providers (Groq, Anthropic, Ollama)

## Security Defaults

Bifrost ships in **safe-defaults mode**:

- `learning_mode: true` — observe only, no enforcement
- `dry_run: true` — all destructive actions are logged but not executed
- `autonomous_actions_enabled: false` — requires explicit human opt-in

Operators must explicitly disable all three safeguards before autonomous
enforcement becomes active. See `README.md → Security and Safe Defaults` for
details.

## Authorized Use

Bifrost is a **defensive security tool** intended for use only on systems you
own or have explicit written authorization to monitor and protect.

Deploying Bifrost on systems you do not own or have authorization to monitor
may violate computer fraud and abuse laws in your jurisdiction.

See [docs/lab-attack-simulation.md](docs/lab-attack-simulation.md) for
guidance on authorized lab testing.
