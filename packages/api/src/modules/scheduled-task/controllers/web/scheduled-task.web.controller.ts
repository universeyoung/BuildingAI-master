import { BaseController } from "@buildingai/base";
import { type UserPlayground } from "@buildingai/db";
import { Playground } from "@buildingai/decorators/playground.decorator";
import { UUIDValidationPipe } from "@buildingai/pipe";
import { WebController } from "@common/decorators/controller.decorator";
import { Body, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common";
 
import { CreateScheduledTaskDto } from "../../dto/create-scheduled-task.dto";
import { QueryScheduledTaskDto } from "../../dto/query-scheduled-task.dto";
import { ToggleScheduledTaskDto } from "../../dto/toggle-scheduled-task.dto";
import { UpdateScheduledTaskDto } from "../../dto/update-scheduled-task.dto";
import { ScheduledTaskService } from "../../services/scheduled-task.service";
 
@WebController("scheduled-tasks")
export class ScheduledTaskWebController extends BaseController {
  constructor(private readonly scheduledTaskService: ScheduledTaskService) {
    super();
  }
 
  @Get()
  async list(@Query() query: QueryScheduledTaskDto, @Playground() user: UserPlayground) {
    const result = await this.scheduledTaskService.paginateTasks(query, user.id);
    return this.paginationResult(result.items, result.total, query);
  }
 
  @Get(":id")
  async detail(@Param("id", UUIDValidationPipe) id: string) {
    return this.scheduledTaskService.findOneById(id);
  }
 
  @Post()
  async create(@Body() dto: CreateScheduledTaskDto, @Playground() user: UserPlayground) {
    return this.scheduledTaskService.createTask(dto, user.id);
  }
 
  @Patch(":id")
  async update(
    @Param("id", UUIDValidationPipe) id: string,
    @Body() dto: UpdateScheduledTaskDto,
  ) {
    return this.scheduledTaskService.updateTask(id, dto);
  }
 
  @Delete(":id")
  async remove(@Param("id", UUIDValidationPipe) id: string) {
    return this.scheduledTaskService.delete(id);
  }
 
  @Post(":id/toggle")
  async toggle(
    @Param("id", UUIDValidationPipe) id: string,
    @Body() dto: ToggleScheduledTaskDto,
  ) {
    return this.scheduledTaskService.toggleEnabled(id, dto.isEnabled);
  }
 
  @Post(":id/run")
  async run(@Param("id", UUIDValidationPipe) id: string, @Playground() user: UserPlayground) {
    return this.scheduledTaskService.runManually(id, user.id);
  }
 
  @Get(":id/runs")
  async runs(
    @Param("id", UUIDValidationPipe) id: string,
    @Query() query: QueryScheduledTaskDto,
    @Playground() user: UserPlayground,
  ) {
    const result = await this.scheduledTaskService.paginateRuns(id, query, user.id);
    return this.paginationResult(result.items, result.total, query);
  }
 
  @Get("runs/:runId/messages")
  async runMessages(
    @Param("runId", UUIDValidationPipe) runId: string,
    @Playground() user: UserPlayground,
  ) {
    return this.scheduledTaskService.getRunMessages(runId, user.id);
  }
}
