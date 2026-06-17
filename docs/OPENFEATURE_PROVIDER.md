# OpenFeature Provider

EvoFork should provide an OpenFeature provider so teams can use EvoFork through a standard feature flag interface.

## Example

```ts
import { OpenFeature } from "@openfeature/server-sdk";
import { EvoForkProvider } from "@evofork/openfeature-provider";

OpenFeature.setProvider(
  new EvoForkProvider({
    endpoint: "http://localhost:4000",
    appId: "demo-saas"
  })
);

const client = OpenFeature.getClient();

const variant = await client.getStringValue(
  "pricing.hero",
  "default",
  {
    targetingKey: "user_123",
    lifecycle_stage: "new_user",
    company_size: "1-10"
  }
);
```

## Mapping

```text
OpenFeature flag key -> EvoFork surfaceId
OpenFeature targetingKey -> EvoFork userId
OpenFeature context -> EvoFork segmentHints
OpenFeature string value -> EvoFork variant
```

## v0.1 scope

- string variant resolution only
- no complex flag evaluation
- no remote caching initially
- fail safe to default value
