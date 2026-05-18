import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useCreateArticleMutation } from "../../../services";
import type { CreateArticleParams, UpdateArticleParams } from "../../../services/types/article";
import ArticleForm from "./components/form";

export default function ArticleAddPage() {
    useDocumentHead({
        title: "发布文章",
    });

    const navigate = useNavigate();
    const createMutation = useCreateArticleMutation();

    const handleSubmit = async (data: CreateArticleParams | UpdateArticleParams) => {
        try {
            await createMutation.mutateAsync(data as CreateArticleParams);
            toast.success("创建成功");
            setTimeout(() => navigate(-1), 1000);
        } catch (error) {
            console.error(error);
        }
    };

    const handleCancel = () => {
        navigate(-1);
    };

    return (
        <>
            <div className="bg-background sticky top-0 z-10 mb-4 flex w-full items-center justify-baseline pb-2">
                <Button variant="secondary" size="icon" onClick={() => navigate(-1)}>
                    <ArrowLeft />
                </Button>

                <h1 className="ml-4 text-xl font-bold">发布文章</h1>
            </div>

            <ArticleForm
                onSubmit={handleSubmit}
                onCancel={handleCancel}
                isSubmitting={createMutation.isPending}
            />
        </>
    );
}
