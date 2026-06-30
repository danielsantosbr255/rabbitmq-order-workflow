import { InvalidStateTransitionError } from "../exceptions/domain.errors.js";
import { isUUID } from "../utils/guard.js";
import { Money } from "../value-objects/money.vo.js";
import { OrderItem } from "../value-objects/order-item.vo.js";

export const ORDER_STATUSES = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELED"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

function isValidOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && (ORDER_STATUSES as readonly string[]).includes(value);
}

type CreateOrderInput = {
  customerId: string;
  items: { productId: string; quantity: number; unitPrice: number }[];
};

export type OrderSnapshot = {
  id: string;
  customerId: string;
  items: { productId: string; quantity: number; unitPrice: number }[];
  totalAmount: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
};

export class OrderEntity {
  private _id: string;
  private _customerId: string;
  private _items: OrderItem[];
  private _totalAmount: Money;
  private _status: OrderStatus;
  private _createdAt: string;
  private _updatedAt: string;

  private constructor(
    id: string,
    customerId: string,
    items: OrderItem[],
    totalAmount: Money,
    status: OrderStatus,
    createdAt: string,
    updatedAt: string,
  ) {
    this._id = id;
    this._customerId = customerId;
    this._items = items;
    this._totalAmount = totalAmount;
    this._status = status;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  static create(input: CreateOrderInput): OrderEntity {
    if (!isUUID(input.customerId)) {
      throw new Error(`OrderEntity customerId must be a valid UUID, received: ${String(input.customerId)}`);
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error("OrderEntity must have at least one item");
    }

    const items = input.items.map(i => OrderItem.create(i));
    const totalCents = items.reduce((sum, item) => sum + item.lineTotal.cents, 0);
    const totalAmount = Money.create(totalCents);

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    return new OrderEntity(id, input.customerId, items, totalAmount, "PENDING", now, now);
  }

  static restore(input: OrderSnapshot): OrderEntity {
    if (!isUUID(input.id)) {
      throw new Error(`Cannot restore OrderEntity with invalid id: ${String(input.id)}`);
    }
    if (!isUUID(input.customerId)) {
      throw new Error(`Cannot restore OrderEntity with invalid customerId: ${String(input.customerId)}`);
    }
    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error("Cannot restore OrderEntity with empty items");
    }
    if (!isValidOrderStatus(input.status)) {
      throw new Error(`Cannot restore OrderEntity with invalid status: ${String(input.status)}`);
    }
    if (typeof input.createdAt !== "string" || input.createdAt.length === 0) {
      throw new Error("Cannot restore OrderEntity with invalid createdAt");
    }
    if (typeof input.updatedAt !== "string" || input.updatedAt.length === 0) {
      throw new Error("Cannot restore OrderEntity with invalid updatedAt");
    }

    const items = input.items.map(i => OrderItem.restore(i));
    const totalAmount = Money.restore(input.totalAmount);

    return new OrderEntity(
      input.id,
      input.customerId,
      items,
      totalAmount,
      input.status,
      input.createdAt,
      input.updatedAt,
    );
  }

  get id(): string {
    return this._id;
  }
  get customerId(): string {
    return this._customerId;
  }
  get items(): readonly OrderItem[] {
    return this._items;
  }
  get totalAmount(): Money {
    return this._totalAmount;
  }
  get status(): OrderStatus {
    return this._status;
  }
  get createdAt(): string {
    return this._createdAt;
  }
  get updatedAt(): string {
    return this._updatedAt;
  }

  markAsPaid(): void {
    if (this._status === "PAID" || this._status === "SHIPPED" || this._status === "DELIVERED") return;
    if (this._status !== "PENDING") {
      throw new InvalidStateTransitionError(this._status, "PAID");
    }
    this._status = "PAID";
    this._updatedAt = new Date().toISOString();
  }

  markAsShipped(): void {
    if (this._status === "SHIPPED" || this._status === "DELIVERED") return;
    if (this._status !== "PAID") {
      throw new InvalidStateTransitionError(this._status, "SHIPPED");
    }
    this._status = "SHIPPED";
    this._updatedAt = new Date().toISOString();
  }

  markAsDelivered(): void {
    if (this._status === "DELIVERED") return;
    if (this._status !== "SHIPPED") {
      throw new InvalidStateTransitionError(this._status, "DELIVERED");
    }
    this._status = "DELIVERED";
    this._updatedAt = new Date().toISOString();
  }

  cancel(): void {
    if (this._status === "CANCELED" || this._status === "DELIVERED") return;
    this._status = "CANCELED";
    this._updatedAt = new Date().toISOString();
  }

  toSnapshot(): OrderSnapshot {
    return {
      id: this.id,
      customerId: this.customerId,
      items: this.items.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice.cents,
      })),
      totalAmount: this.totalAmount.cents,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
