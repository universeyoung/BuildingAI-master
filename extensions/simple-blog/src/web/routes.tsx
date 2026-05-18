import { defineRouteOption } from "@buildingai/web-core";

import packageJson from "./../../package.json";
import ArticleDetailPage from "./pages/article/[id]";
import ArticleAddPage from "./pages/console/article/add";
import ArticleEditPage from "./pages/console/article/edit";
import ArticleListPage from "./pages/console/article/list";
import ColumnListPage from "./pages/console/column/list";
import BlogIndexPage from "./pages/index";

export const routeOption = defineRouteOption({
    base: `extension/${packageJson.name}`,
    identifier: packageJson.name,
    routes: [
        {
            index: true,
            element: <BlogIndexPage />,
        },
        {
            path: "article/:id",
            element: <ArticleDetailPage />,
        },
    ],
    consoleMenus: [
        {
            title: "文章管理",
            path: "/",
            icon: "file-text",
        },
        {
            title: "栏目管理",
            path: "/column/list",
            icon: "columns-3",
        },
    ],
    consoleRoutes: [
        {
            index: true,
            element: <ArticleListPage />,
        },
        {
            path: "article/add",
            element: <ArticleAddPage />,
        },
        {
            path: "article/edit",
            element: <ArticleEditPage />,
        },
        {
            path: "column/list",
            element: <ColumnListPage />,
        },
    ],
});
