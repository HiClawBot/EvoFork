"use client";

import { useState } from "react";
import type { AdminSnapshot, DemoActionResult } from "../lib/admin-api";

export function AdminConsole({ initialSnapshot }: { initialSnapshot: AdminSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [result, setResult] = useState<DemoActionResult | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const governance = summarizeGovernance(snapshot, result);

  async function runAction(action: string, path: string, body?: unknown) {
    setBusyAction(action);
    setResult(null);

    try {
      const response = await fetch(path, {
        method: body ? "POST" : "GET",
        headers: {
          "content-type": "application/json"
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = (await response.json()) as DemoActionResult | AdminSnapshot;

      if ("signals" in data && "branches" in data) {
        setSnapshot(data);
      } else {
        setResult(data);
        await refresh();
      }
    } finally {
      setBusyAction(null);
    }
  }

  async function refresh() {
    const response = await fetch("/api/admin/snapshot", { cache: "no-store" });
    setSnapshot((await response.json()) as AdminSnapshot);
  }

  return (
    <main className="shell">
      <nav className="topbar" aria-label="Admin navigation">
        <span className="brand">EvoFork Admin</span>
        <a href="http://127.0.0.1:3000/pricing">Pricing Demo</a>
      </nav>

      <section className="dashboard">
        <HeaderBlock />
        <div className="metric-grid">
          <Metric label="Feedback" value={snapshot.signals.length} />
          <Metric
            label="Active Branches"
            value={snapshot.branches.filter((branch) => branch.status === "active").length}
          />
          <Metric
            label="Canary Branches"
            value={snapshot.branches.filter((branch) => branch.status === "canary").length}
          />
          <Metric
            label="Rollbacks"
            value={snapshot.branches.filter((branch) => branch.status === "reverted").length}
          />
          <Metric label="Policy Blocks" value={governance.policyBlocked} />
          <Metric label="Eval Gate" value={governance.evalStatus} />
        </div>
      </section>

      <section className="toolband">
        <button
          className="button primary"
          disabled={busyAction !== null}
          onClick={() => runAction("generate", "/api/admin/generate-rfc", {})}
        >
          {busyAction === "generate" ? "Generating..." : "Generate RFC"}
        </button>
        <button
          className="button"
          disabled={busyAction !== null}
          onClick={() => runAction("branch", "/api/admin/create-branch", {})}
        >
          {busyAction === "branch" ? "Creating..." : "Create Demo Branch"}
        </button>
        <button
          className="button"
          disabled={busyAction !== null}
          onClick={() => runAction("refresh", "/api/admin/snapshot")}
        >
          Refresh
        </button>
      </section>

      {snapshot.seedLoaded ? (
        <section className="result-panel">
          <h2>Local Seed Loaded</h2>
          <p>
            The console is showing `.evofork/demo-seed.json` because the local API has no
            matching demo records yet.
          </p>
        </section>
      ) : null}

      {result ? (
        <section className="result-panel">
          <h2>Latest Action</h2>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </section>
      ) : null}

      <section className="content-grid">
        <Panel title="Governance">
          <div className="status-list">
            <StatusItem
              label="Data Source"
              value={governance.source}
              detail={governance.sourceDetail}
              tone={snapshot.apiAvailable ? "good" : snapshot.seedLoaded ? "warn" : "neutral"}
            />
            <StatusItem
              label="Eval Gate"
              value={governance.evalStatus}
              detail={governance.evalDetail}
              tone={governance.evalStatus === "failed" ? "warn" : "good"}
            />
            <StatusItem
              label="Policy"
              value={`${governance.policyAllowed} allowed / ${governance.policyBlocked} blocked`}
              detail="audit trail"
              tone={governance.policyBlocked > 0 ? "warn" : "neutral"}
            />
            <StatusItem
              label="Rollback"
              value={governance.rollbackStatus}
              detail={`${governance.rollbackCount} reverted`}
              tone={governance.rollbackCount > 0 ? "warn" : "neutral"}
            />
          </div>
        </Panel>

        <Panel title="Feedback">
          {snapshot.signals.length === 0 ? (
            <p className="empty">No feedback yet. Submit feedback from the pricing page.</p>
          ) : (
            snapshot.signals.map((signal) => (
              <article className="row" key={signal.id}>
                <strong>{signal.signalType}</strong>
                <span>{signal.text ?? signal.summary ?? "No text"}</span>
                <small>{signal.surfaceId}</small>
              </article>
            ))
          )}
        </Panel>

        <Panel title="RFCs">
          <p className="empty">
            RFC generation is deterministic in mock mode. Use Generate RFC to preview the
            structured RFC before creating a branch.
          </p>
        </Panel>

        <Panel title="Branches">
          {snapshot.branches.length === 0 ? (
            <p className="empty">No branches yet.</p>
          ) : (
            snapshot.branches.map((branch) => {
              const evalSummary = readEvalSummary(branch.evalReport);

              return (
                <article className="row branch-row" key={branch.id}>
                  <div>
                    <strong>{branch.branchName}</strong>
                    <span>
                      {branch.status} · rollout {branch.rolloutPercentage}%
                    </span>
                    {evalSummary ? <small>{formatEvalSummary(evalSummary)}</small> : null}
                  </div>
                  {branch.status === "active" || branch.status === "canary" ? (
                    <button
                      className="button small"
                      disabled={busyAction !== null}
                      onClick={() =>
                        runAction("revert", "/api/admin/revert-branch", {
                          id: branch.id
                        })
                      }
                    >
                      Revert
                    </button>
                  ) : null}
                </article>
              );
            })
          )}
        </Panel>

        <Panel title="Audit Logs">
          {snapshot.auditLogs.length === 0 ? (
            <p className="empty">No audit logs yet.</p>
          ) : (
            snapshot.auditLogs.map((log) => (
              <article className="row" key={log.id}>
                <strong>{log.event}</strong>
                <span>{log.actor}</span>
                <small>{log.resourceId}</small>
                {formatAuditPayload(log.payload) ? (
                  <span className="audit-meta">{formatAuditPayload(log.payload)}</span>
                ) : null}
              </article>
            ))
          )}
        </Panel>
      </section>
    </main>
  );
}

type StatusTone = "good" | "warn" | "neutral";

function HeaderBlock() {
  return (
    <div>
      <p className="eyebrow">Local control plane</p>
      <h1>Feedback, RFCs, branches, and rollback.</h1>
      <p>
        This console runs against the local API server and mock LLM path. No
        production credentials are required.
      </p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusItem({
  label,
  value,
  detail,
  tone
}: {
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
}) {
  return (
    <div className="status-item">
      <span className={`status-dot ${tone}`} aria-hidden="true" />
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
        <span>{detail}</span>
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <h2>{title}</h2>
      <div className="panel-body">{children}</div>
    </section>
  );
}

type EvalSummary = {
  status: string;
  recommendation?: string;
  failures: string[];
};

function summarizeGovernance(snapshot: AdminSnapshot, result: DemoActionResult | null) {
  const evalSummary =
    readEvalSummary(result?.evalReport) ??
    snapshot.branches.map((branch) => readEvalSummary(branch.evalReport)).find(Boolean);
  const policyAllowed = snapshot.auditLogs.filter((log) => log.event === "policy_allowed").length;
  const policyBlocked = snapshot.auditLogs.filter((log) => log.event === "policy_blocked").length;
  const rollbackCount = snapshot.branches.filter((branch) => branch.status === "reverted").length;
  const rollbackReady = snapshot.branches.some(
    (branch) => branch.status === "active" || branch.status === "canary"
  );

  return {
    source: snapshot.apiAvailable ? "API" : snapshot.seedLoaded ? "Local seed" : "Offline",
    sourceDetail: snapshot.seedLoaded
      ? ".evofork/demo-seed.json"
      : snapshot.apiAvailable
        ? "127.0.0.1:3333"
        : "waiting for local data",
    evalStatus: evalSummary?.status ?? "pending",
    evalDetail:
      evalSummary?.recommendation ??
      (evalSummary?.failures.length ? evalSummary.failures.join(", ") : "no report yet"),
    policyAllowed,
    policyBlocked,
    rollbackCount,
    rollbackStatus: rollbackReady ? "available" : rollbackCount > 0 ? "completed" : "idle"
  };
}

function readEvalSummary(value: unknown): EvalSummary | undefined {
  if (!isRecord(value) || typeof value.status !== "string") {
    return undefined;
  }

  const recommendation = typeof value.recommendation === "string" ? value.recommendation : "";

  return {
    status: value.status,
    failures: Array.isArray(value.failures)
      ? value.failures.filter((failure): failure is string => typeof failure === "string")
      : [],
    ...(recommendation ? { recommendation } : {})
  };
}

function formatEvalSummary(summary: EvalSummary | undefined): string {
  if (!summary) {
    return "";
  }

  return `Eval ${summary.status}${
    summary.recommendation ? ` · ${summary.recommendation}` : ""
  }`;
}

function formatAuditPayload(payload: Record<string, unknown> | undefined): string {
  if (!payload) {
    return "";
  }

  const parts = [
    readPayloadString(payload, "status"),
    readPayloadNumber(payload, "rolloutPercentage", "%"),
    readPayloadString(payload, "action"),
    readPayloadString(payload, "reason")
  ].filter(Boolean);

  return parts.join(" · ");
}

function readPayloadString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];

  return typeof value === "string" ? value : "";
}

function readPayloadNumber(
  payload: Record<string, unknown>,
  key: string,
  suffix: string
): string {
  const value = payload[key];

  return typeof value === "number" ? `${value}${suffix}` : "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
