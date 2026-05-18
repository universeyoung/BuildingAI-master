"use client";

import { useI18n } from "@buildingai/i18n";
import { useSetUserConfigMutation } from "@buildingai/services/shared";
import {
  useDeactivateUserMemoryMutation,
  type UserMemoryItem,
  useUserMemoriesQuery,
} from "@buildingai/services/web";
import { useUserConfigStore } from "@buildingai/stores";
import { Button } from "@buildingai/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@buildingai/ui/components/ui/dropdown-menu";
import { ScrollArea } from "@buildingai/ui/components/ui/scroll-area";
import { Switch } from "@buildingai/ui/components/ui/switch";
import { Textarea } from "@buildingai/ui/components/ui/textarea";
import { ChevronsUpDown, Trash2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { SettingItem, SettingItemGroup } from "../setting-item";

const AI_GROUP = "ai";
const CHAT_STYLE_KEY = "chatStyle";
const CUSTOM_INSTRUCTION_KEY = "customInstruction";
const REFER_SAVED_MEMORIES_KEY = "referSavedMemories";
const REFER_CHAT_HISTORY_KEY = "referChatHistory";

type StyleOption = {
  value: string;
  labelKey: string;
  hintKey: string;
};

const STYLE_OPTIONS: StyleOption[] = [
  {
    value: "default",
    labelKey: "settings.personalized.chatStyle.default",
    hintKey: "settings.personalized.chatStyle.defaultHint",
  },
  {
    value: "sunny",
    labelKey: "settings.personalized.chatStyle.sunny",
    hintKey: "settings.personalized.chatStyle.sunnyHint",
  },
  {
    value: "tsundere",
    labelKey: "settings.personalized.chatStyle.tsundere",
    hintKey: "settings.personalized.chatStyle.tsundereHint",
  },
  {
    value: "gentle",
    labelKey: "settings.personalized.chatStyle.gentle",
    hintKey: "settings.personalized.chatStyle.gentleHint",
  },
  {
    value: "sarcastic",
    labelKey: "settings.personalized.chatStyle.sarcastic",
    hintKey: "settings.personalized.chatStyle.sarcasticHint",
  },
  {
    value: "energetic",
    labelKey: "settings.personalized.chatStyle.energetic",
    hintKey: "settings.personalized.chatStyle.energeticHint",
  },
  {
    value: "classical",
    labelKey: "settings.personalized.chatStyle.classical",
    hintKey: "settings.personalized.chatStyle.classicalHint",
  },
];

const CATEGORY_LABEL: Record<string, string> = {
  preference: "偏好",
  personal_info: "个人信息",
  habit: "习惯",
  instruction: "指令",
};

const STICKY_COLORS = [
  "bg-amber-50 dark:bg-amber-950/40 border-amber-200/80 dark:border-amber-800/50 shadow-[2px_3px_0_rgba(251,191,36,0.15)]",
  "bg-rose-50 dark:bg-rose-950/40 border-rose-200/80 dark:border-rose-800/50 shadow-[2px_3px_0_rgba(251,113,133,0.12)]",
  "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200/80 dark:border-emerald-800/50 shadow-[2px_3px_0_rgba(52,211,153,0.12)]",
  "bg-sky-50 dark:bg-sky-950/40 border-sky-200/80 dark:border-sky-800/50 shadow-[2px_3px_0_rgba(56,189,248,0.12)]",
  "bg-violet-50 dark:bg-violet-950/40 border-violet-200/80 dark:border-violet-800/50 shadow-[2px_3px_0_rgba(167,139,250,0.12)]",
];

const ROTATIONS = ["-0.5deg", "0.5deg", "-1deg", "0deg", "1deg"];

function MemorySticky({
  item,
  colorClass,
  rotation,
  onDelete,
  isDeleting,
}: {
  item: UserMemoryItem;
  colorClass: string;
  rotation: string;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { t } = useI18n();
  const categoryLabel = CATEGORY_LABEL[item.category] ?? item.category;

  return (
    <div
      className={`group relative flex min-h-[100px] w-full max-w-[220px] flex-1 flex-col justify-between rounded-lg border p-3 transition-[transform,shadow] hover:shadow-md ${colorClass}`}
      style={{ transform: `rotate(${rotation})` }}
    >
      <p className="text-foreground/90 line-clamp-4 text-[13px] leading-snug wrap-break-word">
        {item.content}
      </p>
      <p className="text-muted-foreground mt-2 text-[11px] font-medium tracking-wide uppercase">
        {categoryLabel}
      </p>
      <Button
        variant="ghost"
        size="icon"
        className="text-muted-foreground hover:text-destructive absolute top-1.5 right-1.5 size-7 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10"
        onClick={onDelete}
        disabled={isDeleting}
        aria-label={t("settings.personalized.memory.delete")}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  );
}

function ChatStyleSection() {
  const { t } = useI18n();
  const { setConfig } = useUserConfigStore((s) => s.userConfigActions);
  const currentStyle =
    useUserConfigStore((s) => s.userConfig.configs?.[AI_GROUP]?.[CHAT_STYLE_KEY] as string) ??
    "default";
  const setConfigMutation = useSetUserConfigMutation();
  const currentLabel = STYLE_OPTIONS.find((o) => o.value === currentStyle)
    ? t(STYLE_OPTIONS.find((o) => o.value === currentStyle)!.labelKey)
    : t("settings.personalized.chatStyle.default");

  const handleSelect = useCallback(
    (value: string) => {
      setConfig(AI_GROUP, CHAT_STYLE_KEY, value);
      setConfigMutation.mutate({ key: CHAT_STYLE_KEY, value, group: AI_GROUP });
    },
    [setConfig, setConfigMutation],
  );

  return (
    <SettingItemGroup label={t("settings.personalized.label")}>
      <SettingItem
        title={t("settings.personalized.chatStyle.title")}
        description={t("settings.personalized.chatStyle.description")}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm">
              {currentLabel}
              <ChevronsUpDown className="text-muted-foreground ml-1 size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {STYLE_OPTIONS.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => handleSelect(opt.value)}
                className="flex flex-col items-start gap-0.5 py-2.5"
              >
                <span className="flex w-full items-center justify-between gap-2">
                  {t(opt.labelKey)}
                  {currentStyle === opt.value && (
                    <DropdownMenuShortcut>
                      <div className="bg-primary ring-primary/15 size-1.5 rounded-full ring-2" />
                    </DropdownMenuShortcut>
                  )}
                </span>
                <span className="text-muted-foreground text-xs leading-snug">{t(opt.hintKey)}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SettingItem>
    </SettingItemGroup>
  );
}

function CustomInstructionSection() {
  const { t } = useI18n();
  const { setConfig } = useUserConfigStore((s) => s.userConfigActions);
  const savedInstruction =
    useUserConfigStore(
      (s) => s.userConfig.configs?.[AI_GROUP]?.[CUSTOM_INSTRUCTION_KEY] as string,
    ) ?? "";
  const setConfigMutation = useSetUserConfigMutation();
  const [localValue, setLocalValue] = useState(savedInstruction);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setLocalValue(savedInstruction);
  }, [savedInstruction]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setLocalValue(value);
      setConfig(AI_GROUP, CUSTOM_INSTRUCTION_KEY, value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setConfigMutation.mutate({
          key: CUSTOM_INSTRUCTION_KEY,
          value,
          group: AI_GROUP,
        });
      }, 600);
    },
    [setConfig, setConfigMutation],
  );

  return (
    <SettingItemGroup>
      <SettingItem
        title={t("settings.personalized.customInstruction.title")}
        description={t("settings.personalized.customInstruction.description")}
        className="border-b-0"
      />
      <div className="px-4 pb-3">
        <Textarea
          value={localValue}
          onChange={handleChange}
          placeholder={t("settings.personalized.customInstruction.placeholder")}
          className="bg-background min-h-[80px] resize-none"
          maxLength={500}
        />
      </div>
    </SettingItemGroup>
  );
}

function MemoryTogglesSection() {
  const { t } = useI18n();
  const { setConfig } = useUserConfigStore((s) => s.userConfigActions);
  const configs = useUserConfigStore((s) => s.userConfig.configs?.[AI_GROUP]);
  const referSavedMemories = (configs?.[REFER_SAVED_MEMORIES_KEY] as boolean | undefined) ?? true;
  const referChatHistory = (configs?.[REFER_CHAT_HISTORY_KEY] as boolean | undefined) ?? true;
  const setConfigMutation = useSetUserConfigMutation();

  const handleToggle = useCallback(
    (key: string, value: boolean) => {
      setConfig(AI_GROUP, key, value);
      setConfigMutation.mutate({ key, value, group: AI_GROUP });
    },
    [setConfig, setConfigMutation],
  );

  return (
    <>
      <SettingItem
        title={t("settings.personalized.memory.referSavedMemories")}
        description={t("settings.personalized.memory.referSavedMemoriesHint")}
      >
        <Switch
          checked={referSavedMemories}
          onCheckedChange={(v) => handleToggle(REFER_SAVED_MEMORIES_KEY, v)}
        />
      </SettingItem>
      <SettingItem
        title={t("settings.personalized.memory.referChatHistory")}
        description={t("settings.personalized.memory.referChatHistoryHint")}
        className="border-b-0"
      >
        <Switch
          checked={referChatHistory}
          onCheckedChange={(v) => handleToggle(REFER_CHAT_HISTORY_KEY, v)}
        />
      </SettingItem>
    </>
  );
}

function MemorySection() {
  const { t } = useI18n();
  const { data: memories = [], isLoading } = useUserMemoriesQuery();
  const deactivate = useDeactivateUserMemoryMutation();

  return (
    <SettingItemGroup label={t("settings.personalized.memory.title")}>
      <MemoryTogglesSection />
      <div className="border-border/60 border-b-0 px-4 pb-3">
        {isLoading && (
          <div className="text-muted-foreground flex min-h-[200px] items-center justify-center rounded-lg border border-dashed py-12 text-sm">
            {t("common.action.loading")}
          </div>
        )}
        {!isLoading && memories.length === 0 && (
          <div className="text-muted-foreground bg-muted/20 flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm">{t("settings.personalized.memory.empty")}</p>
            <p className="mt-1.5 max-w-[320px] text-xs leading-relaxed">
              {t("settings.personalized.memory.emptyHint")}
            </p>
          </div>
        )}
        {!isLoading && memories.length > 0 && (
          <ScrollArea className="-mx-1 h-[320px] pr-2">
            <div className="grid grid-cols-4 gap-3 pb-2">
              {memories.map((item, i) => (
                <MemorySticky
                  key={item.id}
                  item={item}
                  colorClass={STICKY_COLORS[i % STICKY_COLORS.length]}
                  rotation={ROTATIONS[i % ROTATIONS.length]}
                  onDelete={() => deactivate.mutate(item.id)}
                  isDeleting={deactivate.isPending}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>
    </SettingItemGroup>
  );
}

const PersonalizedSetting = () => {
  return (
    <div className="flex flex-col gap-4">
      <ChatStyleSection />
      <CustomInstructionSection />
      <MemorySection />
    </div>
  );
};

export default PersonalizedSetting;
