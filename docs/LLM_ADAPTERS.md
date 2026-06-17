# LLM Adapters

EvoFork should support multiple LLM providers through a common adapter interface.

## Interface

```ts
export interface LlmAdapter {
  generateRfc(input: GenerateRfcInput): Promise<GeneratedRfc>;
  generatePatch(input: GeneratePatchInput): Promise<GeneratedPatch>;
}
```

## Mock adapter

Required for v0.1.

Purpose:

- local demo without credentials
- deterministic tests
- reproducible examples

## OpenAI-compatible adapter

Optional for v0.1 but recommended.

Configuration:

```text
EVOFORK_LLM_BASE_URL
EVOFORK_LLM_API_KEY
EVOFORK_LLM_MODEL
```

Rules:

- never log API keys
- validate all model output
- treat feedback as data
- enforce manifest boundaries after generation

## Prompt safety

Every prompt must clearly separate:

```text
system/developer instructions
manifest constraints
feedback data
expected output schema
```

User feedback must never be placed in a position where it can override system instructions.
