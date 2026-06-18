# EvoFork API Specification v0.1

Base path:

```text
/v1
```

## Health

```http
GET /health
```

Response:

```json
{
  "ok": true
}
```

## Signals

### POST /v1/signals

```json
{
  "appId": "demo-saas",
  "surfaceId": "pricing.hero",
  "source": "user_feedback",
  "signalType": "confusion",
  "text": "I do not understand Basic vs Pro.",
  "segmentHints": {
    "lifecycle_stage": "new_user"
  },
  "piiRemoved": true
}
```

### POST /v1/feedback

Convenience endpoint for user feedback.

```json
{
  "appId": "demo-saas",
  "surface": "pricing.hero",
  "rating": -1,
  "text": "I do not understand Basic vs Pro.",
  "context": {
    "page": "/pricing",
    "lifecycle_stage": "new_user"
  },
  "consent": true
}
```

### POST /v1/support-summaries

```json
{
  "appId": "demo-saas",
  "surfaceId": "pricing.hero",
  "signalType": "confusion",
  "summary": "New users frequently ask about the difference between Basic and Pro.",
  "evidenceCount": 47,
  "segmentHints": {
    "lifecycle_stage": "new_user",
    "company_size": "1-10"
  },
  "piiRemoved": true
}
```

## Insights and RFCs

In v0.1 Developer Preview, RFC generation and PR preparation are exposed through
the CLI and local Admin Console rather than public API server routes.

```bash
pnpm evo insight generate --surface pricing.hero
pnpm evo patch create-pr --rfc rfc_pricing_clarity_001 --surface pricing.hero
```

RFC response shape:

```json
{
  "rfcId": "rfc_pricing_clarity_001",
  "surfaceId": "pricing.hero",
  "problem": "New users do not understand Basic vs Pro.",
  "hypothesis": "Clearer role-based copy will increase pricing-to-signup conversion.",
  "proposedChanges": ["rewrite hero copy", "add role-based explanation", "change CTA"],
  "targetMetric": "pricing_to_signup_conversion",
  "guardrailMetrics": ["page_error_rate", "support_ticket_rate", "p95_latency"],
  "risk": "low"
}
```

PR preview response includes local metadata and a manifest boundary report.

```json
{
  "branchName": "pricing.hero.new-user-clarity.v1",
  "title": "EvoFork: New users do not understand Basic vs Pro.",
  "changedFiles": ["apps/demo-nextjs/src/app/pricing/PricingHero.tsx"],
  "boundary": {
    "allowed": true
  }
}
```

## Branches

### GET /v1/branches

Returns all branches for an app.

### POST /v1/branches

```json
{
  "appId": "demo-saas",
  "surfaceId": "pricing.hero",
  "branchName": "pricing.hero.new-user-clarity.v1",
  "targetSegments": {
    "lifecycle_stage": "new_user"
  },
  "rolloutPercentage": 5
}
```

### POST /v1/branches/:id/approve

Approves a branch for canary.

### POST /v1/branches/:id/rollout

```json
{
  "percentage": 10
}
```

### POST /v1/branches/:id/revert

```json
{
  "reason": "error rate increased"
}
```

## Router

### POST /v1/variants/resolve

```json
{
  "appId": "demo-saas",
  "surfaceId": "pricing.hero",
  "userId": "user_123",
  "segmentHints": {
    "lifecycle_stage": "new_user",
    "company_size": "1-10"
  },
  "personalizationOptOut": false
}
```

Response:

```json
{
  "surfaceId": "pricing.hero",
  "variant": "pricing.hero.new-user-clarity.v1",
  "branchId": "br_123",
  "reason": "matched_segment_and_rollout",
  "sticky": true
}
```

Fallback response:

```json
{
  "surfaceId": "pricing.hero",
  "variant": "default",
  "branchId": null,
  "reason": "default_fallback",
  "sticky": false
}
```

## Events

### POST /v1/events

```json
{
  "appId": "demo-saas",
  "event": "variant_exposed",
  "surfaceId": "pricing.hero",
  "branchId": "br_123",
  "userId": "user_123",
  "properties": {}
}
```

Local metric events for Rollout Observer input use the same endpoint:

```json
{
  "appId": "demo-saas",
  "event": "metric_observed",
  "surfaceId": "pricing.hero",
  "branchId": "br_123",
  "sessionId": "session_123",
  "properties": {
    "metric": "pricing_to_signup_conversion",
    "value": 1,
    "cohort": "canary",
    "direction": "increase"
  }
}
```

### GET /v1/events

Returns local metric and behavior events for demo tooling.

Query parameters:

- `appId`
- `surfaceId`
- `branchId`
- `event`

Example:

```http
GET /v1/events?appId=demo-saas&surfaceId=pricing.hero&event=metric_observed
```

This endpoint is for local observer input construction in the developer
preview. It does not export data to third-party telemetry systems.
