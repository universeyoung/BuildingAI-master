import { Button } from "@buildingai/ui/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@buildingai/ui/components/ui/dialog";
import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { Spinner } from "@buildingai/ui/components/ui/spinner";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
    useCategoryDetailQuery,
    useCreateCategoryMutation,
    useUpdateCategoryMutation,
} from "../../../services";
import type { CreateCategoryParams, UpdateCategoryParams } from "../../../services/types/category";

interface CategoryEditDialogProps {
    open: boolean;
    id: string | null;
    onClose: (shouldRefresh?: boolean) => void;
}

export default function CategoryEditDialog({ open, id, onClose }: CategoryEditDialogProps) {
    const [formData, setFormData] = useState<CreateCategoryParams | UpdateCategoryParams>({
        name: "",
        description: "",
        sort: 0,
    });

    const { data: category, isLoading } = useCategoryDetailQuery(id!, { enabled: !!id && open });
    const createMutation = useCreateCategoryMutation();
    const updateMutation = useUpdateCategoryMutation();

    useEffect(() => {
        if (category && id) {
            setFormData({
                name: category.name,
                description: category.description || "",
                sort: category.sort || 0,
            });
        } else {
            setFormData({
                name: "",
                description: "",
                sort: 0,
            });
        }
    }, [category, id, open]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name?.trim()) {
            toast.error("请输入分类名称");
            return;
        }

        try {
            if (id) {
                const updateData: UpdateCategoryParams = {
                    name: formData.name,
                    description: formData.description,
                    sort: formData.sort,
                };
                await updateMutation.mutateAsync({ id, data: updateData });
                toast.success("更新成功");
            } else {
                const createData: CreateCategoryParams = {
                    name: formData.name,
                    description: formData.description,
                    sort: formData.sort,
                };
                await createMutation.mutateAsync(createData);
                toast.success("创建成功");
            }
            onClose(true);
        } catch (error) {
            console.error(error);
        }
    };

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    return (
        <Dialog open={open} onOpenChange={() => onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>{id ? "编辑分类" : "新建分类"}</DialogTitle>
                    <DialogDescription>
                        {id ? "编辑分类信息" : "创建新的文章分类"}
                    </DialogDescription>
                </DialogHeader>

                {isLoading && id ? (
                    <div className="flex items-center justify-center py-20">
                        <Spinner className="size-8" />
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name">
                                名称 <span className="text-destructive">*</span>
                            </Label>
                            <Input
                                id="name"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="请输入分类名称"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="description">描述</Label>
                            <Textarea
                                id="description"
                                value={formData.description || ""}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                placeholder="请输入分类描述"
                                rows={3}
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

                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onClose()}
                                disabled={isSubmitting}
                            >
                                取消
                            </Button>
                            <Button type="submit" disabled={isSubmitting} loading={isSubmitting}>
                                {isSubmitting ? "保存中..." : "保存"}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
