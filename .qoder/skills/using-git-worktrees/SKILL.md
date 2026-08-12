---
name: using-git-worktrees
description: 当需要同时处理多个分支而不切换当前工作目录时使用
---

# 使用 Git Worktrees

## 概述

Git worktrees 允许你同时检出多个分支到不同的目录，无需切换当前工作目录。

**核心原则：** 并行工作、隔离环境、高效切换。

## 何时使用

**适用场景：**
- 需要在多个分支间快速切换
- 同时修复多个 bug
- 审查 PR 时不影响当前工作
- 并行开发多个功能

## 基本命令

### 添加 worktree

```bash
# 创建新分支并检出
git worktree add ../feature-branch feature-branch

# 检出已有分支
git worktree add ../existing-branch existing-branch

# 分离 HEAD 模式（临时工作）
git worktree add --detach ../temp-work
```

### 列出 worktrees

```bash
git worktree list
```

### 移除 worktree

```bash
# 先删除目录
rm -rf ../feature-branch

# 然后清理
git worktree prune
```

### 在 worktree 中工作

```bash
cd ../feature-branch
# 正常工作：修改、提交、推送
git add .
git commit -m "fix: ..."
git push
```

## 工作流程

### 场景 1：并行修复多个 bug

```bash
# 主工作目录
cd ~/project
git checkout main

# 创建 bug 修复 worktrees
git worktree add ../bugfix-1 bugfix-1
git worktree add ../bugfix-2 bugfix-2

# 在不同目录并行工作
cd ../bugfix-1
# 修复 bug 1...

cd ../bugfix-2
# 修复 bug 2...
```

### 场景 2：审查 PR

```bash
# 创建 PR 分支的 worktree
git worktree add ../pr-review pr-branch-name

cd ../pr-review
# 审查代码、运行测试
# 不影响主工作目录
```

### 场景 3：紧急修复

```bash
# 正在开发功能时接到紧急任务
git worktree add ../hotfix hotfix-branch

cd ../hotfix
# 快速修复、部署

# 完成后清理
cd ~/project
rm -rf ../hotfix
git worktree prune
```

## 注意事项

- worktree 共享 `.git` 目录
- 不能同时检出同一分支到多个 worktree
- 删除 worktree 前先确保工作已提交
- 定期运行 `git worktree prune` 清理

## 常见问题

| 问题 | 解决方案 |
|------|----------|
| "branch already checked out" | 使用不同分支名或 --detach |
| worktree 路径冲突 | 使用唯一目录名 |
| 清理残留 worktree | `git worktree prune` |
