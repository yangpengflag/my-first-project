# spot-detail-engagement — Proposal

## Why

景点详情页（`frontend/app/spots/[slug]`）当前已有基础骨架：两列基础信息、周边景点、相关攻略、地图外链。但缺三项互动能力：**图片轮播**、**景点收藏按钮**、**景点评论**。

- 后端已建好 `SpotBookmark`（与帖子 `Bookmark` 分离），景点收藏接口齐备；但**景点评论后端完全缺失**。
- 前端评论/收藏组件当前硬编码帖子 `postId`，无法直接用于景点。

本 change 补全景点详情页「画廊 + 收藏 + 评论」三件套，并顺手把评论/收藏组件泛化为「按 `targetType` 注入 api」的复用形态，与团队既有的「帖子/景点分离」后端直觉保持一致（不引入统一多态单表方案）。

## Scope

**前端**
- 新建 `components/places/SpotGallery.tsx`：原生极简轮播（主图 + 缩略图 + 键盘/圆点导航，无第三方库，符合样式规约禁花哨动效）。
- 泛化收藏：抽 `useBookmark(targetType, targetId)` hook，`BookmarkButton` 退化为薄展示层，景点复用同一组件。
- 泛化评论：抽 `CommentThreadApi` 接口 + 公共 `CommentItem` 展示层；新建 `SpotCommentSection`（`components/places/`）复用。
- `SpotDetail` 接入画廊 / 收藏按钮 / 评论区；扩展 `spots/[slug]/page.test.tsx`。

**后端（镜像 `SpotBookmark` / `Comment` 套路，新增独立子系统）**
- `SpotComment` 实体 + `SpotCommentRepository` + `SpotCommentService` + `SpotCommentsController`：
  - `POST   /api/spots/{slug}/comments`
  - `GET    /api/spots/{slug}/comments`（顶层倒序分页，含 `reply_count`）
  - `GET    /api/spot-comments/{id}/replies`（独立回复端点）
  - `DELETE /api/spot-comments/{id}`
- 两层回复模型、软删级联、作者信息批量解析（`UserRepository`），照搬 `Comment` 体系。

## Out of Scope

- 不统一多态评论/收藏（不引入 `target_type`/`target_id` 单表方案）。
- 不改动帖子评论/收藏既有行为与契约（仅前端泛化复用，后端不动）。
- 不做城市详情页评论（仅景点）。
- 不做 CMS / 编辑后台、不做交互式地图。

## Impact

- 后端新增 `places` 包下 `comment` 子系统（实体/仓储/服务/控制器/异常），复用 `UserRepository` 解析作者。
- 前端新增 `components/places/SpotGallery.tsx`、`components/places/SpotCommentSection.tsx`、`lib/spot-comments/{api,types,messages}.ts`、`lib/spot-bookmarks/api.ts`；改造 `BookmarkButton` 与 `CommentItem`/`CommentSection` 为可注入。
- 依赖 `api-spots` 已合并、`SpotBookmark` 已存在（真实后端，非 mock）。
- 独立 change，不并入 `places-ingestion`（后者是后端数据摄取）。

## 已确认决策

- 景点评论：**镜像分离模式**（新增后端 `SpotComment`，前端复用 `CommentItem` 展示层）。
- 收藏复用：**抽 `useBookmark(targetType, targetId)` hook**（改 `BookmarkButton` 为薄展示层）。
- 轮播：**原生极简，无第三方库**。
- `SpotCommentSection` 落点：**`components/places/`**（与 `SpotCard` 同级，便于后续复用）。
