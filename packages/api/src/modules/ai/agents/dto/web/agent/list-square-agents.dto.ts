import { PaginationDto } from "@buildingai/dto/pagination.dto";
import { Transform } from "class-transformer";
import { Allow, IsArray, IsOptional, IsString, IsUUID } from "class-validator";

export class ListSquareAgentsDto extends PaginationDto {
    @IsOptional()
    @IsString()
    keyword?: string;

    @IsOptional()
    @Transform(({ value, obj }) => {
        const v = value ?? (obj as Record<string, unknown>)["tagIds[]"];
        return Array.isArray(v) ? v : v ? [v] : undefined;
    })
    @IsArray()
    @IsUUID("4", { each: true })
    tagIds?: string[];

    @Allow()
    @IsOptional()
    "tagIds[]"?: unknown;
}
