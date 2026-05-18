import {
    Editor,
    EditorContainer,
    EditorKit,
    markdownToValue,
    Plate,
    serializeEditorToMarkdown,
    usePlateEditor,
} from "@buildingai/ui/components/editor";
import { Button } from "@buildingai/ui/components/ui/button";
import { ImageUpload } from "@buildingai/ui/components/ui/image-upload";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@buildingai/ui/components/ui/select";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { ArticleStatus, useCategoryListQuery } from "../../../../services";
import type {
    Article,
    CreateArticleParams,
    UpdateArticleParams,
} from "../../../../services/types/article";

interface ArticleFormProps {
    initialData?: Partial<Article>;
    onSubmit: (data: CreateArticleParams | UpdateArticleParams) => Promise<void>;
    onCancel: () => void;
    isSubmitting?: boolean;
}

export default function ArticleForm({
    initialData,
    onSubmit,
    onCancel,
    isSubmitting,
}: ArticleFormProps) {
    const { data: categories = [] } = useCategoryListQuery();
    const [formData, setFormData] = useState<Partial<Article>>({
        title: "",
        content: "",
        summary: "",
        cover: "",
        status: ArticleStatus.DRAFT,
        sort: 0,
        categoryId: undefined,
        ...initialData,
    });

    const editorInitialValue = useMemo(
        () => markdownToValue(formData.content || ""),
        [initialData?.content],
    );

    const contentEditor = usePlateEditor({
        plugins: EditorKit,
        id: "article-content",
        value: editorInitialValue,
    });

    useEffect(() => {
        if (initialData) {
            setFormData({ ...formData, ...initialData });
        }
    }, [initialData]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.title?.trim()) {
            toast.error("请输入文章标题");
            return;
        }

        if (!formData.content?.trim()) {
            toast.error("请输入文章内容");
            return;
        }

        try {
            await onSubmit(formData as CreateArticleParams | UpdateArticleParams);
        } catch (error) {
            console.error("提交失败:", error);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="flex flex-1 flex-col">
            <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-4">
                <div className="flex h-full flex-col gap-4 lg:col-span-3">
                    <h3 className="text-lg font-semibold">文章设置</h3>

                    <div className="space-y-2">
                        <Label htmlFor="title">
                            标题 <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="请输入文章标题"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="summary">摘要</Label>
                        <Textarea
                            id="summary"
                            value={formData.summary || ""}
                            onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                            placeholder="请输入文章摘要"
                            rows={3}
                        />
                    </div>

                    <div className="flex flex-1 flex-col space-y-2">
                        <Label htmlFor="content">
                            内容 <span className="text-destructive">*</span>
                        </Label>
                        <Plate
                            editor={contentEditor}
                            onValueChange={() => {
                                const markdown = serializeEditorToMarkdown(contentEditor);
                                setFormData({ ...formData, content: markdown });
                            }}
                        >
                            <EditorContainer className="flex-1 rounded-lg border">
                                <Editor variant="default" />
                            </EditorContainer>
                        </Plate>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">发布设置</h3>

                    <div className="space-y-2">
                        <Label htmlFor="status">
                            状态 <span className="text-destructive">*</span>
                        </Label>
                        <Select
                            value={formData.status}
                            onValueChange={(value) =>
                                setFormData({ ...formData, status: value as ArticleStatus })
                            }
                        >
                            <SelectTrigger id="status" className="w-full">
                                <SelectValue placeholder="选择状态" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={ArticleStatus.DRAFT}>草稿</SelectItem>
                                <SelectItem value={ArticleStatus.PUBLISHED}>已发布</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="categoryId">分类</Label>
                        <Select
                            value={formData.categoryId || "none"}
                            onValueChange={(value) =>
                                setFormData({
                                    ...formData,
                                    categoryId: value === "none" ? "" : value,
                                })
                            }
                        >
                            <SelectTrigger id="categoryId" className="w-full">
                                <SelectValue placeholder="选择分类" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="none">无分类</SelectItem>
                                {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={cat.id}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="cover">封面图</Label>
                        <ImageUpload
                            value={formData.cover}
                            onChange={(url) => setFormData({ ...formData, cover: url || "" })}
                            size="xl"
                            className="w-full"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="sort">排序</Label>
                        <Input
                            id="sort"
                            type="number"
                            value={formData.sort || 0}
                            onChange={(e) =>
                                setFormData({ ...formData, sort: Number(e.target.value) })
                            }
                            placeholder="数字越大越靠前"
                        />
                    </div>

                    <div className="flex flex-col gap-2 pt-4">
                        <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
                            {isSubmitting ? "提交中..." : "提交"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={onCancel}
                            disabled={isSubmitting}
                        >
                            取消
                        </Button>
                    </div>
                </div>
            </div>
        </form>
    );
}
