import { IsBoolean, IsOptional, IsString, IsUUID, Length } from "class-validator";

export class CreateAgentAnnotationDto {
    @IsString()
    @Length(1, 1000, { message: "标注问题长度须在 1–1000 字符之间" })
    question: string;

    @IsString()
    @Length(1, 5000, { message: "标注答案长度须在 1–5000 字符之间" })
    answer: string;

    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @IsOptional()
    @IsUUID("4")
    messageId?: string;
}
