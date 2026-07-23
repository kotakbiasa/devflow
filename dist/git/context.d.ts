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
    fileSnippets: {
        path: string;
        content: string;
        truncated: boolean;
    }[];
    tree: string;
};
export type CollectOptions = {
    cwd?: string;
    base?: string;
    maxFiles?: number;
    maxBytesPerFile?: number;
    maxDiffBytes?: number;
};
/**
 * Collect git-aware context for handoff generation.
 * Caps keep COGS sane — never dump whole monorepos to Sonnet.
 */
export declare function collectGitContext(opts?: CollectOptions): GitContext;
export declare function formatContextForPrompt(ctx: GitContext): string;
export declare function defaultOutPath(cwd: string, kind: string): string;
export declare function repoName(ctx: GitContext): string;
