import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { Task, ExperienceCard, ExperienceCategory } from "@buildingai/db/entities";

export interface TaskSummary {
    taskId: string;
    taskName: string;
    status: string;
    subtaskCount: number;
    completedSubtaskCount: number;
    lessons: string[];
}

export interface ExperienceWithRating {
    experience: ExperienceCard;
    rating: number;
    comment?: string;
}

@Injectable()
export class SummaryLearningService {
    private readonly logger = new Logger(SummaryLearningService.name);

    constructor(
        @InjectRepository(Task)
        private readonly taskRepository: Repository<Task>,
        @InjectRepository(ExperienceCard)
        private readonly experienceRepository: Repository<ExperienceCard>,
    ) {}

    async generateSummary(id: string): Promise<TaskSummary> {
        const qb = this.taskRepository.createQueryBuilder("task");
        qb.where("task.id = :id", { id });
        const task = await qb.getOne();
        if (!task) throw new Error("任务不存在");

        return {
            taskId: (task as any).id,
            taskName: task.name,
            status: task.status as string,
            subtaskCount: 0,
            completedSubtaskCount: 0,
            lessons: ["任务执行完成", "建议优化工作流程"],
        };
    }

    async rateMembers(id: string): Promise<{ memberId: string; rating: number; feedback: string }[]> {
        return [];
    }

    async searchExperiences(teamId: string, query: string, category?: ExperienceCategory): Promise<ExperienceCard[]> {
        const qb = this.experienceRepository.createQueryBuilder("exp");
        qb.where("exp.teamId = :teamId", { teamId });

        if (category) {
            qb.andWhere("exp.category = :category", { category });
        }

        if (query) {
            qb.andWhere("(exp.title LIKE :query OR exp.content LIKE :query)", { query: `%${query}%` });
        }

        return qb.getMany();
    }
}
