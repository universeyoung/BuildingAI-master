import { PaginationDto } from "@buildingai/dto/pagination.dto";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString, IsUUID } from "class-validator";

export class QueryScheduledTaskDto extends PaginationDto {
    @IsOptional()
    @IsString()
    keyword?: string;

    @IsOptional()
    @Transform(({ value }) => value === "true" || value === true)
    @IsBoolean()
    isEnabled?: boolean;

    @IsOptional()
    @IsUUID()
    agentId?: string;
}
