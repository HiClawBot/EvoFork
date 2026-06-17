# EvoFork Safety Fixtures

## English

Safety fixtures are deterministic examples used to verify that EvoFork keeps
feedback, patches, policy decisions, and Eval Gate results inside the expected
safety boundaries.

List bundled fixtures:

```bash
pnpm evo eval fixtures
pnpm evo eval fixtures --json
```

Run one fixture:

```bash
pnpm evo eval fixture payment-logic-blocked --json
```

The command exits with `0` when the actual result matches the fixture
expectation. A blocked fixture can therefore pass when Eval Gate or policy
correctly blocks it.

Bundled fixtures:

- `pricing-copy-allowed`: allowed pricing hero copy change.
- `payment-logic-blocked`: checkout/payment behavior attempted from the pricing surface.
- `database-schema-blocked`: database migration outside the surface boundary.
- `prompt-injection-feedback-is-data`: adversarial feedback shape that must remain data.

These fixtures are not a substitute for project-specific tests. They are a
portable baseline for release checks and CI smoke validation.

## 中文

Safety fixtures 是一组确定性的安全样例，用于验证 EvoFork 是否能把 feedback、
patch、policy decision 和 Eval Gate 结果限制在预期的安全边界内。

列出内置 fixtures：

```bash
pnpm evo eval fixtures
pnpm evo eval fixtures --json
```

运行单个 fixture：

```bash
pnpm evo eval fixture payment-logic-blocked --json
```

当实际结果符合 fixture 预期时，命令返回 `0`。因此，一个被阻断的 fixture
只要确实被 Eval Gate 或 policy 阻断，也会被视为通过。

内置 fixtures：

- `pricing-copy-allowed`：允许的 pricing hero 文案变更。
- `payment-logic-blocked`：在 pricing surface 中尝试加入 checkout/payment 行为。
- `database-schema-blocked`：超出 surface 边界的数据库 migration。
- `prompt-injection-feedback-is-data`：模拟对抗性 feedback，必须只被当作数据。

这些 fixtures 不能替代项目自己的测试。它们提供的是一组可移植的发布检查和
CI smoke validation 基线。
