/**
 * Article types
 * @description Shared type definitions for article
 */

export const ArticleStatus = {
    DRAFT: "draft",
    PUBLISHED: "published",
} as const;

export type ArticleStatus = (typeof ArticleStatus)[keyof typeof ArticleStatus];

export interface Article {
    id: string;
    title: string;
    summary?: string;
    content: string;
    cover?: string;
    status: ArticleStatus;
    viewCount: number;
    sort: number;
    categoryId?: string;
    publishedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
    category?: {
        id: string;
        name: string;
        description?: string;
    };
    author?: {
        id: string;
        username?: string;
        nickname?: string;
    };
}

export interface QueryArticleParams {
    page?: number;
    pageSize?: number;
    title?: string;
    status?: ArticleStatus;
    categoryId?: string;
}

export interface CreateArticleParams {
    title: string;
    summary?: string;
    content: string;
    cover?: string;
    status?: ArticleStatus;
    sort?: number;
    categoryId?: string;
}

export interface UpdateArticleParams {
    title?: string;
    summary?: string;
    content?: string;
    cover?: string;
    status?: ArticleStatus;
    sort?: number;
    categoryId?: string;
}
