/**
 * Value Object representing a monetary value in cents.
 * Immutable and self-validating. Always positive.
 */
export class Money {
  private readonly _cents: number;

  private constructor(cents: number) {
    this._cents = cents;
  }

  static create(cents: number): Money {
    if (!Number.isFinite(cents) || !Number.isInteger(cents) || cents <= 0) {
      throw new Error(`Money must be a positive integer in cents, received: ${String(cents)}`);
    }
    return new Money(cents);
  }

  static restore(cents: number): Money {
    if (!Number.isFinite(cents) || !Number.isInteger(cents) || cents <= 0) {
      throw new Error(`Cannot restore Money from invalid value: ${String(cents)}`);
    }
    return new Money(cents);
  }

  get cents(): number {
    return this._cents;
  }

  add(other: Money): Money {
    return new Money(this._cents + other._cents);
  }

  multiply(factor: number): Money {
    if (!Number.isFinite(factor) || !Number.isInteger(factor) || factor <= 0) {
      throw new Error(`Money multiplication factor must be a positive integer, received: ${String(factor)}`);
    }
    return new Money(this._cents * factor);
  }

  equals(other: Money): boolean {
    return this._cents === other._cents;
  }
}
