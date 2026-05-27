/**
 * Migration: add-scheduled-task
 * Version: 26.1.0
 * Generated: 2026-05-27
 */

import { MigrationInterface, QueryRunner } from "typeorm";

export class Migration1779857000000 implements MigrationInterface {
    name = "Migration1779857000000";

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "scheduled_tasks" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(100) NOT NULL, "prompt" text, "agentId" uuid NOT NULL, "conversationMode" character varying(20) NOT NULL DEFAULT 'new', "conversationId" uuid, "cronExpression" character varying(100) NOT NULL, "isEnabled" boolean NOT NULL DEFAULT true, "advancedSettings" json, "lastRunAt" TIMESTAMP WITH TIME ZONE, "nextRunAt" TIMESTAMP WITH TIME ZONE, "totalRunCount" integer NOT NULL DEFAULT '0', "failCount" integer NOT NULL DEFAULT '0', "userId" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_b09553a83b2b9e02ea3b35d5a63" PRIMARY KEY ("id")); COMMENT ON COLUMN "scheduled_tasks"."name" IS '任务名称'; COMMENT ON COLUMN "scheduled_tasks"."prompt" IS '提示词'; COMMENT ON COLUMN "scheduled_tasks"."agentId" IS '智能体ID'; COMMENT ON COLUMN "scheduled_tasks"."conversationMode" IS '会话模式: new=新建会话, continue=继续历史会话'; COMMENT ON COLUMN "scheduled_tasks"."conversationId" IS '继续会话时指定的会话ID'; COMMENT ON COLUMN "scheduled_tasks"."cronExpression" IS 'Cron 表达式'; COMMENT ON COLUMN "scheduled_tasks"."isEnabled" IS '是否启用'; COMMENT ON COLUMN "scheduled_tasks"."advancedSettings" IS '高级设置'; COMMENT ON COLUMN "scheduled_tasks"."totalRunCount" IS '总执行次数'; COMMENT ON COLUMN "scheduled_tasks"."failCount" IS '失败次数'`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_b09553a83b2b9e02ea3b35d5a6" ON "scheduled_tasks" ("id") `,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_3d5e40c7a0e4f3a6b68a1cbda2" ON "scheduled_tasks" ("name") `,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_7c2f4b3d1e0a5f6c7d8e9f0a1" ON "scheduled_tasks" ("userId") `,
        );
        await queryRunner.query(`COMMENT ON TABLE "scheduled_tasks" IS '定时任务'`);

        await queryRunner.query(
            `CREATE TABLE IF NOT EXISTS "scheduled_task_runs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "taskId" uuid NOT NULL, "chatConversationId" uuid NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'pending', "errorMessage" text, "tokenUsed" integer NOT NULL DEFAULT '0', "startedAt" TIMESTAMP WITH TIME ZONE, "finishedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9a8f4e3c7d1b5a2f6e0d8c4b9a" PRIMARY KEY ("id")); COMMENT ON COLUMN "scheduled_task_runs"."chatConversationId" IS '关联的对话记录ID'; COMMENT ON COLUMN "scheduled_task_runs"."status" IS 'pending/running/success/failed'`,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_9a8f4e3c7d1b5a2f6e0d8c4b9" ON "scheduled_task_runs" ("taskId") `,
        );
        await queryRunner.query(
            `CREATE INDEX IF NOT EXISTS "IDX_4f2a1c8e6b3d9f5a7c0e2d4b8" ON "scheduled_task_runs" ("taskId", "createdAt") `,
        );
        await queryRunner.query(`COMMENT ON TABLE "scheduled_task_runs" IS '定时任务执行记录'`);

        await queryRunner.query(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_d6e2f1a3b4c5d7e8f9a0b1c2d') THEN ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "FK_d6e2f1a3b4c5d7e8f9a0b1c2d" FOREIGN KEY ("agentId") REFERENCES "ai_agent"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$`,
        );
        await queryRunner.query(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_3e4f5a6b7c8d9e0f1a2b3c4d5') THEN ALTER TABLE "scheduled_tasks" ADD CONSTRAINT "FK_3e4f5a6b7c8d9e0f1a2b3c4d5" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE NO ACTION ON UPDATE NO ACTION; END IF; END $$`,
        );
        await queryRunner.query(
            `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_5a6b7c8d9e0f1a2b3c4d5e6f7') THEN ALTER TABLE "scheduled_task_runs" ADD CONSTRAINT "FK_5a6b7c8d9e0f1a2b3c4d5e6f7" FOREIGN KEY ("taskId") REFERENCES "scheduled_tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION; END IF; END $$`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TABLE "scheduled_task_runs" DROP CONSTRAINT IF EXISTS "FK_5a6b7c8d9e0f1a2b3c4d5e6f7"`,
        );
        await queryRunner.query(
            `ALTER TABLE "scheduled_tasks" DROP CONSTRAINT IF EXISTS "FK_3e4f5a6b7c8d9e0f1a2b3c4d5"`,
        );
        await queryRunner.query(
            `ALTER TABLE "scheduled_tasks" DROP CONSTRAINT IF EXISTS "FK_d6e2f1a3b4c5d7e8f9a0b1c2d"`,
        );
        await queryRunner.query(`COMMENT ON TABLE "scheduled_task_runs" IS NULL`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_4f2a1c8e6b3d9f5a7c0e2d4b8"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_9a8f4e3c7d1b5a2f6e0d8c4b9"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "scheduled_task_runs"`);
        await queryRunner.query(`COMMENT ON TABLE "scheduled_tasks" IS NULL`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_7c2f4b3d1e0a5f6c7d8e9f0a1"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_3d5e40c7a0e4f3a6b68a1cbda2"`);
        await queryRunner.query(`DROP INDEX IF EXISTS "public"."IDX_b09553a83b2b9e02ea3b35d5a6"`);
        await queryRunner.query(`DROP TABLE IF EXISTS "scheduled_tasks"`);
    }
}
