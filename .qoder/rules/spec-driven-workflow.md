# 规格驱动开发工作流

> 基于 Harness + OpenSpec + Superpowers 方法论的项目规则

## 核心原则

1. **规格先行，代码在后** — 没有经过验证的设计规格，绝不写代码
2. **测试驱动开发** — 先写测试（RED → GREEN → REFACTOR）
3. **系统化而非临时** — 遵循流程，而非猜测
4. **降低复杂度** — 简洁是首要目标
5. **证据胜于声明** — 验证后再宣布成功

## 强制工作流

在进行任何创造性工作（功能、组件、功能变更）之前：

### 阶段 1：头脑风暴
- 探索项目上下文（文件、文档、最近变更）
- 提出澄清问题 — 一次一个
- 提出 2-3 种方案并说明权衡
- 分部分展示设计，获取用户批准
- 将设计保存到 `docs/designs/YYYY-MM-DD-<主题>-design.md`

### 阶段 2：规格说明（OpenSpec）
- 创建变更提案：`openspec/changes/<变更名称>/proposal.md`
- 编写增量规格：`openspec/changes/<变更名称>/specs/`
- 编写技术设计：`openspec/changes/<变更名称>/design.md`
- 创建任务分解：`openspec/changes/<变更名称>/tasks.md`
- **在继续之前获取用户批准**

### 阶段 3：计划
- 将工作分解为 2-5 分钟的任务
- 每个任务包含：精确文件路径、完整代码、验证步骤
- 将计划保存到 `docs/plans/YYYY-MM-DD-<主题>-plan.md`

### 阶段 4：实施（TDD）
- 对每个任务：
  1. 编写失败测试（RED）
  2. 编写最小代码使其通过（GREEN）
  3. 在保持测试通过的情况下重构（REFACTOR）
  4. 使用描述性消息提交

### 阶段 5：审查与验证
- 根据计划和规格进行自我审查
- 运行所有测试 — 必须通过
- 如有可用，请求代码审查
- 在宣布完成前验证完成标准

### 阶段 6：归档
- 归档变更：移动到 `openspec/changes/archive/`
- 将增量规格合并到主规格中

## 避免的反模式

- ❌ 在不理解需求的情况下编写代码
- ❌ 跳过测试或在代码之后编写测试
- ❌ 未经核实就宣布"完成"
- ❌ 在不更新规格的情况下进行更改
-  大型不可审查的变更集
- ❌ "这太简单了不需要设计" — 每个变更都需要设计

## 技能参考

在执行任何任务之前，检查 `skills/` 目录中的相关技能：

| 技能 | 使用时机 |
|------|----------|
| `brainstorming` | 任何创造性/功能工作之前 |
| `writing-plans` | 设计批准后，编码之前 |
| `executing-plans` | 实施阶段 |
| `test-driven-development` | 任何代码编写期间 |
| `systematic-debugging` | 调查 bug 时 |
| `requesting-code-review` | 任务之间或检查点 |
| `verification-before-completion` | 宣布完成之前 |

## 项目结构

```
.qoder/
├── agents/         # 自定义子代理
├── commands/       # 自定义斜杠命令
├── rules/          # 项目规则（本文件）
└── skills/         # 可组合技能框架
openspec/
├── config.yaml     # OpenSpec 配置
├── specs/          # 系统规格（真相来源）
└── changes/        # 进行中的变更
    └── archive/    # 已归档的变更
docs/
├── designs/        # 头脑风暴设计文档
└── plans/          # 实施计划
src/                # 源代码
tests/              # 测试文件
_qa/                # QA 制品（测试报告等）
```

## 关键规则

- 规格是真相来源，代码从规格派生
- 每个变更都从 `openspec/changes/` 中的提案开始
- TDD 是强制性的：RED → GREEN → REFACTOR
- 没有 `docs/designs/` 中的设计文档就不写代码
- 在宣布完成前用测试验证
