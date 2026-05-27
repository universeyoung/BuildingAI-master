import { SchedulerRegistry } from "@buildingai/core/@nestjs/schedule";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { ScheduledTask } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { Injectable, Logger } from "@nestjs/common";
import { CronJob } from "cron";

import { calculateNextRun } from "../utils/cron-parser.util";
import { ScheduledTaskExecutorService } from "./scheduled-task-executor.service";

@Injectable()
export class ScheduledTaskSchedulerService {
    private readonly logger = new Logger(ScheduledTaskSchedulerService.name);

    constructor(
        private readonly schedulerRegistry: SchedulerRegistry,
        @InjectRepository(ScheduledTask)
        private readonly scheduledTaskRepository: Repository<ScheduledTask>,
        private readonly executorService: ScheduledTaskExecutorService,
    ) {}

    async loadAllEnabledTasks(): Promise<void> {
        const tasks = await this.scheduledTaskRepository.find({
            where: { isEnabled: true } as any,
        });

        this.logger.log(`Loading ${tasks.length} enabled scheduled tasks`);

        for (const task of tasks) {
            try {
                this.register(task);
            } catch (error) {
                this.logger.error(
                    `Failed to register task "${task.name}" (${task.id}): ${(error as Error).message}`,
                );
            }
        }

        this.logger.log("All enabled scheduled tasks loaded");
    }

    register(task: ScheduledTask): void {
        const jobName = this.getJobName(task.id);

        this.unregister(task.id);

        const cronJob = new CronJob(
            task.cronExpression,
            async () => {
                await this.executorService.execute(task);
            },
            null,
            false,
        );

        this.schedulerRegistry.addCronJob(jobName, cronJob);
        cronJob.start();

        const nextRun = calculateNextRun(task.cronExpression);
        task.nextRunAt = nextRun;
        this.scheduledTaskRepository.save(task).catch((err) => {
            this.logger.error(`Failed to update nextRunAt for task ${task.id}: ${err.message}`);
        });

        this.logger.log(
            `Registered cron job "${jobName}" with expression "${task.cronExpression}"`,
        );
    }

    unregister(taskId: string): void {
        const jobName = this.getJobName(taskId);
        try {
            this.schedulerRegistry.deleteCronJob(jobName);
            this.logger.log(`Unregistered cron job "${jobName}"`);
        } catch {
            // Job may not exist yet
        }
    }

    calculateNextRun(cronExpression: string): Date {
        return calculateNextRun(cronExpression);
    }

    getJobName(taskId: string): string {
        return `scheduled-task-${taskId}`;
    }
}
