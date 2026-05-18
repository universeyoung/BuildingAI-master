import { BaseController } from "@buildingai/base";
import { BuildFileUrl } from "@buildingai/decorators";
import { UUIDValidationPipe } from "@buildingai/pipe/param-validate.pipe";
import { ConsoleController } from "@common/decorators";
import { Permissions } from "@common/decorators/permissions.decorator";
import { Body, Delete, Get, Param, Post, Query } from "@nestjs/common";

import { CreateCardBatchDto } from "../../dto/create-card-batch.dto";
import { QueryCardBatchDto } from "../../dto/query-card-batch.dto";
import { QueryCDKDto } from "../../dto/query-cdk.dto";
import { CardBatchService } from "../../services/card-batch.service";

/**
 * 卡密批次管理控制器
 */
@ConsoleController("card-batch", "卡密批次管理")
export class CardBatchController extends BaseController {
    constructor(private readonly cardBatchService: CardBatchService) {
        super();
    }

    /**
     * 创建卡密批次
     */
    @Post()
    @Permissions({
        code: "create",
        name: "创建卡密批次",
        description: "创建卡密批次并生成卡密",
    })
    async create(@Body() createDto: CreateCardBatchDto) {
        return this.cardBatchService.createBatch(createDto);
    }

    /**
     * 查询卡密批次列表
     */
    @Get()
    @Permissions({
        code: "list",
        name: "查询卡密批次列表",
        description: "查询卡密批次列表",
    })
    async list(@Query() queryDto: QueryCardBatchDto) {
        return this.cardBatchService.queryBatches(queryDto);
    }

    /**
     * 查询批次下的卡密列表（分页）
     */
    @Get(":id")
    @Permissions({
        code: "detail",
        name: "查询批次卡密列表",
        description: "查询当前批次下的卡密列表（分页）",
    })
    @BuildFileUrl(["***.avatar"])
    async detail(@Param("id", UUIDValidationPipe) id: string, @Query() queryDto: QueryCDKDto) {
        return this.cardBatchService.queryBatchCDKs(id, queryDto);
    }

    /**
     * 删除批次
     */
    @Delete(":id")
    @Permissions({
        code: "delete",
        name: "删除批次",
        description: "删除批次及其卡密",
    })
    async delete(@Param("id", UUIDValidationPipe) id: string) {
        return this.cardBatchService.deleteBatch(id);
    }
}
