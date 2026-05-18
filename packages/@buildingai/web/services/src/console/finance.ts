import type { PaginatedResponse, QueryOptionsUtil } from "@buildingai/web-types";
import type { UseQueryOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";

import { consoleHttpClient } from "../base";

/** 经营概况 */
export type FinanceCenterFinance = {
    totalIncomeAmount: number;
    totalIncomeNum: number;
    totalRefundAmount: number;
    totalRefundNum: number;
    totalNetIncome: number;
};

/** 充值概况 */
export type FinanceCenterRecharge = {
    rechargeAmount: number;
    rechargeNum: number;
    rechargeRefundAmount: number;
    rechargeRefundNum: number;
    rechargeNetIncome: number;
};

/** 会员概况（仅 source=1 订单购买） */
export type FinanceCenterMember = {
    memberAmount: number;
    memberOrderNum: number;
    memberRefundAmount: number;
    memberRefundNum: number;
    memberNetIncome: number;
};

/** 用户概况 */
export type FinanceCenterUser = {
    totalUserNum: number;
    totalRechargeNum: number;
    totalMemberUserNum: number;
    totalChatNum: number;
    totalRechargeAmount: number;
    totalPowerSum: number;
    totalPointsIssued: number;
    totalPointsConsumed: number;
};

export type FinanceCenterResponse = {
    finance: FinanceCenterFinance;
    recharge: FinanceCenterRecharge;
    member: FinanceCenterMember;
    user: FinanceCenterUser;
};

/**
 * 财务中心概览数据
 */
export function useFinanceCenterQuery(options?: QueryOptionsUtil<FinanceCenterResponse>) {
    return useQuery<FinanceCenterResponse>({
        queryKey: ["finance", "center"],
        queryFn: () => consoleHttpClient.get<FinanceCenterResponse>("/finance/center"),
        ...options,
    });
}

// ─── 余额明细（账户变动记录）─────────────────────────────────────────────────────

export type QueryAccountLogDto = {
    page?: number;
    pageSize?: number;
    keyword?: string;
    accountType?: number;
};

export type AccountLogUserInfo = {
    username: string;
    userNo: string;
    avatar: string | null;
    nickname: string | null;
};
/** 账户日志列表项（含接口 enrich 后的描述字段） */
export type AccountLogListItem = {
    id: string;
    user: AccountLogUserInfo;
    accountNo: string;
    userId: string;
    accountType: number;
    action: number;
    changeAmount: number;
    leftAmount: number;
    associationUserId: string | null;
    createdAt: string;
    sourceInfo: unknown;
    username: string;
    userNo: string;
    avatar: string | null;
    nickname: string | null;
    accountTypeDesc: string;
    associationUser: string;
    consumeSourceDesc: string;
};

export type AccountLogListResponse = PaginatedResponse<AccountLogListItem> & {
    accountTypeLists: Record<number, string>;
};

/**
 * 用户账户变动记录列表（余额明细）
 */
export function useFinanceAccountLogQuery(
    params?: QueryAccountLogDto,
    options?: Omit<UseQueryOptions<AccountLogListResponse>, "queryKey" | "queryFn">,
) {
    return useQuery<AccountLogListResponse>({
        queryKey: ["finance", "account-log", params],
        queryFn: () =>
            consoleHttpClient.get<AccountLogListResponse>("/finance/account-log", { params }),
        ...options,
    });
}
