import type { DashboardData } from "@buildingai/types/analyse/dashboard.interface";
import type { QueryOptionsUtil } from "@buildingai/web-types";
import { useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";

/**
 * 数据看板查询参数
 */
export interface DashboardQueryParams {
    /** 用户图表时间范围（天数），默认15天 */
    userDays?: number;
    /** 收入图表时间范围（天数），默认15天 */
    revenueDays?: number;
    /** Token使用排行时间范围（天数），默认15天 */
    tokenDays?: number;
}

/**
 * 获取数据看板统计信息
 * @description 获取后台工作台数据看板的统计数据，包括用户、对话、订单等多维度数据
 * @param params 查询参数
 * @param options React Query 配置选项
 * @returns 数据看板完整数据
 */
export function useDashboardQuery(
    params?: DashboardQueryParams,
    options?: QueryOptionsUtil<DashboardData>,
) {
    return useQuery<DashboardData>({
        queryKey: ["analyse", "dashboard", params],
        queryFn: () =>
            consoleHttpClient.get<DashboardData>("/analyse/dashboard", {
                params,
            }),
        ...options,
    });
}
