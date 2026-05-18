/**
 * Convert unknown error to string message
 * @param error - Unknown error object
 * @param fallback - Fallback message when error cannot be parsed
 * @returns Error message string
 */
export function getErrorMessage(error: unknown, fallback = "操作失败，请稍后重试"): string {
  if (typeof error === "string") {
    return error;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    // Handle common API error response formats
    if ("message" in error && typeof error.message === "string") {
      return error.message;
    }

    if ("msg" in error && typeof error.msg === "string") {
      return error.msg;
    }

    if ("error" in error && typeof error.error === "string") {
      return error.error;
    }

    // Try to stringify the object
    try {
      const stringified = JSON.stringify(error);
      if (stringified !== "{}") {
        return stringified;
      }
    } catch {
      // Ignore stringify errors
    }
  }

  return fallback;
}
