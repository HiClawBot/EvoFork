import { resolve } from "node:path";
import { runEvalGate } from "@evofork/eval-gate";
import { generateInsightRfc } from "@evofork/insight-worker";
import { findSurface, loadManifest } from "@evofork/manifest-parser";
import { preparePullRequest } from "@evofork/patch-agent";
import { getAdminSnapshot, postApiJson } from "./admin-api";

const surfaceId = "pricing.hero";

export async function generateDemoRfc() {
  const manifest = await loadRepoManifest();
  const surface = findSurface(manifest, surfaceId);

  if (!surface) {
    throw new Error(`Surface not found: ${surfaceId}`);
  }

  const snapshot = await getAdminSnapshot();

  return generateInsightRfc({
    appId: manifest.app.id,
    surface,
    signals:
      snapshot.signals.length > 0
        ? snapshot.signals.map((signal) => ({
            ...signal,
            source: "admin_console",
            evidenceCount: 1,
            segmentHints: {},
            piiRemoved: true,
            llmEligible: true,
            createdAt: new Date().toISOString()
          }))
        : [
            {
              id: "demo_signal_001",
              appId: manifest.app.id,
              surfaceId,
              source: "admin_console",
              signalType: "confusion",
              text: "I do not understand the difference between Basic and Pro.",
              evidenceCount: 1,
              segmentHints: {
                lifecycle_stage: "new_user",
                company_size: "1-10"
              },
              piiRemoved: true,
              llmEligible: true,
              createdAt: new Date().toISOString()
            }
          ]
  });
}

export async function createDemoBranch() {
  const manifest = await loadRepoManifest();
  const rfc = await generateDemoRfc();
  const pr = preparePullRequest({
    manifest,
    rfc,
    surfaceId
  });
  const evalReport = runEvalGate({
    manifest,
    surfaceId,
    changedFiles: pr.changedFiles
  });

  if (evalReport.status !== "passed") {
    return {
      ok: false,
      action: "create_demo_branch",
      rfc,
      pr,
      evalReport
    };
  }

  const created = await postApiJson("/v1/branches", {
    appId: manifest.app.id,
    surfaceId,
    rfcId: rfc.rfcId,
    branchName: pr.branchName,
    gitBranch: `evofork/${pr.branchName}`,
    targetSegments: {
      lifecycle_stage: "new_user",
      company_size: ["1-10", "11-50"]
    },
    rolloutPercentage: 0,
    priority: 10,
    evalReport,
    createdBy: "codex"
  });
  const branch = extractBranch(created.body);

  if (!created.ok || !branch?.id) {
    return {
      ok: false,
      action: "create_demo_branch",
      rfc,
      pr,
      evalReport,
      response: created.body
    };
  }

  await postApiJson(`/v1/branches/${branch.id}/approve`, {
    actor: "maintainer"
  });
  const rollout = await postApiJson(`/v1/branches/${branch.id}/rollout`, {
    percentage: 100,
    actor: "maintainer"
  });

  return {
    ok: rollout.ok,
    action: "create_demo_branch",
    rfc,
    pr,
    evalReport,
    branch: rollout.body
  };
}

async function loadRepoManifest() {
  return loadManifest(resolve(process.cwd(), "../../evo.manifest.yaml"));
}

function extractBranch(body: unknown): { id?: string } | undefined {
  if (!body || typeof body !== "object" || !("branch" in body)) {
    return undefined;
  }

  const branch = (body as { branch?: unknown }).branch;

  return branch && typeof branch === "object" ? (branch as { id?: string }) : undefined;
}
