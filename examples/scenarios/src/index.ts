import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type Locale = "en" | "zh";

export type LocalizedText = Record<Locale, string>;

export type ScenarioStep = {
  id: string;
  label: LocalizedText;
  detail: LocalizedText;
};

export type EvoScenarioModel = {
  schemaVersion: "evofork.scenario/v1";
  id: string;
  displayOrder: number;
  title: LocalizedText;
  surfaceId: string;
  surfaceType: "react-component" | "markdown-doc" | "llm-prompt";
  branch: string;
  audience: LocalizedText;
  problem: LocalizedText;
  signalExamples: LocalizedText[];
  allowedChanges: string[];
  blockedChanges: string[];
  evalGate: LocalizedText;
  primaryMetric: string;
  guardrailMetrics: string[];
  demoFlow: ScenarioStep[];
};

export type PublicScenarioPreview = {
  id: string;
  surfaceId: string;
  branch: string;
  audience: LocalizedText;
  problem: LocalizedText;
  evalGate: LocalizedText;
  metric: string;
  steps: ScenarioStep[];
};

const bundledFixturesDir = fileURLToPath(new URL("./fixtures", import.meta.url));

const isRecord = (input: unknown): input is Record<string, unknown> =>
  typeof input === "object" && input !== null && !Array.isArray(input);

const assertString = (input: unknown, field: string): string => {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new Error(`Scenario field ${field} must be a non-empty string`);
  }

  return input;
};

const assertStringArray = (input: unknown, field: string): string[] => {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error(`Scenario field ${field} must be a non-empty string array`);
  }

  return input.map((value, index) => assertString(value, `${field}[${index}]`));
};

const assertPositiveInteger = (input: unknown, field: string): number => {
  if (!Number.isInteger(input) || Number(input) < 1) {
    throw new Error(`Scenario field ${field} must be a positive integer`);
  }

  return Number(input);
};

const assertLocalizedText = (input: unknown, field: string): LocalizedText => {
  if (!isRecord(input)) {
    throw new Error(`Scenario field ${field} must be localized text`);
  }

  return {
    en: assertString(input.en, `${field}.en`),
    zh: assertString(input.zh, `${field}.zh`)
  };
};

const assertLocalizedTextArray = (input: unknown, field: string): LocalizedText[] => {
  if (!Array.isArray(input) || input.length === 0) {
    throw new Error(`Scenario field ${field} must be a non-empty localized text array`);
  }

  return input.map((value, index) => assertLocalizedText(value, `${field}[${index}]`));
};

const assertSurfaceType = (input: unknown): EvoScenarioModel["surfaceType"] => {
  if (input === "react-component" || input === "markdown-doc" || input === "llm-prompt") {
    return input;
  }

  throw new Error("Scenario field surfaceType is invalid");
};

const assertSteps = (input: unknown): ScenarioStep[] => {
  if (!Array.isArray(input) || input.length < 3) {
    throw new Error("Scenario field demoFlow must include at least three steps");
  }

  return input.map((value, index) => {
    if (!isRecord(value)) {
      throw new Error(`Scenario field demoFlow[${index}] must be an object`);
    }

    return {
      id: assertString(value.id, `demoFlow[${index}].id`),
      label: assertLocalizedText(value.label, `demoFlow[${index}].label`),
      detail: assertLocalizedText(value.detail, `demoFlow[${index}].detail`)
    };
  });
};

export const validateScenarioModel = (input: unknown): EvoScenarioModel => {
  if (!isRecord(input)) {
    throw new Error("Scenario model must be an object");
  }

  const model: EvoScenarioModel = {
    schemaVersion: assertString(input.schemaVersion, "schemaVersion") as EvoScenarioModel["schemaVersion"],
    id: assertString(input.id, "id"),
    displayOrder: assertPositiveInteger(input.displayOrder, "displayOrder"),
    title: assertLocalizedText(input.title, "title"),
    surfaceId: assertString(input.surfaceId, "surfaceId"),
    surfaceType: assertSurfaceType(input.surfaceType),
    branch: assertString(input.branch, "branch"),
    audience: assertLocalizedText(input.audience, "audience"),
    problem: assertLocalizedText(input.problem, "problem"),
    signalExamples: assertLocalizedTextArray(input.signalExamples, "signalExamples"),
    allowedChanges: assertStringArray(input.allowedChanges, "allowedChanges"),
    blockedChanges: assertStringArray(input.blockedChanges, "blockedChanges"),
    evalGate: assertLocalizedText(input.evalGate, "evalGate"),
    primaryMetric: assertString(input.primaryMetric, "primaryMetric"),
    guardrailMetrics: assertStringArray(input.guardrailMetrics, "guardrailMetrics"),
    demoFlow: assertSteps(input.demoFlow)
  };

  if (model.schemaVersion !== "evofork.scenario/v1") {
    throw new Error("Scenario schemaVersion must be evofork.scenario/v1");
  }

  if (!model.surfaceId.includes(".")) {
    throw new Error("Scenario surfaceId must be dot-separated");
  }

  if (!model.branch.startsWith(`${model.surfaceId}.`)) {
    throw new Error("Scenario branch must start with the surface id");
  }

  if (!/^[a-z0-9_]+$/.test(model.primaryMetric)) {
    throw new Error("Scenario primaryMetric must be snake_case");
  }

  return model;
};

export const loadScenarioModelsFromDirectory = async (
  fixturesDir: string = bundledFixturesDir
): Promise<EvoScenarioModel[]> => {
  const entries = await readdir(fixturesDir, { withFileTypes: true });
  const scenarioDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const models = await Promise.all(
    scenarioDirectories.map(async (directory) => {
      const raw = await readFile(join(fixturesDir, directory, "scenario.json"), "utf8");
      return validateScenarioModel(JSON.parse(raw));
    })
  );

  return models.sort(
    (left, right) =>
      left.displayOrder - right.displayOrder || left.id.localeCompare(right.id)
  );
};

export const toPublicScenarioPreviews = (
  models: EvoScenarioModel[]
): PublicScenarioPreview[] =>
  models.map((model) => ({
    id: model.id,
    surfaceId: model.surfaceId,
    branch: model.branch,
    audience: model.audience,
    problem: model.problem,
    evalGate: model.evalGate,
    metric: model.primaryMetric,
    steps: model.demoFlow
  }));
