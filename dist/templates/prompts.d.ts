export type Audience = "client" | "junior" | "reviewer" | "self" | "future-self";
export declare const AUDIENCES: Audience[];
export declare function normalizeAudience(raw?: string): Audience;
export type CommandKind = "handoff" | "explain" | "pr";
export declare function systemPrompt(kind: CommandKind, audience: Audience): string;
export declare function userPrompt(kind: CommandKind, audience: Audience, contextMarkdown: string, extra?: string): string;
/** Offline fallback when no API key — still produces a useful skeleton from git. */
export declare function offlineArtifact(kind: CommandKind, audience: Audience, meta: {
    repo: string;
    branch: string;
    head: string;
    rangeLabel: string;
    status: string;
    log: string;
    diffStat: string;
    changedFiles: string[];
}): string;
