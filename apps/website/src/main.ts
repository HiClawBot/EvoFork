import {
  copy,
  loopSteps,
  type Locale,
  type LocalizedText,
  type ScenarioPreview,
  type ScenarioStep
} from "./content.js";
import {
  createScenarioPlayerState,
  findScenario,
  findScenarioStep,
  selectScenario,
  selectScenarioStep,
  type ScenarioPlayerState
} from "./scenario-player.js";

const localeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-locale-target]"));
const localizedNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-i18n]"));
const loopTrack = document.querySelector<HTMLElement>("[data-loop-track]");
const sceneTrack = document.querySelector<HTMLElement>("[data-scene-track]");
const scenarioNav = document.querySelector<HTMLElement>("[data-scenario-nav]");
const scenarioDetail = document.querySelector<HTMLElement>("[data-scenario-detail]");

let activeLocale: Locale = "en";
let scenarios: ScenarioPreview[] = [];
let scenarioPlayerState: ScenarioPlayerState = createScenarioPlayerState(scenarios);
let scenarioLoadState: "loading" | "ready" | "error" = "loading";
let activeLoopIndex = 0;

const textFor = (key: string, locale: Locale): string => {
  const localized = copy[key as keyof typeof copy];
  return localized?.[locale] ?? key;
};

const copyText = (key: keyof typeof copy): string => copy[key][activeLocale];

const localizedText = (value: LocalizedText): string => value[activeLocale];

const formatToken = (value: string): string => value.replaceAll("_", " ");

const appendDefinition = (parent: HTMLElement, label: string, value: string): void => {
  const group = document.createElement("div");
  const term = document.createElement("dt");
  const detail = document.createElement("dd");

  term.textContent = label;
  detail.textContent = value;
  group.append(term, detail);
  parent.append(group);
};

const appendListBlock = (
  parent: HTMLElement,
  title: string,
  values: string[],
  tone: "neutral" | "allow" | "block" = "neutral"
): void => {
  const block = document.createElement("section");
  block.className = `scenario-list-block tone-${tone}`;

  const heading = document.createElement("h5");
  heading.textContent = title;

  const list = document.createElement("ul");
  for (const value of values) {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  }

  block.append(heading, list);
  parent.append(block);
};

const setLocalizedText = (locale: Locale): void => {
  document.documentElement.lang = locale === "en" ? "en" : "zh-CN";
  document.body.dataset.locale = locale;

  for (const node of localizedNodes) {
    const key = node.dataset.i18n;
    if (key) {
      node.textContent = textFor(key, locale);
    }
  }

  for (const button of localeButtons) {
    const isActive = button.dataset.localeTarget === locale;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  }
};

const renderScenarioState = (message: string, mode: "loading" | "empty" | "error"): void => {
  if (!scenarioDetail) {
    return;
  }

  scenarioDetail.innerHTML = "";
  scenarioDetail.setAttribute("aria-busy", String(mode === "loading"));

  const state = document.createElement("div");
  state.className = `scenario-state scenario-state-${mode}`;

  const bars = document.createElement("div");
  bars.className = "scenario-state-bars";
  bars.setAttribute("aria-hidden", "true");
  for (let index = 0; index < 3; index += 1) {
    const bar = document.createElement("span");
    bars.append(bar);
  }

  const text = document.createElement("p");
  text.textContent = message;

  state.append(bars, text);
  scenarioDetail.append(state);
};

const renderLoop = (): void => {
  if (!loopTrack || !sceneTrack) {
    return;
  }

  loopTrack.innerHTML = "";
  sceneTrack.innerHTML = "";

  loopSteps.forEach((step, index) => {
    const item = document.createElement("article");
    item.className = `loop-step tone-${step.tone}`;
    item.dataset.active = String(index === activeLoopIndex);

    const label = document.createElement("h3");
    label.textContent = step.label[activeLocale];

    const detail = document.createElement("p");
    detail.textContent = step.detail[activeLocale];

    item.append(label, detail);
    loopTrack.append(item);

    const sceneNode = document.createElement("button");
    sceneNode.className = `scene-node tone-${step.tone}`;
    sceneNode.type = "button";
    sceneNode.textContent = step.label[activeLocale];
    sceneNode.dataset.active = String(index === activeLoopIndex);
    sceneNode.addEventListener("click", () => {
      activeLoopIndex = index;
      renderLoop();
    });
    sceneTrack.append(sceneNode);
  });
};

const getStageBlocks = (
  scenario: ScenarioPreview,
  step: ScenarioStep | undefined
): Array<{ title: string; values: string[]; tone?: "neutral" | "allow" | "block" }> => {
  switch (step?.id) {
    case "signal":
      return [
        {
          title: copyText("playerSignals"),
          values: scenario.signalExamples.map(localizedText)
        },
        {
          title: copyText("playerProblem"),
          values: [localizedText(scenario.problem)]
        }
      ];
    case "rfc":
      return [
        {
          title: copyText("playerAllowed"),
          values: scenario.allowedChanges.map(formatToken),
          tone: "allow"
        },
        {
          title: copyText("playerMetric"),
          values: [formatToken(scenario.metric)]
        }
      ];
    case "eval":
      return [
        {
          title: copyText("playerEvalGate"),
          values: [localizedText(scenario.evalGate)]
        },
        {
          title: copyText("playerBlocked"),
          values: scenario.blockedChanges.map(formatToken),
          tone: "block"
        }
      ];
    case "route":
      return [
        {
          title: copyText("playerBranch"),
          values: [scenario.branch]
        },
        {
          title: copyText("playerGuardrails"),
          values: scenario.guardrailMetrics.map(formatToken)
        }
      ];
    default:
      return [];
  }
};

const renderScenario = (scenario: ScenarioPreview | undefined): void => {
  if (!scenarioDetail) {
    return;
  }

  if (scenarioLoadState === "loading") {
    renderScenarioState(copyText("scenarioLoading"), "loading");
    return;
  }

  if (scenarioLoadState === "error") {
    renderScenarioState(copyText("scenarioLoadError"), "error");
    return;
  }

  if (!scenario) {
    renderScenarioState(copyText("scenarioUnavailable"), "empty");
    return;
  }

  scenarioDetail.innerHTML = "";
  scenarioDetail.setAttribute("aria-busy", "false");

  const activeStep = findScenarioStep(scenario, scenarioPlayerState.stepId);

  const header = document.createElement("header");
  header.className = "scenario-detail-head";

  const surfaceType = document.createElement("p");
  surfaceType.className = "scenario-surface-type";
  surfaceType.textContent = `${copyText("playerSurfaceType")}: ${formatToken(scenario.surfaceType)}`;

  const title = document.createElement("h3");
  title.textContent = localizedText(scenario.title);

  const branch = document.createElement("p");
  branch.className = "scenario-branch";
  branch.textContent = scenario.branch;

  header.append(surfaceType, title, branch);

  const summary = document.createElement("dl");
  summary.className = "scenario-summary";
  appendDefinition(summary, copyText("playerAudience"), localizedText(scenario.audience));
  appendDefinition(summary, copyText("playerProblem"), localizedText(scenario.problem));
  appendDefinition(summary, copyText("playerMetric"), formatToken(scenario.metric));

  const player = document.createElement("div");
  player.className = "scenario-player";

  const stepNav = document.createElement("div");
  stepNav.className = "scenario-step-nav";
  stepNav.setAttribute("role", "tablist");

  for (const step of scenario.steps) {
    const button = document.createElement("button");
    const isActive = step.id === activeStep?.id;
    button.type = "button";
    button.className = "scenario-step-button";
    button.dataset.active = String(isActive);
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(isActive));
    button.textContent = localizedText(step.label);
    button.addEventListener("click", () => {
      scenarioPlayerState = selectScenarioStep(scenarioPlayerState, scenario, step.id);
      renderScenario(scenario);
    });
    stepNav.append(button);
  }

  const stage = document.createElement("section");
  stage.className = "scenario-stage-panel";
  stage.setAttribute("role", "tabpanel");

  const stageTitle = document.createElement("h4");
  stageTitle.textContent = activeStep ? localizedText(activeStep.label) : scenario.surfaceId;

  const stageDetail = document.createElement("p");
  stageDetail.textContent = activeStep ? localizedText(activeStep.detail) : localizedText(scenario.problem);

  const stageGrid = document.createElement("div");
  stageGrid.className = "scenario-stage-grid";
  for (const block of getStageBlocks(scenario, activeStep)) {
    appendListBlock(stageGrid, block.title, block.values, block.tone);
  }

  stage.append(stageTitle, stageDetail, stageGrid);
  player.append(stepNav, stage);
  scenarioDetail.append(header, summary, player);
};

const renderScenarioNav = (): void => {
  if (!scenarioNav) {
    return;
  }

  scenarioNav.innerHTML = "";

  if (scenarioLoadState === "loading") {
    for (let index = 0; index < 3; index += 1) {
      const item = document.createElement("span");
      item.className = "scenario-nav-skeleton";
      scenarioNav.append(item);
    }
    return;
  }

  for (const scenario of scenarios) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scenario-button";
    button.dataset.active = String(scenario.id === scenarioPlayerState.scenarioId);
    button.textContent = scenario.surfaceId;
    button.addEventListener("click", () => {
      scenarioPlayerState = selectScenario(scenarios, scenario.id);
      renderScenarioNav();
      renderScenario(findScenario(scenarios, scenarioPlayerState.scenarioId));
    });
    scenarioNav.append(button);
  }
};

const tickScene = (): void => {
  activeLoopIndex = (activeLoopIndex + 1) % loopSteps.length;
  renderLoop();
};

const loadScenarios = async (): Promise<ScenarioPreview[]> => {
  const response = await fetch("./assets/scenarios.json");
  if (!response.ok) {
    throw new Error(`Failed to load scenario models: ${response.status}`);
  }

  return (await response.json()) as ScenarioPreview[];
};

for (const button of localeButtons) {
  button.addEventListener("click", () => {
    const locale = button.dataset.localeTarget;
    if (locale === "en" || locale === "zh") {
      activeLocale = locale;
      setLocalizedText(activeLocale);
      renderLoop();
      renderScenarioNav();
      renderScenario(findScenario(scenarios, scenarioPlayerState.scenarioId));
    }
  });
}

setLocalizedText(activeLocale);
renderLoop();
renderScenarioNav();
renderScenario(undefined);
try {
  scenarios = await loadScenarios();
  scenarioLoadState = "ready";
  scenarioPlayerState = createScenarioPlayerState(scenarios);
} catch {
  scenarios = [];
  scenarioLoadState = "error";
  scenarioPlayerState = createScenarioPlayerState(scenarios);
}
renderScenarioNav();
renderScenario(findScenario(scenarios, scenarioPlayerState.scenarioId));
window.setInterval(tickScene, 4200);
