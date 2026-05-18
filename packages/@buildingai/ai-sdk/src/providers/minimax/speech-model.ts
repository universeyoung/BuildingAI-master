import type { SpeechModelV3 } from "@ai-sdk/provider";

import type { MiniMaxProviderSettings } from "./index";

function hexToUint8Array(hex: string): Uint8Array {
    const len = hex.length / 2;
    const view = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        view[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    }
    return view;
}

const SAMPLE_RATE = 32000;
const BITRATE = 128000;

export function createMiniMaxSpeechModel(
    settings: MiniMaxProviderSettings,
    modelId: string,
): SpeechModelV3 {
    const baseURL = settings.baseURL ?? "https://api.minimax.io";
    return {
        specificationVersion: "v3",
        provider: "minimax",
        modelId,
        async doGenerate(options: Parameters<SpeechModelV3["doGenerate"]>[0]) {
            const format = options.outputFormat ?? "mp3";
            const response = await fetch(`${baseURL}/v1/t2a_v2`, {
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
                    text: options.text,
                    stream: false,
                    language_boost: "auto",
                    output_format: "hex",
                    voice_setting: {
                        voice_id: options.voice ?? "English_expressive_narrator",
                        speed: options.speed ?? 1,
                        vol: 1,
                        pitch: 0,
                    },
                    audio_setting: {
                        sample_rate: SAMPLE_RATE,
                        bitrate: format === "mp3" ? BITRATE : undefined,
                        format,
                        channel: 1,
                    },
                }),
            });
            if (!response.ok) {
                const err = await response.text();
                throw new Error(`MiniMax T2A 请求失败: ${response.status} ${err}`);
            }
            const json = (await response.json()) as {
                base_resp?: { status_code?: number; status_msg?: string };
                data?: { audio?: string };
                extra_info?: { audio_format?: string };
            };
            if (json.base_resp?.status_code !== 0) {
                throw new Error(
                    `MiniMax T2A 错误: ${json.base_resp?.status_msg ?? json.base_resp?.status_code}`,
                );
            }
            const hexAudio = json.data?.audio;
            if (!hexAudio || typeof hexAudio !== "string")
                throw new Error("MiniMax T2A 返回无音频数据");
            const audio = hexToUint8Array(hexAudio);
            const resultFormat = json.extra_info?.audio_format ?? format;
            return {
                audio,
                format: resultFormat,
                warnings: [],
                response: { timestamp: new Date(), modelId, headers: undefined },
                providerMetadata: {},
            };
        },
    };
}
