import { useDocumentHead } from "@buildingai/hooks";
import { Button } from "@buildingai/ui/components/ui/button";
import { Checkbox } from "@buildingai/ui/components/ui/checkbox";
import { Input } from "@buildingai/ui/components/ui/input";
import { Spinner } from "@buildingai/ui/components/ui/spinner";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@buildingai/ui/components/ui/table";
import { TimeText } from "@buildingai/ui/components/ui/time-text";
import { Pencil, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
    useBatchDeleteCategoriesMutation,
    useCategoryListQuery,
    useDeleteCategoryMutation,
} from "../../../services";
import CategoryEditDialog from "./edit";

export default function ColumnListPage() {
    useDocumentHead({
        title: "栏目管理",
    });

    const [searchName, setSearchName] = useState("");
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const {
        data: categories = [],
        isLoading,
        refetch,
    } = useCategoryListQuery({ name: searchName });
    const deleteMutation = useDeleteCategoryMutation();
    const batchDeleteMutation = useBatchDeleteCategoriesMutation();

    const handleToggleAll = () => {
        const allCurrentPageSelected =
            categories.length > 0 && categories.every((cat) => selectedIds.has(cat.id));

        if (allCurrentPageSelected) {
            // Deselect all items
            const newSelected = new Set(selectedIds);
            categories.forEach((cat) => newSelected.delete(cat.id));
            setSelectedIds(newSelected);
        } else {
            // Select all items
            const newSelected = new Set(selectedIds);
            categories.forEach((cat) => newSelected.add(cat.id));
            setSelectedIds(newSelected);
        }
    };

    const handleToggleRow = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleEdit = (id: string) => {
        setEditingId(id);
        setEditDialogOpen(true);
    };

    const handleCreate = () => {
        setEditingId(null);
        setEditDialogOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm("确定要删除这个分类吗？")) return;

        try {
            await deleteMutation.mutateAsync(id);
            toast.success("删除成功");
            refetch();
        } catch (error) {
            console.error(error);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.size === 0) return;

        if (!confirm(`确定要删除选中的 ${selectedIds.size} 个分类吗？`)) return;

        try {
            await batchDeleteMutation.mutateAsync(Array.from(selectedIds));
            toast.success("批量删除成功");
            setSelectedIds(new Set());
            refetch();
        } catch (error) {
            console.error(error);
        }
    };

    const handleDialogClose = (shouldRefresh?: boolean) => {
        setEditDialogOpen(false);
        setEditingId(null);
        if (shouldRefresh) {
            refetch();
        }
    };

    return (
        <>
            <div className="mb-4 flex flex-wrap gap-4">
                <Input
                    placeholder="搜索分类名称..."
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    className="max-w-xs"
                />

                <div className="ml-auto flex items-end gap-2">
                    {selectedIds.size > 1 && (
                        <Button variant="outline" onClick={() => setSelectedIds(new Set())}>
                            取消全选
                        </Button>
                    )}

                    <Button
                        variant="destructive"
                        disabled={selectedIds.size === 0}
                        onClick={handleBatchDelete}
                    >
                        <Trash />
                        批量删除 ({selectedIds.size})
                    </Button>

                    <Button onClick={handleCreate}>
                        <Plus />
                        新建分类
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <div className="mb-4 flex flex-1 items-center justify-center py-20">
                    <Spinner className="size-8" />
                </div>
            ) : (
                <div className="mb-4 overflow-hidden rounded-md border">
                    <Table>
                        <TableHeader className="bg-muted">
                            <TableRow>
                                <TableHead className="w-12">
                                    <Checkbox
                                        checked={
                                            categories.length > 0 &&
                                            categories.every((cat) => selectedIds.has(cat.id))
                                        }
                                        onCheckedChange={handleToggleAll}
                                        aria-label="Select all"
                                    />
                                </TableHead>
                                <TableHead>名称</TableHead>
                                <TableHead>排序</TableHead>
                                <TableHead>文章数</TableHead>
                                <TableHead>创建时间</TableHead>
                                <TableHead className="w-24">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {categories.length > 0 ? (
                                categories.map((category) => (
                                    <TableRow
                                        key={category.id}
                                        data-state={
                                            selectedIds.has(category.id) ? "selected" : undefined
                                        }
                                    >
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.has(category.id)}
                                                onCheckedChange={() => handleToggleRow(category.id)}
                                                aria-label="Select row"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div>
                                                <p className="font-medium">{category.name}</p>
                                                {category.description && (
                                                    <p className="text-muted-foreground truncate text-sm">
                                                        {category.description}
                                                    </p>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-accent-foreground">
                                                {category.sort || 0}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-accent-foreground">
                                                {category.articleCount || 0}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {category.createdAt ? (
                                                <TimeText
                                                    value={category.createdAt}
                                                    format="YYYY/MM/DD HH:mm"
                                                />
                                            ) : (
                                                "-"
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => handleEdit(category.id)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => handleDelete(category.id)}
                                                >
                                                    <Trash className="text-destructive h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-24 text-center">
                                        暂无数据
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            <div className="flex items-center justify-between">
                <div className="text-muted-foreground text-sm">
                    已选择 {selectedIds.size} / {categories.length} 项
                </div>
            </div>

            <CategoryEditDialog open={editDialogOpen} id={editingId} onClose={handleDialogClose} />
        </>
    );
}
