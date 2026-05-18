import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Spinner } from "@buildingai/ui/components/ui/spinner";
import { ArrowLeft } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { useArticleDetailQuery, useUpdateArticleMutation } from "../../../services";
import type { Article, UpdateArticleParams } from "../../../services/types/article";
import ArticleForm from "./components/form";

export default function ArticleEditPage() {
    useDocumentHead({
        title: "编辑文章",
    });

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const id = searchParams.get("id") || "";

    const { data: article, isLoading } = useArticleDetailQuery(id);
    const updateMutation = useUpdateArticleMutation();

    const handleSubmit = async (data: Partial<Article>) => {
        try {
            const updateData: UpdateArticleParams = {
                title: data.title,
                summary: data.summary,
                content: data.content,
                cover: data.cover,
                status: data.status,
                sort: data.sort,
                categoryId: data.categoryId,
            };
            await updateMutation.mutateAsync({ id, data: updateData });
            toast.success("更新成功");
            setTimeout(() => navigate(-1), 1000);
        } catch (error) {
            console.error(error);
        }
    };

    const handleCancel = () => {
        navigate(-1);
    };

    if (isLoading) {
        return (
            <div className="article-edit-container relative">
                <div className="bg-background sticky top-0 z-10 mb-4 flex w-full items-center justify-baseline pb-2">
                    <Button variant="secondary" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft />
                    </Button>

                    <h1 className="ml-4 text-xl font-bold">编辑文章</h1>
                </div>

                <div className="flex items-center justify-center py-10">
                    <Spinner className="size-8" />
                </div>
            </div>
        );
    }

    return (
        <div className="article-edit-container relative">
            <div className="bg-background sticky top-0 z-10 mb-4 flex w-full items-center justify-baseline pb-2">
                <Button variant="ghost" onClick={() => navigate(-1)}>
                    <ArrowLeft className="mr-2 h-5 w-5" />
                    <span className="text-base font-medium">返回</span>
                </Button>

                <h1 className="ml-4 text-xl font-bold">编辑文章</h1>
            </div>

            <ArticleForm
                initialData={article}
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                isSubmitting={updateMutation.isPending}
            />
        </div>
    );
}
