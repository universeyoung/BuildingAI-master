import { useDocumentHead } from "@buildingai/hooks";
import { EditorContentRenderer } from "@buildingai/ui/components/editor";
import { Separator } from "@buildingai/ui/components/ui/separator";
import { Spinner } from "@buildingai/ui/components/ui/spinner";
import { TimeText } from "@buildingai/ui/components/ui/time-text";
import { ChevronLeft, User } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { useWebArticleDetailQuery } from "../../services";

export default function ArticleDetailPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { data: article, isLoading } = useWebArticleDetailQuery(id!);

    useDocumentHead({
        title: article?.title,
    });

    if (isLoading) {
        return (
            <div className="bg-background min-h-screen py-12">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-center py-20">
                        <Spinner className="text-muted-foreground size-8" />
                    </div>
                </div>
            </div>
        );
    }

    if (!article) {
        return (
            <div className="bg-background min-h-screen py-12">
                <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-center py-20">
                        <p className="text-muted-foreground text-lg">文章不存在</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-background min-h-screen py-12">
            <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
                <article>
                    <h1 className="text-foreground text-3xl leading-tight font-bold">
                        {article.title}
                    </h1>

                    <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm leading-none">
                        <button
                            onClick={() => navigate(-1)}
                            className="flex items-center gap-0.5 hover:underline hover:underline-offset-2"
                        >
                            <ChevronLeft className="size-4" />
                            <span>返回</span>
                        </button>
                        <Separator orientation="vertical" className="h-3.5" />
                        <div className="flex items-center gap-0.5">
                            <User className="size-3.5" />
                            {article.author?.nickname || article.author?.username || "未知作者"}
                        </div>
                        <Separator orientation="vertical" className="h-3.5" />

                        <TimeText
                            value={article.publishedAt || article.createdAt}
                            variant="relative"
                        />
                        <Separator orientation="vertical" className="h-3.5" />

                        {article.category?.name && (
                            <>
                                <span>{article.category.name}</span>
                                <Separator orientation="vertical" />
                            </>
                        )}

                        <span>{article.viewCount || 0} 次阅读</span>
                    </div>

                    {article.cover && (
                        <div className="mt-2 h-96 overflow-hidden rounded-lg">
                            <img
                                src={article.cover}
                                alt={article.title}
                                className="h-full w-full object-cover"
                            />
                        </div>
                    )}

                    {article.summary && (
                        <p className="bg-muted text-muted-foreground mt-4 rounded-lg p-2 text-sm leading-relaxed">
                            {article.summary}
                        </p>
                    )}

                    <div className="prose prose-lg dark:prose-invert mt-6 max-w-none pb-10">
                        {/* <div dangerouslySetInnerHTML={{ __html: article.content }} /> */}
                        <EditorContentRenderer value={article.content} />
                    </div>
                </article>
            </div>
        </div>
    );
}
