---
trigger: always_on
glob: 
description: Idempotência e Operações em Banco de Dados (Drizzle ORM)
---

# Idempotência e Operações em Banco de Dados (Drizzle ORM)

- **Insert-and-Catch:** Siga a abordagem otimista ("Insert-and-Catch") ao invés de buscar a existência antes de salvar ("Select-then-Insert"). Tente inserir os registros diretamente no banco de dados e capture as exceções de chave duplicada para lidar com a concorrência.
- **Tratamento de Erros no Drizzle:** Ao capturar erros do Postgres com Drizzle (como Unique Constraint Violation `23505`), lembre-se que o Drizzle costuma "encapsular" o erro original em um `DrizzleQueryError`. Para identificar a violação corretamente, você deve checar `e.code === "23505"`, `e.cause?.code === "23505"`, e também se a `message` contém `"duplicate key value"`.
- **Comportamento da Idempotência:** Chaves de idempotência duplicadas não devem gerar erro genérico (500) nem criar múltiplos registros. Elas devem ser capturadas amigavelmente pelo serviço, devolvendo a entidade original previamente criada com status `200 OK` (e não `201 Created`).
