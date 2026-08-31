## Why

公开列表与"我的帖子"当前只返回基础帖子字段，前端卡片无法显示点赞 / 评论 / 收藏数，也不支持按热度排序与高效翻页；用户已能在帖子详情页互动（vote / comment / bookmark），但列表侧缺少这些聚合信号，体验割裂。现 `add-posts-delete-and-tags-json` 合并在即，正是统一增强列表读取能力（互动统计 + cursor/offset 混合分页 + 排序）的时机。

## What Changes

- **`PostSummary` 增强**：在现有字段基础上追加 `comment_count` / `up_vote_count` / `bookmark_count`（snake_case），通过聚合查询实时获取，**不在 `Post` 实体冗余存储**。
  - `comment_count`：含该帖全部评论（含回复）且排除软删。
  - `up_vote_count`：仅计 `vote_type = 'UP'`（忽略 DOWN）。
  - `bookmark_count`：有效收藏数（取消走物理删行，天然有效）。
- **统一分页信封 `PostListResponse`**：始终返回 `items` / `next_cursor` / `has_more`；offset 模式额外返回 `page` / `size` / `total`。
- **混合分页**：
  - `sort=latest`（默认）：基于 `created_at` 的 **cursor** 分页，返回 `next_cursor` 供下一页。
  - `sort=top`（`up_vote_count` DESC）/ `sort=most_commented`（`comment_count` DESC）：回退 **offset** 分页（`cursor` 参数忽略），返回 `page` / `size` / `total`。
  - 默认 `size=20`，上限 `size=100`（与 `api-conventions` 对齐，原 posts spec 的 50 上限提升）。
- **聚合查询**：列表查询 `LEFT JOIN comments / votes / bookmarks` 并 `GROUP BY post.id`，在 SQL 层 `ORDER BY` 计数，确保排序与分页精确（Post 模块读取其它模块表，有意打破模块边界）。
- **`listMine`（我的帖子）同步增强**：同样带三统计字段，与公开列表保持一致。
- 扩展 `api-conventions` 分页响应格式，收录 `next_cursor` / `has_more` 字段（同步 `.qoder` 镜像）。

## Capabilities

### New Capabilities

- 无新增 capability。互动统计、排序与混合分页属于 `posts` 列表读取行为的一部分，不单列。

### Modified Capabilities

- `posts`：修改"公开帖子列表""我的帖子"两项 Requirement（新增统计字段、排序参数、cursor/offset 混合分页与统一信封），并扩展"响应安全边界"白名单以纳入三个新字段。

## Impact

- **后端**（`backend/`）：
  - `PostRepository` 新增 native 聚合查询（JOIN + GROUP BY + 动态排序 + cursor/offset）。
  - `PostService.listPublished` / `listMine` 重构：组装 `PostStatsView` → 批量解析作者 → 映射 `PostSummary`（带计数）→ 构造 `PostListResponse`。
  - 新增 `PostStatsView`（native 结果映射）、`PostListResponse` 信封 DTO。
  - 控制器 `GET /api/posts`、`GET /api/posts/me` 增加 `sort` / `cursor` / `offset(page,size)` 参数。
- **前端**（`frontend/`）：
  - `types.ts` / 生成的 `api.generated.ts`：`PostSummary` 加三字段；`PagePostSummary` 演进为 `PostListResponse`（替换 `content` 为 `items` + `next_cursor`/`has_more`/`page`/`size`/`total`）。
  - `PostCard` 底部加统计行（lucide `MessageSquare` / `ThumbsUp` / `Bookmark` + `text-sm text-slate-500`）。
  - `PostList` 加排序切换（最新 / 最多点赞 / 最多评论）；`latest` 走游标翻页，其余走页码翻页；保留四态。
  - 重跑 `openapi:sync` + `openapi:gen`（需后端起在 8080）刷新契约。
- **约定文档**：`.codebuddy/rules/api-conventions.md` 与 `.qoder/rules/api-conventions.md` 分页响应格式扩展 `next_cursor` / `has_more`。
- **依赖与排期**：本 change 的代码实现须等 `add-posts-delete-and-tags-json`（同样修改 `PostService` / `PostSummary`）合并后再启动，避免同文件冲突。OpenSpec 文档（proposal/design/tasks/spec delta）可先行产出。
