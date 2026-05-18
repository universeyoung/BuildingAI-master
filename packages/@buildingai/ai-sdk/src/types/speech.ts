export interface SpeechModelV1 {
    readonly modelId: string;
    readonly provider: string;
    doGenerate(params: SpeechGenerateParams): Promise<SpeechGenerateResult>;
}

export interface SpeechGenerateParams {
    text: string;
    voice?: string;
    speed?: number;
    responseFormat?: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
}

export interface SpeechGenerateResult {
    audio: ArrayBuffer;
    format: string;
}

export interface TranscriptionModelV1 {
    readonly modelId: string;
    readonly provider: string;
    doTranscribe(params: TranscriptionParams): Promise<TranscriptionResult>;
}

export interface TranscriptionParams {
    audio: ArrayBuffer | Blob | File;
    language?: string;
    prompt?: string;
    responseFormat?: "json" | "text" | "srt" | "verbose_json" | "vtt";
    temperature?: number;
}

export interface TranscriptionResult {
    text: string;
    language?: string;
    duration?: number;
    segments?: TranscriptionSegment[];
}

export interface TranscriptionSegment {
    id: number;
    start: number;
    end: number;
    text: string;
}

export interface SpeechVoiceOption {
    id: string;
    name: string;
    languages?: string[];
}

export interface SpeechTtsModelConfig {
    modelId: string;
    label: string;
    defaultVoiceId?: string;
    voices: SpeechVoiceOption[];
    supportedLanguages: string[];
    outputFormats?: string[];
    defaultOutputFormat?: string;
    speedRange?: [number, number];
    defaultSpeed?: number;
    maxInputLength?: number;
}

export interface SpeechTranscriptionModelConfig {
    modelId: string;
    label: string;
    supportedLanguages?: string[];
    supportedFileExtensions?: string[];
    maxFileSizeMb?: number;
    responseFormats?: string[];
}

export interface SpeechCatalog {
    providerId: string;
    providerName: string;
    tts: {
        models: SpeechTtsModelConfig[];
    };
    transcription: {
        models: SpeechTranscriptionModelConfig[];
    };
}
