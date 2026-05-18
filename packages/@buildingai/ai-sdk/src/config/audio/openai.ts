import type {
    SpeechCatalog,
    SpeechTranscriptionModelConfig,
    SpeechTtsModelConfig,
    SpeechVoiceOption,
} from "../../types/speech";

const OPENAI_TTS_VOICES: SpeechVoiceOption[] = [
    {
        id: "alloy",
        name: "Alloy",
        languages: ["zh-Hans", "en-US", "de-DE", "fr-FR", "es-ES", "it-IT", "th-TH", "id-ID"],
    },
    {
        id: "echo",
        name: "Echo",
        languages: ["zh-Hans", "en-US", "de-DE", "fr-FR", "es-ES", "it-IT", "th-TH", "id-ID"],
    },
    {
        id: "fable",
        name: "Fable",
        languages: ["zh-Hans", "en-US", "de-DE", "fr-FR", "es-ES", "it-IT", "th-TH", "id-ID"],
    },
    {
        id: "onyx",
        name: "Onyx",
        languages: ["zh-Hans", "en-US", "de-DE", "fr-FR", "es-ES", "it-IT", "th-TH", "id-ID"],
    },
    {
        id: "nova",
        name: "Nova",
        languages: ["zh-Hans", "en-US", "de-DE", "fr-FR", "es-ES", "it-IT", "th-TH", "id-ID"],
    },
    {
        id: "shimmer",
        name: "Shimmer",
        languages: ["zh-Hans", "en-US", "de-DE", "fr-FR", "es-ES", "it-IT", "th-TH", "id-ID"],
    },
];

const OPENAI_TTS_LANGUAGES = [
    "zh-Hans",
    "en-US",
    "de-DE",
    "fr-FR",
    "es-ES",
    "it-IT",
    "th-TH",
    "id-ID",
];

function createOpenAITtsModel(
    modelId: string,
    label: string,
    defaultVoiceId: string = "alloy",
): SpeechTtsModelConfig {
    return {
        modelId,
        label,
        defaultVoiceId,
        voices: OPENAI_TTS_VOICES,
        supportedLanguages: OPENAI_TTS_LANGUAGES,
        outputFormats: ["mp3", "opus", "aac", "flac", "wav", "pcm"],
        defaultOutputFormat: "mp3",
        speedRange: [0.25, 4.0],
        defaultSpeed: 1,
        maxInputLength: 4096,
    };
}

const OPENAI_WHISPER_LANGUAGES = [
    "en",
    "zh",
    "ja",
    "ko",
    "de",
    "fr",
    "es",
    "it",
    "pt",
    "ru",
    "ar",
    "hi",
    "th",
    "id",
    "vi",
    "nl",
    "pl",
    "tr",
    "uk",
    "cs",
    "el",
    "he",
    "hu",
    "ro",
    "sv",
    "da",
    "fi",
    "no",
    "bg",
    "hr",
    "sk",
    "sl",
    "ca",
    "af",
    "hy",
    "az",
    "be",
    "bs",
    "et",
    "gl",
    "ka",
    "kk",
    "lv",
    "lt",
    "mk",
    "ms",
    "mr",
    "mi",
    "ne",
    "fa",
    "sr",
    "sw",
    "tl",
    "ta",
    "ur",
    "cy",
];

const OPENAI_TRANSCRIPTION_MODELS: SpeechTranscriptionModelConfig[] = [
    {
        modelId: "whisper-1",
        label: "Whisper",
        supportedLanguages: OPENAI_WHISPER_LANGUAGES,
        supportedFileExtensions: [
            "flac",
            "mp3",
            "mp4",
            "mpeg",
            "mpga",
            "m4a",
            "ogg",
            "wav",
            "webm",
        ],
        maxFileSizeMb: 25,
        responseFormats: ["json", "text", "srt", "verbose_json", "vtt"],
    },
];

export const openaiSpeechConfig: SpeechCatalog = {
    providerId: "openai",
    providerName: "OpenAI",
    tts: {
        models: [
            createOpenAITtsModel("tts-1", "tts-1", "alloy"),
            createOpenAITtsModel("tts-1-hd", "tts-1-hd", "alloy"),
            createOpenAITtsModel("gpt-4o-mini-tts", "gpt-4o-mini-tts", "alloy"),
        ],
    },
    transcription: {
        models: OPENAI_TRANSCRIPTION_MODELS,
    },
};
