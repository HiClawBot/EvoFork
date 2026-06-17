export const pricingVariantIds = [
  "default",
  "pricing.hero.new-user-clarity.v1",
  "pricing.hero.developer-focused.v1",
  "pricing.hero.enterprise-buyer.v1"
] as const;

export type PricingVariant = (typeof pricingVariantIds)[number];

export const pricingHeroCopy: Record<
  PricingVariant,
  {
    eyebrow: string;
    headline: string;
    body: string;
    primaryCta: string;
    metric: string;
    highlights: string[];
  }
> = {
  default: {
    eyebrow: "Plans for teams shipping product",
    headline: "Choose the plan that matches your product stage.",
    body: "Start with a focused plan, then expand into governance and audit controls as your team grows.",
    primaryCta: "Compare Plans",
    metric: "default",
    highlights: ["Basic for launch", "Pro for growth", "Enterprise for controls"]
  },
  "pricing.hero.new-user-clarity.v1": {
    eyebrow: "New-user clarity variant",
    headline: "Basic launches your app. Pro grows it with experiments.",
    body: "Basic covers the trusted loop for one surface. Pro adds branch routing, approvals, and richer evaluation for teams iterating every week.",
    primaryCta: "Show Me Basic vs Pro",
    metric: "pricing_to_signup_conversion",
    highlights: ["Plain-language plan split", "Role-based explanation", "Lower support confusion"]
  },
  "pricing.hero.developer-focused.v1": {
    eyebrow: "Developer variant",
    headline: "APIs, manifests, and local mock adapters first.",
    body: "Wire EvoFork into a TypeScript app, run the trusted loop locally, and keep production credentials out of the demo path.",
    primaryCta: "Read Developer Docs",
    metric: "activation_rate",
    highlights: ["Typed SDK", "Mock LLM", "Manifest boundary"]
  },
  "pricing.hero.enterprise-buyer.v1": {
    eyebrow: "Enterprise buyer variant",
    headline: "Approval, audit logs, and rollback before rollout.",
    body: "Govern every AI-generated fork with eval gates, reversible branches, opt-out routing, and human approval for sensitive changes.",
    primaryCta: "Review Governance",
    metric: "risk_reduction",
    highlights: ["Audit trail", "Human approval", "Rollback path"]
  }
};

export const pricingPlans = [
  {
    name: "Basic",
    price: "$49",
    description: "For one team proving the feedback-to-fork loop.",
    features: ["1 app manifest", "Mock LLM adapter", "Local eval report"]
  },
  {
    name: "Pro",
    price: "$149",
    description: "For product teams routing safe variants.",
    features: ["Branch registry", "Segment rollout", "Admin console"]
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For teams that need review, audit, and rollback controls.",
    features: ["Approval workflow", "Audit logs", "Adapter boundaries"]
  }
];

export function toPricingVariant(value: string | undefined): PricingVariant {
  return pricingVariantIds.includes(value as PricingVariant)
    ? (value as PricingVariant)
    : "default";
}
