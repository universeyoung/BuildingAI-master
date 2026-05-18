"use client";

import { useUserInfoQuery } from "@buildingai/services/shared";
import { useRedeemCDKMutation } from "@buildingai/services/web";
import { useAuthStore } from "@buildingai/stores";
import { useConfigStore } from "@buildingai/stores";
import { Button } from "@buildingai/ui/components/ui/button";
import { Input } from "@buildingai/ui/components/ui/input";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useMemo, useState } from "react";
import { toast } from "sonner";

/**
 * 卡密兑换设置页
 */
export const RedeemCDKSetting = () => {
  const queryClient = useQueryClient();
  const { websiteConfig } = useConfigStore((state) => state.config);
  const { isLogin, setUserInfo } = useAuthStore((state) => state.authActions);
  const [cdkCode, setCDKCode] = useState("");
  const { refetch: refetchUserInfo } = useUserInfoQuery({ enabled: isLogin() });
  const noticeLines = (websiteConfig?.cdk?.notice || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
  const redeemMutation = useRedeemCDKMutation({
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["user", "info"] });
      await queryClient.invalidateQueries({ queryKey: ["user", "account-log"] });
      const latestUserInfo = (await refetchUserInfo()).data;

      if (latestUserInfo) {
        setUserInfo(latestUserInfo);
      }

      if (result.type === "points") {
        toast.success(`兑换成功，已到账 ${result.points ?? 0} 积分`);
      } else {
        const endTime = result.endTime ? format(new Date(result.endTime), "yyyy年MM月dd日") : "-";
        const giftText = result.giftPoints ? `，赠送 ${result.giftPoints} 积分` : "";
        toast.success(
          `兑换成功，已开通 ${result.levelName ?? "会员"}，有效期至 ${endTime}${giftText}`,
        );
      }

      setCDKCode("");
    },
  });

  const isDisabled = useMemo(() => {
    return !cdkCode.trim();
  }, [cdkCode]);

  const handleRedeem = async () => {
    const value = cdkCode.trim();
    if (!value) {
      toast.error("请输入兑换码");
      return;
    }
    await redeemMutation.mutateAsync({ keyCode: value });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-1">
        <div className="flex w-full items-center gap-2">
          <Input
            value={cdkCode}
            onChange={(e) => setCDKCode(e.target.value)}
            placeholder="请输入兑换码，区分大小写"
            className="min-w-0 flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void handleRedeem();
              }
            }}
          />
          <Button
            onClick={() => void handleRedeem()}
            disabled={isDisabled}
            loading={redeemMutation.isPending}
          >
            立即兑换
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <h1 className="text-base">兑换须知</h1>
        <div className="text-muted-foreground space-y-1 text-xs leading-5">
          {noticeLines.length > 0 ? (
            noticeLines.map((line, index) => <div key={`${index}-${line}`}>{line}</div>)
          ) : (
            <div>暂无兑换须知</div>
          )}
        </div>
      </div>
    </div>
  );
};
