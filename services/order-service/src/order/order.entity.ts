import { InvalidStateTransitionError } from "../core/errors/app.errors.js";
import type { OrderData, OrderStatus } from "./order.schemas.js";

type CreateOrderInput = Pick<OrderData, "customerId" | "items">;

export class OrderEntity {
  private _id: string;
  private _customerId: string;
  private _items: OrderData["items"];
  private _status: OrderStatus;
  private _createdAt: string;
  private _updatedAt: string;

  private constructor(data: OrderData) {
    this._id = data.id;
    this._customerId = data.customerId;
    this._items = data.items;
    this._status = data.status;
    this._createdAt = data.createdAt;
    this._updatedAt = data.updatedAt;
  }

  // Getters
  get id() { return this._id; }
  get customerId() { return this._customerId; }
  get items() { return this._items; }
  get status() { return this._status; }
  get createdAt() { return this._createdAt; }
  get updatedAt() { return this._updatedAt; }

  /**
   * Cria um novo pedido com estado inicial PENDING.
   */
  static create(input: CreateOrderInput): OrderEntity {
    const now = new Date().toISOString();
    return new OrderEntity({
      id: crypto.randomUUID(),
      customerId: input.customerId,
      items: input.items,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    });
  }

  /**
   * Reconstrói a entidade a partir do banco de dados.
   */
  static restore(data: OrderData): OrderEntity {
    return new OrderEntity(data);
  }

  // --- State Machine ---

  markAsProcessing(): void {
    if (this._status !== "PENDING") {
      throw new InvalidStateTransitionError(this._status, "PROCESSING");
    }
    this._status = "PROCESSING";
    this._updatedAt = new Date().toISOString();
  }

  complete(): void {
    if (this._status !== "PROCESSING") {
      throw new InvalidStateTransitionError(this._status, "COMPLETED");
    }
    this._status = "COMPLETED";
    this._updatedAt = new Date().toISOString();
  }

  cancel(): void {
    if (this._status === "COMPLETED" || this._status === "CANCELLED") {
      throw new InvalidStateTransitionError(this._status, "CANCELLED");
    }
    this._status = "CANCELLED";
    this._updatedAt = new Date().toISOString();
  }

  /**
   * Exporta os dados da entidade para um formato puro (DTO)
   */
  toJSON(): OrderData {
    return {
      id: this._id,
      customerId: this._customerId,
      items: [...this._items],
      status: this._status,
      createdAt: this._createdAt,
      updatedAt: this._updatedAt,
    };
  }
}
