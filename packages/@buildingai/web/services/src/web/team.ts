import { apiHttpClient } from "../base";
import type { Team, TeamMember, LocalAgent, Task, Subtask, Message, SharedMemoryEntry } from "@buildingai/db/entities";

export interface CreateTeamInput {
    name: string;
    description?: string;
    leadType: "human" | "ai" | "dual";
    leadAgentId?: string;
}

export interface UpdateTeamInput {
    name?: string;
    description?: string;
    leadType?: "human" | "ai" | "dual";
    leadAgentId?: string;
}

export interface TeamQueryInput {
    name?: string;
    leadType?: string;
    page?: number;
    pageSize?: number;
    search?: string;
}

export interface TeamListResult {
    items: Team[];
    total: number;
    page: number;
    pageSize: number;
}

export interface AddMembersInput {
    agentIds: string[];
    roles?: string[];
}

export interface CreateTaskInput {
    name: string;
    description?: string;
    messaging?: boolean;
    workflow?: boolean;
    sharedSpace?: boolean;
}

export interface CreateSubtaskInput {
    name: string;
    description?: string;
    priority?: string;
    estimatedHours?: number;
}

export interface MessageInput {
    content: Record<string, unknown>;
    contentType?: string;
}

export interface MemoryInput {
    key: string;
    value: Record<string, unknown>;
}

export const teamApi = {
    getAll: async (query?: TeamQueryInput): Promise<TeamListResult> => {
        const params = new URLSearchParams();
        if (query?.name) params.set("name", query.name);
        if (query?.leadType) params.set("leadType", query.leadType);
        if (query?.page) params.set("page", String(query.page));
        if (query?.pageSize) params.set("pageSize", String(query.pageSize));
        if (query?.search) params.set("search", query.search);
        
        const res = await apiHttpClient.get(`/teams?${params.toString()}`);
        return res.data;
    },

    getById: async (id: string): Promise<Team> => {
        const res = await apiHttpClient.get(`/teams/${id}`);
        return res.data;
    },

    create: async (input: CreateTeamInput): Promise<Team> => {
        const res = await apiHttpClient.post("/teams", input);
        return res.data;
    },

    update: async (id: string, input: UpdateTeamInput): Promise<Team> => {
        const res = await apiHttpClient.put(`/teams/${id}`, input);
        return res.data;
    },

    delete: async (id: string): Promise<{ success: boolean; message?: string }> => {
        const res = await apiHttpClient.delete(`/teams/${id}`);
        return res.data;
    },

    getMembers: async (teamId: string): Promise<TeamMember[]> => {
        const res = await apiHttpClient.get(`/teams/${teamId}/members`);
        return res.data;
    },

    addMembers: async (teamId: string, input: AddMembersInput): Promise<{ agentId: string; success: boolean }[]> => {
        const res = await apiHttpClient.post(`/teams/${teamId}/members`, input);
        return res.data;
    },

    removeMember: async (teamId: string, memberId: string): Promise<{ success: boolean; message?: string }> => {
        const res = await apiHttpClient.delete(`/teams/${teamId}/members/${memberId}`);
        return res.data;
    },

    getSkills: async (teamId: string): Promise<{ skills: { name: string; count: number; agents: string[] }[] }> => {
        const res = await apiHttpClient.get(`/teams/${teamId}/skills`);
        return res.data;
    },

    getAgents: async (keywords?: string[], tags?: string[]): Promise<LocalAgent[]> => {
        const params = new URLSearchParams();
        if (keywords?.length) params.set("keywords", keywords.join(","));
        if (tags?.length) params.set("tags", tags.join(","));
        
        const res = await apiHttpClient.get(`/agents?${params.toString()}`);
        return res.data;
    },

    scanAgents: async (): Promise<{ loaded: LocalAgent[]; warnings: { path: string; reason: string }[] }> => {
        const res = await apiHttpClient.post("/agents/scan");
        return res.data;
    },

    scanCustomDirectory: async (path: string): Promise<{ loaded: LocalAgent | null; warnings: string[] }> => {
        const res = await apiHttpClient.post("/agents/scan-directory", { path });
        return res.data;
    },

    scanMultipleDirectories: async (paths: string[]): Promise<{ loaded: LocalAgent[]; warnings: { path: string; reason: string }[] }> => {
        const res = await apiHttpClient.post("/agents/scan-directories", { paths });
        return res.data;
    },

    createTask: async (teamId: string, input: CreateTaskInput): Promise<Task> => {
        const res = await apiHttpClient.post(`/teams/${teamId}/tasks`, input);
        return res.data;
    },

    getTasks: async (teamId: string): Promise<Task[]> => {
        const res = await apiHttpClient.get(`/teams/${teamId}/tasks`);
        return res.data;
    },

    getTaskById: async (id: string): Promise<Task> => {
        const res = await apiHttpClient.get(`/tasks/${id}`);
        return res.data;
    },

    planTask: async (id: string): Promise<{ subtasks: { name: string; description: string; estimatedHours: number }[] }> => {
        const res = await apiHttpClient.post(`/api/tasks/${id}/plan`);
        return res.data;
    },

    startTask: async (id: string): Promise<{ success: boolean; affectedSubtasks: number }> => {
        const res = await apiHttpClient.post(`/api/tasks/${id}/start`);
        return res.data;
    },

    pauseTask: async (id: string): Promise<{ success: boolean; affectedSubtasks: number }> => {
        const res = await apiHttpClient.post(`/api/tasks/${id}/pause`);
        return res.data;
    },

    resumeTask: async (id: string): Promise<{ success: boolean; affectedSubtasks: number }> => {
        const res = await apiHttpClient.post(`/tasks/${id}/resume`);
        return res.data;
    },

    cancelTask: async (id: string): Promise<{ success: boolean; affectedSubtasks: number }> => {
        const res = await apiHttpClient.post(`/api/tasks/${id}/cancel`);
        return res.data;
    },

    getTaskProgress: async (id: string): Promise<{ subtasks: { id: string; status: string; progress: number }[] }> => {
        const res = await apiHttpClient.get(`/tasks/${id}/progress`);
        return res.data;
    },

    createSubtask: async (taskId: string, input: CreateSubtaskInput): Promise<Subtask> => {
        const res = await apiHttpClient.post(`/tasks/${taskId}/subtasks`, input);
        return res.data;
    },

    assignSubtasks: async (taskId: string): Promise<{ subtaskId: string; memberId: string; matchScore: number }[]> => {
        const res = await apiHttpClient.post(`/api/tasks/${taskId}/assign`);
        return res.data;
    },

    updateSubtask: async (id: string, input: Partial<Subtask>): Promise<Subtask> => {
        const res = await apiHttpClient.put(`/subtasks/${id}`, input);
        return res.data;
    },

    reassignSubtask: async (id: string, newMemberId: string): Promise<Subtask> => {
        const res = await apiHttpClient.post(`/api/subtasks/${id}/reassign`, { newMemberId });
        return res.data;
    },

    reviewSubtask: async (id: string, verdict: "approved" | "rejected", feedback?: string): Promise<Subtask> => {
        const res = await apiHttpClient.post(`/subtasks/${id}/review`, { verdict, feedback });
        return res.data;
    },

    urgeSubtask: async (id: string, reason?: string, newDeadline?: string): Promise<{ success: boolean; message: string }> => {
        const res = await apiHttpClient.post(`/api/subtasks/${id}/urge`, { reason, newDeadline });
        return res.data;
    },

    getMessages: async (teamId: string): Promise<Message[]> => {
        const res = await apiHttpClient.get(`/teams/${teamId}/space/messages`);
        return res.data;
    },

    sendMessage: async (teamId: string, input: MessageInput): Promise<{ messageId: string; delivered: boolean }> => {
        const res = await apiHttpClient.post(`/teams/${teamId}/space/messages`, input);
        return res.data;
    },

    getMemory: async (teamId: string, key?: string): Promise<{ success: boolean; key?: string; value?: SharedMemoryEntry; entries?: SharedMemoryEntry[] }> => {
        const url = key ? `/teams/${teamId}/space/memory?key=${key}` : `/teams/${teamId}/space/memory`;
        const res = await apiHttpClient.get(url);
        return res.data;
    },

    writeMemory: async (teamId: string, input: MemoryInput, memberId: string): Promise<{ entryId: string }> => {
        const res = await apiHttpClient.post(`/teams/${teamId}/space/memory`, { ...input, memberId });
        return res.data;
    },

    getSummary: async (taskId: string): Promise<{ summary: string; stats: Record<string, unknown>; issues: Record<string, unknown>[]; ratings: Record<string, unknown> }> => {
        const res = await apiHttpClient.get(`/api/tasks/${taskId}/summary`);
        return res.data;
    },

    getExperiences: async (teamId: string, query?: string, category?: string): Promise<{ title: string; category: string; content: string; tags: string[] }[]> => {
        const params = new URLSearchParams();
        if (query) params.set("query", query);
        if (category) params.set("category", category);
        
        const res = await apiHttpClient.get(`/teams/${teamId}/experiences?${params.toString()}`);
        return res.data;
    },
};