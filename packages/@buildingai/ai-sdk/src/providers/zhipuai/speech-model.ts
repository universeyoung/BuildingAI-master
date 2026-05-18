import type { SpeechModelV3 } from "@ai-sdk/provider";

import type { ZhipuAIProviderSettings } from "./index";

export function createZhipuSpeechModel(
    settings: ZhipuAIProviderSettings,
    modelId: string,
): SpeechModelV3 {
    const baseURL = settings.baseURL?.replace(/\/$/, "") || "https://open.bigmodel.cn/api/paas/v4";
    const speechURL = `${baseURL}/audio/speech`;
    return {
        specificationVersion: "v3",
        provider: "zhipuai",
        modelId,
        async doGenerate(options: Parameters<SpeechModelV3["doGenerate"]>[0]) {
            const fmt = options.outputFormat === "mp3" ? "wav" : (options.outputFormat ?? "wav");
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
                    voice: options.voice ?? "tongtong",
                    speed: options.speed ?? 1,
                    volume: 1,
                    response_format: fmt,
                }),
            });
            if (!response.ok) {
                const err = await response.text();
                throw new Error(`智谱 TTS 请求失败: ${response.status} ${err}`);
            }
            const audio = new Uint8Array(await response.arrayBuffer());
            return {
                audio,
                format: fmt,
                warnings: [],
                response: { timestamp: new Date(), modelId, headers: undefined },
                providerMetadata: {},
            };
        },
    };
}
