import { ExperienceCategory } from "@buildingai/db/entities";

export interface TaskSummary {
    taskId: string;
    taskName: string;
    overallSummary: string;
    keyAchievements: string[];
    challengesEncountered: string[];
    recommendations: string[];
}

export interface MemberRating {
    memberId: string;
    memberName: string;
    score: number;
    strengths: string[];
    areasForImprovement: string[];
}

export interface ExperienceSearchResult {
    cardId: string;
    title: string;
    content: string;
    category: ExperienceCategory;
    relevanceScore: number;
}
