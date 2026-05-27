import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import {
    Team,
    TeamMember,
    LocalAgent,
    Task,
    Subtask,
    SubtaskDependency,
    Message,
    CollaborationSpace,
    SharedMemoryEntry,
    ExperienceCard,
    ApiKey,
    KeyPool,
    ModelConfig,
} from "@buildingai/db/entities";
import { Module } from "@nestjs/common";

import { TeamController } from "./controllers/team.controller";
import { TaskController } from "./controllers/task.controller";
import { CollaborationSpaceController } from "./controllers/collaboration-space.controller";
import { SummaryLearningController } from "./controllers/summary-learning.controller";
import { TeamService } from "./services/team.service";
import { TaskService } from "./services/task.service";
import { CollaborationSpaceService } from "./services/collaboration-space.service";
import { AgentDiscoveryService } from "./services/agent-discovery.service";
import { SummaryLearningService } from "./services/summary-learning.service";

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Team,
            TeamMember,
            LocalAgent,
            Task,
            Subtask,
            SubtaskDependency,
            Message,
            CollaborationSpace,
            SharedMemoryEntry,
            ExperienceCard,
            ApiKey,
            KeyPool,
            ModelConfig,
        ]),
    ],
    controllers: [
        TeamController,
        TaskController,
        CollaborationSpaceController,
        SummaryLearningController,
    ],
    providers: [
        TeamService,
        TaskService,
        CollaborationSpaceService,
        AgentDiscoveryService,
        SummaryLearningService,
    ],
    exports: [TeamService],
})
export class TeamModule {}
