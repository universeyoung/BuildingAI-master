import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { AgentMemory, UserMemory } from "@buildingai/db/entities";
import { Module } from "@nestjs/common";

import { UserMemoryWebController } from "./controllers/web/user-memory.controller";
import { MemoryService } from "./services/memory.service";
import { MemoryExtractionService } from "./services/memory-extraction.service";

@Module({
    imports: [TypeOrmModule.forFeature([UserMemory, AgentMemory])],
    controllers: [UserMemoryWebController],
    providers: [MemoryService, MemoryExtractionService],
    exports: [MemoryService, MemoryExtractionService],
})
export class AiMemoryModule {}
