import { PaginationDto } from "@buildingai/dto/pagination.dto";
import { Transform } from "class-transformer";
import { IsBoolean, IsOptional, IsString } from "class-validator";

function isEnabled(value: unknown): boolean {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        return (
            normalized === "true" ||
            normalized === "1" ||
            normalized === "yes" ||
            normalized === "on"
        );
    }
    return Boolean(value);
}

/**
 * 查询角色DTO
 *
 * 用于角色列表查询的参数验证
 * 继承自PaginationDto，支持分页查询
 */
export class QueryRoleDto extends PaginationDto {
    /**
     * 角色名称
     *
     * 用于按名称搜索角色，支持模糊匹配
     */
    @IsOptional()
    @IsString({ message: "角色名称必须是字符串" })
    name?: string;

    /**
     * 角色描述
     *
     * 用于按描述搜索角色，支持模糊匹配
     */
    @IsOptional()
    @IsString({ message: "角色描述必须是字符串" })
    description?: string;
}
