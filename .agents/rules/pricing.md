---
trigger: always_on
glob: 
description: Precificação e Regras de Negócio (Source of Truth)
---

# Precificação e Regras de Negócio (Source of Truth)

- O backend é a **única fonte de verdade** para preços de produtos.
- O cliente/frontend **nunca** deve enviar o preço unitário (`unitPrice`) no corpo da requisição. Ele envia apenas `productId` e `quantity`.
- O serviço orquestrador (ex: `OrdersService`) deve sempre buscar os preços reais consultando serviços externos ou mocks (ex: `ProductCatalogService`) e preencher esses valores antes de instanciar a entidade e calcular o valor total (`totalAmount`).
