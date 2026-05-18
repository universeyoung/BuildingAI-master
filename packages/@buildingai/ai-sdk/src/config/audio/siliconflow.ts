import type { SpeechCatalog, SpeechTtsModelConfig, SpeechVoiceOption } from "../../types/speech";

const SILICONFLOW_TTS_LANGUAGES = ["zh-Hans", "en-US"];

const SILICONFLOW_TTS_VOICES: SpeechVoiceOption[] = [
    {
        id: "FunAudioLLM/CosyVoice2-0.5B:alex",
        name: "alex（沉稳男声）",
        languages: SILICONFLOW_TTS_LANGUAGES,
    },
    {
        id: "FunAudioLLM/CosyVoice2-0.5B:benjamin",
        name: "benjamin（低沉男声）",
        languages: SILICONFLOW_TTS_LANGUAGES,
    },
    {
        id: "FunAudioLLM/CosyVoice2-0.5B:charles",
        name: "charles（磁性男声）",
        languages: SILICONFLOW_TTS_LANGUAGES,
    },
    {
        id: "FunAudioLLM/CosyVoice2-0.5B:david",
        name: "david（欢快男声）",
        languages: SILICONFLOW_TTS_LANGUAGES,
    },
    {
        id: "FunAudioLLM/CosyVoice2-0.5B:anna",
        name: "anna（沉稳女声）",
        languages: SILICONFLOW_TTS_LANGUAGES,
    },
    {
        id: "FunAudioLLM/CosyVoice2-0.5B:bella",
        name: "bella（激情女声）",
        languages: SILICONFLOW_TTS_LANGUAGES,
    },
    {
        id: "FunAudioLLM/CosyVoice2-0.5B:claire",
        name: "claire（温柔女声）",
        languages: SILICONFLOW_TTS_LANGUAGES,
    },
    {
        id: "FunAudioLLM/CosyVoice2-0.5B:diana",
        name: "diana（欢快女声）",
        languages: SILICONFLOW_TTS_LANGUAGES,
    },
];

const SILICONFLOW_TTS_MODEL: SpeechTtsModelConfig = {
    modelId: "FunAudioLLM/CosyVoice2-0.5B",
    label: "FunAudioLLM/CosyVoice2-0.5B",
    defaultVoiceId: "FunAudioLLM/CosyVoice2-0.5B:alex",
    voices: SILICONFLOW_TTS_VOICES,
    supportedLanguages: SILICONFLOW_TTS_LANGUAGES,
    outputFormats: ["mp3", "opus", "wav", "pcm"],
    defaultOutputFormat: "mp3",
    speedRange: [0.25, 4],
    defaultSpeed: 1,
    maxInputLength: 10000,
};

export const siliconflowSpeechConfig: SpeechCatalog = {
    providerId: "siliconflow",
    providerName: "硅基流动",
    tts: {
        models: [SILICONFLOW_TTS_MODEL],
    },
    transcription: {
        models: [],
    },
};
