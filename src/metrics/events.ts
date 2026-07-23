import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export type KillMetricEvent = {
  ts: string;
  event:
    | "cli_run"
    | "artifact_written"
    | "offline_fallback"
    | "api_error"
    | "landing_waitlist"
    | "landing_wtp"
    | "beta_invite"
    | "beta_artifact_shared";
  command?: string;
  audience?: string;
  offline?: boolean;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  outPath?: string;
  repo?: string;
  // landing / beta
  emailHash?: string;
  wtp?: string | null;
  source?: string;
  note?: string;
};

function metricsPath(): string {
  // Prefer project-local metrics when running inside monorepo package
  const local = join(process.cwd(), "metrics", "events.jsonl");
  const home = join(homedir(), ".devflow", "metrics", "events.jsonl");
  // If cwd looks like devflow package or monorepo, use local
  if (
    existsSync(join(process.cwd(), "package.json")) ||
    existsSync(join(process.cwd(), "metrics"))
  ) {
    return local;
  }
  return home;
}

export function track(event: KillMetricEvent): void {
  try {
    const path = metricsPath();
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(event) + "\n", "utf8");
  } catch {
    // never break CLI for metrics
  }
}

/** Kill criteria counters — see docs/ceo/cycle2-go-nogo.md */
export const KILL_CRITERIA = {
  windowDays: 14,
  landing: {
    minVisitorsPass: 300,
    minVisitorsFail: 100,
    waitlistCvrPass: 0.08,
    waitlistCvrFail: 0.03,
    wtpGe9Pass: 0.25,
    wtpGe9Fail: 0.1,
    qualitativeHandoffMin: 5,
  },
  beta: {
    seats: 10,
    minSharedArtifacts: 3, // of 10 must send artifact to client/colleague
  },
  finance: {
    minProContributionMargin: 0.5,
  },
} as const;
