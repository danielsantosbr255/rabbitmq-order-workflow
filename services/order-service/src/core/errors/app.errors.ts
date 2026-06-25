export abstract class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ResourceNotFoundError extends DomainError {
  constructor(
    public readonly resource: string,
    public readonly identifier: string,
  ) {
    super(`${resource} with identifier '${identifier}' was not found.`);
  }
}

export class InvalidStateTransitionError extends DomainError {
  constructor(
    public readonly fromState: string,
    public readonly toState: string,
  ) {
    super(`Cannot transition from ${fromState} to ${toState}`);
  }
}

export class IdempotencyConflictError extends DomainError {
  constructor(public readonly idempotencyKey: string) {
    super(`Concurrent request detected for idempotency key: ${idempotencyKey}`);
  }
}
