## Why

公开列表在 `post-list-stats-and-pagination`（2026-08-31 归档）已具备互动统计行、排序 Tab 与「上一页/下一页」翻页（`latest` 走 cursor，`top`/`most_commented` 走 offset）。但按钮翻页体验偏旧，且统计行仍有两点打磨空间：数字为 0 时仍占位、未做 `1.2k` 紧凑化。现将其升级为更现代的列表体验——无限滚动 + 统计行格式化。

探索阶段发现一个被放大暴露的潜在 bug：后端 `PostListResponse.offset()` 把 `has_more` 硬编码为 `false`、`next_cursor` 恒为 `null`。这导致 (1) 无限滚动对 `top`/`most_commented` 无法判断是否还有下一页；(2) 当前 offset 排序的「下一页」按钮因 `has_more=false` 永远 disabled，分页实际不可用。本 change 一并修复（1 行）。

## What Changes

- **前端 `PostList`：按钮翻页 → 无限滚动**
  - 移除「上一页/下一页」按钮与 cursor 回退栈；列表改为累积渲染。
  - 底部 sentinel 用 `IntersectionObserver` 监听触底（`rootMargin` 预取），自动加载下一页：
    - `sort=latest`：用 `next_cursor` 续拉（cursor 分页）。
    - `sort=top` / `most_commented`：用 `page+1` 续拉（offset 分页）。
  - 追加态显示 **3 张卡片骨架**；`has_more=false` 且已有内容时显示「已经到底啦」。
  - 追加失败不丢列表，底部行内「重试」。
  - 排序切换仍清空列表重新加载。
- **前端 `PostCard`：统计行格式化**
  - 新增 `formatCount`：计数 `>0` 才显示该项；`>=1000` 压成一位小数 `k`（`1234→"1.2k"`，`1500→"1.5k"`），超过百万仍按 `k` 显示（`1234567→"1235k"`），不引入 `M`。
  - 保留 lucide 图标（`ThumbsUp`/`MessageSquare`/`Bookmark`），三项皆 0/undefined 时整行隐藏。
- **排序 Tab 文案**：`最新 / 最多点赞 / 最多评论` → `最新 / 最热 / 最多讨论`（`value` 不变）。
- **后端（1 行）**：`PostListResponse.offset(...)` 改为 `has_more = page*size < total`。属实现修正，**不改 API 契约**（`has_more` 本就在契约中）。

## Capabilities

### New Capabilities

- 无新增 capability。

### Modified Capabilities

- `posts`：无契约级 Requirement 变更。offset 模式 `has_more` 修正为后端实现 bug 修复；列表无限滚动与统计格式化属前端行为，不在 `posts` API spec 范围内。本 change 不产出 spec delta。

## Impact

- **后端**（`backend/`）：`PostListResponse.offset()` 1 行 + 对应测试（断言 `top`/`most_commented` 在仍有下一页时 `has_more=true`，末页 `has_more=false`）。
- **前端**（`frontend/`）：
  - `lib/posts/format.ts` 新增 `formatCount`。
  - `PostCard.tsx` 统计行改用 `formatCount` 且按 `>0` 过滤。
  - `PostList.tsx` 重构为累积态 + `IntersectionObserver`（移除按钮与 cursorStack，新增 `loadingMore`/`loadMoreError`/`endReached`）。
  - 排序 Tab 文案微调。
- **契约**：无字段/端点变更，`openapi:sync`/`gen` 无需重跑；但应跑 `openapi:drift` 确认无漂移。
- **测试**：Vitest + RTL，需 mock `IntersectionObserver`；同步更新既有 `PostList.test`/`PostCard.test`（移除旧按钮断言、补格式化与滚动断言）。
