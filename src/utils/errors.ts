/**
 * 统一错误处理类
 * 提供标准化的错误类型和处理机制
 */

/**
 * 错误代码枚举
 */
export enum ErrorCode {
  // 认证相关错误
  AUTH_INVALID_TOKEN = 'AUTH_INVALID_TOKEN',
  AUTH_TOKEN_EXPIRED = 'AUTH_TOKEN_EXPIRED',
  AUTH_INVALID_CREDENTIALS = 'AUTH_INVALID_CREDENTIALS',
  AUTH_MISSING_TOKEN = 'AUTH_MISSING_TOKEN',

  // 配置相关错误
  CONFIG_INVALID_TIMEZONE = 'CONFIG_INVALID_TIMEZONE',
  CONFIG_MISSING_REQUIRED = 'CONFIG_MISSING_REQUIRED',
  CONFIG_INVALID_FORMAT = 'CONFIG_INVALID_FORMAT',

  // 订阅相关错误
  SUBSCRIPTION_NOT_FOUND = 'SUBSCRIPTION_NOT_FOUND',
  SUBSCRIPTION_CREATE_FAILED = 'SUBSCRIPTION_CREATE_FAILED',
  SUBSCRIPTION_UPDATE_FAILED = 'SUBSCRIPTION_UPDATE_FAILED',
  SUBSCRIPTION_DELETE_FAILED = 'SUBSCRIPTION_DELETE_FAILED',
  SUBSCRIPTION_INVALID_DATA = 'SUBSCRIPTION_INVALID_DATA',
  SUBSCRIPTION_EXPIRED_DATE_OUT_OF_RANGE = 'SUBSCRIPTION_EXPIRED_DATE_OUT_OF_RANGE',

  // 通知相关错误
  NOTIFICATION_SEND_FAILED = 'NOTIFICATION_SEND_FAILED',
  NOTIFICATION_CONFIG_MISSING = 'NOTIFICATION_CONFIG_MISSING',
  NOTIFICATION_RATE_LIMITED = 'NOTIFICATION_RATE_LIMITED',
  NOTIFICATION_ALL_CHANNELS_FAILED = 'NOTIFICATION_ALL_CHANNELS_FAILED',

  // 数据存储相关错误
  STORAGE_READ_FAILED = 'STORAGE_READ_FAILED',
  STORAGE_WRITE_FAILED = 'STORAGE_WRITE_FAILED',
  STORAGE_DELETE_FAILED = 'STORAGE_DELETE_FAILED',
  STORAGE_NOT_FOUND = 'STORAGE_NOT_FOUND',

  // 验证相关错误
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  VALIDATION_INVALID_FORMAT = 'VALIDATION_INVALID_FORMAT',
  VALIDATION_MISSING_FIELD = 'VALIDATION_MISSING_FIELD',
  VALIDATION_INVALID_RANGE = 'VALIDATION_INVALID_RANGE',

  // 外部API相关错误
  EXTERNAL_API_REQUEST_FAILED = 'EXTERNAL_API_REQUEST_FAILED',
  EXTERNAL_API_TIMEOUT = 'EXTERNAL_API_TIMEOUT',
  EXTERNAL_API_INVALID_RESPONSE = 'EXTERNAL_API_INVALID_RESPONSE',

  // 系统相关错误
  SYSTEM_ERROR = 'SYSTEM_ERROR',
  SYSTEM_NOT_AVAILABLE = 'SYSTEM_NOT_AVAILABLE',
  SYSTEM_INTERNAL_ERROR = 'SYSTEM_INTERNAL_ERROR',
}

/**
 * 错误级别
 */
export enum ErrorLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL',
}

/**
 * 应用错误类
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly level: ErrorLevel;
  public readonly details?: unknown;
  public readonly timestamp: string;

  constructor(
    code: ErrorCode,
    message: string,
    statusCode: number = 500,
    level: ErrorLevel = ErrorLevel.ERROR,
    details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.level = level;
    this.details = details;
    this.timestamp = new Date().toISOString();

    // 维护正确的原型链
    Object.setPrototypeOf(this, AppError.prototype);

    // 捕获堆栈跟踪
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * 转换为 JSON 格式
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      level: this.level,
      timestamp: this.timestamp,
      details: this.details,
      stack: this.stack,
    };
  }
}

/**
 * 认证错误
 */
export class AuthenticationError extends AppError {
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(code, message, 401, ErrorLevel.WARN, details);
    this.name = 'AuthenticationError';
  }
}

/**
 * 验证错误
 */
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.VALIDATION_FAILED, message, 400, ErrorLevel.INFO, details);
    this.name = 'ValidationError';
  }
}

/**
 * 未找到错误
 */
export class NotFoundError extends AppError {
  constructor(resource: string, identifier?: string) {
    const message = identifier
      ? `${resource} not found: ${identifier}`
      : `${resource} not found`;
    super(ErrorCode.SUBSCRIPTION_NOT_FOUND, message, 404, ErrorLevel.INFO, { resource, identifier });
    this.name = 'NotFoundError';
  }
}

/**
 * 外部API错误
 */
export class ExternalApiError extends AppError {
  constructor(service: string, message: string, details?: unknown) {
    super(ErrorCode.EXTERNAL_API_REQUEST_FAILED, `${service}: ${message}`, 502, ErrorLevel.ERROR, details);
    this.name = 'ExternalApiError';
  }
}

/**
 * 系统错误
 */
export class SystemError extends AppError {
  constructor(message: string, details?: unknown) {
    super(ErrorCode.SYSTEM_INTERNAL_ERROR, message, 500, ErrorLevel.CRITICAL, details);
    this.name = 'SystemError';
  }
}

/**
 * 创建错误工厂函数
 */
export const ErrorFactory = {
  /**
   * 创建订阅未找到错误
   */
  subscriptionNotFound(id: string): NotFoundError {
    return new NotFoundError('Subscription', id);
  },

  /**
   * 创建无效数据错误
   */
  invalidData(field: string, reason: string): ValidationError {
    return new ValidationError(`Invalid ${field}: ${reason}`, { field, reason });
  },

  /**
   * 创建认证失败错误
   */
  authenticationFailed(reason?: string): AuthenticationError {
    return new AuthenticationError(ErrorCode.AUTH_INVALID_CREDENTIALS, 'Authentication failed', { reason });
  },

  /**
   * 创建外部API错误
   */
  externalApiError(service: string, error: Error | string): ExternalApiError {
    const message = typeof error === 'string' ? error : error.message;
    return new ExternalApiError(service, message, error instanceof Error ? { stack: error.stack } : undefined);
  },

  /**
   * 创建系统错误
   */
  systemError(message: string, error?: Error): SystemError {
    return new SystemError(message, error instanceof Error ? { stack: error.stack, message: error.message } : undefined);
  },

  /**
   * 创建验证错误
   */
  validationError(message: string, details?: unknown): ValidationError {
    return new ValidationError(message, details);
  },
};

/**
 * 错误类型守卫
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * 格式化错误消息
 */
export function formatErrorMessage(error: unknown): string {
  if (isAppError(error)) {
    return `[${error.code}] ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

/**
 * 获取错误状态码
 */
export function getErrorStatusCode(error: unknown): number {
  if (isAppError(error)) {
    return error.statusCode;
  }

  if (error instanceof Error) {
    return 500;
  }

  return 500;
}
