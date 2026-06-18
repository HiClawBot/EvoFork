import { spawnSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const phases = [
  ["build", ["build"]],
  ["test", ["test"]],
  ["typecheck", ["typecheck"]],
  ["lint", ["lint"]],
  ["manifest validate", ["evo", "manifest", "validate"]],
  [
    "eval report",
    [
      "evo",
      "eval",
      "report",
      "--surface",
      "pricing.hero",
      "--changed-file",
      "apps/demo-nextjs/src/app/pricing/PricingHero.tsx"
    ]
  ]
];

for (const [label, args] of phases) {
  console.log(`\nverify: ${label}`);
  const result = spawnSync("pnpm", args, {
    stdio: "inherit"
  });

  if (result.error) {
    console.error(`verify: ${label} failed to start`);
    console.error(result.error);
    process.exit(1);
  }

  if (result.signal) {
    console.error(`verify: ${label} terminated with signal ${result.signal}`);
    process.exit(1);
  }

  if (result.status !== 0) {
    console.error(`verify: ${label} exited with code ${result.status}`);
    process.exit(result.status ?? 1);
  }

  await delay(750);
}
