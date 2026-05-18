import { BillingModule } from "@buildingai/core/modules";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import {
    CardBatch,
    CDK,
    MembershipLevels,
    MembershipOrder,
    UserSubscription,
} from "@buildingai/db/entities";
import { DictModule } from "@buildingai/dict";
import { Module } from "@nestjs/common";

import { CardBatchController } from "./controllers/console/card-batch.controller";
import { CardSettingController } from "./controllers/console/card-setting.controller";
import { CDKController } from "./controllers/console/cdk.controller";
import { CDKWebController } from "./controllers/web/cdk.controller";
import { CardBatchService } from "./services/card-batch.service";
import { CardSettingService } from "./services/card-setting.service";
import { CDKService } from "./services/cdk.service";

/**
 * 卡密模块
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([
            CardBatch,
            CDK,
            MembershipLevels,
            MembershipOrder,
            UserSubscription,
        ]),
        DictModule,
        BillingModule,
    ],
    controllers: [CardBatchController, CDKController, CardSettingController, CDKWebController],
    providers: [CardBatchService, CDKService, CardSettingService],
    exports: [CardBatchService, CDKService, CardSettingService],
})
export class CDKModule {}
