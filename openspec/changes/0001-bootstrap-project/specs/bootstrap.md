## ADDED Requirements

### Requirement: 项目骨架

项目 SHALL 提供完整的目录结构，使 AI agent 能够立即开始工作。

#### Scenario: AI agent 打开项目
- **WHEN** AI agent 打开项目
- **THEN** 能够看到 `.qoder/` 和 `openspec/` 目录
- **AND** 能够执行 `/opsx:propose` 开始新变更

### Requirement: 技能框架

项目 SHALL 包含完整的技能框架，覆盖开发全流程。

#### Scenario: 用户提出新需求
- **WHEN** 用户提出新需求
- **THEN** AI 调用 `brainstorming` 技能探索需求
- **AND** 调用 `openspec-propose` 创建变更提案

#### Scenario: 实施变更
- **WHEN** 变更已批准
- **THEN** AI 调用 `test-driven-development` 技能
- **AND** 按 RED → GREEN → REFACTOR 流程实施

### Requirement: 规格驱动

项目 SHALL 使用 OpenSpec 规格驱动开发。

#### Scenario: 创建变更
- **WHEN** 用户执行 `/opsx:propose`
- **THEN** 在 `openspec/changes/` 下创建变更目录
- **AND** 包含 proposal.md、specs/、design.md、tasks.md

#### Scenario: 归档变更
- **WHEN** 变更完成
- **THEN** 移动到 `openspec/changes/archive/`
- **AND** 增量规格合并到 `openspec/specs/`
