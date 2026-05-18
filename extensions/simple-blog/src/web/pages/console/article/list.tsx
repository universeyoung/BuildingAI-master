import { useDocumentHead } from "@buildingai/hooks";
import { Badge } from "@buildingai/ui/components/ui/badge";
import { Button } from "@buildingai/ui/components/ui/button";
import { Checkbox } from "@buildingai/ui/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@buildingai/ui/components/ui/dropdown-menu";
import { Input } from "@buildingai/ui/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@buildingai/ui/components/ui/select";
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
import { usePagination } from "@buildingai/ui/hooks/use-pagination";
import { Eye, EyeOff, FileText, MoreVertical, Pencil, Plus, Trash } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import {
    ArticleStatus,
    useArticleListQuery,
    useBatchDeleteArticlesMutation,
    useCategoryListQuery,
    useDeleteArticleMutation,
    usePublishArticleMutation,
    useUnpublishArticleMutation,
} from "../../../services";
import type { QueryArticleParams } from "../../../services/types/article";

export default function ArticleListPage() {
    useDocumentHead({
        title: "文章列表",
    });

    const navigate = useNavigate();
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [searchParams, setSearchParams] = useState<QueryArticleParams>({
        page: 1,
        pageSize: 10,
        title: "",
        status: undefined,
        categoryId: undefined,
    });

    const { data: articleData, isLoading, refetch } = useArticleListQuery(searchParams);
    const { data: categories = [] } = useCategoryListQuery();

    const { PaginationComponent } = usePagination({
        total: articleData?.total || 0,
        pageSize: searchParams.pageSize || 10,
        page: searchParams.page || 1,
        onPageChange: (page) => {
            setSearchParams((prev) => ({ ...prev, page }));
        },
    });
    const deleteMutation = useDeleteArticleMutation();
    const batchDeleteMutation = useBatchDeleteArticlesMutation();
    const publishMutation = usePublishArticleMutation();
    const unpublishMutation = useUnpublishArticleMutation();

    const articles = articleData?.items || [];
    const total = articleData?.total || 0;

    const handleToggleAll = () => {
        const allCurrentPageSelected =
            articles.length > 0 && articles.every((art) => selectedIds.has(art.id));

        if (allCurrentPageSelected) {
            // Deselect current page items, keep others
            const newSelected = new Set(selectedIds);
            articles.forEach((art) => newSelected.delete(art.id));
            setSelectedIds(newSelected);
        } else {
            // Select current page items, keep others
            const newSelected = new Set(selectedIds);
            articles.forEach((art) => newSelected.add(art.id));
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

    const handleDelete = async (id: string) => {
        if (!confirm("确定要删除这篇文章吗？")) return;

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

        if (!confirm(`确定要删除选中的 ${selectedIds.size} 篇文章吗？`)) return;

        try {
            await batchDeleteMutation.mutateAsync(Array.from(selectedIds));
            toast.success("批量删除成功");
            setSelectedIds(new Set());
            refetch();
        } catch (error) {
            console.error(error);
        }
    };

    const handleStatusChange = async (id: string, currentStatus: string) => {
        try {
            if (currentStatus === ArticleStatus.PUBLISHED) {
                await unpublishMutation.mutateAsync(id);
                toast.success("已设为草稿");
            } else {
                await publishMutation.mutateAsync(id);
                toast.success("发布成功");
            }
            refetch();
        } catch (error) {
            console.error(error);
        }
    };

    const handleSearch = () => {
        setSearchParams({ ...searchParams, page: 1 });
        refetch();
    };

    return (
        <>
            <div className="mb-4 flex flex-wrap gap-4">
                <div className="flex flex-1 flex-wrap gap-4">
                    <Input
                        placeholder="搜索文章标题..."
                        value={searchParams.title}
                        onChange={(e) =>
                            setSearchParams({ ...searchParams, title: e.target.value })
                        }
                        onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                        className="max-w-xs max-sm:max-w-full"
                    />

                    <Select
                        value={searchParams.status || "all"}
                        onValueChange={(value) =>
                            setSearchParams({
                                ...searchParams,
                                status: value === "all" ? undefined : (value as ArticleStatus),
                            })
                        }
                    >
                        <SelectTrigger className="w-[180px] max-sm:w-full">
                            <SelectValue placeholder="选择状态" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部状态</SelectItem>
                            <SelectItem value={ArticleStatus.DRAFT}>草稿</SelectItem>
                            <SelectItem value={ArticleStatus.PUBLISHED}>已发布</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={searchParams.categoryId || "all"}
                        onValueChange={(value) =>
                            setSearchParams({
                                ...searchParams,
                                categoryId: value === "all" ? undefined : value,
                            })
                        }
                    >
                        <SelectTrigger className="w-[180px] max-sm:w-full">
                            <SelectValue placeholder="选择分类" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部分类</SelectItem>
                            {categories.map((cat) => (
                                <SelectItem key={cat.id} value={cat.id}>
                                    {cat.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex gap-2">
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

                    <Button onClick={() => navigate("/console/article/add")}>
                        <Plus />
                        新建文章
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
                                            articles.length > 0 &&
                                            articles.every((art) => selectedIds.has(art.id))
                                        }
                                        onCheckedChange={handleToggleAll}
                                        aria-label="Select all"
                                    />
                                </TableHead>
                                <TableHead>标题</TableHead>
                                <TableHead>状态</TableHead>
                                <TableHead>浏览量</TableHead>
                                <TableHead>创建时间</TableHead>
                                <TableHead className="w-24">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {articles.length > 0 ? (
                                articles.map((article) => (
                                    <TableRow
                                        key={article.id}
                                        data-state={
                                            selectedIds.has(article.id) ? "selected" : undefined
                                        }
                                    >
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedIds.has(article.id)}
                                                onCheckedChange={() => handleToggleRow(article.id)}
                                                aria-label="Select row"
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-3">
                                                {article.cover ? (
                                                    <img
                                                        src={article.cover}
                                                        alt={article.title}
                                                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                                                    />
                                                ) : (
                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800">
                                                        <FileText className="h-6 w-6 text-gray-400" />
                                                    </div>
                                                )}
                                                <div className="min-w-0 flex-1">
                                                    <p
                                                        className="text-secondary-foreground truncate font-medium"
                                                        title={article.title}
                                                    >
                                                        {article.title}
                                                    </p>
                                                    {article.summary && (
                                                        <p
                                                            className="text-muted-foreground max-w-xs truncate text-sm"
                                                            title={article.summary}
                                                        >
                                                            {article.summary}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    article.status === ArticleStatus.PUBLISHED
                                                        ? "default"
                                                        : "secondary"
                                                }
                                            >
                                                {article.status === ArticleStatus.PUBLISHED
                                                    ? "已发布"
                                                    : "草稿"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <span className="text-sm">
                                                {(article.viewCount || 0).toLocaleString()}
                                            </span>
                                        </TableCell>
                                        <TableCell>
                                            {article.createdAt ? (
                                                <TimeText
                                                    value={article.createdAt}
                                                    format="YYYY/MM/DD HH:mm"
                                                />
                                            ) : (
                                                "-"
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" size="icon-sm">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            navigate(
                                                                `/console/article/edit?id=${article.id}`,
                                                            )
                                                        }
                                                    >
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        编辑
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        onClick={() =>
                                                            handleStatusChange(
                                                                article.id,
                                                                article.status,
                                                            )
                                                        }
                                                    >
                                                        {article.status ===
                                                        ArticleStatus.PUBLISHED ? (
                                                            <>
                                                                <EyeOff className="mr-2 h-4 w-4" />
                                                                设为草稿
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Eye className="mr-2 h-4 w-4" />
                                                                发布
                                                            </>
                                                        )}
                                                    </DropdownMenuItem>
                                                    <DropdownMenuItem
                                                        className="text-destructive"
                                                        onClick={() => handleDelete(article.id)}
                                                    >
                                                        <Trash className="mr-2 h-4 w-4" />
                                                        删除
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
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
                <div>
                    <PaginationComponent />
                </div>
                <div className="flex items-center gap-4">
                    <div className="text-muted-foreground text-sm">共 {total} 条数据</div>
                </div>
            </div>
        </>
    );
}
