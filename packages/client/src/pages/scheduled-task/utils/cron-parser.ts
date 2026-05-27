const DAY_NAMES: Record<number, string> = {
  0: "日",
  1: "一",
  2: "二",
  3: "三",
  4: "四",
  5: "五",
  6: "六",
};

interface CronFieldInfo {
  type: "every" | "specific" | "range" | "step" | "list";
  values: number[];
  step?: number;
}

function parseCronField(field: string): CronFieldInfo {
  if (field === "*") {
    return { type: "every", values: [] };
  }
  if (field.includes("/")) {
    const parts = field.split("/");
    const range = parts[0];
    const step = parseInt(parts[1], 10);
    if (range === "*") {
      return { type: "step", values: [], step };
    }
    if (range.includes("-")) {
      const [start, end] = range.split("-");
      return {
        type: "step",
        values: [parseInt(start, 10), parseInt(end, 10)],
        step,
      };
    }
    return { type: "step", values: [parseInt(range, 10)], step };
  }
  if (field.includes("-")) {
    const [start, end] = field.split("-");
    return { type: "range", values: [parseInt(start, 10), parseInt(end, 10)] };
  }
  if (field.includes(",")) {
    return { type: "list", values: field.split(",").map((v) => parseInt(v, 10)) };
  }
  return { type: "specific", values: [parseInt(field, 10)] };
}

function getTimeMinute(minuteInfo: CronFieldInfo): number {
  return minuteInfo.type === "specific" ? minuteInfo.values[0] : 0;
}

function getTimeHour(hourInfo: CronFieldInfo): number {
  return hourInfo.type === "specific" ? hourInfo.values[0] : 0;
}

function validateCronField(field: string, min: number, max: number): boolean {
  if (field === "*") return true;

  if (field.includes("/")) {
    const [range, stepStr] = field.split("/");
    const step = parseInt(stepStr, 10);
    if (isNaN(step) || step < 1) return false;
    if (range === "*") return step >= 1;
    if (range.includes("-")) {
      const [start, end] = range.split("-");
      const s = parseInt(start, 10);
      const e = parseInt(end, 10);
      return !isNaN(s) && !isNaN(e) && s >= min && e <= max && s <= e;
    }
    const v = parseInt(range, 10);
    return !isNaN(v) && v >= min && v <= max;
  }

  if (field.includes("-")) {
    const [start, end] = field.split("-");
    const s = parseInt(start, 10);
    const e = parseInt(end, 10);
    return !isNaN(s) && !isNaN(e) && s >= min && e <= max && s <= e;
  }

  if (field.includes(",")) {
    return field.split(",").every((v) => {
      const n = parseInt(v, 10);
      return !isNaN(n) && n >= min && n <= max;
    });
  }

  const n = parseInt(field, 10);
  return !isNaN(n) && n >= min && n <= max;
}

export function validateCronExpression(expr: string): boolean {
  if (!expr || typeof expr !== "string") return false;
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  return (
    validateCronField(parts[0], 0, 59) &&
    validateCronField(parts[1], 0, 23) &&
    validateCronField(parts[2], 1, 31) &&
    validateCronField(parts[3], 1, 12) &&
    validateCronField(parts[4], 0, 7)
  );
}

export function cronToHumanReadable(expr: string): string {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    return expr;
  }

  const [minute, hour, dayOfMonth, _month, dayOfWeek] = parts;
  const minuteInfo = parseCronField(minute);
  const hourInfo = parseCronField(hour);
  const domInfo = parseCronField(dayOfMonth);
  const dowInfo = parseCronField(dayOfWeek);

  const timeMinute = getTimeMinute(minuteInfo);
  const timeHour = getTimeHour(hourInfo);
  const timeStr = `${timeHour.toString().padStart(2, "0")}:${timeMinute.toString().padStart(2, "0")}`;

  if (
    dowInfo.type === "range" &&
    dowInfo.values[0] === 1 &&
    dowInfo.values[1] === 5 &&
    domInfo.type === "every"
  ) {
    return `工作日 ${timeStr}`;
  }

  if ((dowInfo.type === "specific" || dowInfo.type === "list") && domInfo.type === "every") {
    const days = dowInfo.values.map((d) => `周${DAY_NAMES[d]}`).join("、");
    return `每${days} ${timeStr}`;
  }

  if (domInfo.type === "specific" || domInfo.type === "list") {
    const days = domInfo.values.map((d) => `${d}日`).join("、");
    return `每月${days} ${timeStr}`;
  }

  if (hourInfo.type === "step" && minuteInfo.type === "specific" && minuteInfo.values[0] === 0) {
    return `每${hourInfo.step}小时`;
  }

  if (minuteInfo.type === "step" && hourInfo.type === "every") {
    return `每${minuteInfo.step}分钟`;
  }

  if (domInfo.type === "every" && dowInfo.type === "every") {
    return `每天 ${timeStr}`;
  }

  return expr;
}
