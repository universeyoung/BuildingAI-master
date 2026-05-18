import type { UIMessage } from "ai";
import { IsArray, IsBoolean, IsIn, IsObject, IsOptional, IsString } from "class-validator";

export class AgentChatRequestDto {
    @IsOptional()
    @IsIn(["streaming", "blocking"])
    responseMode?: "streaming" | "blocking";

    @IsOptional()
    @IsString()
    conversationId?: string;

    @IsOptional()
    @IsBoolean()
    saveConversation?: boolean;

    @IsOptional()
    @IsBoolean()
    isDebug?: boolean;

    @IsOptional()
    @IsArray()
    messages?: UIMessage[];

    @IsOptional()
    @IsObject()
    message?: UIMessage;

    @IsOptional()
    @IsObject()
    formVariables?: Record<string, string>;

    @IsOptional()
    @IsObject()
    formFieldsInputs?: Record<string, unknown>;

    @IsOptional()
    @IsObject()
    feature?: Record<string, boolean>;

    @IsOptional()
    @IsString()
    trigger?: string;

    @IsOptional()
    @IsString()
    messageId?: string;

    @IsOptional()
    @IsString()
    parentId?: string;
}
