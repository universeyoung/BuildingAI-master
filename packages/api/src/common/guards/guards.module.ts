import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { Agent, User } from "@buildingai/db/entities";
import { Module } from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import { ExtensionGuard } from "./extension.guard";

@Module({
    imports: [TypeOrmModule.forFeature([Agent, User])],
    providers: [Reflector],
    exports: [Reflector, TypeOrmModule],
})
export class GuardsModule {}
