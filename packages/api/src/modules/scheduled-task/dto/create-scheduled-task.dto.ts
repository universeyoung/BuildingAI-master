import type { ScheduledTaskAdvancedSettings } from "@buildingai/db/entities";
import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Length } from "class-validator";

export class CreateScheduledTaskDto {
    @IsString()
    @Length(1, 100)
    name: string;

    @IsUUID()
    agentId: string;

    @IsIn(["new", "continue"])
    conversationMode: "new" | "continue";

    @IsUUID()
    @IsOptional()
    conversationId?: string;

    @IsString()
    @IsOptional()
    prompt?: string;

    @IsString()
    cronExpression: string;

    @IsBoolean()
    @IsOptional()
    isEnabled?: boolean;

    @IsOptional()
    advancedSettings?: ScheduledTaskAdvancedSettings;
}
