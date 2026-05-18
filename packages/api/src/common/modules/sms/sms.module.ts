import { RedisModule } from "@buildingai/cache";
import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { SmsConfig } from "@buildingai/db/entities/sms-config.entity";
import { Module } from "@nestjs/common";

import { AliyunSmsProvider } from "./providers/aliyun-sms.provider";
import { TencentSmsProvider } from "./providers/tencent-sms.provider";
import { SmsService } from "./services/sms.service";

@Module({
    imports: [RedisModule, TypeOrmModule.forFeature([SmsConfig])],
    exports: [SmsService],
    providers: [SmsService, AliyunSmsProvider, TencentSmsProvider],
})
export class SmsModule {}
