import { IsBoolean, IsEnum, IsOptional, IsString, IsArray, IsIn } from "class-validator";
import { LeadType, TeamStatus } from "@buildingai/db/entities";

export class CreateTeamDto {
    @IsString()
    name: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsIn(["human", "ai", "dual"])
    leadType: "human" | "ai" | "dual" | LeadType;

    @IsOptional()
    @IsString()
    leadAgentId?: string;
}

export class UpdateTeamDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    description?: string;

    @IsOptional()
    @IsIn(["human", "ai", "dual"])
    leadType?: "human" | "ai" | "dual" | LeadType;

    @IsOptional()
    @IsString()
    leadAgentId?: string;

    @IsOptional()
    @IsEnum(TeamStatus)
    status?: TeamStatus;
}

export class TeamQueryDto {
    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsEnum(LeadType)
    leadType?: LeadType;

    @IsOptional()
    @IsString()
    page?: string;

    @IsOptional()
    @IsString()
    pageSize?: string;

    @IsOptional()
    @IsEnum(TeamStatus)
    status?: TeamStatus;

    @IsOptional()
    @IsString()
    search?: string;
}

export interface TeamListResult {
    items: any[];
    total: number;
    page: number;
    pageSize: number;
}

export interface TeamOperationResult {
    success: boolean;
    message?: string;
}

export interface RemoveMemberResult {
    success: boolean;
    reassignedTasks?: string[];
}

export interface TeamSkill {
    name: string;
    count: number;
    agents: string[];
}

export interface TeamSkillsResult {
    skills: TeamSkill[];
}
