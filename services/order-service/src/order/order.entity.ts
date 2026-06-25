import { InvalidStateTransitionError } from "../core/errors/app.errors.js";
import type { OrderData, OrderItem, OrderStatus } from "./order.schemas.js";

type CreateOrderInput = Pick<OrderData, "customerId"> & {
  items: OrderItem[];
};

export class OrderEntity {
  private _id: string;
  private _customerId: string;
  private _items: OrderItem[];
  private _totalAmount: number;
  private _status: OrderStatus;
  private _createdAt: string;
  private _updatedAt: string;

  private constructor(data: OrderData) {
    this._id = data.id;
    this._customerId = data.customerId;
    this._items = data.items;
    this._totalAmount = data.totalAmount;
    this._status = data.status;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  get id() {
    return this._id;
  }
  get customerId() {
    return this._customerId;
  }
  get items() {
    return this._items;
  }
  get totalAmount() {
    return this._totalAmount;
  }
  get status() {
    return this._status;
  }
  get createdAt() {
    return this._createdAt;
  }
  get updatedAt() {
    return this._updatedAt;
  }

  static create(input: CreateOrderInput): OrderEntity {
    const now = new Date().toISOString();
    const totalAmount = input.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    return new OrderEntity({
      id: crypto.randomUUID(),
      customerId: input.customerId,
      items: input.items,
      totalAmount,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    });
  }

  static restore(data: OrderData): OrderEntity {
    return new OrderEntity(data);
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

  toJSON(): OrderData {
    return {
      id: this._id,
      customerId: this._customerId,
      items: [...this._items],
      totalAmount: this._totalAmount,
      status: this._status,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
