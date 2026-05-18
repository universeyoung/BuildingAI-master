import type { SpeechCatalog } from "../../types/speech";
import { minimaxSpeechConfig } from "./minimax";
import { openaiSpeechConfig } from "./openai";
import { siliconflowSpeechConfig } from "./siliconflow";
import { tongyiSpeechConfig } from "./tongyi";
import { zhipuSpeechConfig } from "./zhipu";

const speechConfigRegistry = new Map<string, SpeechCatalog>([
    ["minimax", minimaxSpeechConfig],
    ["openai", openaiSpeechConfig],
    ["tongyi", tongyiSpeechConfig],
    ["zhipuai", zhipuSpeechConfig],
    ["siliconflow", siliconflowSpeechConfig],
]);

export function getSpeechConfig(providerId: string): SpeechCatalog | undefined {
    return speechConfigRegistry.get(providerId);
}

export function listSpeechProviders(): string[] {
    return Array.from(speechConfigRegistry.keys());
}

export function registerSpeechConfig(config: SpeechCatalog): void {
    speechConfigRegistry.set(config.providerId, config);
}

export type {
    SpeechCatalog,
    SpeechTranscriptionModelConfig,
    SpeechTtsModelConfig,
    SpeechVoiceOption,
} from "../../types/speech";
export { minimaxSpeechConfig } from "./minimax";
export { openaiSpeechConfig } from "./openai";
export { siliconflowSpeechConfig } from "./siliconflow";
export { tongyiSpeechConfig } from "./tongyi";
export { zhipuSpeechConfig } from "./zhipu";
