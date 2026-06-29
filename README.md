# 📦 Sistema de Processamento de Pedidos (Saga Orchestration com Temporal.io)

Um ecossistema de micro-serviços estruturado sob o padrão de **Saga Orchestration** para gerenciar a consistência eventual distribuída, aliado ao poder do **Temporal.io** para garantir a execução confiável, retentativas automáticas e abstração completa da complexidade de estado e filas.

Este repositório é um laboratório pragmático focado em resolver os principais desafios de arquiteturas orientadas a eventos em sistemas reais de produção: **execução distribuída confiável, concorrência, retentativas resilientes, idempotência e compensação (rollback) distribuída.**

---

## 🧠 Filosofia Arquitetural

* **Orquestração sobre Coreografia:** Em vez de espalhar a lógica de negócios por vários serviços reativos (Saga Choreography), centralizamos a inteligência do fluxo do pedido em um Orquestrador (Workflow no Temporal). Isso torna o processo de negócio (A -> B -> C) transparente, fácil de debugar e de testar como código procedural simples.
* **Execução Determinística e Resiliente:** Com o Temporal, o estado de cada etapa (Activity) do fluxo do pedido é persistido na engine. Quedas de rede, instabilidades temporárias nos Gateways ou restarts de pods não causam perda de mensagens. O workflow pausa e retoma de onde parou de forma invisível ao desenvolvedor.
* **Adeus Dual-Write e Outbox Pattern:** Ao delegar a responsabilidade de orquestração para o Temporal, eliminamos o problema clássico do Dual-Write. Não precisamos mais manter uma tabela `outbox` e deamons de sincronização no banco transacional. O simples ato de fazer um `startWorkflow` sinaliza a intenção de forma confiável.

---

## 🏗️ Serviços e Fluxo do Sistema

O monorepo é dividido em serviços específicos com responsabilidades bem delimitadas:

1. **Order Service (Node.js + Fastify + Temporal TS SDK + PostgreSQL):**
   * **Responsabilidade:** Domínio de Pedidos, API HTTP e **Dono do Workflow**. Ele orquestra os demais serviços.
   * **Fluxo:** Recebe a requisição HTTP `POST /orders`, valida a requisição e cria a entidade de domínio `OrderEntity` em memória (validação fail-fast), e aciona o `OrderSagaWorkflow` via cliente do Temporal. A persistência no banco de dados é garantida de forma assíncrona pela primeira atividade do workflow.
2. **Payment Service (Go + Temporal Go SDK + PostgreSQL):**
   * **Responsabilidade:** Worker assíncrono de cobrança.
   * **Fluxo:** Expõe as Activities `ProcessPayment` e `RefundPayment` para o Temporal. O orquestrador o aciona no momento exato.
3. **Shipping Service (Go + Temporal Go SDK):**
   * **Responsabilidade:** Domínio de entrega e logística.
   * **Fluxo:** Expõe a Activity `ShipOrder`. Se falhar por endereço inválido, o erro é jogado de volta ao Workflow para disparar as compensações.
4. **Notification Service (Go + Temporal Go SDK):**
   * **Responsabilidade:** Comunicação com o cliente.
   * **Fluxo:** Expõe a Activity `NotifyCustomer`.

---

## ⚙️ Padrão Saga Orchestration

O Workflow da Saga é descrito em TypeScript, e fica no `order-service`.

### Estratégia de Sucesso e Compensação (Try/Catch Distribuído)

O fluxo pode ser visualizado no Temporal UI, mas no código, ele é um bloco lógico direto:

```typescript
export async function OrderSagaWorkflow(input: CreateOrderActivityInput): Promise<void> {
  let paymentProcessed = false;
  let shippingProcessed = false;

  try {
    // Step 0: Persiste o pedido no banco de dados com idempotência
    await orderActivities.createOrder(input);

    // Step 1: Processa o pagamento
    await payment.ProcessPayment(input.orderId, input.customerId, input.totalAmountCents);
    paymentProcessed = true;
    await orderActivities.updateOrderStatus(input.orderId, "PAID");

    // Step 2: Despacha o pedido
    await shipping.ShipOrder(input.orderId, input.customerId);
    shippingProcessed = true;
    await orderActivities.updateOrderStatus(input.orderId, "SHIPPED");

    // Step 3: Notifica o cliente
    await notification.NotifyCustomer(input.orderId, "Your order has been shipped successfully.");
  } catch (err) {
    if (paymentProcessed) {
      await payment.RefundPayment(input.orderId, input.customerId, input.totalAmountCents); // Ação Compensatória
    }
    await orderActivities.updateOrderStatus(input.orderId, "CANCELED");
    await notification.NotifyCustomer(input.orderId, "Your order was canceled and refunded.");
    throw err;
  }
}
```

> [!IMPORTANT]
> **A Regra de Ouro da Compensação é a Idempotência.**
> A rede pode falhar e o Temporal re-executar uma Activity. As Activities em Go (ex: `ProcessPayment`) possuem verificação local no Postgres para assegurar que não farão dupla cobrança caso sejam acionadas novamente com o mesmo `orderId`.

---

## 🚀 Como Rodar o Projeto

### Pré-requisitos

* Docker e Docker Compose instalados.
* Node.js 20+ (para rodar os serviços JS).
* Go 1.22+ (para rodar os workers em Go).

### Execução

1. Suba os containers de infraestrutura (PostgreSQL e Temporal Server):

   ```bash
   docker compose up -d
   ```

2. Painéis disponíveis:
   * **Temporal UI**: `http://localhost:8233` (Dashboard fantástico para ver suas Sagas executando!)
   * **Postgres Database**: Porta local `5432`

3. Para executar as migrations e rodar os Workers:

   * **Order Service:**

     ```bash
     cd services/order-service
     pnpm install
     pnpm run db:push
     pnpm run dev
     ```

   * **Payment Service:**

     ```bash
     cd services/payment-service
     go run cmd/main.go
     ```

   * **Shipping e Notification:**
     Execute os mesmos passos (`go run cmd/main.go`) em seus respectivos diretórios para acoplar todos os workers à task queue do Temporal.
