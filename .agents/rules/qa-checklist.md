---
trigger: always_on
glob: 
description: Garantia de Qualidade e Scripts Obrigatórios (Checklist de Conclusão)
---

# Garantia de Qualidade e Scripts Obrigatórios (Checklist de Conclusão)

**NENHUM AGENTE PODE FINALIZAR UMA IMPLEMENTAÇÃO SEM GARANTIR QUE TODOS OS PASSOS ABAIXO PASSARAM COM SUCESSO:**

1. **Lint e Formatação:** Execute `pnpm lint:fix` (usa o Biome) para garantir a padronização e limpar avisos.
2. **Typecheck:** Execute `pnpm typecheck` (`tsc --noEmit` usando o `tsconfig.json`) para provar que a base inteira, incluindo testes, não possui erros de tipo.
3. **Testes Unitários:** Execute `pnpm test`.
4. **Testes de Integração:** Execute `pnpm test:integration`.
5. **Testes E2E:** Execute `pnpm test:e2e` (garanta que o docker-compose esteja rodando com banco e temporal up).
6. **Build:** Execute `pnpm build` para provar que a aplicação compila os artefatos de distribuição.
*Se algum teste falhar após a sua alteração, a implementação não está pronta.*
