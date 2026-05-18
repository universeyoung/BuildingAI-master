import { PaginationDto } from "@buildingai/dto/pagination.dto";
import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export type ListConsoleAgentStatus =
    | "all"
    | "none"
    | "pending"
    | "approved"
    | "rejected"
    | "published"
    | "unpublished";

const STATUS_VALUES = [
    "all",
    "none",
    "pending",
    "approved",
    "rejected",
    "published",
    "unpublished",
] as const;

export class ListConsoleAgentsDto extends PaginationDto {
    @IsOptional()
    @IsString()
    @MaxLength(100)
    name?: string;

    @IsOptional()
    @IsIn(STATUS_VALUES)
    status?: ListConsoleAgentStatus;

    @IsOptional()
    @IsUUID("4")
    tagId?: string;
}
