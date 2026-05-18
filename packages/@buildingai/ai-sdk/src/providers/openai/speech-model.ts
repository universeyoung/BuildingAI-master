import type { SpeechModelV3 } from "@ai-sdk/provider";

import type { OpenAIProviderSettings } from "./index";

export function createOpenAISpeechModel(
    settings: OpenAIProviderSettings,
    modelId: string,
): SpeechModelV3 {
    return {
        specificationVersion: "v3",
        provider: "openai",
        modelId,
        async doGenerate(options: Parameters<SpeechModelV3["doGenerate"]>[0]) {
            const response = await fetch(`${settings.baseURL}/audio/speech`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization:
                        settings?.apiKey && settings?.apiKey.includes("Bearer ")
                            ? settings.apiKey
                            : settings?.apiKey && settings?.apiKey.includes("Bearer ")
                              ? settings.apiKey
                              : `Bearer ${settings.apiKey}`,
                    ...settings.headers,
                },
                body: JSON.stringify({
                    model: modelId,
                    input: options.text,
                    voice: options.voice ?? "alloy",
                    speed: options.speed ?? 1,
                    response_format: options.outputFormat ?? "mp3",
                }),
            });
            if (!response.ok) {
                const error = await response.text();
                throw new Error(`OpenAI TTS 请求失败: ${response.status} ${error}`);
            }
            const audio = await response.arrayBuffer();
            return {
                audio: new Uint8Array(audio),
                format: options.outputFormat ?? "mp3",
                warnings: [],
                response: { timestamp: new Date(), modelId, headers: undefined },
                providerMetadata: {},
            };
        },
    };
}
