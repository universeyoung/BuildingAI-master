import { createHttpClient } from "@buildingai/utils/http-client";
import { isAxiosError } from "axios";

type ApiEnvelope<T> = {
  data?: T;
  message?: string;
};

export class PublicApiRequestError extends Error {
  readonly code?: number;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "PublicApiRequestError";
    this.code = code;
  }
}

export function getPublicApiRequestErrorCode(error: unknown): number | undefined {
  if (error instanceof PublicApiRequestError) return error.code;
  return undefined;
}

function getAuthHeaders(accessToken: string, anonymousIdentifier?: string) {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(anonymousIdentifier ? { "X-Anonymous-Identifier": anonymousIdentifier } : {}),
  };
}

function unwrapEnvelope<T>(payload: ApiEnvelope<T> | T): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as ApiEnvelope<T>).data as T;
  }

  return payload as T;
}

export async function fetchPublicJson<T>(
  url: string,
  accessToken: string,
  anonymousIdentifier?: string,
): Promise<T> {
  const client = createHttpClient({
    headers: getAuthHeaders(accessToken, anonymousIdentifier),
  });

  try {
    const payload = await client.get<ApiEnvelope<T> | T>(url);
    return unwrapEnvelope(payload);
  } catch (error) {
    if (isAxiosError(error)) {
      const data = error.response?.data as { code?: number; message?: string } | undefined;
      const code = typeof data?.code === "number" ? data.code : undefined;
      const message = data?.message || error.message || "Request failed";
      throw new PublicApiRequestError(message, code);
    }
    const e = error as { message?: string };
    throw new PublicApiRequestError(e?.message || "Request failed");
  }
}
