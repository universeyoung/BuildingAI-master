import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Agent, ScheduledTask, ScheduledTaskRun } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { Injectable, Logger } from "@nestjs/common";
 
@Injectable()
export class ScheduledTaskExecutorService {
  private readonly logger = new Logger(ScheduledTaskExecutorService.name);
 
  constructor(
    @InjectRepository(ScheduledTask)
    private readonly scheduledTaskRepository: Repository<ScheduledTask>,
    @InjectRepository(ScheduledTaskRun)
    private readonly runRepository: Repository<ScheduledTaskRun>,
    @InjectRepository(Agent)
    private readonly agentRepository: Repository<Agent>,
  ) {}
 
  async execute(task: ScheduledTask, existingRun?: ScheduledTaskRun): Promise<ScheduledTaskRun> {
    let run = existingRun;
 
    if (!run) {
      run = this.runRepository.create({
        taskId: task.id,
        chatConversationId: "",
        status: "pending",
        startedAt: new Date(),
      });
      run = await this.runRepository.save(run);
    }
 
    try {
      run.status = "running";
      run = await this.runRepository.save(run);
 
      const agent = await this.agentRepository.findOne({ where: { id: task.agentId } });
      if (!agent) {
        throw new Error(`Agent ${task.agentId} not found`);
      }
 
      const chatParams = this.buildChatParams(task);
 
      // TODO: Integrate with agent ChatCompletionService to send the prompt
      // The execution would create or continue a conversation with the agent,
      // send the prompt message, and wait for the AI response.
      //
      // Example integration flow:
      //   const conversationId = task.conversationMode === "continue" && task.conversationId
      //     ? task.conversationId
      //     : null;
      //   await this.agentChatCompletionService.sendScheduledPrompt({
      //     agentId: task.agentId,
      //     conversationId,
      //     prompt: task.prompt,
      //     modelId: chatParams.modelId,
      //     mcpTools: chatParams.mcpToolIds,
      //     fileIds: chatParams.fileIds,
      //     enableThinking: chatParams.enableThinking,
      //     appId: chatParams.appId,
      //     temperature: chatParams.temperature,
      //     maxTokens: chatParams.maxTokens,
      //   });
 
      this.logger.log(
        `Executing task "${task.name}" (${task.id}) with agent ${task.agentId}, ` +
          `conversation mode: ${task.conversationMode}, params: ${JSON.stringify(chatParams)}`,
      );
 
      // Simulate execution - in production this is replaced by actual AI call
      await this.delay(100);
 
      run.status = "success";
      run.finishedAt = new Date();
      await this.runRepository.save(run);
 
      await this.scheduledTaskRepository.increment(
        { id: task.id },
        "totalRunCount",
        1,
      );
      await this.scheduledTaskRepository.update(task.id, {
        lastRunAt: new Date(),
      });
 
      this.logger.log(`Task "${task.name}" (${task.id}) completed successfully`);
    } catch (error) {
      run.status = "failed";
      run.errorMessage = (error as Error).message;
      run.finishedAt = new Date();
      run = await this.runRepository.save(run);
 
      await this.scheduledTaskRepository.increment(
        { id: task.id },
        "totalRunCount",
        1,
      );
      await this.scheduledTaskRepository.increment(
        { id: task.id },
        "failCount",
        1,
      );
      await this.scheduledTaskRepository.update(task.id, {
        lastRunAt: new Date(),
      });
 
      this.logger.error(`Task "${task.name}" (${task.id}) failed: ${(error as Error).message}`);
    }
 
    return run;
  }
 
  buildChatParams(task: ScheduledTask) {
    const settings = task.advancedSettings || {};
 
    return {
      modelId: settings.modelId || undefined,
      mcpToolIds: settings.mcpToolIds || [],
      fileIds: settings.fileIds || [],
      enableThinking: settings.enableThinking ?? false,
      appId: settings.appId || undefined,
      temperature: settings.temperature ?? undefined,
      maxTokens: settings.maxTokens ?? undefined,
    };
  }
 
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
