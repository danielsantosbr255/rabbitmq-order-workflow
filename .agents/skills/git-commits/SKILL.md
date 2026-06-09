---
name: git-commits
description: How to correctly analyze and group changes into conventional commits with rich scopes.
---

# Git Commit Analyzer

When the user asks you to commit changes ("fazer commit", "gerar commits", "commitar as alterações"), follow this analytical workflow to ensure the repository remains organized with atomic, clean, and semantic conventional commits.

## Workflow Execution

1. **Check Status**: Run `git status` to see what files are modified, deleted, or untracked.
2. **Analyze Diffs**: Run `git diff --stat` first for an overview, then `git diff <file>` on key files to understand exactly *what* changed and *why*.
3. **Group by Context**: Do not dump everything into a single commit! Group files by their logical context (e.g., frontend changes, database changes, documentation).
4. **Stage and Commit Sequentially**: Use `git add <file/folder>` followed by `git commit -m "<message>"` for each logical group. Always run `git add` and `git commit` as separate sequential commands — never chain them with `&&` to avoid staging errors being silently ignored.

## Git Hooks Awareness

This repository may use **Lefthook** (or similar tools) with pre-commit and commit-msg hooks. Be aware:
- **pre-commit hook**: May run linters/formatters (e.g., Biome) on staged files. If the hook auto-fixes files (`stage_fixed: true`), the commit proceeds with the fixed versions.
- **commit-msg hook**: May run **Commitlint** to validate the commit message format. Non-conventional messages will be **rejected**. Always follow the format rules below strictly.
- If a commit is rejected by hooks, read the error output carefully, fix the issue, and retry.

## Semantic Commit Guidelines

Always use the [Conventional Commits](https://www.conventionalcommits.org/) format. Ensure messages are in **English**, concise, and clearly explain the purpose.

**Key Syntax Rules:**
- The description MUST be written in the **imperative mood** (e.g., "add" instead of "adds" or "added", "fix" instead of "fixes" or "fixed"). Think of it as completing the sentence: "If applied, this commit will..."
- The description MUST start with a **lowercase** letter.
- The description MUST NOT end with a **period**.
- The header line (type + scope + description) SHOULD be at most **72 characters**.

Format: `<type>(<scope>): <description>`

Optional:
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### 1. Types
Use appropriate types:
- `feat`: A new feature
- `fix`: A bug fix
- `refactor`: A code change that neither fixes a bug nor adds a feature (e.g., architecture change, ORM updates)
- `docs`: Documentation only changes
- `chore`: Minor tasks, tooling, or agent-related structure
- `style`: Formatting, missing semi-colons, white-space, etc. (does not change production code logic)
- `test`: Adding or correcting tests
- `perf`: A code change that improves performance
- `build`: Changes that affect the build system or external dependencies (e.g., npm, pnpm, go.mod)
- `ci`: Changes to CI configuration files and scripts (e.g., GitHub Actions, GitLab CI)
- `revert`: Reverts a previous commit (reference the reverted commit hash in the body)

### 2. Rich Scopes (Mandatory Rule)
The `<scope>` must **always** be rich and explicitly identify the layer and the feature/resource affected.
Do not use overly complex or massive scopes, but be precise.

**Monorepo App Rule:**
When working in a monorepo with multiple apps/services under a folder like `apps/`, use the app name as the prefix of the scope.
For example, if you change auth files in `apps/api-gateway`, the scope should be `gateway/auth` or `api-gateway/auth`.

**Special Scopes:**
- Use `workspace` for root-level tooling, configs, and CI that affect the whole repository (e.g., `workspace/lefthook`, `workspace/deps`).
- Use `codebase` when a change spans all or most packages uniformly (e.g., `codebase/format`).

**Format Examples:**
- `dashboard/ui`
- `api-gateway/auth`
- `email-worker/rabbitmq`
- `sms-worker/api`
- `workspace/lefthook`
- `codebase/format`

### 3. Body (Optional)
The body provides a detailed explanation of the *why*. It is essential for complex architectural shifts.

**Formatting Rules:**
- Must be separated from the header by a single blank line.
- Should use a list format with dashes (`-`) for multiple points to improve readability in UIs (like GitHub/VSCode).
- Keep a blank line between the body and the footer.

### 4. Footer (Optional)
Use the footer to reference issue IDs or to flag breaking changes.
- **Breaking Changes**: Start with `BREAKING CHANGE: <description>`.
- **References**: `Fixes #123`, `Closes #456`.

### 5. Grouping Strategy

When many files are modified (e.g., after adding a formatter or refactoring), use this priority order for atomic commits:

1. **Tooling/infra first**: Commit config files, lockfiles, and dependency changes first (type: `build` or `chore`).
2. **Removal/cleanup second**: Commit deletions of replaced tools or deprecated configs (type: `chore`).
3. **Bug fixes third**: Commit code fixes found during linting/formatting (type: `fix`).
4. **Formatting last**: Commit the bulk auto-formatted files as a single `style` commit — these are safe to group broadly since they don't change logic.

### 6. Execution Advice
- In Windows/PowerShell environments, run Git commands *sequentially* in isolated `run_command` steps.
- If a change is too large and touches multiple scopes, break it down using `git add <specific-file>` to create atomic records.
- **PowerShell Multi-line Commits**: Use a variable with a here-string (`@" ... "@`) for stability and clean formatting:
  ```powershell
  $msg = @"
  type(scope): header

  - detail 1
  - detail 2
  "@
  git commit -m $msg
  ```

---

## Good Commit Examples

```
feat(backend/projects): add support for sprint association in entities

- Implement project-to-sprint relationship in Drizzle schema
- Add validation logic to ensure sprints belong to the project tenant
- Update repository to support atomic project initialization

Fixes #102
```

```
build(workspace/setup): configure biome, lefthook, and commitlint

- Install @biomejs/biome, lefthook, @commitlint/cli at root devDependencies
- Create universal biome.json matching project code styles
- Configure lefthook.yml with pre-commit and commit-msg hooks
```

```
chore(dashboard/deps): replace eslint with biome

- Remove ESLint dependencies from dashboard package.json
- Delete local eslint.config.js in favor of global Biome configuration
- Replace dashboard "lint" script with "biome check ."
```

```
fix(dashboard/ui): resolve html semantic and linting errors

- Add missing closing tag for head element in index.html
- Specify type="button" for interactive buttons in DlqInspector
- Link form labels to inputs using htmlFor and id in NotificationForm
```

```
style(codebase/format): format all workspace source files with biome

- Run biome check --write to format all files in the pnpm workspace
- Align quotes to single quotes, enforce semicolons, and organize imports
- Strip unused imports and prefix unused variables with underscores
```

```
refactor(backend/drizzle): modernize schema definitions removing circular dep

- Remove redundant defaultRoleId from tenant settings
- Implement isDefault flag in roles table as the single source of truth
- Clean up outdated FK references in tenant relations
```

```
docs(backend/architecture): document tenant invite and project assignment flow

- Add detailed guide on direct project assignment vs tenant invites
- Document implicit ownership model used in CASL ability factory
- Update architectural decision records for B2B governance
```
