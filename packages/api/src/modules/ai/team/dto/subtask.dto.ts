import { IsEnum, IsNumber, IsOptional, IsString, IsUUID } from "class-validator";
import { SubtaskPriority } from "@buildingai/db/entities";

export class CreateSubtaskDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsString()
    input?: string;

    @IsOptional()
    @IsEnum(SubtaskPriority)
    priority?: SubtaskPriority;

    @IsOptional()
    @IsNumber()
    estimatedHours?: number;
}

export class UpdateSubtaskDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(SubtaskPriority)
    priority?: SubtaskPriority;

    @IsOptional()
    @IsUUID()
    assignedTo?: string;
}

export class ReassignSubtaskDto {
    @IsUUID()
    newMemberId: string;
}

export class ReviewSubtaskDto {
    @IsEnum(["approved", "rejected"])
    verdict: "approved" | "rejected";

    @IsOptional()
    @IsString()
    feedback?: string;
}

export class UrgeSubtaskDto {
    @IsOptional()
    @IsString()
    reason?: string;

    @IsOptional()
    @IsString()
    newDeadline?: string;
}
