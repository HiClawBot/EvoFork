# EvoFork Manifest Specification

## File name

```text
evo.manifest.yaml
```

## Purpose

The manifest defines which parts of an application can evolve and what constraints apply.

No AI-generated patch is valid unless it references a manifest surface.

## Schema

```yaml
app:
  id: string
  name: string optional
  default_branch: string

surfaces:
  - id: string
    type: react-component | api-route | llm-prompt | markdown-doc | config
    path: string
    owner: string
    allowed_changes: string[]
    forbidden_changes: string[]
    target_metrics:
      primary: string
      guardrails: string[]
    tests: string[] optional
    rollout:
      max_auto_percentage: number
      require_human_approval: boolean
```

## Surface id

Surface IDs should be stable and dot-separated.

Good:

```text
pricing.hero
onboarding.signup
admin.bulk_import
docs.quickstart
```

Bad:

```text
page1
new-component
stuff
```

## Surface type

Supported v0.1 types:

```text
react-component
api-route
llm-prompt
markdown-doc
config
```

## Allowed changes

Allowed change categories are semantic constraints, not file permissions.

Examples:

```text
copy
layout
cta_text
validation_message
field_order
examples
structure
```

## Forbidden changes

Forbidden changes define what the agent must not alter.

Examples:

```text
payment_logic
authentication
database_schema
pricing_amount
legal_claim
privacy_policy
```

## Rollout

```yaml
rollout:
  max_auto_percentage: 5
  require_human_approval: true
```

Meaning:

- AI cannot recommend rollout above 5% without additional approval.
- Human approval is required before canary.

## Validation rules

v0.1 validator must check:

- app.id exists
- app.default_branch exists
- surfaces is non-empty
- surface ids are unique
- each surface has id, type, path, owner
- allowed_changes is non-empty
- forbidden_changes exists
- path is normalized and does not escape repository root

## Patch boundary rule

A patch for a surface may only modify files explicitly allowed by that surface.

v0.1 may start with a single `path` per surface. Future versions may support globs.
