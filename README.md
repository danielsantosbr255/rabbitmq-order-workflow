# 📦 Sistema de Processamento de Pedidos (Event-Driven Architecture)

Um ecossistema de micro-serviços orientado a eventos, desenhado para simular o processamento assíncrono de pedidos de um e-commerce do mundo real.

Este projeto tem como objetivo principal servir como um laboratório prático para o estudo profundo de **Mensageria (RabbitMQ)**, **Resiliência**, **Desacoplamento** e **Arquitetura de Software**. Em vez de focar em lógicas de negócio complexas, o projeto resolve os desafios de infraestrutura que todo desenvolvedor Fullstack e Backend enfrenta em produção: tolerância a falhas, idempotência e consistência eventual.

---

## 🧠 Filosofia e Propósito

* **Pragmatismo sobre Overengineering:** O projeto utiliza padrões de design como *Ports and Adapters* (Hexagonal lite) apenas onde há fronteiras de I/O (Banco de Dados e APIs externas), mantendo o código das regras de negócio limpo e direto.
* **Coreografia sobre Orquestração:** Não há um serviço central ditando o fluxo. Os serviços reagem a eventos emitidos no ecossistema, garantindo baixo acoplamento.
* **Design for Failure:** O sistema assume que a rede vai falhar, que o banco pode ficar lento e que mensagens podem vir corrompidas. Cada *worker* é blindado com estratégias de retentativa e descarte seguro.

---

## 🏗️ Serviços e Fluxo do Sistema

O sistema é composto por três serviços principais que operam dentro de um Monorepo e são orquestrados via Docker Compose.

1. **Order Service (Node.js + Fastify)**
    * **Papel:** API Gateway inicial e domínio de Pedidos.
    * **Fluxo:** Recebe a requisição HTTP `POST /orders`, salva no banco de dados com o status `PENDING` e publica o evento `order.created` no RabbitMQ. Posteriormente, escuta eventos de conclusão para atualizar o status final do pedido.
2. **Payment Service (Go)**
    * **Papel:** Worker assíncrono de alta performance.
    * **Fluxo:** Consome o evento `order.created`. Verifica a idempotência (para não cobrar duas vezes). Simula o processamento em um Gateway de Pagamento externo (com atrasos e falhas aleatórias de rede). Após o processamento, publica o evento `payment.processed` (`APPROVED` ou `REJECTED`).
3. **Notification Service (Node.js ou Go)**
    * **Papel:** Worker de comunicação.
    * **Fluxo:** Escuta múltiplos eventos (`order.created` e `payment.processed`) para simular o envio de e-mails/SMS informando o cliente sobre o andamento do pedido.

---

## 🐇 Topologia de Mensageria (RabbitMQ)

Para garantir máxima flexibilidade, utilizamos uma **Topic Exchange**. Isso permite que os consumidores filtrem os eventos que desejam ouvir usando *Routing Keys* (chaves de roteamento).

| Exchange | Tipo | Routing Key | Fila Vinculada (Queue) | Fila de Falhas (DLQ) | Consumidor |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `ecommerce.events` | `topic` | `order.created` | `payment_process_queue` | `payment_process.dlq` | Payment Service |
| `ecommerce.events` | `topic` | `payment.processed` | `order_update_queue` | `order_update.dlq` | Order Service |
| `ecommerce.events` | `topic` | `order.*` / `payment.*` | `notification_queue` | `notification.dlq` | Notification Service |

---

## 🛡️ Resiliência: Retries, Backoff e DLQs

Um dos pilares deste projeto é como ele lida com o caos. O fluxo de tratamento de erros segue regras estritas:

### 1. Sistema de Retry com Exponential Backoff

Sistemas externos (como gateways de pagamento reais) costumam ter instabilidades. Se o Payment Service tentar comunicar com o Gateway simulado e falhar por um erro transitório (ex: *Timeout*), ele não descarta a mensagem.

* **O Mecanismo:** O *worker* implementa um padrão de retentativa interno (no próprio código Go/Node) com *Exponential Backoff*.
* **Exemplo:** Falhou a 1ª vez? Espera 2 segundos e tenta de novo. Falhou a 2ª? Espera 4 segundos. Falhou a 3ª? Espera 8 segundos. Se falhar após o limite máximo de tentativas, o erro deixa de ser transitório e passa a ser tratado como falha fatal.

### 2. Dead Letter Queues (DLQs)

Se uma mensagem não puder ser processada de forma alguma (ex: falha fatal após todos os retries, erro de validação de JSON, regra de negócio inválida), o consumidor emite um `.Nack(requeue=false)`.

* **Isolamento Absoluto:** **Cada fila principal possui sua própria DLQ correspondente.** (ex: mensagens rejeitadas da `payment_process_queue` vão automaticamente para a `payment_process.dlq`).
* **Por que não uma DLQ única?** Ter uma DLQ para cada fila facilita imensamente o monitoramento e o processo de *Replay*. Se houver um bug no Payment Service, saberemos exatamente onde as mensagens presas estão e poderemos reprocessá-las no futuro sem misturá-las com mensagens de erro de Notificações.

### 3. Idempotência e Graceful Shutdown

* **Idempotência:** Antes de qualquer ação mutável (como processar um pagamento), o serviço consulta seu banco de dados local. Se o `order_id` já foi processado anteriormente, a mensagem recebe um `.Ack()` imediato e é ignorada.
* **Graceful Shutdown:** Ao receber um sinal de desligamento do Docker (SIGTERM), os serviços param de aceitar novas mensagens da fila, terminam de processar as que já estão em memória, garantem o `.Ack()` e só então encerram suas conexões com segurança.

---

## 🚀 Como Rodar o Projeto Localmente

**Pré-requisitos:**

* Docker e Docker Compose instalados.
* Node.js (para o Order/Notification service localmente).
* Go 1.22+ (para rodar/compilar o Payment worker).

**Passo a passo:**

1. Clone o repositório:

    ```bash
    git clone [https://github.com/seu-usuario/portfolio-projects.git](https://github.com/seu-usuario/portfolio-projects.git)
    cd portfolio-projects/event-driven-ecommerce
    ```

2. Suba a infraestrutura base (RabbitMQ e Bancos de Dados):

    ```bash
    docker-compose up -d rabbitmq postgres
    ```

3. Acesse o painel de gerenciamento do RabbitMQ em `http://localhost:15672` (Usuário: `guest` | Senha: `guest`) para visualizar a topologia.

4. Inicie os serviços utilizando o script inicializador ou os comandos respectivos de cada pasta de serviço.
