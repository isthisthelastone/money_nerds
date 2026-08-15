import { NextResponse } from "next/server";

export function apiError(message: string, status = 400, details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

export function unauthenticatedResponse() {
  return apiError("Connect and sign your wallet to continue.", 401);
}

