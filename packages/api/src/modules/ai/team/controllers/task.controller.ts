import { Body, Get, Param, Post, Put } from "@nestjs/common";
import { WebController } from "@common/decorators/controller.decorator";
import { TaskService } from "../services/task.service";
import { CreateTaskDto, UpdateTaskDto, TaskCommandDto, DependencyInput } from "../dto/task.dto";
import { CreateSubtaskDto, UpdateSubtaskDto, ReassignSubtaskDto, ReviewSubtaskDto, UrgeSubtaskDto } from "../dto/subtask.dto";
import { DependencyType } from "@buildingai/db/entities";

@WebController("tasks")
export class TaskController {
    constructor(private readonly taskService: TaskService) {}

    @Post(":teamId")
    async create(@Param("teamId") teamId: string, @Body() createDto: CreateTaskDto) {
        return this.taskService.create(teamId, createDto);
    }

    @Get(":teamId/list")
    async findAll(@Param("teamId") teamId: string) {
        return this.taskService.findAll(teamId);
    }

    @Get(":id")
    async findOne(@Param("id") id: string) {
        return this.taskService.findOne(id);
    }

    @Put(":id")
    async update(@Param("id") id: string, @Body() updateDto: UpdateTaskDto) {
        return this.taskService.update(id, updateDto);
    }

    @Post(":id/plan")
    async plan(@Param("id") id: string) {
        return this.taskService.plan(id);
    }

    @Post(":id/start")
    async start(@Param("id") id: string, @Body() dto: TaskCommandDto) {
        return this.taskService.start(id);
    }

    @Post(":id/pause")
    async pause(@Param("id") id: string) {
        return this.taskService.pause(id);
    }

    @Post(":id/resume")
    async resume(@Param("id") id: string) {
        return this.taskService.resume(id);
    }

    @Post(":id/cancel")
    async cancel(@Param("id") id: string) {
        return this.taskService.cancel(id);
    }

    @Get(":id/progress")
    async getProgress(@Param("id") id: string) {
        return this.taskService.getProgress(id);
    }

    @Post(":id/subtasks")
    async createSubtask(@Param("id") id: string, @Body() createDto: CreateSubtaskDto) {
        return this.taskService.createSubtask(id, createDto);
    }

    @Post(":id/assign")
    async assignSubtasks(@Param("id") id: string) {
        return this.taskService.assignSubtasks(id);
    }

    @Put("subtasks/:id")
    async updateSubtask(@Param("id") id: string, @Body() updateDto: UpdateSubtaskDto) {
        return this.taskService.updateSubtask(id, updateDto);
    }

    @Post("subtasks/:id/reassign")
    async reassignSubtask(@Param("id") id: string, @Body() dto: ReassignSubtaskDto) {
        return this.taskService.reassignSubtask(id, dto);
    }

    @Post("subtasks/:id/review")
    async reviewSubtask(@Param("id") id: string, @Body() dto: ReviewSubtaskDto) {
        return this.taskService.reviewSubtask(id, dto);
    }

    @Post("subtasks/:id/urge")
    async urgeSubtask(@Param("id") id: string, @Body() dto: UrgeSubtaskDto) {
        return this.taskService.urgeSubtask(id, dto);
    }

    @Post(":id/dependencies")
    async addDependencies(@Param("id") id: string, @Body() dependencies: DependencyInput[]) {
        const typedDependencies = dependencies.map(dep => ({
            ...dep,
            type: (dep.type as DependencyType) || DependencyType.FINISH_TO_START
        }));
        return this.taskService.addDependencies(id, typedDependencies);
    }
}
