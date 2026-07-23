export type GenerateOptions = {
    apiKey: string;
    model?: string;
    system: string;
    user: string;
    maxTokens?: number;
};
export type GenerateResult = {
    text: string;
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
};
/** Default lean model for cost control (Haiku-class). Override with DEVFLOW_MODEL. */
export declare const DEFAULT_MODEL: string;
export declare function generateMarkdown(opts: GenerateOptions): Promise<GenerateResult>;
export declare function resolveApiKey(): string | null;
