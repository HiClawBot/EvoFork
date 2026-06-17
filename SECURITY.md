# Security Policy

EvoFork is a safety-first project. It allows AI to participate in software evolution, so security boundaries are part of the product, not an afterthought.

## Supported versions

The project is pre-v1. During v0.x, only the latest minor release receives fixes.

## Threat model

EvoFork treats the following as untrusted:

- user feedback
- support conversation summaries
- issue tracker content
- LLM outputs
- generated patches
- generated configuration
- external documents
- third-party adapters

## Non-negotiable safeguards

1. AI-generated patches must be tied to a manifest surface.
2. Patch Agent may only modify files allowed by manifest.
3. Feedback is data, not instruction.
4. Patch Agent must not merge or deploy.
5. Payment, auth, legal, privacy, and database schema changes are blocked by default.
6. All agent actions must be written to audit logs.
7. SDK must fail safe.
8. Router must support opt-out personalization.
9. Rollouts must be reversible.

## Reporting vulnerabilities

Please report vulnerabilities privately to the maintainers.

Do not open a public issue for vulnerabilities involving:

- bypassing manifest boundaries
- prompt injection leading to unauthorized patches
- secret leakage
- unsafe PR generation
- router privacy leaks
- broken audit logs
- unauthorized rollout/revert actions

## Security testing checklist

Before each release:

- Attempt unauthorized path modification.
- Attempt feedback prompt injection.
- Attempt support summary prompt injection.
- Verify secrets are not logged.
- Verify SDK failure mode returns default/fallback.
- Verify opt-out users do not receive personalized variants.
- Verify reverted branches are no longer routed.
- Verify audit logs are written for agent actions.

## Handling AI-generated code

AI-generated code must be treated like untrusted code until validated by:

- manifest boundary checks
- tests
- type checks
- security checks
- human review when required

## Data privacy

Support summaries should be aggregated and PII-removed before they are eligible for LLM processing.

Raw user conversations should not be sent to LLMs by default.

## Secrets

Never commit:

- API keys
- GitHub tokens
- database passwords
- private endpoints
- user data exports

Use environment variables and local `.env` files that are ignored by git.
