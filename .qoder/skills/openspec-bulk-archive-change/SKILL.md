---
name: openspec-bulk-archive-change
description: 批量归档多个已完成的变更
---

# OpenSpec 批量归档

## 概述

一次性归档多个已完成的变更。

## 流程

1. 列出所有已完成的变更
2. 批量移动到 archive：
   ```bash
   mv openspec/changes/<completed-*> openspec/changes/archive/
   ```
3. 验证归档成功
