import { pricingHeroCopy, type PricingVariant } from "../../lib/pricing";

export function PricingHero({ variant }: { variant: PricingVariant }) {
  const copy = pricingHeroCopy[variant] ?? pricingHeroCopy.default;

  return (
    <section className="pricing-hero">
      <div className="hero-copy">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1>{copy.headline}</h1>
        <p>{copy.body}</p>
        <div className="hero-actions">
          <a className="button primary" href="#plans">
            {copy.primaryCta}
          </a>
          <a className="button" href="#feedback">
            Send Feedback
          </a>
        </div>
      </div>
      <div className="hero-panel" aria-label="Variant preview">
        <div className="panel-header">
          <span>{variant}</span>
          <strong>{copy.metric}</strong>
        </div>
        <div className="route-stack">
          {copy.highlights.map((item) => (
            <div className="route-row" key={item}>
              <span className="route-dot" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
