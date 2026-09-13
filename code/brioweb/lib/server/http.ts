import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { ConflictError, NotFoundError } from "@/db/queries/errors";

export function apiError(error: unknown) {
  if (error instanceof ZodError) {
    return NextResponse.json({
      error: "Validation failed",
      fields: error.flatten().fieldErrors,
      formErrors: error.flatten().formErrors,
    }, { status: 400 });
  }
  if (error instanceof ConflictError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof NotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  console.error("[api] request failed", error instanceof Error ? error.message : "unknown error");
  return NextResponse.json({ error: "The request could not be completed" }, { status: 500 });
}

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ZodError([{ code: "custom", path: [], message: "Invalid JSON body" }]);
  }
}
