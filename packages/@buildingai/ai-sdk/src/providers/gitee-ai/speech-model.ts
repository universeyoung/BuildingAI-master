import type { SpeechModelV3 } from "@ai-sdk/provider";

import type { GiteeAIProviderSettings } from "./index";

export function createGiteeSpeechModel(
    settings: GiteeAIProviderSettings,
    modelId: string,
): SpeechModelV3 {
    const baseURL = (settings.baseURL || "https://ai.gitee.com/v1").replace(/\/$/, "");
    const speechURL = `${baseURL}/audio/speech`;

    return {
        specificationVersion: "v3",
        provider: "gitee_ai",
        modelId,
        async doGenerate(options: Parameters<SpeechModelV3["doGenerate"]>[0]) {
            const response = await fetch(speechURL, {
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
                    response_data_format: "blob",
                }),
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`Gitee AI TTS 请求失败: ${response.status} ${err}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const audio = new Uint8Array(arrayBuffer);

            return {
                audio,
                format: "mp3",
                warnings: [],
                response: { timestamp: new Date(), modelId, headers: undefined },
                providerMetadata: {},
            };
        },
    };
}
