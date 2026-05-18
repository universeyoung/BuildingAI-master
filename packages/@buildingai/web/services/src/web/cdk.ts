import { useMutation, type UseMutationOptions } from "@tanstack/react-query";

import { apiHttpClient } from "../base";

/**
 * 兑换卡密DTO
 */
export type RedeemCDKDto = {
    keyCode: string;
};

/**
 * 兑换卡密响应
 */
export type RedeemCDKResponse = {
    success: boolean;
    message: string;
    type: "points" | "membership";
    points?: number;
    levelName?: string;
    endTime?: string;
    giftPoints?: number;
};

/**
 * 兑换卡密
 */
export function useRedeemCDKMutation(
    options?: UseMutationOptions<RedeemCDKResponse, Error, RedeemCDKDto>,
) {
    return useMutation<RedeemCDKResponse, Error, RedeemCDKDto>({
        mutationFn: (body) => apiHttpClient.post<RedeemCDKResponse>("/card-key/redeem", body),
        ...options,
    });
}
