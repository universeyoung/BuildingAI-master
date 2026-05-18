import type { SpeechModelV3 } from "@ai-sdk/provider";

import type { SiliconFlowProviderSettings } from "./index";

export function createSiliconflowSpeechModel(
    settings: SiliconFlowProviderSettings,
    modelId: string,
): SpeechModelV3 {
    const baseURL = (settings.baseURL || "https://api.siliconflow.cn/v1").replace(/\/$/, "");
    const speechURL = `${baseURL}/audio/speech`;

    return {
        specificationVersion: "v3",
        provider: "siliconflow",
        modelId,
        async doGenerate(options: Parameters<SpeechModelV3["doGenerate"]>[0]) {
            const response = await fetch(speechURL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization:
                        settings?.apiKey && settings?.apiKey.includes("Bearer ")
                            ? settings.apiKey
                            : `Bearer ${settings.apiKey}`,
                    ...settings.headers,
                },
                body: JSON.stringify({
                    model: modelId,
                    input: options.text,
                    voice: options.voice,
                    speed: options.speed ?? 1,
                    response_format: options.outputFormat ?? "mp3",
                }),
            });

            if (!response.ok) {
                const err = await response.text();
                throw new Error(`硅基流动 TTS 请求失败: ${response.status} ${err}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const audio = new Uint8Array(arrayBuffer);

            return {
                audio,
                format: options.outputFormat ?? "mp3",
                warnings: [],
                response: { timestamp: new Date(), modelId, headers: undefined },
                providerMetadata: {},
            };
        },
    };
}
