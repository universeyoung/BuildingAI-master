import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { NoticeSetting } from "@buildingai/db/entities";
import { SmsConfig } from "@buildingai/db/entities/sms-config.entity";
import { Module } from "@nestjs/common";

import { NoticeConsoleController } from "./controllers/console/notice.controller";
import { NoticeService } from "./services/notice.service";

@Module({
    imports: [TypeOrmModule.forFeature([NoticeSetting, SmsConfig])],
    controllers: [NoticeConsoleController],
    providers: [NoticeService],
    exports: [NoticeService],
})
export class NoticeModule {}
