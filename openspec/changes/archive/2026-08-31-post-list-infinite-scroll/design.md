## Context

`post-list-stats-and-pagination`（2026-08-31 归档）已落地：列表带 `comment_count`/`up_vote_count`/`bookmark_count`，支持 `latest`(cursor)/`top`(offset)/`most_commented`(offset) 排序与四态。当前翻页为「上一页/下一页」按钮。本 change 是其 follow-up，目标：现代无限滚动体验 + 统计行格式化打磨。

探索期已确认：前端生成类型 `PostListResponse` 已含 `page`/`size`/`total`（`api.generated.ts:564-568`），后端 `PostListResponse.offset()` 硬编码 `has_more=false`（`PostListResponse.java:58`），`PostService.listPublished`/`listMine` 对 `top`/`most_commented` 走该工厂（`PostService.java:95`）。因此 Option B（统一 UI + 按 sort 分支分页、零新增端点）可行；且 offset 的 `has_more` 应以后端修正为准（见 D1）。

## Goals / Non-Goals

**Goals:**
- 无限滚动：`IntersectionObserver` 触底续拉，`latest` 走 cursor、`top`/`most_commented` 走 offset；追加态 3 张骨架 + 「已经到底啦」。
- 统计行格式化：hide-0 + `k` 紧凑；保留 lucide 图标。
- 排序 Tab 文案：`最新 / 最热 / 最多讨论`。
- 后端 1 行修复 offset `has_more`，顺手修掉当前 offset 分页按钮失效的潜在 bug。

**Non-Goals:**
- 不改 API 契约（无新端点/字段）。
- 不引入虚拟列表 / 分页动画（`styling-conventions` 禁花哨动效）。
- 不做「回到顶部 / 跳页」等无限滚动之外的导航。
- 不处理 `>1e6` 的 `M` 单位（按决策只到 `k`）。

## Decisions

### D1. 后端修正 offset `has_more`（1 行，B-back）
`PostListResponse.offset(...)` 由硬编码 `false` 改为：
```java
public static PostListResponse offset(List<PostSummary> items, int page, int size, long total) {
    boolean hasMore = (long) page * size < total;
    return new PostListResponse(items, null, hasMore, page, size, total);
}
```
**理由**：`has_more` 在契约中本就表示「是否还有下一页」；此前恒为 `false` 既是语义失真，也导致前端（含当前按钮翻页）无法判断 offset 是否到底。改后跨模式语义统一，前端可无脑消费 `has_more`，且白捡当前 offset 分页按钮失效的修复。**非契约变更**（字段不变）。
**备选**：前端自行用 `page*size<total` 推算 → 拒绝，会让 `has_more` 字段在 offset 下长期失真、前端需分支，且不修当前按钮 bug。

### D2. 前端状态模型改为累积
弃用整体替换的 `data.items`，改为：
- `items: PostSummary[]` 累积数组。
- `loadFirst(targetSort)`：`setItems(data.items)`（替换）。
- `loadMore()`：`setItems(prev => [...prev, ...data.items])`（追加）。
- 新状态：`loadingInitial` / `loadingMore` / `loadMoreError`（行内重试，不丢列表）/ `endReached`（`has_more=false && items.length>0` → 显示「已经到底啦」）/ `empty` / `error`（首屏）。
- 移除 `goPrev` 与 `cursorStack`（无限滚动不再回退）。
- **排序切换必须同步清空**：`useEffect([sort])` 内先 `setItems([])` + `setLoadingInitial(true)` 再 `loadFirst`，避免上一种排序的卡片在重拉期间残留闪烁。

### D3. `IntersectionObserver` 触底续拉
- 底部稳定 sentinel `<div data-testid="post-list-sentinel" />`；仅在内容态且 `has_more` 时渲染（用稳定 ref，observer 只创建一次）。
- **用 ref 镜像状态，杜绝闭包陈旧**：observer 回调只读 `loadingRef.current` / `hasMoreRef.current`，不直接读 state。
  ```ts
  const ioRef = useRef<IntersectionObserver | null>(null);
  const loadingRef = useRef(false);
  const hasMoreRef = useRef(false);
  // 回调：const e = entries[0]; if (!e.isIntersecting || loadingRef.current || !hasMoreRef.current) return; loadMore();
  // loadMore 成功后：if (hasMoreRef.current) { ioRef.current?.unobserve(sentinel); ioRef.current?.observe(sentinel); } // 强制重判
  ```
- **sentinel 持续在视口内也要续拉**：append 后若 sentinel 从未离开视口，IO 不会再 fire（只在交叉状态变化时触发）。故 `loadMore` 成功后若仍 `hasMore`，执行 `unobserve`→`observe` 同节点，浏览器会再次异步回调当前状态，从而续拉直到 `has_more=false`。
- `endReached` 时 `ioRef.current?.disconnect()`。
- 分支：`isCursor = sort==='latest'` → `list({sort, cursor: nextCursor, size})`；否则 `list({sort, page: page+1, size})`。
- **测试桩要求**：mock 的 `IntersectionObserver` 须支持 `observe` 后再次回调（以覆盖 re-observe 续拉场景），并提供 `triggerIntersect(isIntersecting)` 手动触发。

### D4. `formatCount`
`lib/posts/format.ts` 新增：
```ts
export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "";
  if (n < 1000) return String(n);
  const k = n / 1000;
  const s = (k >= 100 ? k.toFixed(0) : k.toFixed(1)).replace(/\.0$/, "");
  return `${s}k`;
}
```
`PostCard` 统计行：每项仅当 `count > 0` 渲染，数字走 `formatCount`；保留 lucide 图标（`ThumbsUp`/`MessageSquare`/`Bookmark`）；三项皆 0/undefined 时整行隐藏。按决策只到 `k`：`1234→"1.2k"`、`1500→"1.5k"`、`1234567→"1235k"`。

### D5. 排序 Tab 文案
`最新(latest)` / `最热(top)` / `最多讨论(most_commented)`，纯 label 变更，`value` 不变；当前项品牌色 `blue-700` 高亮（沿用 `Button variant="default"`）。

### D6. 约定合规
遵循 `styling-conventions.md` 与 `frontend-conventions.md`：
- 图标统一 lucide（`styling-conventions.md:114`），不混用 emoji。
- 骨架用 shadcn `<Skeleton>`；追加态精确 3 张卡片。
- 不引入 fade/slide 动效（无限滚动无需动画）。
- 响应式网格 `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` 保持不变。
- **固定 `data-testid` 命名**（实现与测试统一，禁止各写各的）：
  - `post-list-loading`（首屏骨架，沿用既有）/ `post-list-sentinel`（底部哨兵）/ `post-list-loading-more`（追加态 3 张骨架容器）/ `post-list-end`（「已经到底啦」）/ `post-list-loadmore-error`（追加失败行内区）。
  - `PostCard` 各统计项：`stat-comments` / `stat-upvotes` / `stat-bookmarks`（仅当 `count>0` 渲染）。
- **a11y**：「已经到底啦」容器加 `role="status" aria-live="polite"`，便于屏幕阅读器播报；加载态骨架已有语义。

## Risks / Trade-offs

- **IO 闭包陈旧 / 不续拉**：observer 只建一次，回调须读 `loadingRef`/`hasMoreRef` 而非 state；sentinel 持续在视口内不会再 fire，需 `loadMore` 成功后 `unobserve`→`observe` 强制重判（见 D3）。
- **jsdom 无 `IntersectionObserver`** → 测试桩 mock（可手动 `triggerIntersect`）。
- **后端 `has_more` 由恒 `false` 改为正确值** → 既有断言 offset `has_more=false` 的测试须同步更新（若有）。
- **移除 prev/next 按钮** → 既有 `PostList.test` 按钮相关断言须删除。
- **短列表场景**：sentinel 入视口会立即续拉，靠 `loadingMore` 串联直至 `has_more=false`，可接受。

## Migration Plan

1. 后端：改 `offset()` 1 行 + 补测试 → `mvn test` posts 包全绿。
2. 前端：`formatCount` + `PostCard` 渲染 + `PostList` 累积态/IO 重构 + 排序文案；更新 Vitest（mock IO、补格式化与滚动断言、删旧按钮断言）。
3. 验证：`openapi:drift`（无字段变更，预期无漂移）、`type-check`、`npm test`、`npm run build` 全绿。

## Open Questions

无（决策已锁定：B-back、formatCount 仅到 `k`、保留 lucide 图标）。
