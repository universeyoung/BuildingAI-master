import { IsNumber, IsOptional, IsString, Max, Min } from "class-validator";

export class AgentSpeechRequestDto {
    @IsString()
    text: string;

    @IsOptional()
    @IsString()
    modelId?: string;

    @IsOptional()
    @IsString()
    voice?: string;

    @IsOptional()
    @IsNumber()
    @Min(0.25)
    @Max(4)
    speed?: number;

    @IsOptional()
    @IsString()
    responseFormat?: "mp3" | "opus" | "aac" | "flac" | "wav" | "pcm";
}
