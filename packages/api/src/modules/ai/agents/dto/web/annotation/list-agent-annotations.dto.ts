import { PaginationDto } from "@buildingai/dto/pagination.dto";
import { IsBoolean, IsOptional, IsString } from "class-validator";

export class ListAgentAnnotationsDto extends PaginationDto {
    @IsOptional()
    @IsString()
    keyword?: string;

    @IsOptional()
    @IsBoolean()
    enabled?: boolean;
}
