import { PaginationDto } from "@buildingai/dto";
import { Type } from "class-transformer";
import {
    ArrayMinSize,
    IsArray,
    IsBoolean,
    IsNumber,
    IsObject,
    IsOptional,
    IsString,
    IsUUID,
    ValidateIf,
    ValidateNested,
} from "class-validator";

export class AgentDecorateLinkItemDto {
    @IsOptional()
    @IsString()
    type?: string;

    @IsOptional()
    @IsString()
    name?: string;

    @IsOptional()
    @IsString()
    path?: string;

    @IsOptional()
    @IsObject()
    query?: Record<string, unknown>;
}

/**
 * 智能体广场 Banner 项 DTO
 */
export class AgentDecorateBannerItemDto {
    @IsString()
    imageUrl!: string;

    @IsOptional()
    @IsString()
    linkUrl?: string;

    @IsOptional()
    @IsString()
    linkType?: "system" | "custom";
}

export class AgentDecorateDto {
    @IsOptional()
    @IsBoolean()
    enabled?: boolean;

    @IsOptional()
    @IsString()
    title?: string;

    @IsOptional()
    @IsString()
    description?: string;

    /**
     * Banner 列表（优先使用此字段）
     */
    @ValidateIf((o) => o.enabled === true)
    @IsArray({ message: "banners 必须是数组" })
    @ArrayMinSize(1, { message: "至少需要一个 Banner" })
    @ValidateNested({ each: true })
    @Type(() => AgentDecorateBannerItemDto)
    banners?: AgentDecorateBannerItemDto[];

    @IsOptional()
    @ValidateNested()
    @Type(() => AgentDecorateLinkItemDto)
    link?: AgentDecorateLinkItemDto;

    @IsOptional()
    @IsString()
    heroImageUrl?: string;

    @IsOptional()
    @IsString()
    overlayTitle?: string;

    @IsOptional()
    @IsString()
    overlayDescription?: string;

    @IsOptional()
    @IsString()
    overlayIconUrl?: string;

    @IsOptional()
    @IsArray()
    @IsUUID("4", { each: true })
    sortAgentIds?: string[];
}

export class QueryAgentDecorateItemsDto extends PaginationDto {
    @IsOptional()
    @IsString()
    keyword?: string;

    @IsOptional()
    @IsUUID("4")
    tagId?: string;
}

export class AgentDecorateSortItemDto {
    @IsString()
    id!: string;

    @IsNumber()
    sort!: number;
}

export class BatchUpdateAgentDecorateSortDto {
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => AgentDecorateSortItemDto)
    items!: AgentDecorateSortItemDto[];
}
