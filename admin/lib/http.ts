import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { ApiError } from "./errors";

/**
 * Every endpoint answers with one of two shapes:
 *
 *   { "ok": true,  "data": ..., "meta"?: { page, perPage, total, totalPages } }
 *   { "ok": false, "error": { "code": "...", "message": "...", "details"?: ... } }
 */

export type PageMeta = {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
};

/** Pagination, plus any extra counters an endpoint wants to report. */
export type Meta = PageMeta | (Partial<PageMeta> & Record<string, unknown>);

export function ok<T>(data: T, init?: { status?: number; meta?: Meta }) {
  return NextResponse.json(
    init?.meta ? { ok: true, data, meta: init.meta } : { ok: true, data },
    { status: init?.status ?? 200 },
  );
}

export function fail(error: ApiError) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.details === undefined ? {} : { details: error.details }),
      },
    },
    { status: error.status },
  );
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;

  if (error instanceof ZodError) {
    return new ApiError(
      "validation_failed",
      "Some fields are invalid",
      error.issues.map((issue) => ({
        field: issue.path.join(".") || "(root)",
        message: issue.message,
      })),
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | undefined)?.join(", ");
      return ApiError.conflict(
        target
          ? `A record with this ${target} already exists`
          : "A record with these details already exists",
      );
    }
    if (error.code === "P2025") return ApiError.notFound("Record");
    if (error.code === "P2003") {
      return ApiError.badRequest("Referenced record does not exist");
    }
  }

  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    return new ApiError(
      "server_error",
      "The database is unavailable. Check DATABASE_URL and that Postgres is running.",
    );
  }

  console.error("[api] unhandled error", error);
  return new ApiError("server_error", "Something went wrong on our side");
}

/**
 * Wraps a route handler so thrown errors become the error envelope instead
 * of a stack trace. Keeps the handler's own signature intact.
 */
export function withRoute<Args extends unknown[]>(
  handler: (...args: Args) => Promise<NextResponse> | NextResponse,
) {
  return async (...args: Args): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (error) {
      return fail(toApiError(error));
    }
  };
}

/** Parses a JSON body against `schema`, with a clear error for bad JSON. */
export async function readBody<T>(
  request: Request,
  schema: ZodType<T>,
): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw ApiError.badRequest("Request body must be valid JSON");
  }
  return schema.parse(raw);
}

/** Parses `?page=&perPage=` with sane bounds. */
export function readPagination(
  url: URL,
  { defaultPerPage = 25, maxPerPage = 100 } = {},
) {
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1) || 1);
  const requested = Number(url.searchParams.get("perPage") ?? defaultPerPage);
  const perPage = Math.min(
    maxPerPage,
    Math.max(1, Number.isFinite(requested) ? requested : defaultPerPage),
  );
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}

export function pageMeta(
  { page, perPage }: { page: number; perPage: number },
  total: number,
): PageMeta {
  return {
    page,
    perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / perPage)),
  };
}

export const noStore = { "Cache-Control": "no-store" } as const;
