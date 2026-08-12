---
name: openspec-archive-change
description: 归档已完成的变更
---

# OpenSpec 归档变更

## 概述

将已完成的变更归档到 archive 目录。

## 流程

1. 确认变更已完成
2. 移动到 archive 目录：
   ```bash
   mv openspec/changes/<change-name> openspec/changes/archive/
   ```
3. 更新索引（如需要）
