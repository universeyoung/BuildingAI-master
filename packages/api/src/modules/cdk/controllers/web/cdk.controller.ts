import { BaseController } from "@buildingai/base";
import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Post } from "@nestjs/common";

import { RedeemCDKDto } from "../../dto/redeem-cdk.dto";
import { CDKService } from "../../services/cdk.service";

/**
 * 前台卡密控制器
 */
@WebController("card-key")
export class CDKWebController extends BaseController {
    constructor(private readonly cdkService: CDKService) {
        super();
    }

    /**
     * 兑换卡密
     */
    @Post("redeem")
    async redeem(@Playground() user: UserPlayground, @Body() redeemDto: RedeemCDKDto) {
        return this.cdkService.redeemCDK(user.id, redeemDto);
    }
}
