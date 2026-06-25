---
trigger: always_on
glob: 
description: Tipagem, Compilação e TSConfig
---

# Tipagem, Compilação e TSConfig

- O projeto exige a separação clara de responsabilidades no TypeScript:
  - `tsconfig.json`: Focado na **experiência do desenvolvedor (IDE) e Typecheck**, deve incluir a checagem completa de tipos sobre *todos* os arquivos (incluindo testes `**/*.spec.ts`). `"rootDir": "./"` e sem excluir a pasta de testes.
  - `tsconfig.build.json`: Usado exclusivamente pelo script de `build` para gerar o output (`dist/`). Este arquivo deve estender o original e **excluir** todos os testes para evitar artefatos indesejados em produção.
