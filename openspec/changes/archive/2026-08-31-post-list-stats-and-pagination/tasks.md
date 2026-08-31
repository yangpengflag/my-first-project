# 实现任务清单

> **前置门禁（必须先满足）**：本 change 与 `add-posts-delete-and-tags-json` 同改 `PostService` / `PostSummary`，须确认后者已合并入 `main` 后再启动以下实现任务，避免同文件冲突。OpenSpec 文档（proposal/design/specs/tasks）已先行产出，不受此限。

## 0. 前置确认

- [x] 0.1 确认 `add-posts-delete-and-tags-json` 已合并，且 `backend/` 当前 `main` 已含其改动（软删 + tags JSON）

## 1. 后端：测试先行（RED）

- [x] 1.1 写 `PostRepository` 聚合查询单测（@SpringBootTest + 真实 MySQL 8.0.34）：验证 `comment_count` 含回复且排除软删、`up_vote_count` 仅计 UP、`bookmark_count` 有效数；验证 cursor（latest）翻页与 offset（top/most_commented）分页
- [x] 1.2 写 `PostService` 单测：列表返回 `PostListResponse` 信封 + 三计数 + 排序映射 + 作者批量解析（含作者软删回退）
- [x] 1.3 写 Controller 集成测试：`GET /api/posts?sort=latest&cursor=...`、`?sort=top&page=2&size=10`、size 超限截断为 100、`GET /api/posts/me` 带统计

## 2. 后端：实现（GREEN）

- [x] 2.1 新增 `PostStatsView`（含 `Post` 实体 + `commentCount` / `upVoteCount` / `bookmarkCount`）与 `PostListResponse` 信封 DTO（`items` / `nextCursor` / `hasMore` / `page` / `size` / `total`）
- [x] 2.2 `PostSummary` 增加三计数字段并重写 `from(...)` 携带计数
- [x] 2.3 `PostRepository` 新增 native 聚合查询：相关子查询分别聚合 comments/votes/bookmarks 的计数（避免多表 JOIN 叉乘膨胀）+ 动态排序 + 显式 `deleted=false`；cursor 形态加 `(created_at,id) < (cur_ts,cur_id)` 且 `LIMIT size+1`，offset 形态用 `LIMIT size OFFSET (page-1)*size`
- [x] 2.4 `PostService.listPublished` 重构：聚合查询 → 批量解析作者 → 映射 `PostSummary`（带计数）→ 构造 `PostListResponse`（latest 用 cursor，其余用 offset + `countByStatusAndDeletedFalse` 取 total）
- [x] 2.5 `PostService.listMine` 同步增强：同样带三计数、排序与统一信封
- [x] 2.6 控制器 `GET /api/posts`、`GET /api/posts/me` 增加 `sort`（`latest`/`top`/`most_commented`，默认 latest）/`cursor`/`page`/`size` 参数；`sort≠latest` 忽略 `cursor`

## 3. 前端：测试先行（RED）

- [x] 3.1 写 `PostCard` 渲染测试：底部出现统计行（评论/点赞/收藏数与 lucide 图标）
- [x] 3.2 写 `PostList` 测试：排序切换、latest 走游标翻页、top/most_commented 走页码翻页、四态（loading/content/empty/error）覆盖

## 4. 前端：实现（GREEN）

- [x] 4.1 后端起服后 `npm run openapi:sync` + `openapi:gen`：`api.generated.ts` 演进为 `PostListResponse`（含 `items`/`next_cursor`/`has_more`/`page`/`size`/`total`），`PostSummary` 加三字段；`lib/posts/types.ts` 由其派生
- [x] 4.2 `PostCard` 底部加统计行（lucide `MessageSquare` / `ThumbsUp` / `Bookmark` + `text-sm text-slate-500`）
- [x] 4.3 `PostList` 加排序切换（最新 / 最多点赞 / 最多评论），`latest` 用 `next_cursor` 游标翻页、其余用 `page`/`size` 页码翻页，保留四态

## 5. 约定文档与契约同步

- [x] 5.1 扩展 `.codebuddy/rules/api-conventions.md` 与 `.qoder/rules/api-conventions.md` 分页响应格式，补 `next_cursor` / `has_more` / `page` / `size` / `total` 说明与 `sort`/`cursor`/`page`/`size` 参数
- [x] 5.2 `npm run openapi:drift`（需后端 :8080）校验契约无漂移（首次漂移：进仓快照过期 → 已 `openapi:sync`+`openapi:gen` 重新生成 `openapi/openapi.json` 与 `lib/api.generated.ts`，`type-check` 通过，drift 转绿）

## 6. 验证

- [x] 6.1 后端 `mvn test` 全绿（posts 包 25/25 通过）
- [x] 6.2 前端 `type-check` 通过；`npm test` 全量实跑通过（21 文件 / 150 用例，含 `lib/posts/api.test.ts`、`PostCard.test.tsx`、`PostList.test.tsx`）；`build` 仍待本地复核
- [x] 6.3 `openapi:drift` 通过（见 5.2）
