export type ErrorCode =
  | 'MISSING_SHOP'
  | 'SHOP_NOT_FOUND'
  | 'MISSING_PARAM'
  | 'INVALID_PARAM'
  | 'FEATURE_DISABLED'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

export interface ApiError {
  code: ErrorCode;
  message: string;
}

export interface ErrorResponse {
  success: false;
  error: ApiError;
}

export function createError(code: ErrorCode, message: string): ErrorResponse {
  return { success: false, error: { code, message } };
}

export const errors = {
  missingShop: () => createError('MISSING_SHOP', 'Shop domain is required'),
  shopNotFound: () => createError('SHOP_NOT_FOUND', 'Shop not found or inactive'),
  missingParam: (param: string) => createError('MISSING_PARAM', `${param} is required`),
  invalidParam: (param: string, detail?: string) =>
    createError('INVALID_PARAM', detail ? `Invalid ${param}: ${detail}` : `Invalid ${param}`),
  featureDisabled: (feature: string) => createError('FEATURE_DISABLED', `${feature} is disabled`),
  databaseError: () => createError('DATABASE_ERROR', 'Database operation failed'),
  internal: () => createError('INTERNAL_ERROR', 'An unexpected error occurred'),
};

export function getStatusCode(code: ErrorCode): number {
  switch (code) {
    case 'MISSING_SHOP':
    case 'MISSING_PARAM':
    case 'INVALID_PARAM':
      return 400;
    case 'SHOP_NOT_FOUND':
      return 404;
    case 'FEATURE_DISABLED':
      return 403;
    default:
      return 500;
  }
}
