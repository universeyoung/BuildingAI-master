import { Column, CreateDateColumn, DeleteDateColumn, Entity, Index, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from "../typeorm";
import { Agent } from "./ai-agent.entity";
import { ScheduledTaskRun } from "./scheduled-task-run.entity";
import { User } from "./user.entity";
 
export interface ScheduledTaskAdvancedSettings {
  modelId?: string;
  mcpToolIds?: string[];
  fileIds?: string[];
  enableThinking?: boolean;
  appId?: string;
  temperature?: number;
  maxTokens?: number;
}
 
@Entity("scheduled_tasks")
export class ScheduledTask {
  @PrimaryGeneratedColumn("uuid")
  @Index()
  id: string;
 
  @Index()
  @Column({ length: 100, name: "name", comment: "任务名称" })
  name: string;

  @Column({ type: "text", nullable: true, name: "prompt", comment: "提示词" })
  prompt: string;

  @Column({ type: "uuid", name: "agentId", comment: "智能体ID" })
  agentId: string;

  @ManyToOne(() => Agent, { nullable: true })
  @JoinColumn({ name: "agentId" })
  agent: Agent;

  @Column({ type: "varchar", length: 20, default: "new", name: "conversationMode", comment: "会话模式: new=新建会话, continue=继续历史会话" })
  conversationMode: "new" | "continue";

  @Column({ type: "uuid", nullable: true, name: "conversationId", comment: "继续会话时指定的会话ID" })
  conversationId: string;

  @Column({ length: 100, name: "cronExpression", comment: "Cron 表达式" })
  cronExpression: string;

  @Column({ type: "boolean", default: true, name: "isEnabled", comment: "是否启用" })
  isEnabled: boolean;

  @Column({ type: "json", nullable: true, name: "advancedSettings", comment: "高级设置" })
  advancedSettings: ScheduledTaskAdvancedSettings;

  @Column({ type: "timestamptz", nullable: true, name: "lastRunAt" })
  lastRunAt: Date;

  @Column({ type: "timestamptz", nullable: true, name: "nextRunAt" })
  nextRunAt: Date;

  @Column({ type: "int", default: 0, name: "totalRunCount", comment: "总执行次数" })
  totalRunCount: number;

  @Column({ type: "int", default: 0, name: "failCount", comment: "失败次数" })
  failCount: number;

  @Index()
  @Column({ type: "uuid", name: "userId" })
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: "userId" })
  user: User;

  @CreateDateColumn({ type: "timestamptz", name: "createdAt" })
  createdAt: Date;

  @UpdateDateColumn({ type: "timestamptz", name: "updatedAt" })
  updatedAt: Date;

  @DeleteDateColumn({ type: "timestamptz", nullable: true, name: "deletedAt" })
  deletedAt: Date;

  @OneToMany(() => ScheduledTaskRun, (run) => run.task)
  runs: ScheduledTaskRun[];
}