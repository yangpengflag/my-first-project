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

## 第一次使用

本项目用 `openspec init --tools qoder` 初始化，斜杠命令由 OpenSpec CLI 提供：

- `/opsx:propose <idea>` — 创建变更（生成 proposal/design/tasks）
- `/opsx:apply` — 按 tasks.md 推进实现（走 superpowers 的 TDD skill）
- `/opsx:archive` — 归档完成的变更
- `/opsx:explore` — 浏览已有 specs 与 changes

> 重启 Qoder 让斜杠命令生效。