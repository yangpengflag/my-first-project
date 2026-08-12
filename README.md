# my-first-project

> 基于 **Harness + OpenSpec + Superpowers** 理念的 AI 编码项目。

## 理念

本项目结合三种结构化 AI 辅助开发的核心概念：

### Harness（代理生命周期控制）

行为指令，引导 AI 编码代理从会话开始就遵循结构化工作流。

**关键文件：**
- `AGENTS.md` — 代理行为指令（会话开始时自动加载）

### OpenSpec（规格驱动开发）

轻量规格层，确保人和 AI 在写代码之前就"要构建什么"达成一致。

**关键目录：**
```
openspec/
├── config.yaml          # 配置
├── project.md           # 项目规格模板
├── specs/               # 系统规格（真相来源）
└── changes/             # 进行中的变更
    ├── <变更名称>/      # 每个变更包含：
    │   ├── proposal.md  # 为什么做
    │   ├── specs/       # 增量规格（ADDED/MODIFIED/REMOVED）
    │   ├── design.md    # 技术方案
    │   └── tasks.md     # 实施清单
    └── archive/         # 已归档的变更
```

**工作流：** `/opsx:propose` → `/opsx:apply` → `/opsx:archive`

### Superpowers（技能框架）

可组合技能，为不同开发任务提供结构化方法论。

**关键目录：**
```
.qoder/skills/
── brainstorming/               # 需求探索
── writing-plans/               # 计划编写
├── executing-plans/             # 计划执行
├── test-driven-development/     # TDD 方法论
├── systematic-debugging/        # 调试方法论
├── requesting-code-review/      # 代码审查流程
└── verification-before-completion/  # 完成验证
```

## 开发工作流

```
┌─────────────     ┌──────────────┐     ┌─────────────┐
│ 头脑风暴     │────▶│ 规格说明      │────▶│ 计划        │
│ (explore)    │     │ (propose)    │     │ (tasks)     │
└─────────────     └──────────────┘     └──────┬──────┘
                                                 │
┌─────────────┐     ┌──────────────┐     ┌──────▼──────
│ 归档         │◀────│ 验证         │◀────│ 实施        │
│ (done)       │     │ (tests)      │     │ (TDD)       │
└─────────────┘     └──────────────     └─────────────┘
```

1. **头脑风暴** — 探索想法、提问、提出方案
2. **规格说明** — 创建 OpenSpec 变更（提案、增量规格、设计）
3. **计划** — 分解为 2-5 分钟任务，带验证步骤
4. **实施** — TDD 循环：RED → GREEN → REFACTOR
5. **验证** — 运行测试、对照规格审查、收集证据
6. **归档** — 移动变更到 archive，合并规格

## 核心原则

1. **规格先行，代码在后** — 没有经过验证的设计，绝不写代码
2. **测试驱动开发** — RED → GREEN → REFACTOR
3. **系统化而非临时** — 遵循流程，而非猜测
4. **降低复杂度** — 简洁是首要目标
5. **证据胜于声明** — 验证后再宣布成功

## 快速开始

1. 阅读 `AGENTS.md` 获取完整开发工作流
2. 检查 `openspec/specs/` 获取当前系统规格
3. 检查 `.qoder/skills/` 获取相关技能指令
4. 遵循 头脑风暴 → 规格 → 计划 → 实施 → 审查 → 归档 循环

## 项目结构

```
my-first-project/                  ← 父仓（OpenSpec 管理）
├── AGENTS.md                      # 代理行为指令
├── backend/                       # git submodule（Spring Boot 3.5.16 + Maven）
│   ├── pom.xml
│   ├── src/main/java/com/icool/backend/
│   └── src/test/java/com/icool/backend/
├── frontend/                      # git submodule（Vue 3 + Vite + TypeScript）
│   ├── package.json
│   ├── vite.config.ts
│   └── src/
├── .qoder/                        # Qoder 原生配置目录
│   ├── agents/                    # 自定义子代理
│   ├── commands/opsx/             # OpenSpec 斜杠命令
│   ├── rules/                     # 项目规则
│   └── skills/                    # 可组合技能框架
├── openspec/                      # OpenSpec：规格驱动开发
│   ├── config.yaml                # OpenSpec 配置
│   ├── project.md                 # 项目规格
│   ├── specs/                     # 系统规格（真相来源）
│   └── changes/                   # 变更提案
│       ├── 0001-bootstrap-project/
│       ├── 0002-springboot-skeleton/
│       └── archive/
└── docs/                          # 文档
    ├── designs/                   # 设计文档
    └── plans/                     # 实施计划
```

## 参考

- [OpenSpec](https://github.com/Fission-AI/OpenSpec) — 规格驱动开发框架
- [Superpowers](https://github.com/obra/superpowers) — 可组合技能框架与方法论
