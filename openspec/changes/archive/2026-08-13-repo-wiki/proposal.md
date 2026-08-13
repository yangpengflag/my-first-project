# Proposal: 仓库知识库 (Repo Wiki)

## Why

用户希望获得类似 Qoder "Repo Wiki" 的能力：让 AI 自动扫描整个代码库，生成结构化的知识库文档（架构概览、模块说明、关键流程），并能问答/检索，且可随代码演进持续维护。当前仓库只有 OpenSpec 规格层，缺少对子仓业务代码本身的"可读索引"，AI 每次都需重新探索，可复现性与一致性差。

## What Changes

### 新增产物

- 父仓新增 `scripts/wiki-generator.ts`：扫描 `backend/` 与 `frontend/` 子仓，生成结构化 Wiki 到 `docs/wiki/`。
- 父仓新增 skill `repo-wiki`（放 `.codebuddy/skills/repo-wiki/SKILL.md`），封装"生成/增量更新/检索"的 SOP，让 AI 与用户都能调用。
- 生成的 Wiki 文档（示例，实际由脚本产出）：
  - `docs/wiki/INDEX.md` — 总览 + 模块链接 + 更新时间戳
  - `docs/wiki/architecture.md` — 整体分层架构与依赖
  - `docs/wiki/modules/<模块>.md` — 每个主要模块的的职责、关键文件、对外接口

### 扫描范围（已确认）

- ✅ `backend/` 子仓业务代码
- ✅ `frontend/` 子仓业务代码
- ❌ 不扫描 `openspec/` 规格层（仅当未来扩展再纳入）
- ❌ 不扫描 `docs/` 现有文档

### 工作流约束遵守

- 脚本落在**父仓** `scripts/`（非子仓业务代码），符合硬规则 2（工具脚本不进 submodule）。
- 本 change 本身走 OpenSpec 流程（proposal → design → tasks → 签字 → apply），符合硬规则 1。

## Out of Scope

- 不引入向量数据库 / 重型 RAG 框架（采用轻量 INDEX + 文件定位检索）。
- 不生成可视化架构图渲染（架构图以 ASCII/Markdown 文本表达）。
- 不接入 LLM API 自动撰写（脚本产出"骨架 + 提取信息"，AI 在 skill 中补充自然语言叙述；保持可离线、可复现）。
- 不扫描 OpenSpec / docs（本期不做）。

## Open Questions

- [x] 脚本语言：Node/TS（`tsx` 运行），复用 frontend 的 Node 生态
- [x] 扫描范围：仅 backend/ + frontend/ 子仓业务代码
- [ ] 是否需要在 CI 中自动跑生成（留到后续 change，本期手动触发）
