import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { Agent, ScheduledTask, ScheduledTaskRun } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { Injectable, Logger } from "@nestjs/common";
import { PassThrough } from "stream";

import { AgentChatCompletionService } from "../../ai/agents/services/agent-chat-completion.service";

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
    private readonly agentChatCompletionService: AgentChatCompletionService,
  ) {}

  async execute(task: ScheduledTask, existingRun?: ScheduledTaskRun): Promise<ScheduledTaskRun> {
    let run = existingRun;

    if (!run) {
      run = this.runRepository.create({
        taskId: task.id,
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

      const promptText = task.prompt || task.name;

      const { conversationId } = await this.callAgentBlocking({
        agentId: task.agentId,
        userId: task.userId,
        promptText,
        conversationId:
          task.conversationMode === "continue" ? task.conversationId : undefined,
        runId: run.id,
      });

      if (conversationId) {
        run.chatConversationId = conversationId;
      }

      run.status = "success";
      run.finishedAt = new Date();
      run = await this.runRepository.save(run);

      await this.scheduledTaskRepository.increment({ id: task.id }, "totalRunCount", 1);
      await this.scheduledTaskRepository.update(task.id, { lastRunAt: new Date() });

      this.logger.log(`Task "${task.name}" (${task.id}) completed, conversation: ${conversationId}`);
    } catch (error) {
      run.status = "failed";
      run.errorMessage = (error as Error).message;
      run.finishedAt = new Date();
      run = await this.runRepository.save(run);

      await this.scheduledTaskRepository.increment({ id: task.id }, "totalRunCount", 1);
      await this.scheduledTaskRepository.increment({ id: task.id }, "failCount", 1);
      await this.scheduledTaskRepository.update(task.id, { lastRunAt: new Date() });

      this.logger.error(`Task "${task.name}" (${task.id}) failed: ${(error as Error).message}`);
    }

    return run;
  }

  private callAgentBlocking(params: {
    agentId: string;
    userId: string;
    promptText: string;
    conversationId?: string;
    runId: string;
  }): Promise<{ conversationId?: string }> {
    return new Promise((resolve, reject) => {
      const passThrough = new PassThrough();

      let conversationId: string | undefined;

      passThrough.on("data", (chunk: Buffer) => {
        const str = chunk.toString();
        for (const line of str.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === "data-conversation-id") {
              conversationId = data.data;
            }
          } catch {
            // skip malformed lines
          }
        }
      });

      passThrough.on("finish", () => resolve({ conversationId }));
      passThrough.on("error", (err) => reject(err));

      const mockRes = Object.assign(passThrough, {
        writeHead: () => mockRes,
        setHeader: () => mockRes,
        flushHeaders: () => {},
      });

      this.agentChatCompletionService
        .streamChat(
          {
            agentId: params.agentId,
            userId: params.userId,
            conversationId: params.conversationId,
            saveConversation: true,
            isDebug: false,
            messages: [
              {
                role: "user",
                id: `scheduled-${params.runId}`,
                parts: [{ type: "text", text: params.promptText }],
              },
            ] as any,
          },
          mockRes as any,
        )
        .catch((err) => reject(err));
    });
  }
}
