## 硬规则（不可违反）

1. **任何代码改动前必须先走 OpenSpec 流程**：在父仓 `openspec/changes/<change-name>/` 下产出 `proposal.md` → `design.md` → `tasks.md`，人类签字后才动 submodule 内的代码。
2. **业务改动落在 submodule 内**：`backend/` 和 `frontend/` 是独立 git 仓库，`git add` / `commit` / `push` 都要在子仓目录内执行；父仓只追加 submodule 指针。
3. **TDD 不可绕过**：实现阶段严格 RED → GREEN → REFACTOR，先写失败测试。
4. **YAGNI / DRY**：不做没要求的事，不搞预防性抽象。
5. **变更完成后归档**：把 `openspec/changes/<name>/` 移入 `openspec/changes/archive/<date>-<name>/`，并在父仓同步更新对应 submodule 指针。

## 快速入口

- 编码规约：[`.qoder/rules/coding-conventions.md`](.qoder/rules/coding-conventions.md)
- 工作流规则：[`.qoder/rules/spec-driven-workflow.md`](.qoder/rules/spec-driven-workflow.md)
- OpenSpec 官方命令：`.qoder/commands/opsx/{propose,apply,archive,explore}.md`
- OpenSpec 官方 skills：`.qoder/skills/openspec-{propose,apply-change,archive-change,explore}/SKILL.md`
- Superpowers skills：`.qoder/skills/{brainstorming,writing-plans,executing-plans,test-driven-development,subagent-driven-development,using-git-worktrees,requesting-code-review,verification-before-completion}/SKILL.md`
- OpenSpec 配置：[`openspec/config.yaml`](openspec/config.yaml)
- 项目级 spec：[`openspec/project.md`](openspec/project.md)
- 当前进行中的变更：`openspec/changes/`

## Submodule 说明

本项目采用 **父仓 + submodule** 结构，`frontend/` 和 `backend/` 是独立的 git 仓库：

### `backend/` — Spring Boot 后端服务
- **技术栈**：Java 17 + Spring Boot 3.3.x + JPA (Hibernate) + PostgreSQL
- **包名**：`com.mooc.app`
- **分层架构**：`controller/` → `service/` → `repository/` → `entity/` → `dto/`
- **启动命令**：`mvn -f backend/pom.xml spring-boot:run`
- **测试命令**：`mvn -f backend/pom.xml test`
- **编码规约**：[`.qoder/rules/backend-conventions.md`](.qoder/rules/backend-conventions.md)

### `frontend/` — Next.js 前端应用
- **技术栈**：Next.js 16 (App Router) + React 19 + TypeScript 5
- **样式**：Tailwind CSS 4 + shadcn/ui (base-nova) + lucide-react
- **状态管理**：Zustand
- **测试**：Vitest + React Testing Library
- **目录入口**：`frontend/app/`（页面），`frontend/components/`（共享组件），`frontend/lib/`（工具/状态）
- **编码规约**：[`.qoder/rules/frontend-conventions.md`](.qoder/rules/frontend-conventions.md)

### Submodule 操作规范
- 进入子仓执行 git 操作：`cd backend && git add . && git commit -m "..."`
- 父仓只记录 submodule 指针更新：`git add backend frontend && git commit -m "update submodule pointers"`
- 克隆后需初始化子仓：`git submodule update --init --recursive`

## 第一次使用

本项目用 `openspec init --tools qoder` 初始化，斜杠命令由 OpenSpec CLI 提供：

- `/opsx:propose <idea>` — 创建变更（生成 proposal/design/tasks）
- `/opsx:apply` — 按 tasks.md 推进实现（走 superpowers 的 TDD skill）
- `/opsx:archive` — 归档完成的变更
- `/opsx:explore` — 浏览已有 specs 与 changes

> 重启 Qoder 让斜杠命令生效。