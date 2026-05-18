import { BaseController } from "@buildingai/base";
import { Tag } from "@buildingai/db/entities";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { ConsoleController } from "@common/decorators";
import { Permissions } from "@common/decorators/permissions.decorator";
import { CreateTagDto, QueryTagDto, UpdateTagDto } from "@modules/tag/dto";
import { TagService } from "@modules/tag/services/tag.service";
import { Body, Delete, Get, Param, Post, Put, Query } from "@nestjs/common";

/**
 * Tag management controller (console)
 */
@ConsoleController("tag", "标签管理")
export class TagController extends BaseController {
    /**
     * Constructor
     *
     * @param tagService Tag service
     */
    constructor(private readonly tagService: TagService) {
        super();
    }

    /**
     * Create a tag
     *
     * @param createTagDto DTO for creating a tag
     * @returns Created tag
     */
    @Post()
    @Permissions({
        code: "create",
        name: "创建标签",
        description: "创建一个新标签",
    })
    async create(@Body() createTagDto: CreateTagDto): Promise<Partial<Tag>> {
        return this.tagService.createTag(createTagDto);
    }

    /**
     * Query tag list
     *
     * @param queryTagDto DTO for querying tags
     * @returns Tag list
     */
    @Get()
    @Permissions({
        code: "list",
        name: "标签列表",
        description: "查询标签列表",
    })
    async findAll(@Query() queryTagDto: QueryTagDto): Promise<Tag[]> {
        return this.tagService.list(queryTagDto);
    }

    /**
     * Get tag by id
     *
     * @param id Tag id
     * @returns Tag detail
     */
    @Get(":id")
    @Permissions({
        code: "detail",
        name: "获取标签详细",
        description: "查询某个标签的详情",
    })
    async findOne(@Param("id", UUIDValidationPipe) id: string) {
        return this.tagService.findOneById(id);
    }

    /**
     * Update tag
     *
     * @param id Tag id
     * @param updateTagDto DTO for updating a tag
     * @returns Updated tag
     */
    @Put(":id")
    @Permissions({
        code: "update",
        name: "更新标签",
        description: "更新现有标签",
    })
    async update(@Param("id", UUIDValidationPipe) id: string, @Body() updateTagDto: UpdateTagDto) {
        return this.tagService.updateTagById(id, updateTagDto);
    }

    /**
     * Delete tag
     *
     * @param id Tag id
     * @returns Operation result
     */
    @Delete(":id")
    @Permissions({
        code: "delete",
        name: "删除标签",
        description: "删除现有标签",
    })
    async remove(@Param("id", UUIDValidationPipe) id: string) {
        // Ensure not used
        const tag = await this.tagService.findOneById(id);

        if (!tag) {
            return {
                success: false,
                message: "Tag does not exist",
            };
        }

        if (tag.bindingCount > 0) {
            return {
                success: false,
                message: "This tag is in use and cannot be deleted",
            };
        }

        await this.tagService.delete(id);
        return {
            success: true,
            message: "Deleted successfully",
        };
    }

    /**
     * Batch delete tags
     *
     * @param ids Tag ids
     * @returns Operation result
     */
    @Post("batch-delete")
    @Permissions({
        code: "delete",
        name: "批量删除标签",
        description: "批量删除标签",
    })
    async batchRemove(@Body("ids") ids: string[]) {
        try {
            await this.tagService.batchDelete(ids);
            return {
                success: true,
                message: "Batch deletion succeeded",
            };
        } catch (error) {
            return {
                success: false,
                message: error.message,
            };
        }
    }
}
