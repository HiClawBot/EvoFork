export type Locale = "en" | "zh";

export type LocalizedText = Record<Locale, string>;

export type LoopStep = {
  id: string;
  label: LocalizedText;
  detail: LocalizedText;
  tone: "signal" | "rfc" | "patch" | "eval" | "branch" | "route";
};

export type ScenarioPreview = {
  id: string;
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
  metric: string;
  guardrailMetrics: string[];
  steps: ScenarioStep[];
};

export type ScenarioStep = {
  id: string;
  label: LocalizedText;
  detail: LocalizedText;
};

export const copy = {
  navDocs: {
    en: "Docs",
    zh: "文档"
  },
  navQuickstart: {
    en: "Quickstart",
    zh: "快速开始"
  },
  navGitHub: {
    en: "GitHub",
    zh: "GitHub"
  },
  eyebrow: {
    en: "Open-source framework for governed application evolution",
    zh: "用于受治理应用演化的开源框架"
  },
  heroTitle: {
    en: "EvoFork",
    zh: "EvoFork"
  },
  heroBody: {
    en: "Turn feedback, support intelligence, and product metrics into reviewable forks that stay inside manifest boundaries.",
    zh: "把用户反馈、客服智能摘要和产品指标转化为可审查、可回滚、受 manifest 边界约束的版本分叉。"
  },
  primaryCta: {
    en: "Read the repository",
    zh: "查看仓库"
  },
  secondaryCta: {
    en: "Open quickstart",
    zh: "打开快速开始"
  },
  statusLabel: {
    en: "Developer Preview",
    zh: "开发者预览"
  },
  ledgerManifest: {
    en: "manifest: pricing.hero",
    zh: "manifest: pricing.hero"
  },
  ledgerEval: {
    en: "eval: boundary pass",
    zh: "eval: 边界通过"
  },
  ledgerRoute: {
    en: "route: reversible",
    zh: "route: 可回滚"
  },
  loopKicker: {
    en: "Trusted loop",
    zh: "可信闭环"
  },
  loopTitle: {
    en: "A safer loop from signal to route",
    zh: "从信号到路由的安全闭环"
  },
  loopBody: {
    en: "EvoFork keeps every proposed change tied to a manifest surface, Eval Gate result, branch registry record, and reversible routing decision.",
    zh: "EvoFork 让每次候选变更都绑定 manifest surface、Eval Gate 结果、branch registry 记录和可回滚的路由决策。"
  },
  scenarioTitle: {
    en: "Scenario Player",
    zh: "场景播放器"
  },
  scenarioKicker: {
    en: "Use cases",
    zh: "应用场景"
  },
  scenarioBody: {
    en: "Explore versioned scenario fixtures as a public demo of the governed loop, from evidence to reversible route.",
    zh: "以公开 demo 的方式查看版本化场景 fixture，贯穿从证据到可回滚路由的治理闭环。"
  },
  scenarioLoading: {
    en: "Loading scenario models",
    zh: "正在加载场景模型"
  },
  scenarioUnavailable: {
    en: "Scenario models are not available in this build.",
    zh: "此构建中没有可用的场景模型。"
  },
  scenarioLoadError: {
    en: "Scenario models could not be loaded.",
    zh: "场景模型加载失败。"
  },
  playerAudience: {
    en: "Audience",
    zh: "受众"
  },
  playerProblem: {
    en: "Problem",
    zh: "问题"
  },
  playerMetric: {
    en: "Primary metric",
    zh: "主指标"
  },
  playerSignals: {
    en: "Evidence signals",
    zh: "证据信号"
  },
  playerAllowed: {
    en: "Allowed changes",
    zh: "允许变更"
  },
  playerBlocked: {
    en: "Blocked changes",
    zh: "阻止变更"
  },
  playerGuardrails: {
    en: "Guardrails",
    zh: "护栏指标"
  },
  playerEvalGate: {
    en: "Eval Gate",
    zh: "Eval Gate"
  },
  playerRoute: {
    en: "Route decision",
    zh: "路由决策"
  },
  playerBranch: {
    en: "Branch",
    zh: "分支"
  },
  playerSurfaceType: {
    en: "Surface type",
    zh: "Surface 类型"
  },
  safetyTitle: {
    en: "Safety constraints stay visible",
    zh: "安全约束保持可见"
  },
  safetyKicker: {
    en: "Governance",
    zh: "治理"
  },
  safetyBody: {
    en: "No autonomous merge, no production deploy, no payment/auth/legal/database edits by default, and no third-party telemetry export.",
    zh: "默认不自动合并、不生产部署、不修改支付/认证/法律/数据库逻辑，也不向第三方导出 telemetry。"
  },
  footer: {
    en: "Apache-2.0 open source. Built for local-first demos with mock adapters.",
    zh: "Apache-2.0 开源。面向本地优先演示，默认使用 mock/local adapter。"
  }
} satisfies Record<string, LocalizedText>;

export const loopSteps: LoopStep[] = [
  {
    id: "signal",
    label: { en: "Signal Hub", zh: "Signal Hub" },
    detail: {
      en: "Collect feedback, events, and support summaries as data.",
      zh: "把反馈、事件和客服摘要作为数据收集。"
    },
    tone: "signal"
  },
  {
    id: "rfc",
    label: { en: "RFC Agent", zh: "RFC Agent" },
    detail: {
      en: "Generate a structured product hypothesis from evidence.",
      zh: "基于证据生成结构化产品假设。"
    },
    tone: "rfc"
  },
  {
    id: "patch",
    label: { en: "Patch Agent", zh: "Patch Agent" },
    detail: {
      en: "Create constrained PR previews for allowed surface files.",
      zh: "只为授权 surface 文件创建受约束 PR 预览。"
    },
    tone: "patch"
  },
  {
    id: "eval",
    label: { en: "Eval Gate", zh: "Eval Gate" },
    detail: {
      en: "Reject boundary, policy, and safety violations.",
      zh: "拒绝边界、policy 和安全违规。"
    },
    tone: "eval"
  },
  {
    id: "branch",
    label: { en: "Branch Registry", zh: "Branch Registry" },
    detail: {
      en: "Track auditable, reversible version forks.",
      zh: "记录可审计、可回滚的版本分叉。"
    },
    tone: "branch"
  },
  {
    id: "route",
    label: { en: "Router", zh: "Router" },
    detail: {
      en: "Resolve variants with opt-out and fallback behavior.",
      zh: "在支持 opt-out 与 fallback 的前提下解析变体。"
    },
    tone: "route"
  }
];
