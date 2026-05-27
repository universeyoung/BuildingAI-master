import { Input } from "@buildingai/ui/components/ui/input";
import { Label } from "@buildingai/ui/components/ui/label";
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

type ScheduleMode = "once" | "repeat" | "interval";

const DAY_OPTIONS = [
  { value: "1", label: "一" },
  { value: "2", label: "二" },
  { value: "3", label: "三" },
  { value: "4", label: "四" },
  { value: "5", label: "五" },
  { value: "6", label: "六" },
  { value: "0", label: "日" },
];

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function detectMode(expr: string): ScheduleMode {
  if (!expr || !validateCronExpression(expr)) return "repeat";
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return "repeat";
  const [minute, hour, dom, month, dow] = parts;
  if (dom !== "*" && month !== "*" && dow === "*") return "once";
  if (dow.includes(",")) return "repeat";
  if (minute.includes("*/") || hour.includes("*/")) return "interval";
  return "repeat";
}

function buildOnceCron(date: string, time: string): string {
  if (!date || !time) return "";
  const [y, m, d] = date.split("-");
  const [hh, mm] = time.split(":");
  return `${mm} ${hh} ${parseInt(d)} ${parseInt(m)} *`;
}

function buildRepeatCron(days: string[], time: string): string {
  if (days.length === 0 || !time) return "";
  const [hh, mm] = time.split(":");
  const dow = days.sort().join(",");
  return `${mm} ${hh} * * ${dow}`;
}

function buildIntervalCron(unit: "minute" | "hour", value: number): string {
  if (value < 1) value = 1;
  if (unit === "minute") return `*/${value} * * * *`;
  return `0 */${value} * * *`;
}

function parseOnceFromCron(expr: string): { date: string; time: string } {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { date: "", time: "08:00" };
  const [mm, hh, dom, month] = parts;
  const now = new Date();
  const y = now.getFullYear();
  const m = String(parseInt(month)).padStart(2, "0");
  const d = String(parseInt(dom)).padStart(2, "0");
  return { date: `${y}-${m}-${d}`, time: `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}` };
}

function parseRepeatFromCron(expr: string): { days: string[]; time: string } {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { days: ["1"], time: "08:00" };
  const [mm, hh, , , dow] = parts;
  const days = dow.split(",").filter(Boolean);
  return { days, time: `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}` };
}

function parseIntervalFromCron(expr: string): { unit: "minute" | "hour"; value: number } {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return { unit: "hour", value: 1 };
  const [mm, hh] = parts;
  if (mm.startsWith("*/")) return { unit: "minute", value: parseInt(mm.slice(2)) || 1 };
  if (hh.startsWith("*/")) return { unit: "hour", value: parseInt(hh.slice(2)) || 1 };
  return { unit: "hour", value: 1 };
}

export interface CronPickerProps {
  value: string;
  onChange: (cron: string) => void;
  disabled?: boolean;
}

export function CronPicker({ value, onChange, disabled }: CronPickerProps) {
  const detectedMode = useMemo(() => detectMode(value), [value]);
  const [mode, setMode] = useState<ScheduleMode>(detectedMode);

  const onceParsed = useMemo(() => parseOnceFromCron(value), [value]);
  const repeatParsed = useMemo(() => parseRepeatFromCron(value), [value]);
  const intervalParsed = useMemo(() => parseIntervalFromCron(value), [value]);

  const [onceDate, setOnceDate] = useState(onceParsed.date);
  const [onceTime, setOnceTime] = useState(onceParsed.time || "08:00");
  const [repeatDays, setRepeatDays] = useState<string[]>(repeatParsed.days.length > 0 ? repeatParsed.days : ["1"]);
  const [repeatTime, setRepeatTime] = useState(repeatParsed.time || "08:00");
  const [intervalUnit, setIntervalUnit] = useState<"minute" | "hour">(intervalParsed.unit);
  const [intervalValue, setIntervalValue] = useState(intervalParsed.value);

  useEffect(() => {
    const m = detectMode(value);
    if (m === "once") {
      const p = parseOnceFromCron(value);
      setOnceDate(p.date);
      setOnceTime(p.time);
    } else if (m === "repeat") {
      const p = parseRepeatFromCron(value);
      setRepeatDays(p.days.length > 0 ? p.days : ["1"]);
      setRepeatTime(p.time);
    } else {
      const p = parseIntervalFromCron(value);
      setIntervalUnit(p.unit);
      setIntervalValue(p.value);
    }
  }, [value]);

  useEffect(() => {
    let cron = "";
    if (mode === "once") {
      cron = buildOnceCron(onceDate, onceTime);
    } else if (mode === "repeat") {
      cron = buildRepeatCron(repeatDays, repeatTime);
    } else {
      cron = buildIntervalCron(intervalUnit, intervalValue);
    }
    if (cron && cron !== value) {
      onChange(cron);
    }
  }, [mode, onceDate, onceTime, repeatDays, repeatTime, intervalUnit, intervalValue]);

  const toggleDay = (dayValue: string) => {
    setRepeatDays((prev) => {
      if (prev.includes(dayValue)) {
        return prev.filter((d) => d !== dayValue);
      }
      return [...prev, dayValue].sort();
    });
  };

  const preview = useMemo(() => {
    let expr = "";
    if (mode === "once") expr = buildOnceCron(onceDate, onceTime);
    else if (mode === "repeat") expr = buildRepeatCron(repeatDays, repeatTime);
    else expr = buildIntervalCron(intervalUnit, intervalValue);
    if (!expr) return "";
    try {
      return cronToHumanReadable(expr);
    } catch {
      return expr;
    }
  }, [mode, onceDate, onceTime, repeatDays, repeatTime, intervalUnit, intervalValue]);

  const modeOptions: { value: ScheduleMode; label: string }[] = [
    { value: "once", label: "单次" },
    { value: "repeat", label: "重复" },
    { value: "interval", label: "间隔" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {modeOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={cn(
              "rounded-md px-4 py-2 text-sm font-medium transition-colors",
              mode === opt.value
                ? "bg-primary text-primary-foreground"
                : "bg-accent text-accent-foreground hover:bg-accent/80",
            )}
            onClick={() => !disabled && setMode(opt.value)}
            disabled={disabled}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {mode === "once" && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">日期</Label>
            <Input
              type="date"
              value={onceDate}
              onChange={(e) => setOnceDate(e.target.value)}
              className="w-40"
              disabled={disabled}
            />
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">时间</Label>
            <Select value={onceTime.split(":")[0]} onValueChange={(v) => setOnceTime(`${v}:${onceTime.split(":")[1] || "00"}`)} disabled={disabled}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>:</span>
            <Select value={onceTime.split(":")[1] || "00"} onValueChange={(v) => setOnceTime(`${onceTime.split(":")[0] || "08"}:${v}`)} disabled={disabled}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {mode === "repeat" && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">每周</Label>
            <div className="flex gap-1.5">
              {DAY_OPTIONS.map((d) => (
                <button
                  key={d.value}
                  type="button"
                  className={cn(
                    "size-9 rounded-md text-sm font-medium transition-colors",
                    repeatDays.includes(d.value)
                      ? "bg-primary text-primary-foreground"
                      : "bg-accent text-accent-foreground hover:bg-accent/80",
                  )}
                  onClick={() => toggleDay(d.value)}
                  disabled={disabled}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm whitespace-nowrap">时间</Label>
            <Select value={repeatTime.split(":")[0]} onValueChange={(v) => setRepeatTime(`${v}:${repeatTime.split(":")[1] || "00"}`)} disabled={disabled}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOURS.map((h) => (
                  <SelectItem key={h} value={h}>{h}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>:</span>
            <Select value={repeatTime.split(":")[1] || "00"} onValueChange={(v) => setRepeatTime(`${repeatTime.split(":")[0] || "08"}:${v}`)} disabled={disabled}>
              <SelectTrigger className="w-20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MINUTES.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      {mode === "interval" && (
        <div className="flex items-center gap-3">
          <Label className="text-sm whitespace-nowrap">每</Label>
          <Input
            type="number"
            min={1}
            max={intervalUnit === "minute" ? 59 : 23}
            value={intervalValue}
            onChange={(e) => {
              const v = parseInt(e.target.value) || 1;
              setIntervalValue(v);
            }}
            className="w-20"
            disabled={disabled}
          />
          <Select
            value={intervalUnit}
            onValueChange={(v) => setIntervalUnit(v as "minute" | "hour")}
            disabled={disabled}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minute">分钟</SelectItem>
              <SelectItem value="hour">小时</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-muted-foreground text-sm">执行一次</span>
        </div>
      )}

      {preview && (
        <p className="text-sm text-muted-foreground">
          执行计划：{preview}
        </p>
      )}
    </div>
  );
}
