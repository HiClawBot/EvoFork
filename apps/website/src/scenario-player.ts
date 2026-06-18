import type { ScenarioPreview, ScenarioStep } from "./content.js";

export type ScenarioPlayerState = {
  scenarioId: string | undefined;
  stepId: string | undefined;
};

export const createScenarioPlayerState = (
  scenarios: ScenarioPreview[]
): ScenarioPlayerState => {
  const scenario = scenarios[0];

  return {
    scenarioId: scenario?.id,
    stepId: scenario?.steps[0]?.id
  };
};

export const findScenario = (
  scenarios: ScenarioPreview[],
  scenarioId: string | undefined
): ScenarioPreview | undefined =>
  scenarios.find((scenario) => scenario.id === scenarioId) ?? scenarios[0];

export const findScenarioStep = (
  scenario: ScenarioPreview | undefined,
  stepId: string | undefined
): ScenarioStep | undefined => {
  if (!scenario) {
    return undefined;
  }

  return scenario.steps.find((step) => step.id === stepId) ?? scenario.steps[0];
};

export const selectScenario = (
  scenarios: ScenarioPreview[],
  scenarioId: string
): ScenarioPlayerState => {
  const scenario = findScenario(scenarios, scenarioId);

  return {
    scenarioId: scenario?.id,
    stepId: scenario?.steps[0]?.id
  };
};

export const selectScenarioStep = (
  state: ScenarioPlayerState,
  scenario: ScenarioPreview | undefined,
  stepId: string
): ScenarioPlayerState => {
  const step = findScenarioStep(scenario, stepId);

  return {
    scenarioId: state.scenarioId,
    stepId: step?.id
  };
};
