"use client";

import { useState } from "react";
import type { AdminSnapshot, DemoActionResult } from "../lib/admin-api";

export function AdminConsole({ initialSnapshot }: { initialSnapshot: AdminSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [result, setResult] = useState<DemoActionResult | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

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
            snapshot.branches.map((branch) => (
              <article className="row branch-row" key={branch.id}>
                <div>
                  <strong>{branch.branchName}</strong>
                  <span>
                    {branch.status} · rollout {branch.rolloutPercentage}%
                  </span>
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
            ))
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
              </article>
            ))
          )}
        </Panel>
      </section>
    </main>
  );
}

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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
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
