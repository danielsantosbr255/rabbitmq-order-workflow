---
trigger: always_on
glob: 
description: Commits Atômicos e Clean Code
---

# Commits Atômicos e Clean Code

- **SOLID e Clean Architecture:** Mantenha as camadas isoladas. Repositórios lidam com a infra de persistência. A regra de negócio não deve vazar para repositórios; ela pertence a Services e Entities.
- **Git:** Agrupe as mudanças em commits atômicos, testados e seguindo o Conventional Commits detalhado nas Skills de git-commits (`/git-commits`).
