export class PlatformError extends Error {
  constructor(message, { code = 'PLATFORM_ERROR', cause = null } = {}) {
    super(message);
    this.name = 'PlatformError';
    this.code = code;
    this.cause = cause;
  }
}

export class ValidationError extends PlatformError {
  constructor(message, options = {}) {
    super(message, { code: 'VALIDATION_ERROR', ...options });
    this.name = 'ValidationError';
  }
}

export class UserInputError extends PlatformError {
  constructor(message, { usage = null, examples = [], ...options } = {}) {
    super(message, { code: 'USER_INPUT_ERROR', ...options });
    this.name = 'UserInputError';
    this.usage = usage;
    this.examples = examples;
  }
}
