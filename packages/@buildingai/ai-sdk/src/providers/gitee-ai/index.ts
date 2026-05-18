import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModelV3, SpeechModelV3, TranscriptionModelV3 } from "@ai-sdk/provider";

import type { AIProvider, BaseProviderSettings, ProviderModelInfo } from "../../types";
import { fetchProviderModels } from "../../utils/fetch-models";
import { createGiteeSpeechModel } from "./speech-model";
import { createGiteeTranscriptionModel } from "./transcription-model";

export interface GiteeAIProviderSettings extends BaseProviderSettings {}

class GiteeAIProviderImpl implements AIProvider {
    readonly id = "gitee_ai";
    readonly name = "Gitee AI";

    private baseProvider: ReturnType<typeof createOpenAICompatible>;
    private settings: GiteeAIProviderSettings;

    constructor(settings: GiteeAIProviderSettings = {}) {
        this.settings = settings;
        this.baseProvider = createOpenAICompatible({
            name: "gitee_ai",
            baseURL: settings.baseURL || "https://ai.gitee.com/v1",
            headers: {
                Authorization:
                    settings?.apiKey && settings?.apiKey.includes("Bearer ")
                        ? settings.apiKey
                        : settings?.apiKey && settings?.apiKey.includes("Bearer ")
                          ? settings.apiKey
                          : `Bearer ${settings.apiKey}`,
                ...settings.headers,
            },
        });
    }

    languageModel(modelId: string): LanguageModelV3 {
        return this.baseProvider.languageModel(modelId);
    }

    speech(modelId: string): SpeechModelV3 {
        return createGiteeSpeechModel(this.settings, modelId);
    }

    transcription(modelId: string): TranscriptionModelV3 {
        return createGiteeTranscriptionModel(this.settings, modelId);
    }

    async listModels(): Promise<ProviderModelInfo[]> {
        return fetchProviderModels({
            ...this.settings,
            baseURL: this.settings.baseURL || "https://ai.gitee.com/v1",
        });
    }
}

export function giteeAi(settings: GiteeAIProviderSettings = {}): AIProvider {
    return new GiteeAIProviderImpl(settings);
}
