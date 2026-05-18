import type {
    EmbeddingModelV3,
    ImageModelV3,
    LanguageModelV3,
    RerankingModelV3,
    SpeechModelV3,
    TranscriptionModelV3,
} from "@ai-sdk/provider";

import { ProviderCapabilityError } from "../errors";
import { getProvider as getProviderFromRegistry } from "../registry";
import type {
    AIProvider,
    BaseProviderSettings,
    ModerationModelV1,
    ProviderCapabilities,
    ProviderCapability,
    ProviderModelInfo,
} from "../types";
import { createCapabilities } from "../types/capabilities";

export interface ProviderModelConfig {
    model: LanguageModelV3;
}

export interface ProviderEmbeddingConfig {
    model: EmbeddingModelV3;
}

export interface ProviderSpeechConfig {
    model: SpeechModelV3;
}

export interface ProviderTranscriptionConfig {
    model: TranscriptionModelV3;
}

export interface ProviderImageConfig {
    model: ImageModelV3;
}

export interface ProviderModerationConfig {
    model: ModerationModelV1;
}

export interface ProviderRerankConfig {
    model: RerankingModelV3;
}

type InferModelType<T extends string> =
    Lowercase<T> extends `${string}rerank${string}`
        ? ProviderRerankConfig
        : Lowercase<T> extends `${string}embed${string}` | `${string}embedding${string}`
          ? ProviderEmbeddingConfig
          : ProviderModelConfig;

export type CallableProvider = Omit<
    AIProvider,
    "image" | "speech" | "transcription" | "moderation" | "rerank"
> & {
    <T extends string>(modelId: T): InferModelType<T>;
    speech(modelId: string): ProviderSpeechConfig;
    transcription(modelId: string): ProviderTranscriptionConfig;
    image(modelId: string): ProviderImageConfig;
    moderation(modelId: string): ProviderModerationConfig;
    rerank(modelId: string): ProviderRerankConfig;
    listModels(): Promise<ProviderModelInfo[]>;
    supports(capability: ProviderCapability): boolean;
    readonly capabilities: ProviderCapabilities;
};

export function getProvider<T extends BaseProviderSettings = BaseProviderSettings>(
    providerName: string,
    settings?: T,
): CallableProvider {
    const provider = getProviderFromRegistry(providerName, settings);
    const caps: ProviderCapability[] = ["language"];
    if (provider.embeddingModel) caps.push("embedding");
    if (provider.speech) caps.push("speech");
    if (provider.transcription) caps.push("transcription");
    if (provider.image) caps.push("image");
    if (provider.moderation) caps.push("moderation");
    if (provider.rerank) caps.push("rerank");
    const capabilities = createCapabilities(caps);

    const createMethod =
        <T>(
            method: keyof AIProvider,
            cap: ProviderCapability,
            getModel: (p: AIProvider, id: string) => T,
        ) =>
        (id: string): { model: T } => {
            if (!provider[method]) throw new ProviderCapabilityError(provider.id, cap);
            return { model: getModel(provider, id) };
        };

    const methods = {
        supports: (c: ProviderCapability) => capabilities.supports(c),
        capabilities,
        listModels: () => (provider.listModels ? provider.listModels() : Promise.resolve([])),
        speech: createMethod("speech", "speech", (p, id) => p.speech!(id)),
        transcription: createMethod("transcription", "transcription", (p, id) =>
            p.transcription!(id),
        ),
        image: createMethod("image", "image", (p, id) => p.image!(id)),
        moderation: createMethod("moderation", "moderation", (p, id) => p.moderation!(id)),
        rerank: createMethod("rerank", "rerank", (p, id) => p.rerank!(id)),
    };

    return new Proxy(
        (modelId: string): ProviderModelConfig | ProviderEmbeddingConfig | ProviderRerankConfig => {
            const lower = modelId.toLowerCase();
            if (provider.rerank && lower.includes("rerank"))
                return { model: provider.rerank(modelId) } as ProviderRerankConfig;
            if (provider.embeddingModel && (lower.includes("embed") || lower.includes("embedding")))
                return { model: provider.embeddingModel(modelId) } as ProviderEmbeddingConfig;
            return { model: provider.languageModel(modelId) } as ProviderModelConfig;
        },
        {
            get: (target, prop) => {
                if (prop in methods) return methods[prop as keyof typeof methods];
                if (prop in provider) {
                    const v = (provider as unknown as Record<string, unknown>)[prop as string];
                    return typeof v === "function" ? v.bind(provider) : v;
                }
                return (target as unknown as Record<string, unknown>)[prop as string];
            },
            has: (target, prop) => prop in methods || prop in provider || prop in target,
            ownKeys: () => [...Object.keys(provider), ...Object.keys(methods)],
            getOwnPropertyDescriptor: (target, prop) =>
                prop in provider
                    ? Object.getOwnPropertyDescriptor(provider, prop)
                    : Object.getOwnPropertyDescriptor(target, prop),
        },
    ) as CallableProvider;
}

export function getProviderForText<T extends BaseProviderSettings = BaseProviderSettings>(
    providerName: string,
    settings?: T,
): (modelId: string) => ProviderModelConfig {
    const provider = getProviderFromRegistry(providerName, settings);
    return (modelId: string): ProviderModelConfig => ({
        model: provider.languageModel(modelId),
    });
}

export function getProviderForEmbedding<T extends BaseProviderSettings = BaseProviderSettings>(
    providerName: string,
    settings?: T,
): (modelId: string) => ProviderEmbeddingConfig {
    const provider = getProviderFromRegistry(providerName, settings);
    if (!provider.embeddingModel) {
        throw new ProviderCapabilityError(providerName, "embedding");
    }
    return (modelId: string): ProviderEmbeddingConfig => ({
        model: provider.embeddingModel!(modelId),
    });
}

export function getProviderForSpeech<T extends BaseProviderSettings = BaseProviderSettings>(
    providerName: string,
    settings?: T,
): (modelId: string) => ProviderSpeechConfig {
    const provider = getProviderFromRegistry(providerName, settings);
    if (!provider.speech) {
        throw new ProviderCapabilityError(providerName, "speech");
    }
    return (modelId: string): ProviderSpeechConfig => ({
        model: provider.speech!(modelId),
    });
}

export function getProviderForTranscription<T extends BaseProviderSettings = BaseProviderSettings>(
    providerName: string,
    settings?: T,
): (modelId: string) => ProviderTranscriptionConfig {
    const provider = getProviderFromRegistry(providerName, settings);
    if (!provider.transcription) {
        throw new ProviderCapabilityError(providerName, "transcription");
    }
    return (modelId: string): ProviderTranscriptionConfig => ({
        model: provider.transcription!(modelId),
    });
}

export function getProviderForImage<T extends BaseProviderSettings = BaseProviderSettings>(
    providerName: string,
    settings?: T,
): (modelId: string) => ProviderImageConfig {
    const provider = getProviderFromRegistry(providerName, settings);
    if (!provider.image) {
        throw new ProviderCapabilityError(providerName, "image");
    }
    return (modelId: string): ProviderImageConfig => ({
        model: provider.image!(modelId),
    });
}

export function getProviderForModeration<T extends BaseProviderSettings = BaseProviderSettings>(
    providerName: string,
    settings?: T,
): (modelId: string) => ProviderModerationConfig {
    const provider = getProviderFromRegistry(providerName, settings);
    if (!provider.moderation) {
        throw new ProviderCapabilityError(providerName, "moderation");
    }
    return (modelId: string): ProviderModerationConfig => ({
        model: provider.moderation!(modelId),
    });
}

export function getProviderForRerank<T extends BaseProviderSettings = BaseProviderSettings>(
    providerName: string,
    settings?: T,
): (modelId: string) => ProviderRerankConfig {
    const provider = getProviderFromRegistry(providerName, settings);
    if (!provider.rerank) {
        throw new ProviderCapabilityError(providerName, "rerank");
    }
    return (modelId: string): ProviderRerankConfig => ({
        model: provider.rerank!(modelId),
    });
}
