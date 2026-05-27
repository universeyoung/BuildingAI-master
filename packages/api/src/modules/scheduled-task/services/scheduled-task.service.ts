import { BaseService, PaginationResult } from "@buildingai/base";
import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Agent, ScheduledTask, ScheduledTaskRun } from "@buildingai/db/entities";
import { FindManyOptions, ILike, Repository } from "@buildingai/db/typeorm";
import { HttpErrorFactory } from "@buildingai/errors";
import { forwardRef, Inject, Injectable, Logger } from "@nestjs/common";
 
import { CreateScheduledTaskDto } from "../dto/create-scheduled-task.dto";
import { QueryScheduledTaskDto } from "../dto/query-scheduled-task.dto";
import { UpdateScheduledTaskDto } from "../dto/update-scheduled-task.dto";
import { calculateNextRun, validateCronExpression } from "../utils/cron-parser.util";
import { ScheduledTaskExecutorService } from "./scheduled-task-executor.service";
import { ScheduledTaskSchedulerService } from "./scheduled-task-scheduler.service";
 
@Injectable()
export class ScheduledTaskService extends BaseService<ScheduledTask> {
  private readonly logger = new Logger(ScheduledTaskService.name);
 
  constructor(
    @InjectRepository(ScheduledTask)
    private readonly scheduledTaskRepository: Repository<ScheduledTask>,
    @InjectRepository(ScheduledTaskRun)
    private readonly runRepository: Repository<ScheduledTaskRun>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
    @Inject(forwardRef(() => ScheduledTaskSchedulerService))
    private readonly schedulerService: ScheduledTaskSchedulerService,
    private readonly executorService: ScheduledTaskExecutorService,
  ) {
    super(scheduledTaskRepository);
  }
 
  async createTask(dto: CreateScheduledTaskDto, userId: string): Promise<ScheduledTask> {
    const agent = await this.agentRepository.findOne({ where: { id: dto.agentId } });
    if (!agent) {
      throw HttpErrorFactory.badRequest("智能体不存在");
    }
 
    if (!validateCronExpression(dto.cronExpression)) {
      throw HttpErrorFactory.badRequest("Cron 表达式无效");
    }
 
    if (dto.conversationMode === "continue") {
      if (!dto.conversationId) {
        throw HttpErrorFactory.badRequest("继续会话模式下必须指定会话ID");
      }
    }
 
    const nextRunAt = calculateNextRun(dto.cronExpression);
 
    const task = this.scheduledTaskRepository.create({
      name: dto.name,
      agentId: dto.agentId,
      conversationMode: dto.conversationMode,
      conversationId: dto.conversationId ?? null,
      prompt: dto.prompt ?? null,
      cronExpression: dto.cronExpression,
      isEnabled: dto.isEnabled ?? true,
      advancedSettings: dto.advancedSettings ?? null,
      nextRunAt,
      userId,
    });
 
    const saved = await this.scheduledTaskRepository.save(task);
 
    if (saved.isEnabled) {
      this.schedulerService.register(saved);
    }
 
    this.logger.log(`Task "${saved.name}" (${saved.id}) created by user ${userId}`);
 
    return saved;
  }
 
  async updateTask(id: string, dto: UpdateScheduledTaskDto): Promise<ScheduledTask> {
    const task = await this.scheduledTaskRepository.findOne({ where: { id } as any });
    if (!task) {
      throw HttpErrorFactory.notFound("定时任务不存在");
    }
 
    if (dto.agentId) {
      const agent = await this.agentRepository.findOne({ where: { id: dto.agentId } });
      if (!agent) {
        throw HttpErrorFactory.badRequest("智能体不存在");
      }
    }
 
    if (dto.cronExpression && !validateCronExpression(dto.cronExpression)) {
      throw HttpErrorFactory.badRequest("Cron 表达式无效");
    }
 
    const conversationMode = dto.conversationMode ?? task.conversationMode;
    const conversationId = dto.conversationId !== undefined ? dto.conversationId : task.conversationId;
    if (conversationMode === "continue" && !conversationId) {
      throw HttpErrorFactory.badRequest("继续会话模式下必须指定会话ID");
    }
 
    const cronChanged = dto.cronExpression && dto.cronExpression !== task.cronExpression;
    const enabledChanged = dto.isEnabled !== undefined && dto.isEnabled !== task.isEnabled;
 
    if (dto.name !== undefined) task.name = dto.name;
    if (dto.agentId !== undefined) task.agentId = dto.agentId;
    if (dto.conversationMode !== undefined) task.conversationMode = dto.conversationMode;
    if (dto.conversationId !== undefined) task.conversationId = dto.conversationId ?? null;
    if (dto.prompt !== undefined) task.prompt = dto.prompt ?? null;
    if (dto.cronExpression !== undefined) task.cronExpression = dto.cronExpression;
    if (dto.isEnabled !== undefined) task.isEnabled = dto.isEnabled;
    if (dto.advancedSettings !== undefined) task.advancedSettings = dto.advancedSettings ?? null;
 
    if (dto.cronExpression) {
      task.nextRunAt = calculateNextRun(dto.cronExpression);
    }
 
    const saved = await this.scheduledTaskRepository.save(task);
 
    if (cronChanged || enabledChanged) {
      if (saved.isEnabled) {
        this.schedulerService.register(saved);
      } else {
        this.schedulerService.unregister(saved.id);
      }
    }
 
    this.logger.log(`Task "${saved.name}" (${saved.id}) updated`);
 
    return saved;
  }
 
  async toggleEnabled(id: string, isEnabled: boolean): Promise<ScheduledTask> {
    const task = await this.scheduledTaskRepository.findOne({ where: { id } as any });
    if (!task) {
      throw HttpErrorFactory.notFound("定时任务不存在");
    }
 
    task.isEnabled = isEnabled;
    const saved = await this.scheduledTaskRepository.save(task);
 
    if (isEnabled) {
      this.schedulerService.register(saved);
    } else {
      this.schedulerService.unregister(saved.id);
    }
 
    this.logger.log(`Task "${saved.name}" (${saved.id}) ${isEnabled ? "enabled" : "disabled"}`);
 
    return saved;
  }
 
  async runManually(id: string, userId: string): Promise<ScheduledTaskRun> {
    const task = await this.scheduledTaskRepository.findOne({ where: { id } as any });
    if (!task) {
      throw HttpErrorFactory.notFound("定时任务不存在");
    }
 
    const run = await this.executorService.execute(task);
 
    this.logger.log(`Task "${task.name}" (${task.id}) manually triggered by user ${userId}`);
 
    return run;
  }
 
  async paginateTasks(
    dto: QueryScheduledTaskDto,
    userId: string,
  ): Promise<PaginationResult<ScheduledTask>> {
    const where: any = { userId };
 
    if (dto.keyword) {
      where.name = ILike(`%${dto.keyword}%`);
    }
 
    if (dto.isEnabled !== undefined) {
      where.isEnabled = dto.isEnabled;
    }
 
    if (dto.agentId) {
      where.agentId = dto.agentId;
    }
 
    return this.paginate({
      page: dto.page,
      pageSize: dto.pageSize,
    }, {
      where,
      order: { createdAt: "DESC" },
    } as FindManyOptions<ScheduledTask>);
  }
 
  async paginateRuns(
    taskId: string,
    dto: QueryScheduledTaskDto,
    userId: string,
  ): Promise<PaginationResult<ScheduledTaskRun>> {
    const task = await this.scheduledTaskRepository.findOne({ where: { id: taskId, userId } as any });
    if (!task) {
      throw HttpErrorFactory.notFound("定时任务不存在");
    }
 
    const [items, total] = await this.runRepository.findAndCount({
      where: { taskId },
      order: { createdAt: "DESC" },
      skip: ((dto.page ?? 1) - 1) * (dto.pageSize ?? 15),
      take: dto.pageSize ?? 15,
    });
 
    return {
      items,
      total,
      page: dto.page ?? 1,
      pageSize: dto.pageSize ?? 15,
      totalPages: Math.ceil(total / (dto.pageSize ?? 15)),
    };
  }
 
  async getRunMessages(runId: string, userId: string) {
    const run = await this.runRepository.findOne({
      where: { id: runId },
    });
    if (!run) {
      throw HttpErrorFactory.notFound("执行记录不存在");
    }
 
    const task = await this.scheduledTaskRepository.findOne({ where: { id: run.taskId, userId } as any });
    if (!task) {
      throw HttpErrorFactory.notFound("定时任务不存在");
    }
 
    // TODO: Fetch messages from the chat service using run.chatConversationId
    // The message retrieval would use AiChatRecordService or AgentChatRecordService
    // to get messages for the conversation associated with this run.
    //
    // Example:
    //   return this.aiChatRecordService.getMessages(run.chatConversationId, userId);
 
    return {
      runId: run.id,
      taskId: run.taskId,
      conversationId: run.chatConversationId,
      messages: [],
    };
  }
}
