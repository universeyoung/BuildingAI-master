import { InjectRepository } from "@buildingai/db/@nestjs/typeorm";
import { AgentAnnotation, AgentChatRecord } from "@buildingai/db/entities";
import { Repository } from "@buildingai/db/typeorm";
import { Injectable } from "@nestjs/common";

export interface DashboardChartItem {
    date: string;
    value: number;
}

export interface DailyFeedbackItem {
    date: string;
    like: number;
    dislike: number;
}

export interface AgentDashboardResult {
    cards: {
        totalRecords: number;
        totalMessages: number;
        totalTokens: number;
        totalPower: number;
        totalAnnotations: number;
        hitAnnotations: number;
    };
    charts: {
        dailyTokens: DashboardChartItem[];
        dailyMessages: DashboardChartItem[];
        dailyUsers: DashboardChartItem[];
        dailyPower: DashboardChartItem[];
        dailyRecords: DashboardChartItem[];
        dailyFeedback: DailyFeedbackItem[];
        dailyAnnotations: DashboardChartItem[];
    };
}

@Injectable()
export class AgentDashboardService {
    constructor(
        @InjectRepository(AgentChatRecord)
        private readonly chatRecordRepository: Repository<AgentChatRecord>,
        @InjectRepository(AgentAnnotation)
        private readonly annotationRepository: Repository<AgentAnnotation>,
    ) {}

    async getDashboard(
        agentId: string,
        startTime?: string,
        endTime?: string,
    ): Promise<AgentDashboardResult> {
        const [cards, charts] = await Promise.all([
            this.getCards(agentId),
            this.getCharts(agentId, startTime, endTime),
        ]);
        return { cards, charts };
    }

    private async getCards(agentId: string): Promise<AgentDashboardResult["cards"]> {
        const [recordStats, annotationStats, hitAnnotationCount] = await Promise.all([
            this.chatRecordRepository
                .createQueryBuilder("r")
                .select("COUNT(*)", "totalRecords")
                .addSelect("COALESCE(SUM(r.message_count), 0)", "totalMessages")
                .addSelect("COALESCE(SUM(r.total_tokens), 0)", "totalTokens")
                .addSelect("COALESCE(SUM(r.consumed_power), 0)", "totalPower")
                .where("r.agentId = :agentId", { agentId })
                .andWhere("r.isDeleted = false")
                .getRawOne<{
                    totalRecords: string;
                    totalMessages: string;
                    totalTokens: string;
                    totalPower: string;
                }>(),
            this.annotationRepository.count({ where: { agentId } }),
            this.annotationRepository
                .createQueryBuilder("a")
                .where("a.agentId = :agentId", { agentId })
                .andWhere("a.hitCount > 0")
                .getCount(),
        ]);

        return {
            totalRecords: parseInt(recordStats?.totalRecords ?? "0"),
            totalMessages: parseInt(recordStats?.totalMessages ?? "0"),
            totalTokens: parseInt(recordStats?.totalTokens ?? "0"),
            totalPower: parseInt(recordStats?.totalPower ?? "0"),
            totalAnnotations: annotationStats,
            hitAnnotations: hitAnnotationCount,
        };
    }

    private async getCharts(
        agentId: string,
        startTime?: string,
        endTime?: string,
    ): Promise<AgentDashboardResult["charts"]> {
        const [
            dailyTokens,
            dailyMessages,
            dailyUsers,
            dailyPower,
            dailyRecords,
            dailyFeedback,
            dailyAnnotations,
        ] = await Promise.all([
            this.queryDailyRecordStat(agentId, "total_tokens", startTime, endTime),
            this.queryDailyRecordStat(agentId, "message_count", startTime, endTime),
            this.queryDailyUsers(agentId, startTime, endTime),
            this.queryDailyRecordStat(agentId, "consumed_power", startTime, endTime),
            this.queryDailyRecords(agentId, startTime, endTime),
            this.queryDailyFeedback(agentId, startTime, endTime),
            this.queryDailyAnnotations(agentId, startTime, endTime),
        ]);

        const dates = this.getDateRange(startTime, endTime);
        if (dates.length > 0) {
            const feedbackFilled = this.fillFeedbackSeries(dates, dailyFeedback);
            return {
                dailyTokens: this.fillChartSeries(dates, dailyTokens),
                dailyMessages: this.fillChartSeries(dates, dailyMessages),
                dailyUsers: this.fillChartSeries(dates, dailyUsers),
                dailyPower: this.fillChartSeries(dates, dailyPower),
                dailyRecords: this.fillChartSeries(dates, dailyRecords),
                dailyFeedback: feedbackFilled,
                dailyAnnotations: this.fillChartSeries(dates, dailyAnnotations),
            };
        }
        return {
            dailyTokens,
            dailyMessages,
            dailyUsers,
            dailyPower,
            dailyRecords,
            dailyFeedback,
            dailyAnnotations,
        };
    }

    private getDateRange(startTime?: string, endTime?: string): string[] {
        if (!startTime || !endTime) return [];
        const start = new Date(startTime);
        const end = new Date(endTime);
        const dates: string[] = [];
        const cur = new Date(start);
        cur.setUTCHours(0, 0, 0, 0);
        const endDay = new Date(end);
        endDay.setUTCHours(0, 0, 0, 0);
        while (cur <= endDay) {
            dates.push(cur.toISOString().slice(0, 10));
            cur.setUTCDate(cur.getUTCDate() + 1);
        }
        return dates;
    }

    private fillChartSeries(dates: string[], series: DashboardChartItem[]): DashboardChartItem[] {
        const map = new Map(series.map((s) => [s.date, s.value]));
        return dates.map((date) => ({ date, value: map.get(date) ?? 0 }));
    }

    private fillFeedbackSeries(dates: string[], series: DailyFeedbackItem[]): DailyFeedbackItem[] {
        const map = new Map(series.map((s) => [s.date, s]));
        return dates.map((date) => {
            const item = map.get(date);
            return { date, like: item?.like ?? 0, dislike: item?.dislike ?? 0 };
        });
    }

    private async queryDailyRecords(
        agentId: string,
        startTime?: string,
        endTime?: string,
    ): Promise<DashboardChartItem[]> {
        const qb = this.chatRecordRepository
            .createQueryBuilder("r")
            .select("TO_CHAR(DATE_TRUNC('day', r.created_at), 'YYYY-MM-DD')", "date")
            .addSelect("COUNT(*)", "value")
            .where("r.agentId = :agentId", { agentId })
            .andWhere("r.isDeleted = false")
            .groupBy("DATE_TRUNC('day', r.created_at)")
            .orderBy("DATE_TRUNC('day', r.created_at)", "ASC");
        this.applyTimeRange(qb, startTime, endTime);
        const rows = await qb.getRawMany<{ date: string; value: string }>();
        return rows.map((r) => ({ date: r.date, value: parseInt(r.value) }));
    }

    private async queryDailyFeedback(
        agentId: string,
        startTime?: string,
        endTime?: string,
    ): Promise<DailyFeedbackItem[]> {
        const qb = this.chatRecordRepository
            .createQueryBuilder("r")
            .select("TO_CHAR(DATE_TRUNC('day', r.created_at), 'YYYY-MM-DD')", "date")
            .addSelect("COALESCE(SUM((r.feedback_status->>'like')::int), 0)", "like")
            .addSelect("COALESCE(SUM((r.feedback_status->>'dislike')::int), 0)", "dislike")
            .where("r.agentId = :agentId", { agentId })
            .andWhere("r.isDeleted = false")
            .andWhere("r.feedback_status IS NOT NULL")
            .groupBy("DATE_TRUNC('day', r.created_at)")
            .orderBy("DATE_TRUNC('day', r.created_at)", "ASC");
        this.applyTimeRange(qb, startTime, endTime);
        const rows = await qb.getRawMany<{ date: string; like: string; dislike: string }>();
        return rows.map((r) => ({
            date: r.date,
            like: parseInt(r.like),
            dislike: parseInt(r.dislike),
        }));
    }

    private async queryDailyAnnotations(
        agentId: string,
        startTime?: string,
        endTime?: string,
    ): Promise<DashboardChartItem[]> {
        const qb = this.annotationRepository
            .createQueryBuilder("a")
            .select("TO_CHAR(DATE_TRUNC('day', a.created_at), 'YYYY-MM-DD')", "date")
            .addSelect("COUNT(*)", "value")
            .where("a.agentId = :agentId", { agentId })
            .groupBy("DATE_TRUNC('day', a.created_at)")
            .orderBy("DATE_TRUNC('day', a.created_at)", "ASC");
        if (startTime) {
            qb.andWhere("a.created_at >= :startTime", { startTime });
        }
        if (endTime) {
            qb.andWhere("a.created_at <= :endTime", { endTime });
        }
        const rows = await qb.getRawMany<{ date: string; value: string }>();
        return rows.map((r) => ({ date: r.date, value: parseInt(r.value) }));
    }

    private async queryDailyRecordStat(
        agentId: string,
        column: "total_tokens" | "message_count" | "consumed_power",
        startTime?: string,
        endTime?: string,
    ): Promise<DashboardChartItem[]> {
        const qb = this.chatRecordRepository
            .createQueryBuilder("r")
            .select("TO_CHAR(DATE_TRUNC('day', r.created_at), 'YYYY-MM-DD')", "date")
            .addSelect(`COALESCE(SUM(r.${column}), 0)`, "value")
            .where("r.agentId = :agentId", { agentId })
            .andWhere("r.isDeleted = false")
            .groupBy("DATE_TRUNC('day', r.created_at)")
            .orderBy("DATE_TRUNC('day', r.created_at)", "ASC");

        this.applyTimeRange(qb, startTime, endTime);

        const rows = await qb.getRawMany<{ date: string; value: string }>();
        return rows.map((r) => ({ date: r.date, value: parseInt(r.value) }));
    }

    private async queryDailyUsers(
        agentId: string,
        startTime?: string,
        endTime?: string,
    ): Promise<DashboardChartItem[]> {
        const qb = this.chatRecordRepository
            .createQueryBuilder("r")
            .select("TO_CHAR(DATE_TRUNC('day', r.created_at), 'YYYY-MM-DD')", "date")
            .addSelect("COUNT(DISTINCT r.user_id)", "value")
            .where("r.agentId = :agentId", { agentId })
            .andWhere("r.isDeleted = false")
            .andWhere("r.userId IS NOT NULL")
            .groupBy("DATE_TRUNC('day', r.created_at)")
            .orderBy("DATE_TRUNC('day', r.created_at)", "ASC");

        this.applyTimeRange(qb, startTime, endTime);

        const rows = await qb.getRawMany<{ date: string; value: string }>();
        return rows.map((r) => ({ date: r.date, value: parseInt(r.value) }));
    }

    private applyTimeRange(
        qb: ReturnType<Repository<AgentChatRecord>["createQueryBuilder"]>,
        startTime?: string,
        endTime?: string,
    ): void {
        if (startTime) {
            qb.andWhere("r.created_at >= :startTime", { startTime });
        }
        if (endTime) {
            qb.andWhere("r.created_at <= :endTime", { endTime });
        }
    }
}
