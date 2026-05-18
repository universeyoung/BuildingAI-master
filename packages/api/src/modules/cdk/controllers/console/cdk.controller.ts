import { BaseController } from "@buildingai/base";
import { BuildFileUrl } from "@buildingai/decorators";
import { ConsoleController } from "@common/decorators";
import { Permissions } from "@common/decorators/permissions.decorator";
import { Get, Query } from "@nestjs/common";

import { QueryCDKDto } from "../../dto/query-cdk.dto";
import { CDKService } from "../../services/cdk.service";

/**
 * 卡密记录控制器
 */
@ConsoleController("card-key", "卡密记录")
export class CDKController extends BaseController {
    constructor(private readonly cdkService: CDKService) {
        super();
    }

    /**
     * 查询卡密列表
     */
    @Get()
    @Permissions({
        code: "list",
        name: "查询卡密列表",
        description: "查询卡密列表",
    })
    async list(@Query() queryDto: QueryCDKDto) {
        return this.cdkService.queryCDKs(queryDto);
    }

    /**
     * 查询已使用的卡密记录
     */
    @Get("used")
    @Permissions({
        code: "used-list",
        name: "查询已使用卡密",
        description: "查询已使用的卡密记录",
    })
    @BuildFileUrl(["***.avatar"])
    async usedList(@Query() queryDto: QueryCDKDto) {
        return this.cdkService.queryUsedCDKs(queryDto);
    }
}
