# 自定义子代理

本目录存放自定义子代理定义文件。

## 用途

子代理是专门化的 AI 代理，用于处理特定类型的任务。每个代理文件定义：
- 代理名称和描述
- 可用的工具
- 行为规范

## 文件结构

```
agents/
├── README.md          # 本文件
└── <agent-name>.md    # 代理定义文件
```

## 示例

```markdown
---
name: code-reviewer
description: 专业代码审查代理
tools:
  - read_file
  - search_codebase
---

# 代码审查代理

专注于代码质量审查，检查：
- 逻辑错误
- 安全漏洞
- 性能问题
- 代码规范
```

## 当前状态

暂无自定义代理定义。

## 参考

- Qoder 文档：自定义子代理配置
- 内置代理：Browser, CodeReview, ComputerUse
