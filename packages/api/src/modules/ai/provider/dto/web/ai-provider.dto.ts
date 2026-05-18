import { ModelType } from "@buildingai/ai-sdk";
import { PaginationDto } from "@buildingai/dto/pagination.dto";
import { Transform, Type } from "class-transformer";
import { IsArray, IsOptional, IsString } from "class-validator";

export class QueryAiProviderDto extends PaginationDto {
    @IsOptional()
    @IsString({ message: "搜索关键词必须是字符串" })
    name?: string;

    @IsOptional()
    @Transform(({ value }) => (value == null ? undefined : Array.isArray(value) ? value : [value]))
    @IsArray({ message: "支持的模型类型必须是数组" })
    @Type(() => String)
    @IsString({ each: true, message: "支持的模型类型必须是字符串数组" })
    supportedModelTypes?: ModelType[];
}
