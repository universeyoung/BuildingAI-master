import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Repository } from "@buildingai/db/typeorm";
import { Task, Subtask, SubtaskDependency, SubtaskStatus, SubtaskPriority, DependencyType } from "@buildingai/db/entities";
import { CreateTaskDto, UpdateTaskDto, DependencyInput, SubtaskDraft } from "../dto/task.dto";
import { CreateSubtaskDto, UpdateSubtaskDto, ReassignSubtaskDto, ReviewSubtaskDto, UrgeSubtaskDto } from "../dto/subtask.dto";

@Injectable()
export class TaskService {
    private readonly logger = new Logger(TaskService.name);

    constructor(
        @InjectRepository(Task)
        private readonly taskRepository: Repository<Task>,
        @InjectRepository(Subtask)
        private readonly subtaskRepository: Repository<Subtask>,
        @InjectRepository(SubtaskDependency)
        private readonly dependencyRepository: Repository<SubtaskDependency>,
    ) {}

    async create(teamId: string, dto: CreateTaskDto): Promise<Task> {
        const task = this.taskRepository.create({
            teamId: teamId,
            name: dto.name,
            description: dto.description,
        });
        return this.taskRepository.save(task);
    }

    async findAll(teamId: string): Promise<Task[]> {
        const qb = this.taskRepository.createQueryBuilder("task");
        qb.where("task.teamId = :teamId", { teamId });
        return qb.getMany();
    }

    async findOne(id: string): Promise<Task | null> {
        const qb = this.taskRepository.createQueryBuilder("task");
        qb.where("task.id = :id", { id });
        return qb.getOne();
    }

    async update(id: string, updateDto: UpdateTaskDto): Promise<Task | null> {
        const qb = this.taskRepository.createQueryBuilder("task");
        qb.where("task.id = :id", { id });
        const task = await qb.getOne();
        if (!task) return null;
        Object.assign(task, updateDto);
        return this.taskRepository.save(task);
    }

    async plan(id: string): Promise<{ subtasks: SubtaskDraft[] }> {
        const qb = this.taskRepository.createQueryBuilder("task");
        qb.where("task.id = :id", { id });
        const task = await qb.getOne();
        if (!task) throw new Error("任务不存在");

        const subtasks: SubtaskDraft[] = [
            { name: `${task.name} - 步骤1`, description: "第一步", estimatedHours: 1 },
            { name: `${task.name} - 步骤2`, description: "第二步", estimatedHours: 1 },
        ];

        return { subtasks };
    }

    async start(id: string): Promise<{ success: boolean; affectedSubtasks: number }> {
        const qb = this.taskRepository.createQueryBuilder("task");
        qb.where("task.id = :id", { id });
        const task = await qb.getOne();
        if (!task) return { success: false, affectedSubtasks: 0 };

        task.status = "in_progress" as any;
        task.startedAt = new Date();
        await this.taskRepository.save(task);

        return { success: true, affectedSubtasks: 0 };
    }

    async pause(id: string): Promise<{ success: boolean; affectedSubtasks: number }> {
        const qb = this.taskRepository.createQueryBuilder("task");
        qb.where("task.id = :id", { id });
        const task = await qb.getOne();
        if (!task || task.status !== "in_progress" as any) {
            return { success: false, affectedSubtasks: 0 };
        }
        task.status = "paused" as any;
        await this.taskRepository.save(task);
        return { success: true, affectedSubtasks: 0 };
    }

    async resume(id: string): Promise<{ success: boolean; affectedSubtasks: number }> {
        const qb = this.taskRepository.createQueryBuilder("task");
        qb.where("task.id = :id", { id });
        const task = await qb.getOne();
        if (!task || task.status !== "paused" as any) {
            return { success: false, affectedSubtasks: 0 };
        }
        task.status = "in_progress" as any;
        await this.taskRepository.save(task);
        return { success: true, affectedSubtasks: 0 };
    }

    async cancel(id: string): Promise<{ success: boolean; affectedSubtasks: number }> {
        const qb = this.taskRepository.createQueryBuilder("task");
        qb.where("task.id = :id", { id });
        const task = await qb.getOne();
        if (!task) return { success: false, affectedSubtasks: 0 };
        task.status = "cancelled" as any;
        await this.taskRepository.save(task);
        return { success: true, affectedSubtasks: 0 };
    }

    async getProgress(id: string): Promise<{ subtasks: { id: string; status: SubtaskStatus; progress: number }[] }> {
        const qb = this.taskRepository.createQueryBuilder("task");
        qb.where("task.id = :id", { id });
        const task = await qb.getOne();
        if (!task) {
            return { subtasks: [] };
        }
        const subtasks = await this.subtaskRepository.find({ where: { taskId: (task as any).id } });
        return {
            subtasks: subtasks.map((s) => ({
                id: (s as any).id,
                status: s.status,
                progress: s.status === SubtaskStatus.COMPLETED ? 100 : s.status === SubtaskStatus.IN_PROGRESS ? 50 : 0,
            })),
        };
    }

    async createSubtask(taskId: string, dto: CreateSubtaskDto): Promise<Subtask> {
        const subtask = this.subtaskRepository.create({
            taskId: taskId,
            name: dto.name,
            description: dto.description,
            priority: dto.priority || SubtaskPriority.MEDIUM,
            status: SubtaskStatus.PENDING,
            estimatedHours: dto.estimatedHours || 1,
        });
        return this.subtaskRepository.save(subtask);
    }

    async assignSubtasks(taskId: string): Promise<{ subtaskId: string; memberId: string; matchScore: number }[]> {
        const qb = this.taskRepository.createQueryBuilder("task");
        qb.where("task.id = :taskId", { taskId });
        const task = await qb.getOne();
        if (!task) return [];
        const subtasks = await this.subtaskRepository.find({ where: { taskId: (task as any).id } });
        const assignments: { subtaskId: string; memberId: string; matchScore: number }[] = [];
        for (const subtask of subtasks) {
            assignments.push({ subtaskId: (subtask as any).id, memberId: "auto-assigned", matchScore: 0.8 });
        }
        return assignments;
    }

    async updateSubtask(id: string, updateDto: UpdateSubtaskDto): Promise<Subtask | null> {
        const qb = this.subtaskRepository.createQueryBuilder("subtask");
        qb.where("subtask.id = :id", { id });
        const subtask = await qb.getOne();
        if (!subtask) return null;
        Object.assign(subtask, updateDto);
        return this.subtaskRepository.save(subtask);
    }

    async reassignSubtask(id: string, dto: ReassignSubtaskDto): Promise<Subtask | null> {
        const qb = this.subtaskRepository.createQueryBuilder("subtask");
        qb.where("subtask.id = :id", { id });
        const subtask = await qb.getOne();
        if (!subtask) return null;
        subtask.assignedTo = dto.newMemberId;
        return this.subtaskRepository.save(subtask);
    }

    async reviewSubtask(id: string, dto: ReviewSubtaskDto): Promise<Subtask | null> {
        const qb = this.subtaskRepository.createQueryBuilder("subtask");
        qb.where("subtask.id = :id", { id });
        const subtask = await qb.getOne();
        if (!subtask) return null;
        subtask.reviewFeedback = dto.feedback;
        if (dto.verdict === "approved") {
            subtask.status = SubtaskStatus.COMPLETED;
        }
        return this.subtaskRepository.save(subtask);
    }

    async urgeSubtask(id: string, dto: UrgeSubtaskDto): Promise<{ success: boolean; message: string }> {
        const qb = this.subtaskRepository.createQueryBuilder("subtask");
        qb.where("subtask.id = :id", { id });
        const subtask = await qb.getOne();
        if (!subtask) {
            return { success: false, message: "子任务不存在" };
        }
        return { success: true, message: "催促已发送" };
    }

    async addDependencies(subtaskId: string, dependencies: DependencyInput[]): Promise<SubtaskDependency[]> {
        const results: SubtaskDependency[] = [];
        for (const dep of dependencies) {
            const dependency = this.dependencyRepository.create({
                fromSubtaskId: dep.fromSubtaskId,
                toSubtaskId: subtaskId,
                type: dep.type as DependencyType,
                condition: dep.condition,
            });
            const saved = await this.dependencyRepository.save(dependency);
            results.push(saved);
        }
        return results;
    }
}
