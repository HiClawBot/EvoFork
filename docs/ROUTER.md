# EvoFork Router

The Router resolves which variant a user should see.

## Inputs

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

## Outputs

```json
{
  "surfaceId": "pricing.hero",
  "variant": "pricing.hero.new-user-clarity.v1",
  "branchId": "br_123",
  "reason": "matched_segment_and_rollout",
  "sticky": true
}
```

## Resolution order

1. If personalizationOptOut is true, return default.
2. Find active or canary branches for appId + surfaceId.
3. Filter branches by segment match.
4. Apply rollout percentage using stable hash.
5. Return highest priority matching branch.
6. If none match, return default.

## Sticky rollout

```ts
function inRollout(userId: string, branchId: string, percentage: number): boolean {
  const hash = stableHash(`${userId}:${branchId}`);
  return hash % 100 < percentage;
}
```

## Segment matching

Example branch target:

```json
{
  "lifecycle_stage": "new_user",
  "company_size": ["1-10", "11-50"]
}
```

Example user context:

```json
{
  "lifecycle_stage": "new_user",
  "company_size": "1-10"
}
```

This matches.

## Fallback

Router must always return a safe fallback.

```json
{
  "variant": "default",
  "reason": "default_fallback"
}
```

## Privacy

Router should not require sensitive attributes.

Blocked or restricted fields should include:

- race
- religion
- political_view
- health_status
- precise_location unless explicitly approved

## Revert behavior

If branch status is reverted or sunset, router must not return it.
