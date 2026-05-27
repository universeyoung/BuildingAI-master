import { IsBoolean, IsEnum, IsOptional, IsString, IsUUID } from "class-validator";
import { TaskStatus } from "@buildingai/db/entities";

export class CreateTaskDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsBoolean()
    messaging?: boolean;

    @IsOptional()
    @IsBoolean()
    workflow?: boolean;

    @IsOptional()
    @IsBoolean()
    sharedSpace?: boolean;
}

export class UpdateTaskDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsEnum(TaskStatus)
    status?: TaskStatus;

    @IsOptional()
    @IsBoolean()
    messaging?: boolean;

    @IsOptional()
    @IsBoolean()
    workflow?: boolean;

    @IsOptional()
    @IsBoolean()
    sharedSpace?: boolean;
}

export class TaskCommandDto {
    @IsString()
    @IsUUID()
    teamId: string;
}

export interface SubtaskDraft {
    name: string;
    description: string;
    inputSchema?: Record<string, unknown>;
    expectedOutputSchema?: Record<string, unknown>;
    estimatedHours: number;
    suggestedDependencies?: string[];
}

export interface AssignmentResult {
    subtaskId: string;
    memberId: string;
    matchScore: number;
}

export interface DependencyInput {
    fromSubtaskId: string;
    toSubtaskId: string;
    type: string;
    condition?: string;
}
