## Context

`posts` 列表当前返回 `Page<PostSummary>`（Spring Data 分页），无互动统计、无排序、无游标。详情页已具备 vote / comment / bookmark 互动能力（分属 `votes` / `comments` / `bookmarks` 模块），但列表侧读不到这些信号。聚合依据现状：

- `Comment` / `Vote` / `Bookmark` 均 `extends BaseEntity`、持 `post_id` UUID 列（**非 `@ManyToOne` 关联**），表名 `comments` / `votes` / `bookmarks`。
- 全局软删 `@Where` 未启用（见 `PostRepository` 注释），故所有 JOIN 必须显式 `AND x.deleted = false`，正好支撑 `comment_count` 不含软删。
- `Vote` / `Bookmark` 取消走**物理删除行**，行数即有效数。
- `api-conventions` 分页响应为 `{ items, total, page, size }`，且已声明 `最大 size=100`；故把 posts spec 原 50 上限提升到 100 正好对齐。

本 change 与 `add-posts-delete-and-tags-json`（同样改 `PostService` / `PostSummary`）存在同文件冲突，代码实现须在其合并后启动（见 Migration）。

## Goals / Non-Goals

**Goals:**
- 列表（公开 + 我的）实时带 `comment_count` / `up_vote_count` / `bookmark_count`，不冗余存储。
- 提供 `latest`（cursor）/ `top` / `most_commented`（offset）排序与混合分页，统一信封。
- 与 `api-conventions` 对齐（size 上限 100、信封扩展 `next_cursor` / `has_more`）。

**Non-Goals:**
- 不在 `Post` 实体加冗余计数列（user 明确禁止）。
- 不改详情接口（`PostResponse` 已通过独立端点暴露互动数）。
- 不引入 QueryDSL / jOOQ 等额外依赖；保持 Spring Data JPA 栈。
- 不做服务间 RPC；所有聚合在同一 DB 内单条 SQL 完成。

## Decisions

### D1. 聚合查询用 native SQL（打破模块边界但单库单查询）
`PostRepository` 新增 native 查询，一次性 `LEFT JOIN comments / votes / bookmarks` + `GROUP BY p.id` + 动态 `ORDER BY`：
```sql
SELECT p.*,
       COUNT(c.id) AS comment_count,
       COALESCE(SUM(CASE WHEN v.vote_type='UP' THEN 1 ELSE 0 END),0) AS up_vote_count,
       COUNT(b.id) AS bookmark_count
FROM posts p
LEFT JOIN comments  c ON c.post_id=p.id AND c.deleted=false
LEFT JOIN votes     v ON v.post_id=p.id AND v.deleted=false
LEFT JOIN bookmarks b ON b.post_id=p.id AND b.deleted=false
WHERE p.status='PUBLISHED' AND p.deleted=false
  -- cursor 模式追加: AND (p.created_at, p.id) < (:cur_ts, :cur_id)
GROUP BY p.id
ORDER BY <sortKey> DESC, p.created_at DESC, p.id DESC
-- cursor: LIMIT :size+1 ; offset: LIMIT :size OFFSET (:page-1)*:size
```
**理由**：`Comment/Vote/Bookmark` 无 `@ManyToOne(Post)`，JPQL 无法基于 `post_id` 列做跨实体 JOIN，故选 native SQL。返回结果映射到 `PostStatsView`（含 `Post` 实体 + 三计数）。
**备选**：
- 每帖分别 `countByPostId`（N+1）→ 拒绝，列表放大明显。
- `Post` 实体加计数列 → 拒绝，违反"不冗余存储"。
- JPA Criteria / QueryDSL → 更重，且无关联路径可 JOIN，收益不抵成本。

### D2. 统一信封 `PostListResponse`
```
{ "items": PostSummary[], "next_cursor": string|null, "has_more": bool,
  "page": int?, "size": int?, "total": long? }
```
始终返回 `items/next_cursor/has_more`；offset 模式额外返回 `page/size/total`。前端一套解析，后端按模式填空。
**同步 `.codebuddy/rules/api-conventions.md` 与 `.qoder/rules/api-conventions.md`**，在"分页响应格式"中补 `next_cursor` / `has_more` 说明（SHOULD 级）。

### D3. cursor 仅 `latest`，编码为可逆不透明令牌
- 仅 `sort=latest` 启用：`cursor = base64(createdAtISO + "|" + id)`，服务端解码后按 `(created_at, id) < (cur_ts, cur_id)` 截断，`ORDER BY created_at DESC, id DESC`，`LIMIT size+1` 判 `has_more`。
- `sort∈{top, most_commented}` 忽略 `cursor`，回退 offset，`LIMIT size OFFSET (page-1)*size`。
**理由**：created_at 非唯一需 id 兜底保证游标稳定；base64 可逆、无服务端状态，简单可靠。
**备选**：服务端存游标会话（有状态）→ 拒绝，增加复杂度。

### D4. offset 模式 total 单独计数
`total` = PUBLISHED 总数，与排序无关，用既有 `countByStatusAndDeletedFalse(PUBLISHED)` 直取，避免 Spring 对 GROUP BY + 聚合推导 count 的坑。

### D5. 统计口径（已与用户锁定）
- `comment_count`：该帖**全部**评论（含回复）且排除软删（JOIN 加 `c.deleted=false`，不限定 `parent_comment_id`）。
- `up_vote_count`：仅 `vote_type='UP'`（忽略 DOWN）。
- `bookmark_count`：有效收藏（JOIN 加 `b.deleted=false` 兜底）。
- `listMine` 同样返回三字段，与公开列表一致。

### D6. 排序参数名
`?sort=latest|top|most_commented`（非裸字段名），默认 `latest`。`size` 默认 20、上限 100。

## Risks / Trade-offs

- **模块边界被打破**（Post 读 votes/comments/bookmarks 表）→ 接受；同库单 SQL，无跨服务调用。缓解：聚合理逻辑收敛在 `PostRepository` 单一方法，配单测覆盖口径。
- **native SQL 与方言绑定** → 使用标准 SQL（`(a,b) < (x,y)` 行值比较在 MySQL / PostgreSQL / H2 均支持）；测试用 H2 验证。
- **软删语义依赖显式过滤** → 所有 JOIN 的 `deleted=false` 必须保留，已在 SQL 模板固化。
- **API 契约破坏性变更**（信封由 `Page` 换 `PostListResponse`）→ 前后端同 PR 推进；靠 `openapi:drift` 卡住过期前端类型。
- **与 in-progress change 冲突** → 代码实现推迟到 `add-posts-delete-and-tags-json` 合并后；本 change 的 OpenSpec 文档先行。

## Migration Plan

1. 后端：新增 `PostStatsView` + `PostListResponse`；`PostRepository` 加 native 聚合方法；`PostService.listPublished` / `listMine` 重构；`PostSummary.from` 扩展三参数；控制器加 `sort` / `cursor` / `page` / `size`。
2. 后端契约：`mvn` 起服 → `npm run openapi:sync`（刷新 `frontend/openapi/openapi.json`）→ `npm run openapi:gen`。
3. 前端：`types.ts` / `api.generated.ts` 演进（`PagePostSummary` → `PostListResponse`，`PostSummary` 加三字段）；`PostCard` 加统计行；`PostList` 加排序切换 + 游标/页码翻页；保留四态（loading/content/empty/error）。
4. 文档：扩展 `api-conventions.md`（双 harness 镜像）。
5. 回滚：同时 revert 后端与前端 PR 即可，无 schema 迁移。

## Open Questions

无（所有设计岔路与次级决策均已在 explore 阶段与用户锁定）。
