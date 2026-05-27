import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from "../typeorm";
import { ScheduledTask } from "./scheduled-task.entity";
 
@Entity("scheduled_task_runs")
@Index(["taskId", "createdAt"])
export class ScheduledTaskRun {
  @PrimaryGeneratedColumn("uuid")
  id: string;
 
  @Index()
  @Column({ type: "uuid" })
  taskId: string;
 
  @ManyToOne(() => ScheduledTask, (task) => task.runs)
  @JoinColumn({ name: "taskId" })
  task: ScheduledTask;
 
  @Column({ type: "uuid", comment: "关联的对话记录ID" })
  chatConversationId: string;
 
  @Column({ type: "varchar", length: 20, default: "pending", comment: "pending/running/success/failed" })
  status: "pending" | "running" | "success" | "failed";
 
  @Column({ type: "text", nullable: true })
  errorMessage: string;
 
  @Column({ type: "int", default: 0 })
  tokenUsed: number;
 
  @Column({ type: "timestamptz", nullable: true })
  startedAt: Date;
 
  @Column({ type: "timestamptz", nullable: true })
  finishedAt: Date;
 
  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date;
}
