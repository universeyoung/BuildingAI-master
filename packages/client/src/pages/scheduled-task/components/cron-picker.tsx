import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@buildingai/ui/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@buildingai/ui/components/ui/select";
import { cn } from "@buildingai/ui/lib/utils";
import { useEffect, useMemo, useState } from "react";

import {
  cronToHumanReadable,
  validateCronExpression,
} from "@/pages/scheduled-task/utils/cron-parser";

type CronMode = "simple" | "cron";
type Frequency = "daily" | "weekly" | "hourly" | "custom";

const DAY_OPTIONS = [
  { value: "0", label: "周日" },
  { value: "1", label: "周一" },
  { value: "2", label: "周二" },
  { value: "3", label: "周三" },
  { value: "4", label: "周四" },
  { value: "5", label: "周五" },
  { value: "6", label: "周六" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function detectCronMode(expr: string): {
  mode: CronMode;
  frequency?: Frequency;
  hour?: string;
  minute?: string;
  day?: string;
  interval?: string;
} {
  if (!expr || !validateCronExpression(expr)) return { mode: "cron" };

  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { mode: "cron" };

  const [minute, hour, dom, month, dow] = parts;

  if (month !== "*") return { mode: "cron" };

  // 每小时: "0 */{n} * * *" or "0 * * * *" (every hour)
  if (minute === "0" && hour.startsWith("*/") && dom === "*" && dow === "*") {
    return { mode: "simple", frequency: "hourly", interval: hour.replace("*/", ""), minute: "00" };
  }
  if (minute === "0" && hour === "*" && dom === "*" && dow === "*") {
    return { mode: "simple", frequency: "hourly", interval: "1", minute: "00" };
  }

  // 每天: "0 {hour} * * *" or "{min} {hour} * * *"
  if (
    dom === "*" &&
    dow === "*" &&
    !hour.includes("/") &&
    !hour.includes(",") &&
    !hour.includes("-")
  ) {
    return { mode: "simple", frequency: "daily", hour, minute };
  }

  // 每周: "0 {hour} * * {day}"
  if (
    dom === "*" &&
    !dow.includes(",") &&
    !dow.includes("-") &&
    !dow.includes("/") &&
    !hour.includes("/") &&
    !hour.includes(",") &&
    !hour.includes("-")
  ) {
    return { mode: "simple", frequency: "weekly", hour, minute, day: dow };
  }

  return { mode: "cron" };
}

export interface CronPickerProps {
  value: string;
  onChange: (cron: string) => void;
  disabled?: boolean;
}

export function CronPicker({ value, onChange, disabled }: CronPickerProps) {
  const detected = useMemo(() => detectCronMode(value), [value]);
  const [mode, setMode] = useState<CronMode>(detected.mode);
  const [frequency, setFrequency] = useState<Frequency>(detected.frequency ?? "daily");
  const [hour, setHour] = useState(detected.hour ?? "08");
  const [minute, setMinute] = useState(detected.minute ?? "00");
  const [day, setDay] = useState(detected.day ?? "1");
  const [interval, setInterval] = useState(detected.interval ?? "1");
  const [cronInput, setCronInput] = useState(mode === "cron" ? value : "");

  useEffect(() => {
    const d = detectCronMode(value);
    if (d.mode === "cron") {
      setMode("cron");
      setCronInput(value);
    } else {
      setMode("simple");
      setFrequency(d.frequency ?? "daily");
      setHour(d.hour ?? "08");
      setMinute(d.minute ?? "00");
      setDay(d.day ?? "1");
      setInterval(d.interval ?? "1");
    }
  }, [value]);

  const buildCron = (freq: Frequency, h: string, m: string, d: string, n: string): string => {
    switch (freq) {
      case "daily":
        return `${m} ${h} * * *`;
      case "weekly":
        return `${m} ${h} * * ${d}`;
      case "hourly":
        return `0 */${n} * * *`;
      case "custom":
        return cronInput || "0 8 * * *";
      default:
        return "0 8 * * *";
    }
  };

  const emit = (freq: Frequency, h: string, m: string, d: string, n: string) => {
    onChange(buildCron(freq, h, m, d, n));
  };

  const handleModeChange = (newMode: CronMode) => {
    setMode(newMode);
    if (newMode === "cron") {
      setCronInput(buildCron(frequency, hour, minute, day, interval));
      onChange(buildCron(frequency, hour, minute, day, interval));
    } else {
      const d = detectCronMode(cronInput || value);
      if (d.mode === "simple") {
        setFrequency(d.frequency ?? "daily");
        setHour(d.hour ?? "08");
        setMinute(d.minute ?? "00");
        setDay(d.day ?? "1");
        setInterval(d.interval ?? "1");
        onChange(
          buildCron(
            d.frequency ?? "daily",
            d.hour ?? "08",
            d.minute ?? "00",
            d.day ?? "1",
            d.interval ?? "1",
          ),
        );
      }
    }
  };

  const cronValid = useMemo(() => {
    if (mode === "simple") return true;
    return cronInput ? validateCronExpression(cronInput) : true;
  }, [mode, cronInput]);

  const preview = useMemo(() => {
    const expr = mode === "simple" ? buildCron(frequency, hour, minute, day, interval) : cronInput;
    if (!expr) return "";
    try {
      return cronToHumanReadable(expr);
    } catch {
      return expr;
    }
  }, [mode, frequency, hour, minute, day, interval, cronInput]);

  return (
    <div className="space-y-4">
      <RadioGroup
        value={mode}
        onValueChange={(v) => handleModeChange(v as CronMode)}
        className="flex gap-6"
        disabled={disabled}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="simple" id="cron-simple" />
          <Label htmlFor="cron-simple" className="cursor-pointer">
            简单模式
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="cron" id="cron-advanced" />
          <Label htmlFor="cron-advanced" className="cursor-pointer">
            Cron 表达式
          </Label>
        </div>
      </RadioGroup>

      {mode === "simple" ? (
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={frequency}
            onValueChange={(v) => {
              setFrequency(v as Frequency);
              emit(v as Frequency, hour, minute, day, interval);
            }}
            disabled={disabled}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">每天</SelectItem>
              <SelectItem value="weekly">每周</SelectItem>
              <SelectItem value="hourly">每小时</SelectItem>
            </SelectContent>
          </Select>

          {frequency === "hourly" ? (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">间隔</span>
              <Input
                type="number"
                min={1}
                max={23}
                value={interval}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "") || "1";
                  setInterval(v);
                  emit(frequency, hour, minute, day, v);
                }}
                className="w-20"
                disabled={disabled}
              />
              <span className="text-muted-foreground text-sm">小时</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Select
                value={hour}
                onValueChange={(v) => {
                  setHour(v);
                  emit(frequency, v, minute, day, interval);
                }}
                disabled={disabled}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm">:</span>
              <Select
                value={minute}
                onValueChange={(v) => {
                  setMinute(v);
                  emit(frequency, hour, v, day, interval);
                }}
                disabled={disabled}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MINUTES.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {frequency === "weekly" && (
            <Select
              value={day}
              onValueChange={(v) => {
                setDay(v);
                emit(frequency, hour, minute, v, interval);
              }}
              disabled={disabled}
            >
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DAY_OPTIONS.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      ) : (
        <Input
          value={cronInput}
          onChange={(e) => {
            setCronInput(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="0 8 * * *"
          className={cn("font-mono", cronInput && !cronValid && "border-destructive")}
          disabled={disabled}
        />
      )}

      {preview && (
        <p className={cn("text-sm", cronValid ? "text-muted-foreground" : "text-destructive")}>
          执行计划：{preview}
        </p>
      )}
    </div>
  );
}
