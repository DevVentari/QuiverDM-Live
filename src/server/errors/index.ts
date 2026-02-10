/**
 * Application Error Infrastructure
 *
 * Provides consistent error handling across the application.
 * All errors extend AppError and are automatically transformed
 * to TRPCError in the error handler.
 *
 * Usage:
 *   throw new NotFoundError('campaign', campaignId);
 *   throw new ForbiddenError('You cannot access this resource');
 *   throw new ValidationError('Email is required');
 */

import { TRPCError } from '@trpc/server';

// =============================================================================
// Error Codes
// =============================================================================

export type ErrorCode =
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'UNAUTHORIZED'
  | 'VALIDATION_ERROR'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'BAD_REQUEST';

// Map our error codes to tRPC error codes
const ERROR_CODE_TO_TRPC: Record<ErrorCode, TRPCError['code']> = {
  NOT_FOUND: 'NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'BAD_REQUEST',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_SERVER_ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
};

// =============================================================================
// Base Error Class
// =============================================================================

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly isOperational: boolean;
  public readonly context?: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      statusCode?: number;
      isOperational?: boolean;
      context?: Record<string, unknown>;
    }
  ) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = options?.statusCode ?? this.getDefaultStatusCode(code);
    this.isOperational = options?.isOperational ?? true;
    this.context = options?.context;

    Error.captureStackTrace(this, this.constructor);
  }

  private getDefaultStatusCode(code: ErrorCode): number {
    const statusCodes: Record<ErrorCode, number> = {
      NOT_FOUND: 404,
      FORBIDDEN: 403,
      UNAUTHORIZED: 401,
      VALIDATION_ERROR: 400,
      CONFLICT: 409,
      RATE_LIMITED: 429,
      INTERNAL_ERROR: 500,
      BAD_REQUEST: 400,
    };
    return statusCodes[code];
  }

  /**
   * Convert to TRPCError for router error handling
   */
  toTRPCError(): TRPCError {
    return new TRPCError({
      code: ERROR_CODE_TO_TRPC[this.code],
      message: this.message,
      cause: this,
    });
  }
}

// =============================================================================
// Specific Error Classes
// =============================================================================

/**
 * Resource not found error
 */
export class NotFoundError extends AppError {
  public readonly resourceType: string;
  public readonly resourceId?: string;

  constructor(resourceType: string, resourceId?: string) {
    const message = resourceId
      ? `${resourceType} with ID "${resourceId}" not found`
      : `${resourceType} not found`;

    super('NOT_FOUND', message, {
      context: { resourceType, resourceId },
    });

    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * Access forbidden error
 */
export class ForbiddenError extends AppError {
  public readonly action?: string;
  public readonly resource?: string;

  constructor(message?: string, options?: { action?: string; resource?: string }) {
    super('FORBIDDEN', message ?? 'You do not have permission to perform this action', {
      context: { action: options?.action, resource: options?.resource },
    });

    this.action = options?.action;
    this.resource = options?.resource;
  }

  /**
   * Create a permission-specific forbidden error
   */
  static forPermission(permission: string, resource?: string): ForbiddenError {
    const message = resource
      ? `You do not have permission to ${permission} this ${resource}`
      : `You do not have permission to ${permission}`;
    return new ForbiddenError(message, { action: permission, resource });
  }
}

/**
 * Authentication required error
 */
export class UnauthorizedError extends AppError {
  constructor(message?: string) {
    super('UNAUTHORIZED', message ?? 'Authentication required');
  }
}

/**
 * Validation error
 */
export class ValidationError extends AppError {
  public readonly field?: string;
  public readonly errors?: Record<string, string[]>;

  constructor(
    message: string,
    options?: {
      field?: string;
      errors?: Record<string, string[]>;
    }
  ) {
    super('VALIDATION_ERROR', message, {
      context: { field: options?.field, errors: options?.errors },
    });

    this.field = options?.field;
    this.errors = options?.errors;
  }

  /**
   * Create a field-specific validation error
   */
  static forField(field: string, message: string): ValidationError {
    return new ValidationError(message, { field });
  }

  /**
   * Create a validation error from multiple field errors
   */
  static forFields(errors: Record<string, string[]>): ValidationError {
    const firstError = Object.values(errors).flat()[0] ?? 'Validation failed';
    return new ValidationError(firstError, { errors });
  }
}

/**
 * Resource conflict error (e.g., duplicate entry)
 */
export class ConflictError extends AppError {
  public readonly conflictType: string;

  constructor(message: string, conflictType: string = 'duplicate') {
    super('CONFLICT', message, {
      context: { conflictType },
    });
    this.conflictType = conflictType;
  }

  /**
   * Create a duplicate resource error
   */
  static duplicate(resourceType: string, field?: string): ConflictError {
    const message = field
      ? `A ${resourceType} with this ${field} already exists`
      : `This ${resourceType} already exists`;
    return new ConflictError(message, 'duplicate');
  }
}

/**
 * Rate limiting error
 */
export class RateLimitedError extends AppError {
  public readonly retryAfter?: number;

  constructor(message?: string, retryAfter?: number) {
    super('RATE_LIMITED', message ?? 'Too many requests. Please try again later.', {
      context: { retryAfter },
    });
    this.retryAfter = retryAfter;
  }
}

/**
 * Internal server error (for unexpected errors)
 */
export class InternalError extends AppError {
  constructor(message?: string, cause?: Error) {
    super('INTERNAL_ERROR', message ?? 'An unexpected error occurred', {
      isOperational: false,
      context: cause ? { originalError: cause.message } : undefined,
    });
  }
}

/**
 * Bad request error
 */
export class BadRequestError extends AppError {
  constructor(message: string) {
    super('BAD_REQUEST', message);
  }
}

// =============================================================================
// Error Handler Utility
// =============================================================================

/**
 * Convert any error to a TRPCError
 * Use in tRPC error formatter
 */
export function toTRPCError(error: unknown): TRPCError {
  if (error instanceof TRPCError) {
    return error;
  }

  if (error instanceof AppError) {
    return error.toTRPCError();
  }

  // Unknown errors become internal errors
  const message =
    error instanceof Error ? error.message : 'An unexpected error occurred';

  return new TRPCError({
    code: 'INTERNAL_SERVER_ERROR',
    message,
    cause: error,
  });
}

/**
 * Type guard to check if an error is operational (expected)
 */
export function isOperationalError(error: unknown): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  if (error instanceof TRPCError) {
    return true; // tRPC errors are always operational
  }
  return false;
}
