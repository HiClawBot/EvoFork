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
  surfaceId: string;
  branch: string;
  audience: LocalizedText;
  problem: LocalizedText;
  evalGate: LocalizedText;
  metric: string;
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
    en: "Scenario previews",
    zh: "应用场景预览"
  },
  scenarioKicker: {
    en: "Use cases",
    zh: "应用场景"
  },
  scenarioBody: {
    en: "The public site starts with lightweight scenario previews. The next releases will promote these into versioned fixtures and an interactive scenario player.",
    zh: "官网首版先提供轻量场景预览。后续版本会把它们升级成版本化 fixtures 和可交互场景播放器。"
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

export const scenarios: ScenarioPreview[] = [
  {
    id: "pricing",
    surfaceId: "pricing.hero",
    branch: "pricing.hero.new-user-clarity.v1",
    audience: {
      en: "New SaaS buyers",
      zh: "首次访问 SaaS 价格页的买家"
    },
    problem: {
      en: "Visitors cannot understand the difference between Basic and Pro.",
      zh: "用户看不懂 Basic 和 Pro 的差异。"
    },
    evalGate: {
      en: "Allowed: copy, layout, CTA text. Blocked: pricing amount and payment logic.",
      zh: "允许：文案、布局、CTA。阻止：价格金额和支付逻辑。"
    },
    metric: "pricing_to_signup_conversion"
  },
  {
    id: "docs",
    surfaceId: "docs.quickstart",
    branch: "docs.quickstart.developer-path.v1",
    audience: {
      en: "Developers evaluating a new framework",
      zh: "评估新框架的开发者"
    },
    problem: {
      en: "Readers need the local demo path before advanced architecture details.",
      zh: "读者希望先跑通本地演示，再理解高级架构。"
    },
    evalGate: {
      en: "Allowed: examples and structure. Blocked: license, security policy, secrets.",
      zh: "允许：示例和结构。阻止：许可证、安全政策和密钥。"
    },
    metric: "quickstart_completion_rate"
  },
  {
    id: "support",
    surfaceId: "support.refund_policy_answer",
    branch: "support.refund_policy_answer.clarity.v1",
    audience: {
      en: "Support teams reviewing AI answer quality",
      zh: "审查 AI 回复质量的客服团队"
    },
    problem: {
      en: "Support summaries show repeated confusion around refund eligibility.",
      zh: "客服摘要显示用户反复困惑于退款资格。"
    },
    evalGate: {
      en: "Allowed: answer wording and examples. Blocked: legal claims and policy changes.",
      zh: "允许：回复措辞和示例。阻止：法律声明和政策变更。"
    },
    metric: "support_ticket_reopen_rate"
  }
];
