import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

export type GitContext = {
  cwd: string;
  branch: string;
  remote: string | null;
  head: string;
  base: string;
  rangeLabel: string;
  status: string;
  log: string;
  diffStat: string;
  diff: string;
  changedFiles: string[];
  fileSnippets: { path: string; content: string; truncated: boolean }[];
  tree: string;
};

export type CollectOptions = {
  cwd?: string;
  base?: string; // e.g. main, origin/main, HEAD~5
  maxFiles?: number;
  maxBytesPerFile?: number;
  maxDiffBytes?: number;
};

function run(cwd: string, args: string[], allowFail = false): string {
  try {
    return execFileSync("git", args, {
      cwd,
      encoding: "utf8",
      maxBuffer: 8 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  } catch (err) {
    if (allowFail) return "";
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`git ${args.join(" ")} failed: ${msg}`);
  }
}

function isGitRepo(cwd: string): boolean {
  try {
    run(cwd, ["rev-parse", "--is-inside-work-tree"]);
    return true;
  } catch {
    return false;
  }
}

function detectBase(cwd: string, preferred?: string): string {
  if (preferred) {
    const ok = run(cwd, ["rev-parse", "--verify", preferred], true);
    if (ok) return preferred;
  }
  for (const candidate of ["origin/main", "main", "origin/master", "master", "HEAD~10"]) {
    const ok = run(cwd, ["rev-parse", "--verify", candidate], true);
    if (ok) return candidate;
  }
  return "HEAD~1";
}

function listChangedFiles(cwd: string, base: string): string[] {
  const names = run(cwd, ["diff", "--name-only", `${base}...HEAD`], true);
  const unstaged = run(cwd, ["diff", "--name-only"], true);
  const staged = run(cwd, ["diff", "--name-only", "--cached"], true);
  const untracked = run(cwd, ["ls-files", "--others", "--exclude-standard"], true);
  const set = new Set<string>();
  for (const block of [names, unstaged, staged, untracked]) {
    for (const line of block.split("\n")) {
      const t = line.trim();
      if (t) set.add(t);
    }
  }
  return [...set];
}

const SKIP_EXT = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".gz",
  ".tar",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".mp4",
  ".mp3",
  ".lock",
]);

function shouldRead(path: string): boolean {
  const lower = path.toLowerCase();
  if (lower.includes("node_modules/") || lower.includes(".git/")) return false;
  if (lower.endsWith("package-lock.json") || lower.endsWith("pnpm-lock.yaml")) return false;
  const dot = lower.lastIndexOf(".");
  if (dot >= 0 && SKIP_EXT.has(lower.slice(dot))) return false;
  return true;
}

function readSnippet(
  cwd: string,
  relPath: string,
  maxBytes: number
): { path: string; content: string; truncated: boolean } | null {
  const abs = resolve(cwd, relPath);
  if (!existsSync(abs)) return null;
  try {
    const st = statSync(abs);
    if (!st.isFile() || st.size === 0) return null;
    if (st.size > maxBytes * 4) {
      // huge file — read head only
      const buf = readFileSync(abs, { encoding: "utf8" }).slice(0, maxBytes);
      return { path: relPath, content: buf, truncated: true };
    }
    let content = readFileSync(abs, "utf8");
    let truncated = false;
    if (content.length > maxBytes) {
      content = content.slice(0, maxBytes);
      truncated = true;
    }
    return { path: relPath, content, truncated };
  } catch {
    return null;
  }
}

function shortTree(cwd: string): string {
  // Prefer tracked tree shallow listing
  const out = run(cwd, ["ls-tree", "-r", "--name-only", "HEAD"], true);
  if (!out) return "(empty tree)";
  const lines = out.split("\n").filter(Boolean);
  if (lines.length <= 80) return lines.join("\n");
  const head = lines.slice(0, 60);
  const tail = lines.slice(-10);
  return [...head, `… (${lines.length - 70} more paths) …`, ...tail].join("\n");
}

/**
 * Collect git-aware context for handoff generation.
 * Caps keep COGS sane — never dump whole monorepos to Sonnet.
 */
export function collectGitContext(opts: CollectOptions = {}): GitContext {
  const cwd = resolve(opts.cwd ?? process.cwd());
  if (!isGitRepo(cwd)) {
    throw new Error(`Not a git repository: ${cwd}`);
  }

  const maxFiles = opts.maxFiles ?? 12;
  const maxBytesPerFile = opts.maxBytesPerFile ?? 6_000;
  const maxDiffBytes = opts.maxDiffBytes ?? 40_000;

  const branch = run(cwd, ["rev-parse", "--abbrev-ref", "HEAD"], true) || "HEAD";
  const head = run(cwd, ["rev-parse", "--short", "HEAD"], true) || "unknown";
  const remote = run(cwd, ["config", "--get", "remote.origin.url"], true) || null;
  const base = detectBase(cwd, opts.base);
  const rangeLabel = `${base}...HEAD`;

  const status = run(cwd, ["status", "--short"], true) || "(clean)";
  const log =
    run(cwd, ["log", "--oneline", "-n", "15", `${base}..HEAD`], true) ||
    run(cwd, ["log", "--oneline", "-n", "10"], true) ||
    "(no commits)";

  let diffStat = run(cwd, ["diff", "--stat", `${base}...HEAD`], true);
  if (!diffStat) {
    diffStat =
      run(cwd, ["diff", "--stat", "HEAD"], true) ||
      run(cwd, ["diff", "--stat", "--cached"], true) ||
      "(no diff)";
  }

  let diff = run(cwd, ["diff", `${base}...HEAD`], true);
  if (!diff) {
    diff = run(cwd, ["diff", "HEAD"], true) || run(cwd, ["diff", "--cached"], true) || "";
  }
  let diffTruncated = false;
  if (diff.length > maxDiffBytes) {
    diff = diff.slice(0, maxDiffBytes);
    diffTruncated = true;
  }
  if (diffTruncated) {
    diff += "\n\n… [diff truncated for context budget] …\n";
  }
  if (!diff) diff = "(no textual diff — untracked-only or binary changes)";

  const changedFiles = listChangedFiles(cwd, base);
  const fileSnippets: GitContext["fileSnippets"] = [];
  for (const f of changedFiles) {
    if (fileSnippets.length >= maxFiles) break;
    if (!shouldRead(f)) continue;
    const snip = readSnippet(cwd, f, maxBytesPerFile);
    if (snip) fileSnippets.push(snip);
  }

  // If no changes, sample a few root docs so handoff still works on clean tree
  if (fileSnippets.length === 0) {
    for (const guess of ["README.md", "CLAUDE.md", "package.json", "PROMPT.md"]) {
      const snip = readSnippet(cwd, guess, maxBytesPerFile);
      if (snip) fileSnippets.push(snip);
      if (fileSnippets.length >= 3) break;
    }
  }

  return {
    cwd,
    branch,
    remote,
    head,
    base,
    rangeLabel,
    status,
    log,
    diffStat,
    diff,
    changedFiles,
    fileSnippets,
    tree: shortTree(cwd),
  };
}

export function formatContextForPrompt(ctx: GitContext): string {
  const filesBlock = ctx.fileSnippets
    .map((f) => {
      const mark = f.truncated ? " (truncated)" : "";
      return `### ${f.path}${mark}\n\`\`\`\n${f.content}\n\`\`\``;
    })
    .join("\n\n");

  return [
    `## Repository`,
    `- cwd: ${ctx.cwd}`,
    `- branch: ${ctx.branch}`,
    `- HEAD: ${ctx.head}`,
    `- base: ${ctx.base} (${ctx.rangeLabel})`,
    `- remote: ${ctx.remote ?? "(none)"}`,
    ``,
    `## Status`,
    "```",
    ctx.status,
    "```",
    ``,
    `## Recent commits (${ctx.rangeLabel})`,
    "```",
    ctx.log,
    "```",
    ``,
    `## Diff stat`,
    "```",
    ctx.diffStat,
    "```",
    ``,
    `## Changed files`,
    ctx.changedFiles.length
      ? ctx.changedFiles.map((f) => `- ${f}`).join("\n")
      : "(none detected)",
    ``,
    `## Diff (capped)`,
    "```diff",
    ctx.diff,
    "```",
    ``,
    `## File snippets`,
    filesBlock || "(none)",
    ``,
    `## Tree sample`,
    "```",
    ctx.tree,
    "```",
  ].join("\n");
}

export function defaultOutPath(cwd: string, kind: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return join(cwd, `.devflow`, `${kind}-${stamp}.md`);
}

export function repoName(ctx: GitContext): string {
  if (ctx.remote) {
    const m = ctx.remote.match(/\/([^/]+?)(?:\.git)?$/);
    if (m) return m[1];
  }
  return relative(resolve(ctx.cwd, ".."), ctx.cwd) || "repo";
}
