import { NextResponse } from "next/server";

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

export function unauthenticatedResponse() {
  return apiError("Sign in to continue.", 401);
}

export type RequestBodyErrorCode =
  | "REQUEST_TOO_LARGE"
  | "UNSUPPORTED_REQUEST_TYPE"
  | "INVALID_REQUEST_BODY";

export class RequestBodyError extends Error {
  constructor(public readonly code: RequestBodyErrorCode) {
    super(code);
  }
}

export async function readBoundedJsonBody<T>(request: Request, maximumBytes: number) {
  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new RequestBodyError("UNSUPPORTED_REQUEST_TYPE");
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength) {
    if (!/^\d+$/.test(declaredLength)) throw new RequestBodyError("INVALID_REQUEST_BODY");
    if (Number(declaredLength) > maximumBytes) {
      throw new RequestBodyError("REQUEST_TOO_LARGE");
    }
  }

  const reader = request.body?.getReader();
  if (!reader) throw new RequestBodyError("INVALID_REQUEST_BODY");
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maximumBytes) {
        await reader.cancel().catch(() => undefined);
        throw new RequestBodyError("REQUEST_TOO_LARGE");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new RequestBodyError("INVALID_REQUEST_BODY");
  }
}
