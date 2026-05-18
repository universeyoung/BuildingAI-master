import { PaginationDto } from "@buildingai/dto/pagination.dto";
import { IsEnum, IsOptional, IsString } from "class-validator";

export enum AgentPublishStatus {
    ALL = "all",
    PUBLISHED = "published",
    UNPUBLISHED = "unpublished",
}

export class ListMyAgentsDto extends PaginationDto {
    @IsOptional()
    @IsString()
    keyword?: string;

    @IsOptional()
    @IsEnum(AgentPublishStatus)
    status?: AgentPublishStatus;
}
