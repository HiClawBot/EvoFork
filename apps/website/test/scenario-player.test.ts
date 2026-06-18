import { describe, expect, it } from "vitest";
import type { ScenarioPreview } from "../src/content.js";
import {
  createScenarioPlayerState,
  findScenario,
  findScenarioStep,
  selectScenario,
  selectScenarioStep
} from "../src/scenario-player.js";

const scenario = (id: string, steps: string[]): ScenarioPreview => ({
  id,
  title: { en: id, zh: id },
  surfaceId: `${id}.surface`,
  surfaceType: "react-component",
  branch: `${id}.surface.test.v1`,
  audience: { en: "Developers", zh: "开发者" },
  problem: { en: "A problem", zh: "一个问题" },
  signalExamples: [{ en: "Signal", zh: "信号" }],
  allowedChanges: ["copy"],
  blockedChanges: ["payment_logic"],
  evalGate: { en: "Boundary pass", zh: "边界通过" },
  metric: "demo_metric",
  guardrailMetrics: ["error_rate"],
  steps: steps.map((step) => ({
    id: step,
    label: { en: step, zh: step },
    detail: { en: `${step} detail`, zh: `${step} detail` }
  }))
});

describe("scenario player state", () => {
  const scenarios = [scenario("pricing", ["signal", "rfc"]), scenario("docs", ["signal", "route"])];

  it("selects the first scenario and first step by default", () => {
    expect(createScenarioPlayerState(scenarios)).toEqual({
      scenarioId: "pricing",
      stepId: "signal"
    });
  });

  it("falls back to the first scenario and step for unknown ids", () => {
    const selectedScenario = findScenario(scenarios, "missing");
    const selectedStep = findScenarioStep(selectedScenario, "missing");

    expect(selectedScenario?.id).toBe("pricing");
    expect(selectedStep?.id).toBe("signal");
  });

  it("resets the active step when a scenario changes", () => {
    expect(selectScenario(scenarios, "docs")).toEqual({
      scenarioId: "docs",
      stepId: "signal"
    });
  });

  it("keeps the scenario stable when a step changes", () => {
    expect(
      selectScenarioStep({ scenarioId: "pricing", stepId: "signal" }, scenarios[0], "rfc")
    ).toEqual({
      scenarioId: "pricing",
      stepId: "rfc"
    });
  });
});
