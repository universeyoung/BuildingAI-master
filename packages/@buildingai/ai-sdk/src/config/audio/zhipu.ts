import type {
    SpeechCatalog,
    SpeechTranscriptionModelConfig,
    SpeechTtsModelConfig,
    SpeechVoiceOption,
} from "../../types/speech";

const ZHIPU_TTS_LANGUAGES = ["zh-Hans", "en-US"];

const ZHIPU_TTS_VOICES: SpeechVoiceOption[] = [
    { id: "tongtong", name: "彤彤（默认）", languages: ZHIPU_TTS_LANGUAGES },
    { id: "xiaochen", name: "小陈", languages: ZHIPU_TTS_LANGUAGES },
    { id: "chuichui", name: "锤锤", languages: ZHIPU_TTS_LANGUAGES },
    { id: "jam", name: "jam", languages: ZHIPU_TTS_LANGUAGES },
    { id: "kazi", name: "kazi", languages: ZHIPU_TTS_LANGUAGES },
    { id: "douji", name: "douji", languages: ZHIPU_TTS_LANGUAGES },
    { id: "luodo", name: "luodo", languages: ZHIPU_TTS_LANGUAGES },
];

const ZHIPU_ASR_EXTENSIONS = [
    "aac",
    "amr",
    "flac",
    "m4a",
    "mp3",
    "ogg",
    "opus",
    "wav",
    "webm",
    "wma",
];

const ZHIPU_TRANSCRIPTION_MODEL: SpeechTranscriptionModelConfig = {
    modelId: "glm-asr-2512",
    label: "GLM-ASR-2512",
    supportedFileExtensions: ZHIPU_ASR_EXTENSIONS,
    maxFileSizeMb: 25,
};

const ZHIPU_TTS_MODEL: SpeechTtsModelConfig = {
    modelId: "glm-tts",
    label: "GLM-TTS",
    defaultVoiceId: "tongtong",
    voices: ZHIPU_TTS_VOICES,
    supportedLanguages: ZHIPU_TTS_LANGUAGES,
    outputFormats: ["wav", "pcm"],
    defaultOutputFormat: "wav",
    speedRange: [0.5, 2],
    defaultSpeed: 1,
    maxInputLength: 5000,
};

export const zhipuSpeechConfig: SpeechCatalog = {
    providerId: "zhipuai",
    providerName: "智谱AI",
    tts: {
        models: [ZHIPU_TTS_MODEL],
    },
    transcription: {
        models: [ZHIPU_TRANSCRIPTION_MODEL],
    },
};
