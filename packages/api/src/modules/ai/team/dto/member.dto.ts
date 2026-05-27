import { IsArray, IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";
import { TeamMember } from "@buildingai/db/entities";

export class AddMembersDto {
    @IsArray()
    @IsUUID("4", { each: true })
    agentIds: string[];

    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    roles?: string[];
}

export class RemoveMemberDto {
    @IsOptional()
    @IsBoolean()
    force?: boolean;
}

export interface AddMemberResult {
    agentId: string;
    success: boolean;
    member?: TeamMember;
    error?: string;
}

export interface RemoveMemberResult {
    success: boolean;
    message?: string;
}

export interface TeamOperationResult {
    success: boolean;
    message?: string;
}
