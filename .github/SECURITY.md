# Security Policy

## Scope and guarantees

prompt-anonymizer detects PII on a **best-effort** basis. Detection is
**not guaranteed**: false negatives (PII that is not masked) can and do
occur. Reviewing the anonymized text before sending it anywhere is the
responsibility of the user — the CLI's `--interactive` mode and the UIs'
mapping tables exist for exactly this human-in-the-loop check.

The label mapping returned by `anonymize()` contains the original PII.
This library never persists it; if you store it, protecting it is your
responsibility.

## Reporting a vulnerability

Please report vulnerabilities (including systematic anonymization bypasses,
e.g. an input pattern that reliably evades detection, or ReDoS in a
recognizer regex) via
[GitHub Security Advisories](https://github.com/akazah/prompt-anonymizer/security/advisories/new).

For ordinary false negatives on specific inputs, use the
"Missed PII (false negative)" issue template instead — but **never include
real personal data in an issue**; reproduce with synthetic data (e.g. Faker).
