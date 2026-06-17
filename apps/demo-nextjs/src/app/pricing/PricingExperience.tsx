"use client";

import { useEffect, useMemo, useState } from "react";
import { EvoClient, type VariantResolution } from "@evofork/sdk-core";
import { PricingHero } from "./PricingHero";
import { pricingPlans, toPricingVariant, type PricingVariant } from "../../lib/pricing";

type FeedbackState = "idle" | "submitting" | "sent" | "error";

const appId = "demo-saas";
const surfaceId = "pricing.hero";

export function PricingExperience() {
  const [variant, setVariant] = useState<PricingVariant>("default");
  const [resolution, setResolution] = useState<VariantResolution | null>(null);
  const [feedbackState, setFeedbackState] = useState<FeedbackState>("idle");
  const [message, setMessage] = useState("I do not understand the difference between Basic and Pro.");
  const client = useMemo(
    () =>
      new EvoClient({
        endpoint: "/api/evo",
        appId,
        timeoutMs: 1500,
        sessionId: "demo-session"
      }),
    []
  );

  useEffect(() => {
    let cancelled = false;

    client
      .getVariant(surfaceId, {
        userId: "user_123",
        segmentHints: {
          lifecycle_stage: "new_user",
          company_size: "1-10"
        }
      })
      .then((nextResolution) => {
        if (cancelled) {
          return;
        }

        setResolution(nextResolution);
        setVariant(toPricingVariant(nextResolution.variant));
      });

    return () => {
      cancelled = true;
    };
  }, [client]);

  async function submitFeedback(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedbackState("submitting");

    const result = await client.feedback({
      surface: surfaceId,
      rating: -1,
      signal: "confusion",
      text: message,
      context: {
        page: "/pricing",
        lifecycle_stage: "new_user",
        company_size: "1-10"
      },
      consent: true
    });

    setFeedbackState(result.ok ? "sent" : "error");
  }

  return (
    <main className="shell">
      <nav className="topbar" aria-label="Pricing navigation">
        <a className="brand" href="/">
          EvoFork Demo
        </a>
        <a href="/admin">Admin</a>
      </nav>

      <PricingHero variant={variant} />

      <section className="status-strip" aria-label="Router status">
        <div>
          <span>Resolved variant</span>
          <strong>{resolution?.variant ?? "default"}</strong>
        </div>
        <div>
          <span>Reason</span>
          <strong>{resolution?.reason ?? "loading"}</strong>
        </div>
        <div>
          <span>Sticky</span>
          <strong>{String(resolution?.sticky ?? false)}</strong>
        </div>
      </section>

      <section className="plan-grid" id="plans" aria-label="Pricing plans">
        {pricingPlans.map((plan) => (
          <article className="plan-card" key={plan.name}>
            <p className="plan-name">{plan.name}</p>
            <h2>{plan.price}</h2>
            <p>{plan.description}</p>
            <ul>
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>

      <section className="feedback-panel" id="feedback">
        <div>
          <p className="eyebrow">Signal Hub</p>
          <h2>Send pricing feedback</h2>
          <p>
            This posts through the EvoFork SDK to the local API proxy, then to the
            Signal Hub route in the API server.
          </p>
        </div>
        <form onSubmit={submitFeedback}>
          <label htmlFor="feedback">Feedback</label>
          <textarea
            id="feedback"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />
          <button className="button primary" type="submit" disabled={feedbackState === "submitting"}>
            {feedbackState === "submitting" ? "Submitting..." : "Submit Feedback"}
          </button>
          <p className={`form-status ${feedbackState}`}>
            {feedbackState === "sent"
              ? "Feedback sent. Open the admin console to generate the RFC."
              : feedbackState === "error"
                ? "Feedback could not be sent. The pricing page stays available."
                : "No production credentials required."}
          </p>
        </form>
      </section>
    </main>
  );
}
