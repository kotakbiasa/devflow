export type KillMetricEvent = {
    ts: string;
    event: "cli_run" | "artifact_written" | "offline_fallback" | "api_error" | "landing_waitlist" | "landing_wtp" | "beta_invite" | "beta_artifact_shared";
    command?: string;
    audience?: string;
    offline?: boolean;
    model?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
    outPath?: string;
    repo?: string;
    emailHash?: string;
    wtp?: string | null;
    source?: string;
    note?: string;
};
export declare function track(event: KillMetricEvent): void;
/** Kill criteria counters — see docs/ceo/cycle2-go-nogo.md */
export declare const KILL_CRITERIA: {
    readonly windowDays: 14;
    readonly landing: {
        readonly minVisitorsPass: 300;
        readonly minVisitorsFail: 100;
        readonly waitlistCvrPass: 0.08;
        readonly waitlistCvrFail: 0.03;
        readonly wtpGe9Pass: 0.25;
        readonly wtpGe9Fail: 0.1;
        readonly qualitativeHandoffMin: 5;
    };
    readonly beta: {
        readonly seats: 10;
        readonly minSharedArtifacts: 3;
    };
    readonly finance: {
        readonly minProContributionMargin: 0.5;
    };
};
