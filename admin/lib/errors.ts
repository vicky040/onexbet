export type ErrorCode =
  | "bad_request"
  | "validation_failed"
  | "unauthorized"
  | "invalid_credentials"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "insufficient_balance"
  | "rate_limited"
  | "server_error";

const STATUS: Record<ErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  unauthorized: 401,
  invalid_credentials: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  insufficient_balance: 409,
  rate_limited: 429,
  server_error: 500,
};

/**
 * Thrown anywhere inside a route handler; `withRoute` turns it into the
 * error envelope with the right status.
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) {
    return new ApiError("bad_request", message, details);
  }

  static unauthorized(message = "Authentication required") {
    return new ApiError("unauthorized", message);
  }

  static invalidCredentials(message = "Incorrect mobile number or password") {
    return new ApiError("invalid_credentials", message);
  }

  static forbidden(message = "You do not have access to this resource") {
    return new ApiError("forbidden", message);
  }

  static notFound(what = "Resource") {
    return new ApiError("not_found", `${what} not found`);
  }

  static conflict(message: string, details?: unknown) {
    return new ApiError("conflict", message, details);
  }
}
