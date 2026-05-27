import { TypeOrmModule } from "@buildingai/db/@nestjs/typeorm";
import { Agent, ScheduledTask, ScheduledTaskRun } from "@buildingai/db/entities";
import { Module, OnApplicationBootstrap } from "@nestjs/common";
 
import { ScheduledTaskWebController } from "./controllers/web/scheduled-task.web.controller";
import { ScheduledTaskExecutorService } from "./services/scheduled-task-executor.service";
import { ScheduledTaskSchedulerService } from "./services/scheduled-task-scheduler.service";
import { ScheduledTaskService } from "./services/scheduled-task.service";
 
@Module({
  imports: [TypeOrmModule.forFeature([ScheduledTask, ScheduledTaskRun, Agent])],
  controllers: [ScheduledTaskWebController],
  providers: [
    ScheduledTaskService,
    ScheduledTaskSchedulerService,
    ScheduledTaskExecutorService,
  ],
  exports: [ScheduledTaskService],
})
export class ScheduledTaskModule implements OnApplicationBootstrap {
  constructor(
    private readonly schedulerService: ScheduledTaskSchedulerService,
  ) {}
 
  async onApplicationBootstrap() {
    await this.schedulerService.loadAllEnabledTasks();
  }
}
