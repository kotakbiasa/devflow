import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { collectGitContext, defaultOutPath, formatContextForPrompt, repoName, } from "../git/context.js";
import { AUDIENCES, normalizeAudience, offlineArtifact, systemPrompt, userPrompt, } from "../templates/prompts.js";
import { generateMarkdown, resolveApiKey, DEFAULT_MODEL } from "../llm/anthropic.js";
import { track } from "../metrics/events.js";
const VERSION = "0.1.0";
function printHelp() {
    console.log(`
DevFlow v${VERSION} — portable handoff / shipping artifacts from git

Usage:
  devflow <command> [options]

Commands:
  handoff     Write a durable handoff packet (.md) for the next human
  explain     Alias of handoff (walkthrough artifact, not chat)
  pr          Write a PR walkthrough narrative (.md)
  init        Create .devflow/ config stub
  version     Print version
  help        Show this help

Options:
  --audience, -a   client | junior | reviewer | self | future-self  (default: reviewer)
  --out, -o        Output markdown path
  --base, -b       Git base ref (default: origin/main|main|HEAD~10)
  --cwd            Repository path (default: .)
  --model          Anthropic model id (default: ${DEFAULT_MODEL})
  --extra, -e      Extra free-text instructions for the model
  --offline        Force offline skeleton (no API call)
  --dry-run        Print markdown to stdout; do not write file
  --json           Emit machine-readable result summary on stderr/stdout

Environment:
  ANTHROPIC_API_KEY   BYOK key (required for AI narrative; offline works without)
  DEVFLOW_MODEL       Override default model
  DEVFLOW_API_KEY     Alias of ANTHROPIC_API_KEY

Examples:
  export ANTHROPIC_API_KEY=sk-ant-...
  devflow handoff -a client -o HANDOFF.md
  devflow pr --base origin/main
  devflow explain -a junior --offline

Differentiation: output is a file you commit/share — useful when Cursor is closed.
`.trim());
}
function parseArgs(argv) {
    const args = {
        command: "help",
        audience: "reviewer",
        cwd: process.cwd(),
        offline: false,
        dryRun: false,
        json: false,
    };
    if (argv.length === 0)
        return args;
    args.command = argv[0];
    for (let i = 1; i < argv.length; i++) {
        const a = argv[i];
        const next = () => argv[++i];
        switch (a) {
            case "--audience":
            case "-a":
                args.audience = next() ?? args.audience;
                break;
            case "--out":
            case "-o":
                args.out = next();
                break;
            case "--base":
            case "-b":
                args.base = next();
                break;
            case "--cwd":
                args.cwd = resolve(next() ?? ".");
                break;
            case "--model":
                args.model = next();
                break;
            case "--extra":
            case "-e":
                args.extra = next();
                break;
            case "--offline":
                args.offline = true;
                break;
            case "--dry-run":
                args.dryRun = true;
                break;
            case "--json":
                args.json = true;
                break;
            case "--help":
            case "-h":
                args.command = "help";
                break;
            default:
                if (a.startsWith("-")) {
                    console.error(`Unknown option: ${a}`);
                }
        }
    }
    return args;
}
function kindFromCommand(cmd) {
    if (cmd === "handoff" || cmd === "explain")
        return cmd === "explain" ? "explain" : "handoff";
    if (cmd === "pr")
        return "pr";
    return null;
}
async function runArtifact(args) {
    const kind = kindFromCommand(args.command);
    if (!kind) {
        printHelp();
        return 1;
    }
    const audience = normalizeAudience(args.audience);
    const started = Date.now();
    track({
        ts: new Date().toISOString(),
        event: "cli_run",
        command: kind,
        audience,
        offline: args.offline,
    });
    let ctx;
    try {
        ctx = collectGitContext({ cwd: args.cwd, base: args.base });
    }
    catch (err) {
        console.error(`Error: ${err instanceof Error ? err.message : err}`);
        return 1;
    }
    const outPath = resolve(args.out ?? defaultOutPath(ctx.cwd, kind));
    const apiKey = resolveApiKey();
    const forceOffline = args.offline || !apiKey;
    let body;
    let model = null;
    let inputTokens = null;
    let outputTokens = null;
    if (forceOffline) {
        if (!apiKey && !args.offline) {
            console.error("No ANTHROPIC_API_KEY — writing offline skeleton (BYOK).");
        }
        body = offlineArtifact(kind, audience, {
            repo: repoName(ctx),
            branch: ctx.branch,
            head: ctx.head,
            rangeLabel: ctx.rangeLabel,
            status: ctx.status,
            log: ctx.log,
            diffStat: ctx.diffStat,
            changedFiles: ctx.changedFiles,
        });
        track({
            ts: new Date().toISOString(),
            event: "offline_fallback",
            command: kind,
            audience,
            offline: true,
            repo: repoName(ctx),
        });
    }
    else {
        try {
            const contextMd = formatContextForPrompt(ctx);
            const result = await generateMarkdown({
                apiKey: apiKey,
                model: args.model,
                system: systemPrompt(kind, audience),
                user: userPrompt(kind, audience, contextMd, args.extra),
            });
            body = result.text;
            model = result.model;
            inputTokens = result.inputTokens;
            outputTokens = result.outputTokens;
        }
        catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            console.error(`API error: ${msg}`);
            track({
                ts: new Date().toISOString(),
                event: "api_error",
                command: kind,
                audience,
                note: msg.slice(0, 200),
            });
            console.error("Falling back to offline skeleton.");
            body = offlineArtifact(kind, audience, {
                repo: repoName(ctx),
                branch: ctx.branch,
                head: ctx.head,
                rangeLabel: ctx.rangeLabel,
                status: ctx.status,
                log: ctx.log,
                diffStat: ctx.diffStat,
                changedFiles: ctx.changedFiles,
            });
        }
    }
    const header = [
        `<!--`,
        `  Generated by DevFlow v${VERSION}`,
        `  kind: ${kind}`,
        `  audience: ${audience}`,
        `  repo: ${repoName(ctx)}`,
        `  branch: ${ctx.branch}`,
        `  head: ${ctx.head}`,
        `  range: ${ctx.rangeLabel}`,
        `  model: ${model ?? "offline"}`,
        `  created: ${new Date().toISOString()}`,
        `-->`,
        ``,
    ].join("\n");
    const markdown = header + body + "\n";
    if (args.dryRun) {
        process.stdout.write(markdown);
    }
    else {
        mkdirSync(dirname(outPath), { recursive: true });
        writeFileSync(outPath, markdown, "utf8");
        console.error(`Wrote ${outPath}`);
    }
    track({
        ts: new Date().toISOString(),
        event: "artifact_written",
        command: kind,
        audience,
        offline: forceOffline || model === null,
        model,
        inputTokens,
        outputTokens,
        outPath: args.dryRun ? undefined : outPath,
        repo: repoName(ctx),
    });
    if (args.json) {
        console.log(JSON.stringify({
            ok: true,
            kind,
            audience,
            outPath: args.dryRun ? null : outPath,
            offline: forceOffline || model === null,
            model,
            inputTokens,
            outputTokens,
            ms: Date.now() - started,
            changedFiles: ctx.changedFiles.length,
        }, null, 2));
    }
    else if (!args.dryRun) {
        console.error(`DevFlow ${kind} · audience=${audience} · ${forceOffline || !model ? "offline" : model} · ${Date.now() - started}ms`);
    }
    return 0;
}
function runInit(cwd) {
    const dir = resolve(cwd, ".devflow");
    mkdirSync(dir, { recursive: true });
    const cfg = resolve(dir, "config.json");
    if (!existsSync(cfg)) {
        writeFileSync(cfg, JSON.stringify({
            defaultAudience: "reviewer",
            defaultBase: null,
            model: null,
            note: "DevFlow local config. Prefer env ANTHROPIC_API_KEY for BYOK.",
        }, null, 2) + "\n");
        console.error(`Created ${cfg}`);
    }
    else {
        console.error(`Already exists: ${cfg}`);
    }
    const gitignore = resolve(dir, ".gitignore");
    if (!existsSync(gitignore)) {
        writeFileSync(gitignore, "cache/\n*.local.md\n");
    }
    return 0;
}
async function main() {
    const args = parseArgs(process.argv.slice(2));
    switch (args.command) {
        case "help":
        case "--help":
        case "-h":
            printHelp();
            process.exit(0);
            break;
        case "version":
        case "--version":
        case "-v":
            console.log(VERSION);
            process.exit(0);
            break;
        case "init":
            process.exit(runInit(args.cwd));
            break;
        case "handoff":
        case "explain":
        case "pr":
            process.exit(await runArtifact(args));
            break;
        default:
            console.error(`Unknown command: ${args.command}\n`);
            printHelp();
            process.exit(1);
    }
}
main().catch((err) => {
    console.error(err);
    process.exit(1);
});
// silence unused import in some builds
void readFileSync;
void AUDIENCES;
