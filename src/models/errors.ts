/**
 * Custom error types for workflow operations
 */

/**
 * Base error class for workflow-related errors
 */
export class WorkflowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = false,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'WorkflowError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Error thrown when workflow state is invalid or corrupted
 */
export class InvalidStateError extends WorkflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'INVALID_STATE', false, context);
    this.name = 'InvalidStateError';
  }
}

/**
 * Error thrown when a stage transition is not allowed
 */
export class InvalidTransitionError extends WorkflowError {
  constructor(
    message: string,
    public readonly fromStage: string,
    public readonly toStage: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 'INVALID_TRANSITION', false, {
      ...context,
      fromStage,
      toStage,
    });
    this.name = 'InvalidTransitionError';
  }
}

/**
 * Error thrown when workflow configuration is invalid
 */
export class ConfigurationError extends WorkflowError {
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, 'CONFIGURATION_ERROR', false, context);
    this.name = 'ConfigurationError';
  }
}

/**
 * Error thrown when external service call fails
 */
export class ExternalServiceError extends WorkflowError {
  constructor(
    message: string,
    public readonly service: string,
    public readonly operation: string,
    context?: Record<string, unknown>,
  ) {
    super(message, 'EXTERNAL_SERVICE_ERROR', true, {
      ...context,
      service,
      operation,
    });
    this.name = 'ExternalServiceError';
  }
}

/**
 * Error thrown when GitHub API operation fails
 */
export class GitHubError extends ExternalServiceError {
  constructor(message: string, operation: string, context?: Record<string, unknown>) {
    super(message, 'GitHub', operation, context);
    this.name = 'GitHubError';
  }
}

/**
 * Error thrown when task operation fails
 */
export class TaskError extends WorkflowError {
  constructor(
    message: string,
    public readonly taskNumber: number,
    context?: Record<string, unknown>,
  ) {
    super(message, 'TASK_ERROR', true, { ...context, taskNumber });
    this.name = 'TaskError';
  }
}

/**
 * Error thrown when validation fails
 */
export class ValidationError extends WorkflowError {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string[]>,
    context?: Record<string, unknown>,
  ) {
    super(message, 'VALIDATION_ERROR', false, { ...context, fieldErrors });
    this.name = 'ValidationError';
  }
}
