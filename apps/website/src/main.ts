import { copy, loopSteps, type Locale, type ScenarioPreview } from "./content.js";

const localeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>("[data-locale-target]"));
const localizedNodes = Array.from(document.querySelectorAll<HTMLElement>("[data-i18n]"));
const loopTrack = document.querySelector<HTMLElement>("[data-loop-track]");
const sceneTrack = document.querySelector<HTMLElement>("[data-scene-track]");
const scenarioNav = document.querySelector<HTMLElement>("[data-scenario-nav]");
const scenarioDetail = document.querySelector<HTMLElement>("[data-scenario-detail]");

let activeLocale: Locale = "en";
let scenarios: ScenarioPreview[] = [];
let activeScenario: ScenarioPreview | undefined;
let activeLoopIndex = 0;

const textFor = (key: string, locale: Locale): string => {
  const localized = copy[key as keyof typeof copy];
  return localized?.[locale] ?? key;
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

const renderScenario = (scenario: ScenarioPreview | undefined): void => {
  if (!scenarioDetail) {
    return;
  }

  scenarioDetail.innerHTML = "";

  if (!scenario) {
    const empty = document.createElement("p");
    empty.textContent =
      activeLocale === "en"
        ? "Scenario models are not available in this build."
        : "此构建中没有可用的场景模型。";
    scenarioDetail.append(empty);
    return;
  }

  const title = document.createElement("h3");
  title.textContent = scenario.surfaceId;

  const branch = document.createElement("p");
  branch.className = "scenario-branch";
  branch.textContent = scenario.branch;

  const audience = document.createElement("p");
  audience.textContent = scenario.audience[activeLocale];

  const problem = document.createElement("p");
  problem.textContent = scenario.problem[activeLocale];

  const gate = document.createElement("p");
  gate.className = "scenario-gate";
  gate.textContent = scenario.evalGate[activeLocale];

  const metric = document.createElement("dl");
  metric.className = "scenario-metric";
  const metricLabel = document.createElement("dt");
  metricLabel.textContent = activeLocale === "en" ? "Primary metric" : "主指标";
  const metricValue = document.createElement("dd");
  metricValue.textContent = scenario.metric;
  metric.append(metricLabel, metricValue);

  const steps = document.createElement("ol");
  steps.className = "scenario-steps";
  for (const step of scenario.steps) {
    const item = document.createElement("li");
    const stepLabel = document.createElement("strong");
    stepLabel.textContent = step.label[activeLocale];
    const stepDetail = document.createElement("span");
    stepDetail.textContent = step.detail[activeLocale];
    item.append(stepLabel, stepDetail);
    steps.append(item);
  }

  scenarioDetail.append(title, branch, audience, problem, gate, metric, steps);
};

const renderScenarioNav = (): void => {
  if (!scenarioNav) {
    return;
  }

  scenarioNav.innerHTML = "";

  for (const scenario of scenarios) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "scenario-button";
    button.dataset.active = String(scenario.id === activeScenario?.id);
    button.textContent = scenario.surfaceId;
    button.addEventListener("click", () => {
      activeScenario = scenario;
      renderScenarioNav();
      renderScenario(activeScenario);
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
      renderScenario(activeScenario);
    }
  });
}

setLocalizedText(activeLocale);
renderLoop();
try {
  scenarios = await loadScenarios();
  activeScenario = scenarios[0];
} catch {
  scenarios = [];
  activeScenario = undefined;
}
renderScenarioNav();
renderScenario(activeScenario);
window.setInterval(tickScene, 4200);
