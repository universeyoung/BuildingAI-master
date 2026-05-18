import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Separator } from "@buildingai/ui/components/ui/separator";
import { Spinner } from "@buildingai/ui/components/ui/spinner";
import { TimeText } from "@buildingai/ui/components/ui/time-text";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useWebCategoryListQuery, useWebPublishedArticlesQuery } from "../services";

export default function BlogIndexPage() {
    useDocumentHead({
        title: "首页",
    });

    const navigate = useNavigate();
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | undefined>(undefined);

    const { data: categories = [] } = useWebCategoryListQuery();
    const { data: articles = [], isLoading: articlesLoading } =
        useWebPublishedArticlesQuery(selectedCategoryId);

    const handleCategorySelect = (categoryId?: string) => {
        setSelectedCategoryId(categoryId);
    };

    const handleArticleClick = (articleId: string) => {
        navigate(`/article/${articleId}`);
    };

    return (
        <div className="bg-background min-h-screen py-12">
            <div className="mx-auto flex max-w-6xl gap-40 px-4 sm:px-6 lg:px-8">
                <div className="flex-1">
                    {/* Mobile category filter */}
                    <div className="mb-8 lg:hidden">
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant={selectedCategoryId === undefined ? "default" : "outline"}
                                size="sm"
                                onClick={() => handleCategorySelect(undefined)}
                            >
                                全部
                            </Button>
                            {categories.map((category) => (
                                <Button
                                    key={category.id}
                                    variant={
                                        selectedCategoryId === category.id ? "default" : "outline"
                                    }
                                    size="sm"
                                    onClick={() => handleCategorySelect(category.id)}
                                >
                                    {category.name}
                                    {category.articleCount > 0 && (
                                        <span className="ml-1 text-xs opacity-70">
                                            ({category.articleCount})
                                        </span>
                                    )}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Loading state */}
                    {articlesLoading && (
                        <div className="flex items-center justify-center py-20">
                            <Spinner className="text-muted-foreground size-8" />
                        </div>
                    )}

                    {/* Empty state */}
                    {!articlesLoading && articles.length === 0 && (
                        <div className="flex items-center justify-center py-20">
                            <p className="text-muted-foreground text-lg">暂无文章</p>
                        </div>
                    )}

                    {/* Article list */}
                    {!articlesLoading && articles.length > 0 && (
                        <div className="space-y-8">
                            {articles.map((article) => (
                                <article
                                    key={article.id}
                                    className="group flex cursor-pointer gap-6 pb-10 transition-all"
                                    onClick={() => handleArticleClick(article.id)}
                                >
                                    <div className="flex-1">
                                        <h2 className="text-foreground group-hover:text-primary mb-1 text-xl leading-tight font-bold transition-colors">
                                            {article.title}
                                        </h2>

                                        {article.summary && (
                                            <p className="text-muted-foreground line-clamp-1 text-sm leading-relaxed">
                                                {article.summary}
                                            </p>
                                        )}

                                        <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs leading-none">
                                            <span>
                                                {article.author?.nickname ||
                                                    article.author?.username ||
                                                    "未知作者"}
                                            </span>
                                            <Separator orientation="vertical" className="h-3.5" />

                                            <TimeText
                                                value={article.publishedAt || article.createdAt}
                                                variant="relative"
                                            />
                                            <Separator orientation="vertical" className="h-3.5" />

                                            {article.category?.name && (
                                                <>
                                                    <span>{article.category.name}</span>
                                                    <span className="text-muted-foreground/50">
                                                        |
                                                    </span>
                                                </>
                                            )}

                                            <span>{article.viewCount || 0} 次阅读</span>
                                        </div>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>

                {/* Desktop sidebar */}
                <aside className="sticky top-12 hidden h-fit w-48 shrink-0 lg:block">
                    <div className="space-y-1">
                        <h3 className="text-foreground mb-4 text-sm font-medium">分类</h3>
                        <Button
                            variant={selectedCategoryId === undefined ? "default" : "ghost"}
                            size="sm"
                            className="w-full justify-start"
                            onClick={() => handleCategorySelect(undefined)}
                        >
                            全部
                        </Button>
                        {categories.map((category) => (
                            <Button
                                key={category.id}
                                variant={selectedCategoryId === category.id ? "default" : "ghost"}
                                size="sm"
                                className="w-full justify-start"
                                onClick={() => handleCategorySelect(category.id)}
                            >
                                <div className="flex w-full items-center justify-between">
                                    <span>{category.name}</span>
                                    {category.articleCount > 0 && (
                                        <span className="text-muted-foreground/60 text-xs">
                                            {category.articleCount}
                                        </span>
                                    )}
                                </div>
                            </Button>
                        ))}
                    </div>
                </aside>
            </div>
        </div>
    );
}
