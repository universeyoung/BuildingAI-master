import type { SpeechModelV3 } from "@ai-sdk/provider";

import type { TongYiProviderSettings } from "./index";

const DEFAULT_TTS_BASE =
    "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation";

export function createTongYiSpeechModel(
    settings: TongYiProviderSettings,
    modelId: string,
): SpeechModelV3 {
    const ttsBase = settings.speechBaseURL ?? DEFAULT_TTS_BASE;
    return {
        specificationVersion: "v3",
        provider: "tongyi",
        modelId,
        async doGenerate(options: Parameters<SpeechModelV3["doGenerate"]>[0]) {
            const response = await fetch(`${ttsBase}/generation`, {
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
                    input: {
                        text: options.text,
                        voice: options.voice ?? "Cherry",
                        language_type: "Auto",
                    },
                }),
            });
            if (!response.ok) {
                const err = await response.text();
                throw new Error(`通义 TTS 请求失败: ${response.status} ${err}`);
            }
            const json = (await response.json()) as {
                status_code?: number;
                code?: string;
                message?: string;
                output?: { audio?: { data?: string; url?: string } };
                [k: string]: unknown;
            };
            const isError =
                (json.status_code != null && json.status_code !== 200) ||
                (json.code != null && json.code !== "");
            if (isError) {
                const msg =
                    [json.message, json.code, json.status_code].find((v) => v != null) ??
                    JSON.stringify(json);
                throw new Error(`通义 TTS 错误: ${msg}`);
            }
            const audioOut = json.output?.audio;
            if (!audioOut) throw new Error("通义 TTS 返回无音频信息");
            let audio: Uint8Array;
            if (audioOut.data) {
                const binary = atob(audioOut.data);
                audio = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) audio[i] = binary.charCodeAt(i);
            } else if (audioOut.url) {
                const audioRes = await fetch(audioOut.url);
                if (!audioRes.ok) throw new Error(`通义 TTS 拉取音频失败: ${audioRes.status}`);
                audio = new Uint8Array(await audioRes.arrayBuffer());
            } else {
                throw new Error("通义 TTS 返回无音频 data 或 url");
            }
            return {
                audio,
                format: "wav",
                warnings: [],
                response: { timestamp: new Date(), modelId, headers: undefined },
                providerMetadata: {},
            };
        },
    };
}
