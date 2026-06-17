import { resolve } from "node:path";
import {
  approveLocalBranch,
  createLocalBranch,
  readOrCreateLocalDemoState,
  revertLocalBranch,
  rolloutLocalBranch,
  writeLocalDemoState
} from "@evofork/branch-registry";
import { runEvalGate } from "@evofork/eval-gate";
import { generateInsightRfc } from "@evofork/insight-worker";
import { findSurface, loadManifest } from "@evofork/manifest-parser";
import { preparePullRequest } from "@evofork/patch-agent";
import { getAdminSnapshot, postApiJson } from "./admin-api";
import { resolveDemoSeedPath } from "./demo-state";

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

  if (!created.ok && created.status === 503) {
    return await createLocalDemoBranch({
      appId: manifest.app.id,
      rfcId: rfc.rfcId,
      branchName: pr.branchName,
      evalReport
    });
  }

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

export async function revertDemoBranch(id: string) {
  const response = await postApiJson(`/v1/branches/${id}/revert`, {
    reason: "Demo rollback requested from admin console.",
    actor: "maintainer"
  });

  if (!response.ok && response.status === 503) {
    return await revertLocalDemoBranch(id);
  }

  return {
    ok: response.status < 400,
    action: "revert_branch",
    response: response.body
  };
}

async function createLocalDemoBranch(input: {
  appId: string;
  rfcId: string;
  branchName: string;
  evalReport: unknown;
}) {
  const seedPath = resolveDemoSeedPath();

  if (!seedPath) {
    return {
      ok: false,
      action: "create_demo_branch",
      error: "Local demo seed state is disabled in production without EVOFORK_DEMO_SEED_PATH"
    };
  }

  const state = await readOrCreateLocalDemoState(seedPath, {
    appId: input.appId,
    surfaceId
  });
  const created = createLocalBranch(state, {
    appId: input.appId,
    surfaceId,
    rfcId: input.rfcId,
    branchName: input.branchName,
    gitBranch: `evofork/${input.branchName}`,
    targetSegments: {
      lifecycle_stage: "new_user",
      company_size: ["1-10", "11-50"]
    },
    priority: 10,
    evalReport: input.evalReport,
    actor: "codex"
  });
  const approved = approveLocalBranch(state, created.branch.id, "maintainer");
  const rollout = rolloutLocalBranch(state, approved.branch.id, 100, "maintainer");

  await writeLocalDemoState(state);

  return {
    ok: true,
    action: "create_demo_branch",
    branch: rollout.branch,
    response: {
      localStatePath: seedPath,
      auditLog: rollout.auditLog
    }
  };
}

async function revertLocalDemoBranch(id: string) {
  const seedPath = resolveDemoSeedPath();

  if (!seedPath) {
    return {
      ok: false,
      action: "revert_branch",
      error: "Local demo seed state is disabled in production without EVOFORK_DEMO_SEED_PATH"
    };
  }

  const state = await readOrCreateLocalDemoState(seedPath, {
    appId: "demo-saas",
    surfaceId
  });
  const reverted = revertLocalBranch(
    state,
    id,
    "Demo rollback requested from admin console.",
    "maintainer"
  );

  await writeLocalDemoState(state);

  return {
    ok: true,
    action: "revert_branch",
    response: {
      branch: reverted.branch,
      localStatePath: seedPath,
      auditLog: reverted.auditLog
    }
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
